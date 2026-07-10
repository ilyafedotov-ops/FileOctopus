use std::collections::HashSet;
use std::ffi::{OsStr, OsString};
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Component, Path, PathBuf};

use cap_fs_ext::{DirExt, FollowSymlinks, OpenOptionsFollowExt};
use cap_std::ambient_authority;
use cap_std::fs::{Dir, OpenOptions};
use jobs::{CancellationToken, JobId, PauseToken};
use sha2::{Digest, Sha256};
use vfs::{
    ConflictPolicy, FileKind, FileOperationError, FileOperationItem, FileOperationPlan, ResourceUri,
};
use zip::write::SimpleFileOptions;

use super::execution::{check_cancelled, resolve_conflict_path, ExecutionProgress};
use super::paths::map_std_io_error;
use super::FileOperationEventSink;

#[derive(Clone, Copy)]
pub(super) enum ArchiveFormat {
    Zip,
    Tar,
    TarGz,
    TarBz2,
}

const ARCHIVE_FINGERPRINT_SEPARATOR: &str = ":archive-sha256:";
const MAX_ARCHIVE_SOURCE_BYTES: u64 = 100 * 1024 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES: u64 = 100_000;
const MAX_ARCHIVE_ENTRY_BYTES: u64 = 16 * 1024 * 1024 * 1024;
const MAX_ARCHIVE_EXPANDED_BYTES: u64 = 100 * 1024 * 1024 * 1024;
const MAX_ARCHIVE_COMPRESSION_RATIO: u64 = 1_000;
const MAX_ARCHIVE_PATH_BYTES: usize = 4_096;
const MAX_ARCHIVE_PATH_DEPTH: usize = 128;
const ARCHIVE_COPY_BUFFER_SIZE: usize = 64 * 1024;

pub(super) struct ArchiveManifestEntry {
    pub relative_path: PathBuf,
    pub size: u64,
}

pub(super) struct ArchiveInspection {
    pub fingerprint: String,
    pub entries: Vec<ArchiveManifestEntry>,
}

#[derive(Clone, Copy)]
enum ArchiveEntryKind {
    File,
    Directory,
}

struct ArchiveBudget {
    source_bytes: u64,
    entry_count: u64,
    expanded_bytes: u64,
    seen_paths: HashSet<PathBuf>,
}

impl ArchiveBudget {
    fn new(source_bytes: u64) -> Self {
        Self {
            source_bytes,
            entry_count: 0,
            expanded_bytes: 0,
            seen_paths: HashSet::new(),
        }
    }

    fn observe(
        &mut self,
        path: &Path,
        kind: ArchiveEntryKind,
        size: u64,
        compressed_size: Option<u64>,
    ) -> Result<PathBuf, FileOperationError> {
        self.entry_count = self
            .entry_count
            .checked_add(1)
            .ok_or_else(|| invalid_archive("archive entry count overflowed the supported limit"))?;
        if self.entry_count > MAX_ARCHIVE_ENTRIES {
            return Err(invalid_archive(format!(
                "archive contains more than {MAX_ARCHIVE_ENTRIES} entries"
            )));
        }

        let relative_path = validate_archive_relative_path(path)?;
        if !self.seen_paths.insert(relative_path.clone()) {
            return Err(invalid_archive(format!(
                "archive contains duplicate entry `{}`",
                relative_path.display()
            )));
        }

        if matches!(kind, ArchiveEntryKind::Directory) {
            if size != 0 {
                return Err(invalid_archive(format!(
                    "archive directory `{}` declares non-zero content",
                    relative_path.display()
                )));
            }
            return Ok(relative_path);
        }

        if size > MAX_ARCHIVE_ENTRY_BYTES {
            return Err(invalid_archive(format!(
                "archive entry `{}` exceeds the {MAX_ARCHIVE_ENTRY_BYTES}-byte limit",
                relative_path.display()
            )));
        }
        self.expanded_bytes = self.expanded_bytes.checked_add(size).ok_or_else(|| {
            invalid_archive("archive expanded size overflowed the supported limit")
        })?;
        if self.expanded_bytes > MAX_ARCHIVE_EXPANDED_BYTES {
            return Err(invalid_archive(format!(
                "archive expands beyond the {MAX_ARCHIVE_EXPANDED_BYTES}-byte limit"
            )));
        }
        enforce_compression_ratio(self.expanded_bytes, self.source_bytes, "archive")?;
        if let Some(compressed_size) = compressed_size {
            enforce_compression_ratio(size, compressed_size, &relative_path.display().to_string())?;
        }

        Ok(relative_path)
    }
}

pub(super) fn inspect_archive(path: &Path) -> Result<ArchiveInspection, FileOperationError> {
    let format = detect_archive_format(path)?;
    let (snapshot, fingerprint, source_bytes) = snapshot_archive(path)?;
    let entries = inspect_archive_snapshot(snapshot, format, source_bytes)?;

    Ok(ArchiveInspection {
        fingerprint,
        entries,
    })
}

pub(super) fn bind_archive_fingerprint(operation_id: String, fingerprint: &str) -> String {
    format!("{operation_id}{ARCHIVE_FINGERPRINT_SEPARATOR}{fingerprint}")
}

fn inspect_archive_snapshot(
    snapshot: File,
    format: ArchiveFormat,
    source_bytes: u64,
) -> Result<Vec<ArchiveManifestEntry>, FileOperationError> {
    let mut budget = ArchiveBudget::new(source_bytes);
    let mut manifest = Vec::new();

    match format {
        ArchiveFormat::Zip => {
            let mut archive = zip::ZipArchive::new(snapshot).map_err(|error| {
                FileOperationError::io(format!("failed to read archive: {error}"))
            })?;
            if archive.len() as u64 > MAX_ARCHIVE_ENTRIES {
                return Err(invalid_archive(format!(
                    "archive contains more than {MAX_ARCHIVE_ENTRIES} entries"
                )));
            }
            for index in 0..archive.len() {
                let entry = archive.by_index(index).map_err(|error| {
                    FileOperationError::io(format!("failed to read archive entry {index}: {error}"))
                })?;
                let mode_type = entry.unix_mode().map(|mode| mode & 0o170000).unwrap_or(0);
                let kind = if entry.is_dir() || mode_type == 0o040000 {
                    ArchiveEntryKind::Directory
                } else if mode_type == 0 || mode_type == 0o100000 {
                    ArchiveEntryKind::File
                } else {
                    return Err(unsupported_archive_type(entry.name()));
                };
                let relative_path = budget.observe(
                    Path::new(entry.name()),
                    kind,
                    entry.size(),
                    Some(entry.compressed_size()),
                )?;
                if matches!(kind, ArchiveEntryKind::File) {
                    manifest.push(ArchiveManifestEntry {
                        relative_path,
                        size: entry.size(),
                    });
                }
            }
        }
        ArchiveFormat::Tar => {
            inspect_tar_manifest(snapshot, &mut budget, &mut manifest, "tar")?;
        }
        ArchiveFormat::TarGz => {
            inspect_tar_manifest(
                flate2::read::GzDecoder::new(snapshot),
                &mut budget,
                &mut manifest,
                "tar.gz",
            )?;
        }
        ArchiveFormat::TarBz2 => {
            inspect_tar_manifest(
                bzip2::read::BzDecoder::new(snapshot),
                &mut budget,
                &mut manifest,
                "tar.bz2",
            )?;
        }
    }

    Ok(manifest)
}

fn inspect_tar_manifest<R: Read>(
    reader: R,
    budget: &mut ArchiveBudget,
    manifest: &mut Vec<ArchiveManifestEntry>,
    label: &str,
) -> Result<(), FileOperationError> {
    let mut archive = tar::Archive::new(reader);
    for entry_result in archive.entries().map_err(|error| {
        FileOperationError::io(format!("failed to read {label} archive: {error}"))
    })? {
        let entry = entry_result.map_err(|error| {
            FileOperationError::io(format!("failed to read {label} entry: {error}"))
        })?;
        let path = entry.path().map_err(|error| {
            FileOperationError::io(format!("failed to read {label} entry path: {error}"))
        })?;
        let entry_type = entry.header().entry_type();
        let kind = if entry_type.is_file() {
            ArchiveEntryKind::File
        } else if entry_type.is_dir() {
            ArchiveEntryKind::Directory
        } else {
            return Err(unsupported_archive_type(&path.display().to_string()));
        };
        let size = entry.size();
        let relative_path = budget.observe(&path, kind, size, None)?;
        if matches!(kind, ArchiveEntryKind::File) {
            manifest.push(ArchiveManifestEntry {
                relative_path,
                size,
            });
        }
    }

    Ok(())
}

pub(super) fn detect_archive_format(path: &Path) -> Result<ArchiveFormat, FileOperationError> {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default()
        .to_lowercase();
    if name.ends_with(".tar.gz") || name.ends_with(".tgz") {
        Ok(ArchiveFormat::TarGz)
    } else if name.ends_with(".tar.bz2") || name.ends_with(".tbz2") {
        Ok(ArchiveFormat::TarBz2)
    } else if name.ends_with(".tar") {
        Ok(ArchiveFormat::Tar)
    } else if name.ends_with(".zip") {
        Ok(ArchiveFormat::Zip)
    } else {
        Err(FileOperationError::InvalidRequest {
            message: format!("unsupported archive format: {name}"),
        })
    }
}

pub(super) fn execute_create_archive(
    plan: &FileOperationPlan,
    job_id: &JobId,
    cancel: &CancellationToken,
    pause: &PauseToken,
    sink: &FileOperationEventSink,
) -> Result<(), FileOperationError> {
    let destination =
        plan.destination
            .as_ref()
            .ok_or_else(|| FileOperationError::InvalidRequest {
                message: "create archive plan has no destination".to_string(),
            })?;
    let destination_path = destination.to_local_path()?;

    if destination_path.exists() && plan.conflict_policy == ConflictPolicy::Skip {
        return Ok(());
    }

    let destination_path = resolve_conflict_path(destination_path, plan.conflict_policy)?;

    if let Some(parent) = destination_path.parent() {
        fs::create_dir_all(parent).map_err(|error| map_std_io_error(parent, error))?;
    }

    let format = detect_archive_format(&destination_path)?;
    let mut progress = ExecutionProgress::new(plan);

    match format {
        ArchiveFormat::Zip => {
            let file = File::create(&destination_path)
                .map_err(|error| map_std_io_error(&destination_path, error))?;
            let mut archive = zip::ZipWriter::new(file);
            let options =
                SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

            for item in &plan.items {
                check_cancelled(cancel, pause, job_id)?;
                let source =
                    item.source
                        .as_ref()
                        .ok_or_else(|| FileOperationError::InvalidRequest {
                            message: "archive item has no source".to_string(),
                        })?;
                let source_path = source.to_local_path()?;
                let entry_name = archive_entry_name(plan, &source_path)?;

                archive.start_file(&entry_name, options).map_err(|error| {
                    FileOperationError::io(format!("failed to add file to archive: {error}"))
                })?;

                let mut input = File::open(&source_path)
                    .map_err(|error| map_std_io_error(&source_path, error))?;
                let copied = std::io::copy(&mut input, &mut archive).map_err(|error| {
                    FileOperationError::io(format!("failed to write file to archive: {error}"))
                })?;
                progress.completed_bytes += copied;
                progress.complete_item(item, job_id, sink);
            }

            archive.finish().map_err(|error| {
                FileOperationError::io(format!("failed to finalize archive: {error}"))
            })?;
        }
        ArchiveFormat::TarGz => {
            let file = File::create(&destination_path)
                .map_err(|error| map_std_io_error(&destination_path, error))?;
            let gz = flate2::write::GzEncoder::new(file, flate2::Compression::default());
            let mut archive = tar::Builder::new(gz);

            for item in &plan.items {
                check_cancelled(cancel, pause, job_id)?;
                let source =
                    item.source
                        .as_ref()
                        .ok_or_else(|| FileOperationError::InvalidRequest {
                            message: "archive item has no source".to_string(),
                        })?;
                let source_path = source.to_local_path()?;
                let entry_name = archive_entry_name(plan, &source_path)?;

                let mut input = File::open(&source_path)
                    .map_err(|error| map_std_io_error(&source_path, error))?;
                archive
                    .append_file(&entry_name, &mut input)
                    .map_err(|error| {
                        FileOperationError::io(format!(
                            "failed to add file to tar archive: {error}"
                        ))
                    })?;
                let copied = fs::metadata(&source_path).map(|m| m.len()).unwrap_or(0);
                progress.completed_bytes += copied;
                progress.complete_item(item, job_id, sink);
            }

            archive
                .into_inner()
                .map_err(|error| {
                    FileOperationError::io(format!("failed to finalize tar.gz archive: {error}"))
                })?
                .finish()
                .map_err(|error| {
                    FileOperationError::io(format!("failed to finalize gzip stream: {error}"))
                })?;
        }
        ArchiveFormat::TarBz2 => {
            let file = File::create(&destination_path)
                .map_err(|error| map_std_io_error(&destination_path, error))?;
            let bz = bzip2::write::BzEncoder::new(file, bzip2::Compression::default());
            let mut archive = tar::Builder::new(bz);

            for item in &plan.items {
                check_cancelled(cancel, pause, job_id)?;
                let source =
                    item.source
                        .as_ref()
                        .ok_or_else(|| FileOperationError::InvalidRequest {
                            message: "archive item has no source".to_string(),
                        })?;
                let source_path = source.to_local_path()?;
                let entry_name = archive_entry_name(plan, &source_path)?;

                let mut input = File::open(&source_path)
                    .map_err(|error| map_std_io_error(&source_path, error))?;
                archive
                    .append_file(&entry_name, &mut input)
                    .map_err(|error| {
                        FileOperationError::io(format!(
                            "failed to add file to tar archive: {error}"
                        ))
                    })?;
                let copied = fs::metadata(&source_path).map(|m| m.len()).unwrap_or(0);
                progress.completed_bytes += copied;
                progress.complete_item(item, job_id, sink);
            }

            archive
                .into_inner()
                .map_err(|error| {
                    FileOperationError::io(format!("failed to finalize tar.bz2 archive: {error}"))
                })?
                .finish()
                .map_err(|error| {
                    FileOperationError::io(format!("failed to finalize bzip2 stream: {error}"))
                })?;
        }
        ArchiveFormat::Tar => {
            let file = File::create(&destination_path)
                .map_err(|error| map_std_io_error(&destination_path, error))?;
            let mut archive = tar::Builder::new(file);

            for item in &plan.items {
                check_cancelled(cancel, pause, job_id)?;
                let source =
                    item.source
                        .as_ref()
                        .ok_or_else(|| FileOperationError::InvalidRequest {
                            message: "archive item has no source".to_string(),
                        })?;
                let source_path = source.to_local_path()?;
                let entry_name = archive_entry_name(plan, &source_path)?;

                let mut input = File::open(&source_path)
                    .map_err(|error| map_std_io_error(&source_path, error))?;
                archive
                    .append_file(&entry_name, &mut input)
                    .map_err(|error| {
                        FileOperationError::io(format!(
                            "failed to add file to tar archive: {error}"
                        ))
                    })?;
                let copied = fs::metadata(&source_path).map(|m| m.len()).unwrap_or(0);
                progress.completed_bytes += copied;
                progress.complete_item(item, job_id, sink);
            }

            archive.into_inner().map_err(|error| {
                FileOperationError::io(format!("failed to finalize tar archive: {error}"))
            })?;
        }
    }

    Ok(())
}

pub(super) fn execute_extract_archive(
    plan: &FileOperationPlan,
    job_id: &JobId,
    cancel: &CancellationToken,
    pause: &PauseToken,
    sink: &FileOperationEventSink,
) -> Result<(), FileOperationError> {
    let source = plan
        .sources
        .first()
        .ok_or_else(|| FileOperationError::InvalidRequest {
            message: "extract archive plan has no source".to_string(),
        })?;
    let source_path = source.to_local_path()?;
    let destination =
        plan.destination
            .as_ref()
            .ok_or_else(|| FileOperationError::InvalidRequest {
                message: "extract archive plan has no destination".to_string(),
            })?;
    let destination_root = destination.to_local_path()?;

    let format = detect_archive_format(&source_path)?;
    let (mut snapshot, fingerprint, source_bytes) = snapshot_archive(&source_path)?;
    verify_archive_fingerprint(&plan.operation_id, &fingerprint)?;
    let validation_snapshot = snapshot.try_clone().map_err(|error| {
        FileOperationError::io(format!("failed to clone archive snapshot: {error}"))
    })?;
    let manifest = inspect_archive_snapshot(validation_snapshot, format, source_bytes)?;
    validate_archive_manifest_plan(plan, source, &destination_root, &manifest)?;
    snapshot.seek(SeekFrom::Start(0)).map_err(|error| {
        FileOperationError::io(format!("failed to rewind archive snapshot: {error}"))
    })?;
    let destination_dir = open_archive_destination_root(&destination_root)?;
    let mut context = ExtractionContext {
        plan,
        job_id,
        cancel,
        pause,
        sink,
        source,
        destination_root,
        destination_dir,
        budget: ArchiveBudget::new(source_bytes),
        progress: ExecutionProgress::new(plan),
        planned_index: 0,
    };

    match format {
        ArchiveFormat::Zip => {
            let mut archive = zip::ZipArchive::new(snapshot).map_err(|error| {
                FileOperationError::io(format!("failed to read archive: {error}"))
            })?;
            if archive.len() as u64 > MAX_ARCHIVE_ENTRIES {
                return Err(invalid_archive(format!(
                    "archive contains more than {MAX_ARCHIVE_ENTRIES} entries"
                )));
            }

            for index in 0..archive.len() {
                check_cancelled(cancel, pause, job_id)?;
                let mut entry = archive.by_index(index).map_err(|error| {
                    FileOperationError::io(format!("failed to read archive entry {index}: {error}"))
                })?;
                let path = PathBuf::from(entry.name());
                let mode_type = entry.unix_mode().map(|mode| mode & 0o170000).unwrap_or(0);
                if entry.is_dir() || mode_type == 0o040000 {
                    context.extract_directory(
                        &path,
                        entry.size(),
                        Some(entry.compressed_size()),
                    )?;
                } else if mode_type == 0 || mode_type == 0o100000 {
                    let size = entry.size();
                    let compressed_size = entry.compressed_size();
                    context.extract_file(&path, size, Some(compressed_size), &mut entry)?;
                } else {
                    return Err(unsupported_archive_type(entry.name()));
                }
            }
        }
        ArchiveFormat::TarGz => {
            extract_tar_entries(
                flate2::read::GzDecoder::new(snapshot),
                &mut context,
                "tar.gz",
            )?;
        }
        ArchiveFormat::TarBz2 => {
            extract_tar_entries(
                bzip2::read::BzDecoder::new(snapshot),
                &mut context,
                "tar.bz2",
            )?;
        }
        ArchiveFormat::Tar => {
            extract_tar_entries(snapshot, &mut context, "tar")?;
        }
    }

    context.finish()
}

struct ExtractionContext<'a> {
    plan: &'a FileOperationPlan,
    job_id: &'a JobId,
    cancel: &'a CancellationToken,
    pause: &'a PauseToken,
    sink: &'a FileOperationEventSink,
    source: &'a ResourceUri,
    destination_root: PathBuf,
    destination_dir: Dir,
    budget: ArchiveBudget,
    progress: ExecutionProgress<'a>,
    planned_index: usize,
}

impl ExtractionContext<'_> {
    fn extract_directory(
        &mut self,
        path: &Path,
        size: u64,
        compressed_size: Option<u64>,
    ) -> Result<(), FileOperationError> {
        let relative_path =
            self.budget
                .observe(path, ArchiveEntryKind::Directory, size, compressed_size)?;
        ensure_safe_directory(
            &self.destination_dir,
            &relative_path,
            &self.destination_root,
        )
    }

    fn extract_file<R: Read>(
        &mut self,
        path: &Path,
        size: u64,
        compressed_size: Option<u64>,
        reader: &mut R,
    ) -> Result<(), FileOperationError> {
        let relative_path =
            self.budget
                .observe(path, ArchiveEntryKind::File, size, compressed_size)?;
        let item = self
            .plan
            .items
            .get(self.planned_index)
            .ok_or_else(stale_archive_plan)?;
        validate_planned_archive_item(
            item,
            self.source,
            &self.destination_root,
            &relative_path,
            size,
        )?;
        self.planned_index += 1;

        let copied = extract_file_safely(
            &self.destination_dir,
            &self.destination_root,
            &relative_path,
            self.plan.conflict_policy,
            reader,
            size,
            self.progress.completed_bytes,
            self.budget.source_bytes,
            self.job_id,
            self.cancel,
            self.pause,
        )?;
        if let Some(copied) = copied {
            self.progress.completed_bytes += copied;
        }
        self.progress.complete_item(item, self.job_id, self.sink);

        Ok(())
    }

    fn finish(self) -> Result<(), FileOperationError> {
        if self.planned_index != self.plan.items.len() {
            return Err(stale_archive_plan());
        }
        Ok(())
    }
}

fn extract_tar_entries<R: Read>(
    reader: R,
    context: &mut ExtractionContext<'_>,
    label: &str,
) -> Result<(), FileOperationError> {
    let mut archive = tar::Archive::new(reader);
    for entry_result in archive.entries().map_err(|error| {
        FileOperationError::io(format!("failed to read {label} archive: {error}"))
    })? {
        check_cancelled(context.cancel, context.pause, context.job_id)?;
        let mut entry = entry_result.map_err(|error| {
            FileOperationError::io(format!("failed to read {label} entry: {error}"))
        })?;
        let path = entry.path().map_err(|error| {
            FileOperationError::io(format!("failed to read {label} entry path: {error}"))
        })?;
        let path = path.into_owned();
        let entry_type = entry.header().entry_type();
        if entry_type.is_file() {
            let size = entry.size();
            context.extract_file(&path, size, None, &mut entry)?;
        } else if entry_type.is_dir() {
            context.extract_directory(&path, entry.size(), None)?;
        } else {
            return Err(unsupported_archive_type(&path.display().to_string()));
        }
    }

    Ok(())
}

fn snapshot_archive(path: &Path) -> Result<(File, String, u64), FileOperationError> {
    let mut source = File::open(path).map_err(|error| map_std_io_error(path, error))?;
    let metadata = source
        .metadata()
        .map_err(|error| map_std_io_error(path, error))?;
    if !metadata.is_file() {
        return Err(invalid_archive(format!(
            "archive source is not a regular file: {}",
            path.display()
        )));
    }
    if metadata.len() > MAX_ARCHIVE_SOURCE_BYTES {
        return Err(invalid_archive(format!(
            "archive source exceeds the {MAX_ARCHIVE_SOURCE_BYTES}-byte limit"
        )));
    }

    let mut snapshot = tempfile::tempfile().map_err(|error| {
        FileOperationError::io(format!("failed to create archive snapshot: {error}"))
    })?;
    let mut hasher = Sha256::new();
    let mut copied = 0_u64;
    let mut buffer = [0_u8; ARCHIVE_COPY_BUFFER_SIZE];
    loop {
        let read = source
            .read(&mut buffer)
            .map_err(|error| map_std_io_error(path, error))?;
        if read == 0 {
            break;
        }
        copied = copied
            .checked_add(read as u64)
            .ok_or_else(|| invalid_archive("archive source size overflowed"))?;
        if copied > MAX_ARCHIVE_SOURCE_BYTES {
            return Err(invalid_archive(format!(
                "archive source exceeds the {MAX_ARCHIVE_SOURCE_BYTES}-byte limit"
            )));
        }
        hasher.update(&buffer[..read]);
        snapshot.write_all(&buffer[..read]).map_err(|error| {
            FileOperationError::io(format!("failed to snapshot archive: {error}"))
        })?;
    }
    snapshot.seek(SeekFrom::Start(0)).map_err(|error| {
        FileOperationError::io(format!("failed to rewind archive snapshot: {error}"))
    })?;

    Ok((snapshot, hex::encode(hasher.finalize()), copied))
}

fn verify_archive_fingerprint(
    operation_id: &str,
    actual_fingerprint: &str,
) -> Result<(), FileOperationError> {
    let expected = operation_id
        .rsplit_once(ARCHIVE_FINGERPRINT_SEPARATOR)
        .map(|(_, fingerprint)| fingerprint)
        .filter(|fingerprint| {
            fingerprint.len() == 64 && fingerprint.bytes().all(|byte| byte.is_ascii_hexdigit())
        })
        .ok_or_else(stale_archive_plan)?;
    if expected != actual_fingerprint {
        return Err(stale_archive_plan());
    }

    Ok(())
}

fn validate_planned_archive_item(
    item: &FileOperationItem,
    source: &ResourceUri,
    destination_root: &Path,
    relative_path: &Path,
    size: u64,
) -> Result<(), FileOperationError> {
    let expected_destination = destination_root.join(relative_path);
    let destination_matches = item
        .destination
        .as_ref()
        .map(ResourceUri::to_local_path)
        .transpose()?
        .as_deref()
        == Some(expected_destination.as_path());
    if item.source.as_ref() != Some(source)
        || !destination_matches
        || item.kind != FileKind::File
        || item.size != Some(size)
        || item.recursive
    {
        return Err(stale_archive_plan());
    }

    Ok(())
}

fn validate_archive_manifest_plan(
    plan: &FileOperationPlan,
    source: &ResourceUri,
    destination_root: &Path,
    manifest: &[ArchiveManifestEntry],
) -> Result<(), FileOperationError> {
    if plan.items.len() != manifest.len() {
        return Err(stale_archive_plan());
    }
    for (item, entry) in plan.items.iter().zip(manifest) {
        validate_planned_archive_item(
            item,
            source,
            destination_root,
            &entry.relative_path,
            entry.size,
        )?;
    }

    Ok(())
}

fn open_archive_destination_root(path: &Path) -> Result<Dir, FileOperationError> {
    let Some(parent_path) = path.parent() else {
        return Dir::open_ambient_dir(path, ambient_authority())
            .map_err(|error| map_std_io_error(path, error));
    };
    let Some(root_name) = path.file_name() else {
        return Dir::open_ambient_dir(path, ambient_authority())
            .map_err(|error| map_std_io_error(path, error));
    };
    fs::create_dir_all(parent_path).map_err(|error| map_std_io_error(parent_path, error))?;
    let parent = Dir::open_ambient_dir(parent_path, ambient_authority())
        .map_err(|error| map_std_io_error(parent_path, error))?;
    match parent.open_dir_nofollow(root_name) {
        Ok(root) => Ok(root),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            match parent.create_dir(root_name) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
                Err(error) => return Err(map_std_io_error(path, error)),
            }
            parent.open_dir_nofollow(root_name).map_err(|error| {
                invalid_archive(format!(
                    "archive destination root is not a safe directory `{}`: {error}",
                    path.display()
                ))
            })
        }
        Err(error) => Err(invalid_archive(format!(
            "archive destination root is not a safe directory `{}`: {error}",
            path.display()
        ))),
    }
}

fn ensure_safe_directory(
    root: &Dir,
    relative_path: &Path,
    destination_root: &Path,
) -> Result<(), FileOperationError> {
    let mut current = root
        .try_clone()
        .map_err(|error| map_std_io_error(destination_root, error))?;
    let mut display_path = destination_root.to_path_buf();
    for component in relative_path.components() {
        let Component::Normal(name) = component else {
            return Err(invalid_archive(format!(
                "archive contains unsafe destination path: {}",
                relative_path.display()
            )));
        };
        display_path.push(name);
        current = open_or_create_directory(&current, name, &display_path)?;
    }

    Ok(())
}

fn open_safe_parent(
    root: &Dir,
    relative_path: &Path,
    destination_root: &Path,
) -> Result<(Dir, OsString), FileOperationError> {
    let file_name = relative_path
        .file_name()
        .ok_or_else(|| invalid_archive("archive entry has no file name"))?
        .to_os_string();
    let mut current = root
        .try_clone()
        .map_err(|error| map_std_io_error(destination_root, error))?;
    let mut display_path = destination_root.to_path_buf();
    if let Some(parent) = relative_path.parent() {
        for component in parent.components() {
            let Component::Normal(name) = component else {
                return Err(invalid_archive(format!(
                    "archive contains unsafe destination path: {}",
                    relative_path.display()
                )));
            };
            display_path.push(name);
            current = open_or_create_directory(&current, name, &display_path)?;
        }
    }

    Ok((current, file_name))
}

fn open_or_create_directory(
    parent: &Dir,
    name: &OsStr,
    display_path: &Path,
) -> Result<Dir, FileOperationError> {
    match parent.open_dir_nofollow(name) {
        Ok(directory) => Ok(directory),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            match parent.create_dir(name) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
                Err(error) => return Err(map_std_io_error(display_path, error)),
            }
            parent.open_dir_nofollow(name).map_err(|error| {
                invalid_archive(format!(
                    "archive destination component is not a safe directory `{}`: {error}",
                    display_path.display()
                ))
            })
        }
        Err(error) => Err(invalid_archive(format!(
            "archive destination component is not a safe directory `{}`: {error}",
            display_path.display()
        ))),
    }
}

#[allow(clippy::too_many_arguments)]
fn extract_file_safely<R: Read>(
    root: &Dir,
    destination_root: &Path,
    relative_path: &Path,
    conflict_policy: ConflictPolicy,
    reader: &mut R,
    expected_size: u64,
    previously_expanded: u64,
    source_bytes: u64,
    job_id: &JobId,
    cancel: &CancellationToken,
    pause: &PauseToken,
) -> Result<Option<u64>, FileOperationError> {
    let (parent, requested_name) = open_safe_parent(root, relative_path, destination_root)?;
    let requested_path = destination_root.join(relative_path);
    let destination_parent = requested_path.parent().unwrap_or(destination_root);
    let requested_exists = safe_leaf_exists(&parent, &requested_name, &requested_path)?;
    if requested_exists && conflict_policy == ConflictPolicy::Skip {
        return Ok(None);
    }
    if requested_exists && conflict_policy == ConflictPolicy::Fail {
        return Err(destination_conflict(&requested_path)?);
    }

    let mut target_name = requested_name.clone();
    if requested_exists && conflict_policy == ConflictPolicy::RenameNew {
        target_name = next_available_name(&parent, &requested_name, destination_parent)?;
    }
    let temp_name = unique_temp_name(&parent)?;
    let mut staging_cleanup = StagingCleanup::new(&parent, temp_name.clone());
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    options.follow(FollowSymlinks::No);
    let mut output = parent.open_with(&temp_name, &options).map_err(|error| {
        FileOperationError::io(format!("failed to create extraction staging file: {error}"))
    })?;

    let copied = copy_archive_entry(
        reader,
        &mut output,
        expected_size,
        previously_expanded,
        source_bytes,
        job_id,
        cancel,
        pause,
    )?;
    if let Err(error) = output.sync_all() {
        return Err(FileOperationError::io(format!(
            "failed to flush extracted file: {error}"
        )));
    }
    drop(output);

    let mut target_path = requested_path.with_file_name(&target_name);
    let target_exists = safe_leaf_exists(&parent, &target_name, &target_path)?;
    if target_exists {
        match conflict_policy {
            ConflictPolicy::Skip => {
                return Ok(None);
            }
            ConflictPolicy::Fail => {
                return Err(destination_conflict(&target_path)?);
            }
            ConflictPolicy::RenameNew => {
                target_name = next_available_name(&parent, &requested_name, destination_parent)?;
                target_path = requested_path.with_file_name(&target_name);
            }
            ConflictPolicy::Overwrite => {}
            ConflictPolicy::RenameExisting => {}
        }
    }

    let mut renamed_existing = None::<(OsString, bool)>;
    if safe_leaf_exists(&parent, &target_name, &target_path)? {
        match conflict_policy {
            ConflictPolicy::Overwrite => {
                let backup_name = unique_temp_name(&parent)?;
                parent
                    .rename(&target_name, &parent, &backup_name)
                    .map_err(|error| map_std_io_error(&target_path, error))?;
                renamed_existing = Some((backup_name, true));
            }
            ConflictPolicy::RenameExisting => {
                let backup_name = next_available_name(&parent, &target_name, destination_parent)?;
                parent
                    .rename(&target_name, &parent, &backup_name)
                    .map_err(|error| map_std_io_error(&target_path, error))?;
                renamed_existing = Some((backup_name, false));
            }
            ConflictPolicy::Fail | ConflictPolicy::RenameNew => {
                return Err(destination_conflict(&target_path)?);
            }
            ConflictPolicy::Skip => return Ok(None),
        }
    }

    if let Err(error) = parent.rename(&temp_name, &parent, &target_name) {
        if let Some((backup_name, _)) = renamed_existing {
            let _ = parent.rename(&backup_name, &parent, &target_name);
        }
        return Err(map_std_io_error(&target_path, error));
    }
    staging_cleanup.disarm();
    if let Some((backup_name, remove_after_commit)) = renamed_existing {
        if remove_after_commit {
            parent
                .remove_file(&backup_name)
                .map_err(|error| map_std_io_error(&target_path, error))?;
        }
    }

    Ok(Some(copied))
}

struct StagingCleanup<'a> {
    parent: &'a Dir,
    name: OsString,
    active: bool,
}

impl<'a> StagingCleanup<'a> {
    fn new(parent: &'a Dir, name: OsString) -> Self {
        Self {
            parent,
            name,
            active: true,
        }
    }

    fn disarm(&mut self) {
        self.active = false;
    }
}

impl Drop for StagingCleanup<'_> {
    fn drop(&mut self) {
        if self.active {
            let _ = self.parent.remove_file(&self.name);
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn copy_archive_entry<R: Read, W: Write>(
    reader: &mut R,
    writer: &mut W,
    expected_size: u64,
    previously_expanded: u64,
    source_bytes: u64,
    job_id: &JobId,
    cancel: &CancellationToken,
    pause: &PauseToken,
) -> Result<u64, FileOperationError> {
    let mut copied = 0_u64;
    let mut buffer = [0_u8; ARCHIVE_COPY_BUFFER_SIZE];
    loop {
        check_cancelled(cancel, pause, job_id)?;
        let read = reader.read(&mut buffer).map_err(|error| {
            FileOperationError::io(format!("failed to read archive entry: {error}"))
        })?;
        if read == 0 {
            break;
        }
        copied = copied
            .checked_add(read as u64)
            .ok_or_else(|| invalid_archive("archive entry expanded size overflowed"))?;
        if copied > expected_size || copied > MAX_ARCHIVE_ENTRY_BYTES {
            return Err(invalid_archive(
                "archive entry expanded beyond its declared size",
            ));
        }
        let total = previously_expanded
            .checked_add(copied)
            .ok_or_else(|| invalid_archive("archive expanded size overflowed"))?;
        if total > MAX_ARCHIVE_EXPANDED_BYTES {
            return Err(invalid_archive(format!(
                "archive expands beyond the {MAX_ARCHIVE_EXPANDED_BYTES}-byte limit"
            )));
        }
        enforce_compression_ratio(total, source_bytes, "archive")?;
        writer.write_all(&buffer[..read]).map_err(|error| {
            FileOperationError::io(format!("failed to write extracted file: {error}"))
        })?;
    }

    if copied != expected_size {
        return Err(invalid_archive(
            "archive entry size changed while it was being extracted",
        ));
    }
    Ok(copied)
}

fn safe_leaf_exists(
    parent: &Dir,
    name: &OsStr,
    display_path: &Path,
) -> Result<bool, FileOperationError> {
    match parent.symlink_metadata(name) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() {
                return Err(invalid_archive(format!(
                    "archive destination cannot be a symlink: {}",
                    display_path.display()
                )));
            }
            if !metadata.is_file() {
                return Err(FileOperationError::DestinationConflict {
                    uri: ResourceUri::from_local_path(display_path)?
                        .as_str()
                        .to_string(),
                });
            }
            Ok(true)
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(map_std_io_error(display_path, error)),
    }
}

fn next_available_name(
    parent: &Dir,
    requested_name: &OsStr,
    destination_root: &Path,
) -> Result<OsString, FileOperationError> {
    let requested_path = Path::new(requested_name);
    let stem = requested_path
        .file_stem()
        .and_then(OsStr::to_str)
        .unwrap_or("file");
    let extension = requested_path.extension().and_then(OsStr::to_str);
    for index in 1..10_000 {
        let candidate = match extension {
            Some(extension) => OsString::from(format!("{stem} ({index}).{extension}")),
            None => OsString::from(format!("{stem} ({index})")),
        };
        let display_path = destination_root.join(&candidate);
        if !safe_leaf_exists(parent, &candidate, &display_path)? {
            return Ok(candidate);
        }
    }

    Err(invalid_archive(
        "could not allocate a conflict-free archive destination",
    ))
}

fn unique_temp_name(parent: &Dir) -> Result<OsString, FileOperationError> {
    for _ in 0..100 {
        let candidate =
            OsString::from(format!(".fileoctopus-extract-{}.tmp", uuid::Uuid::new_v4()));
        match parent.symlink_metadata(&candidate) {
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(candidate),
            Ok(_) => {}
            Err(error) => {
                return Err(FileOperationError::io(format!(
                    "failed to inspect extraction staging path: {error}"
                )))
            }
        }
    }

    Err(FileOperationError::io(
        "could not allocate extraction staging path",
    ))
}

fn destination_conflict(path: &Path) -> Result<FileOperationError, FileOperationError> {
    Ok(FileOperationError::DestinationConflict {
        uri: ResourceUri::from_local_path(path)?.as_str().to_string(),
    })
}

pub(super) fn archive_entry_name(
    plan: &FileOperationPlan,
    source_path: &Path,
) -> Result<String, FileOperationError> {
    let canonical_source = source_path
        .canonicalize()
        .unwrap_or_else(|_| source_path.to_path_buf());

    for root_uri in &plan.sources {
        let root_path = root_uri.to_local_path()?;
        let root_path = root_path.canonicalize().unwrap_or(root_path);

        if root_path.is_file() && root_path == canonical_source {
            return Ok(canonical_source
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_else(|| canonical_source.to_string_lossy().to_string()));
        }

        if root_path.is_dir() && canonical_source.starts_with(&root_path) {
            let relative = canonical_source
                .strip_prefix(&root_path)
                .unwrap_or(&canonical_source)
                .to_string_lossy()
                .to_string();
            return Ok(relative);
        }
    }

    Err(FileOperationError::Internal {
        message: format!(
            "archive source `{}` is not covered by the plan roots",
            canonical_source.display()
        ),
    })
}

fn validate_archive_relative_path(path: &Path) -> Result<PathBuf, FileOperationError> {
    if path.as_os_str().as_encoded_bytes().len() > MAX_ARCHIVE_PATH_BYTES {
        return Err(invalid_archive(format!(
            "archive entry path exceeds {MAX_ARCHIVE_PATH_BYTES} bytes"
        )));
    }
    let mut normalized = PathBuf::new();
    let mut depth = 0_usize;
    for component in path.components() {
        match component {
            Component::Normal(name) => {
                if name.as_encoded_bytes().contains(&0) {
                    return Err(invalid_archive("archive entry path contains a null byte"));
                }
                validate_platform_archive_component(name)?;
                depth += 1;
                if depth > MAX_ARCHIVE_PATH_DEPTH {
                    return Err(invalid_archive(format!(
                        "archive entry path exceeds {MAX_ARCHIVE_PATH_DEPTH} components"
                    )));
                }
                normalized.push(name);
            }
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(invalid_archive(format!(
                    "archive entry has an unsafe path: {}",
                    path.display()
                )))
            }
        }
    }
    if normalized.as_os_str().is_empty() {
        return Err(invalid_archive("archive entry path is empty"));
    }

    Ok(normalized)
}

#[cfg(not(windows))]
fn validate_platform_archive_component(_component: &OsStr) -> Result<(), FileOperationError> {
    Ok(())
}

#[cfg(windows)]
fn validate_platform_archive_component(component: &OsStr) -> Result<(), FileOperationError> {
    let value = component.to_string_lossy();
    if value.contains(':') || value.ends_with('.') || value.ends_with(' ') {
        return Err(invalid_archive(format!(
            "archive entry contains an unsafe Windows path component: {value}"
        )));
    }
    let base = value
        .split('.')
        .next()
        .unwrap_or_default()
        .to_ascii_uppercase();
    let reserved = matches!(base.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || (base.len() == 4
            && (base.starts_with("COM") || base.starts_with("LPT"))
            && base.as_bytes()[3].is_ascii_digit()
            && base.as_bytes()[3] != b'0');
    if reserved {
        return Err(invalid_archive(format!(
            "archive entry contains a reserved Windows path component: {value}"
        )));
    }

    Ok(())
}

fn enforce_compression_ratio(
    expanded: u64,
    compressed: u64,
    label: &str,
) -> Result<(), FileOperationError> {
    if expanded == 0 {
        return Ok(());
    }
    if compressed == 0 || expanded > compressed.saturating_mul(MAX_ARCHIVE_COMPRESSION_RATIO) {
        return Err(invalid_archive(format!(
            "{label} exceeds the {MAX_ARCHIVE_COMPRESSION_RATIO}:1 compression ratio limit"
        )));
    }

    Ok(())
}

fn invalid_archive(message: impl Into<String>) -> FileOperationError {
    FileOperationError::InvalidRequest {
        message: message.into(),
    }
}

fn unsupported_archive_type(path: &str) -> FileOperationError {
    invalid_archive(format!(
        "archive entry `{path}` is not a regular file or directory"
    ))
}

fn stale_archive_plan() -> FileOperationError {
    invalid_archive("archive changed after the extraction plan was created")
}

#[cfg(test)]
pub(super) fn validate_archive_budget_for_test(
    entry_count: u64,
    entry_size: u64,
    compressed_size: Option<u64>,
    source_bytes: u64,
) -> Result<(), FileOperationError> {
    let mut budget = ArchiveBudget::new(source_bytes);
    for index in 0..entry_count {
        budget.observe(
            Path::new(&format!("entry-{index}")),
            ArchiveEntryKind::File,
            entry_size,
            compressed_size,
        )?;
    }
    Ok(())
}
