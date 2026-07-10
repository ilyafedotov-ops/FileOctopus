use std::collections::HashSet;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;

use chrono::Utc;
use filetime::FileTime;
use jobs::{CancellationToken, JobEvent, JobId, JobProgressEvent, PauseToken};
use vfs::{
    ConflictPolicy, FileKind, FileOperationError, FileOperationItem, FileOperationPlan, ResourceUri,
};

#[cfg(windows)]
use windows_sys::Win32::Storage::FileSystem::MoveFileExW;

use crate::vfs_io::VfsFilesystem;

use super::paths::{is_cross_device_error, map_std_io_error};
use super::trash::move_to_trash;
use super::FileOperationEventSink;

pub(super) const COPY_BUFFER_SIZE: usize = 64 * 1024;
pub(super) const PROGRESS_BYTE_INTERVAL: u64 = 1024 * 1024;

pub(super) fn execute_copy(
    vfs: &VfsFilesystem,
    plan: &FileOperationPlan,
    job_id: &JobId,
    cancel: &CancellationToken,
    pause: &PauseToken,
    sink: &FileOperationEventSink,
) -> Result<(), FileOperationError> {
    execute_copy_with_report(vfs, plan, job_id, cancel, pause, sink).map(|_| ())
}

#[derive(Default)]
struct CopyExecutionReport {
    copied_items: HashSet<usize>,
}

fn execute_copy_with_report(
    vfs: &VfsFilesystem,
    plan: &FileOperationPlan,
    job_id: &JobId,
    cancel: &CancellationToken,
    pause: &PauseToken,
    sink: &FileOperationEventSink,
) -> Result<CopyExecutionReport, FileOperationError> {
    let mut progress = ExecutionProgress::new(plan);
    let mut report = CopyExecutionReport::default();
    progress.emit_initial(job_id, sink);

    for (item_index, item) in plan.items.iter().enumerate() {
        check_cancelled(cancel, pause, job_id)?;
        let Some(destination) = &item.destination else {
            continue;
        };

        if matches!(
            item.kind,
            FileKind::File | FileKind::Archive | FileKind::Virtual | FileKind::Unknown
        ) {
            if let Some(source) = &item.source {
                if source.scheme() == "local" && destination.scheme() == "local" {
                    let copied = copy_file_streaming(
                        &source.to_local_path()?,
                        &destination.to_local_path()?,
                        plan.conflict_policy,
                        job_id,
                        cancel,
                        pause,
                        &mut progress,
                        sink,
                    )?;
                    if copied {
                        report.copied_items.insert(item_index);
                    }
                    progress.complete_item(item, job_id, sink);
                    continue;
                }
            }
        }

        if vfs.exists(destination)? && plan.conflict_policy == ConflictPolicy::Skip {
            progress.complete_item(item, job_id, sink);
            continue;
        }

        let destination = resolve_conflict_uri(vfs, destination, plan.conflict_policy)?;

        match item.kind {
            FileKind::Directory => vfs.mkdir(&destination)?,
            FileKind::File | FileKind::Archive | FileKind::Virtual | FileKind::Unknown => {
                if let Some(source) = &item.source {
                    let destination_uri = destination.clone();
                    vfs.copy_file(source, &destination_uri, |bytes| {
                        progress.completed_bytes = bytes;
                        progress.emit_chunk_uri(job_id, &destination_uri, sink);
                    })?;
                }
            }
            FileKind::Symlink => {
                let source =
                    item.source
                        .as_ref()
                        .ok_or_else(|| FileOperationError::InvalidRequest {
                            message: "symlink item has no source".to_string(),
                        })?;

                if source.scheme() == "local" && destination.scheme() == "local" {
                    copy_local_symlink(&source.to_local_path()?, &destination.to_local_path()?)?;
                    check_cancelled(cancel, pause, job_id)?;
                    report.copied_items.insert(item_index);
                    progress.complete_item(item, job_id, sink);
                    continue;
                }

                return Err(FileOperationError::UnsupportedSymlink {
                    uri: source.as_str().to_string(),
                    message: "copying symlink objects is only supported for local paths"
                        .to_string(),
                });
            }
        }

        check_cancelled(cancel, pause, job_id)?;
        report.copied_items.insert(item_index);
        progress.complete_item(item, job_id, sink);
    }

    Ok(report)
}

fn copy_local_symlink(source: &Path, destination: &Path) -> Result<(), FileOperationError> {
    let target = fs::read_link(source).map_err(|error| map_std_io_error(source, error))?;
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(&target, destination)
            .map_err(|error| map_std_io_error(destination, error))?;
    }
    #[cfg(windows)]
    {
        let target_metadata =
            fs::metadata(source).map_err(|error| map_std_io_error(source, error))?;
        if target_metadata.is_dir() {
            std::os::windows::fs::symlink_dir(&target, destination)
                .map_err(|error| map_std_io_error(destination, error))?;
        } else {
            std::os::windows::fs::symlink_file(&target, destination)
                .map_err(|error| map_std_io_error(destination, error))?;
        }
    }
    Ok(())
}

pub(super) fn execute_move(
    vfs: &VfsFilesystem,
    plan: &FileOperationPlan,
    job_id: &JobId,
    cancel: &CancellationToken,
    pause: &PauseToken,
    sink: &FileOperationEventSink,
) -> Result<(), FileOperationError> {
    check_cancelled(cancel, pause, job_id)?;

    if plan.sources.len() == 1 {
        let root = &plan.sources[0];
        let destination_dir = plan.destination.as_ref().unwrap();
        let destination = if root.scheme() == "local" && destination_dir.scheme() == "local" {
            let source_path = root.to_local_path()?;
            let root_name =
                source_path
                    .file_name()
                    .ok_or_else(|| FileOperationError::InvalidRequest {
                        message: "source must have a basename".to_string(),
                    })?;
            ResourceUri::from_local_path(&destination_dir.to_local_path()?.join(root_name))?
        } else {
            let name = root
                .remote_path()
                .or_else(|| {
                    root.to_local_path().ok().and_then(|path| {
                        path.file_name()
                            .map(|value| value.to_string_lossy().to_string())
                    })
                })
                .and_then(|path| {
                    path.trim_end_matches('/')
                        .rsplit('/')
                        .next()
                        .map(str::to_string)
                })
                .ok_or_else(|| FileOperationError::InvalidRequest {
                    message: "source must have a basename".to_string(),
                })?;
            if root.scheme() == "local" {
                vfs.join_local_parent(destination_dir, &name)?
            } else {
                vfs.join_remote_parent(destination_dir, &name)?
            }
        };

        if vfs.exists(&destination)? && plan.conflict_policy == ConflictPolicy::Skip {
            return Ok(());
        }

        let destination = resolve_conflict_uri(vfs, &destination, plan.conflict_policy)?;
        if root.scheme() == destination.scheme() {
            if root.scheme() == "local" {
                match fs::rename(&root.to_local_path()?, &destination.to_local_path()?) {
                    Ok(()) => return Ok(()),
                    Err(error) if is_cross_device_error(&error) => {}
                    Err(error) => return Err(map_std_io_error(&root.to_local_path()?, error)),
                }
            } else if root.remote_authority() == destination.remote_authority() {
                vfs.rename(root, &destination)?;
                return Ok(());
            }
        }
    }

    let source_roots = plan
        .sources
        .iter()
        .map(canonical_move_source)
        .collect::<Result<Vec<_>, _>>()?;
    let report = execute_copy_with_report(vfs, plan, job_id, cancel, pause, sink)?;

    remove_copied_move_sources(vfs, plan, &source_roots, &report)?;

    Ok(())
}

fn canonical_move_source(source: &ResourceUri) -> Result<ResourceUri, FileOperationError> {
    if source.scheme() != "local" {
        return Ok(source.clone());
    }

    let path = source.to_local_path()?;
    let canonical = path
        .canonicalize()
        .map_err(|error| map_std_io_error(&path, error))?;
    ResourceUri::from_local_path(&canonical).map_err(FileOperationError::from)
}

fn remove_copied_move_sources(
    vfs: &VfsFilesystem,
    plan: &FileOperationPlan,
    source_roots: &[ResourceUri],
    report: &CopyExecutionReport,
) -> Result<(), FileOperationError> {
    let root_was_fully_copied = source_roots
        .iter()
        .map(|root| {
            let root_items = plan.items.iter().enumerate().filter(|(_, item)| {
                item.source
                    .as_ref()
                    .is_some_and(|source| is_same_or_descendant(source, root))
            });
            let mut item_count = 0_usize;
            let all_copied = root_items
                .inspect(|_| item_count += 1)
                .all(|(index, _)| report.copied_items.contains(&index));
            item_count > 0 && all_copied
        })
        .collect::<Vec<_>>();

    let mut sources_to_remove = HashSet::new();
    for item in &plan.items {
        let Some(source) = &item.source else {
            continue;
        };
        let containing_roots = source_roots
            .iter()
            .enumerate()
            .filter(|(_, root)| is_same_or_descendant(source, root))
            .map(|(index, _)| index)
            .collect::<Vec<_>>();

        if !containing_roots.is_empty()
            && containing_roots
                .iter()
                .all(|index| root_was_fully_copied[*index])
        {
            sources_to_remove.insert(source.clone());
        }
    }

    let mut sources_to_remove = sources_to_remove.into_iter().collect::<Vec<_>>();
    sources_to_remove.sort_by(|left, right| {
        resource_depth(right)
            .cmp(&resource_depth(left))
            .then_with(|| right.as_str().cmp(left.as_str()))
    });

    for source in sources_to_remove {
        vfs.remove(&source, false)?;
    }

    Ok(())
}

fn is_same_or_descendant(source: &ResourceUri, root: &ResourceUri) -> bool {
    if source.scheme() != root.scheme() {
        return false;
    }

    if source.scheme() == "local" {
        return source
            .to_local_path()
            .ok()
            .zip(root.to_local_path().ok())
            .is_some_and(|(source, root)| source == root || source.starts_with(root));
    }

    if source.remote_authority() != root.remote_authority() {
        return false;
    }

    source
        .remote_path()
        .zip(root.remote_path())
        .is_some_and(|(source, root)| {
            let root = root.trim_end_matches('/');
            root.is_empty()
                || source == root
                || source
                    .strip_prefix(root)
                    .is_some_and(|suffix| suffix.starts_with('/'))
        })
}

fn resource_depth(uri: &ResourceUri) -> usize {
    if uri.scheme() == "local" {
        return uri
            .to_local_path()
            .map(|path| path.components().count())
            .unwrap_or(0);
    }

    uri.remote_path()
        .map(|path| {
            path.split('/')
                .filter(|component| !component.is_empty())
                .count()
        })
        .unwrap_or(0)
}

pub(super) fn execute_rename(
    vfs: &VfsFilesystem,
    plan: &FileOperationPlan,
) -> Result<(), FileOperationError> {
    let item = plan
        .items
        .first()
        .ok_or_else(|| FileOperationError::InvalidRequest {
            message: "rename plan has no item".to_string(),
        })?;
    let source = item.source.as_ref().unwrap();
    let destination = item.destination.as_ref().unwrap();

    if vfs.exists(destination)? && plan.conflict_policy == ConflictPolicy::Skip {
        return Ok(());
    }

    let destination = resolve_conflict_uri(vfs, destination, plan.conflict_policy)?;
    if source.scheme() == "local" && destination.scheme() == "local" {
        let source_path = source.to_local_path()?;
        let destination_path = destination.to_local_path()?;
        return rename_no_replace(&source_path, &destination_path).map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                FileOperationError::DestinationConflict {
                    uri: destination.as_str().to_string(),
                }
            } else {
                map_std_io_error(&source_path, error)
            }
        });
    }

    vfs.rename(source, &destination)
}

struct BatchRenameStage {
    source: PathBuf,
    destination: PathBuf,
    temporary: PathBuf,
}

pub(super) fn execute_batch_rename(
    plan: &FileOperationPlan,
    job_id: &JobId,
    cancel: &CancellationToken,
    pause: &PauseToken,
    sink: &FileOperationEventSink,
) -> Result<(), FileOperationError> {
    let stages = prepare_batch_rename_stages(plan)?;
    let mut progress = ExecutionProgress::new(plan);
    progress.emit_initial(job_id, sink);

    for (staged_count, stage) in stages.iter().enumerate() {
        if let Err(error) = check_cancelled(cancel, pause, job_id) {
            return Err(batch_rename_failure(error, &stages[..staged_count], 0));
        }

        if let Err(error) = rename_no_replace(&stage.source, &stage.temporary)
            .map_err(|error| map_std_io_error(&stage.source, error))
        {
            return Err(batch_rename_failure(error, &stages[..staged_count], 0));
        }
    }

    for (index, stage) in stages.iter().enumerate() {
        if let Err(error) = check_cancelled(cancel, pause, job_id) {
            return Err(batch_rename_failure(error, &stages, index));
        }

        match fs::symlink_metadata(&stage.destination) {
            Ok(_) => {
                let error = FileOperationError::DestinationConflict {
                    uri: ResourceUri::from_local_path(&stage.destination)?
                        .as_str()
                        .to_string(),
                };
                return Err(batch_rename_failure(error, &stages, index));
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                let error = map_std_io_error(&stage.destination, error);
                return Err(batch_rename_failure(error, &stages, index));
            }
        }

        if let Err(error) = rename_no_replace(&stage.temporary, &stage.destination) {
            let error = if error.kind() == std::io::ErrorKind::AlreadyExists {
                FileOperationError::DestinationConflict {
                    uri: ResourceUri::from_local_path(&stage.destination)?
                        .as_str()
                        .to_string(),
                }
            } else {
                map_std_io_error(&stage.temporary, error)
            };
            return Err(batch_rename_failure(error, &stages, index));
        }
        progress.complete_item(&plan.items[index], job_id, sink);
    }

    Ok(())
}

fn prepare_batch_rename_stages(
    plan: &FileOperationPlan,
) -> Result<Vec<BatchRenameStage>, FileOperationError> {
    if plan.items.is_empty() || plan.conflict_policy != ConflictPolicy::Fail {
        return Err(FileOperationError::InvalidRequest {
            message: "invalid batch rename plan".to_string(),
        });
    }

    let mut parent = None;
    let mut source_paths = HashSet::new();
    let mut destination_paths = HashSet::new();
    let mut paths = Vec::with_capacity(plan.items.len());

    for item in &plan.items {
        let source_uri =
            item.source
                .as_ref()
                .ok_or_else(|| FileOperationError::InvalidRequest {
                    message: "batch rename item has no source".to_string(),
                })?;
        let destination_uri =
            item.destination
                .as_ref()
                .ok_or_else(|| FileOperationError::InvalidRequest {
                    message: "batch rename item has no destination".to_string(),
                })?;
        if source_uri.scheme() != "local" || destination_uri.scheme() != "local" {
            return Err(FileOperationError::UnsupportedProvider {
                scheme: if source_uri.scheme() != "local" {
                    source_uri.scheme()
                } else {
                    destination_uri.scheme()
                }
                .to_string(),
            });
        }

        let source = source_uri.to_local_path()?;
        let destination = destination_uri.to_local_path()?;
        fs::symlink_metadata(&source).map_err(|error| map_std_io_error(&source, error))?;
        let source_parent = source
            .parent()
            .ok_or_else(|| FileOperationError::InvalidRequest {
                message: "cannot rename filesystem root".to_string(),
            })?
            .canonicalize()
            .map_err(|error| map_std_io_error(&source, error))?;
        let destination_parent = destination
            .parent()
            .ok_or_else(|| FileOperationError::InvalidRequest {
                message: "cannot rename filesystem root".to_string(),
            })?
            .canonicalize()
            .map_err(|error| map_std_io_error(&destination, error))?;
        if source_parent != destination_parent
            || parent
                .as_ref()
                .is_some_and(|expected: &PathBuf| expected != &source_parent)
        {
            return Err(FileOperationError::InvalidRequest {
                message: "batch rename items must share one parent directory".to_string(),
            });
        }
        parent.get_or_insert_with(|| source_parent.clone());

        let source_key = batch_rename_path_key(&source);
        let destination_key = batch_rename_path_key(&destination);
        if !source_paths.insert(source_key) {
            return Err(FileOperationError::InvalidRequest {
                message: "batch rename plan contains a duplicate source".to_string(),
            });
        }
        if !destination_paths.insert(destination_key) {
            return Err(FileOperationError::DestinationConflict {
                uri: destination_uri.as_str().to_string(),
            });
        }

        paths.push((source, destination));
    }

    for (_, destination) in &paths {
        match fs::symlink_metadata(destination) {
            Ok(_) if !source_paths.contains(&batch_rename_path_key(destination)) => {
                return Err(FileOperationError::DestinationConflict {
                    uri: ResourceUri::from_local_path(destination)?
                        .as_str()
                        .to_string(),
                });
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(map_std_io_error(destination, error)),
        }
    }

    let parent = parent.ok_or_else(|| FileOperationError::InvalidRequest {
        message: "batch rename plan has no parent directory".to_string(),
    })?;
    let mut reserved = source_paths;
    reserved.extend(destination_paths);
    paths
        .into_iter()
        .map(|(source, destination)| {
            let temporary = loop {
                let candidate = parent.join(format!(
                    ".fileoctopus-batch-rename-{}.tmp",
                    uuid::Uuid::new_v4()
                ));
                if reserved.contains(&batch_rename_path_key(&candidate)) {
                    continue;
                }
                match fs::symlink_metadata(&candidate) {
                    Ok(_) => continue,
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => break candidate,
                    Err(error) => return Err(map_std_io_error(&candidate, error)),
                }
            };
            reserved.insert(batch_rename_path_key(&temporary));
            Ok(BatchRenameStage {
                source,
                destination,
                temporary,
            })
        })
        .collect()
}

fn rollback_batch_rename(stages: &[BatchRenameStage], committed_count: usize) -> Vec<String> {
    let mut errors = Vec::new();

    for stage in stages[..committed_count].iter().rev() {
        if let Err(error) = rename_no_replace(&stage.destination, &stage.temporary) {
            errors.push(format!(
                "could not move {} back to its temporary path: {error}",
                stage.destination.display()
            ));
        }
    }

    for stage in stages.iter().rev() {
        match fs::symlink_metadata(&stage.temporary) {
            Ok(_) => match fs::symlink_metadata(&stage.source) {
                Ok(_) => errors.push(format!("{} already exists", stage.source.display())),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    if let Err(error) = rename_no_replace(&stage.temporary, &stage.source) {
                        errors.push(format!(
                            "could not restore {}: {error}",
                            stage.source.display()
                        ));
                    }
                }
                Err(error) => errors.push(error.to_string()),
            },
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => errors.push(error.to_string()),
        }
    }

    errors
}

fn batch_rename_failure(
    error: FileOperationError,
    stages: &[BatchRenameStage],
    committed_count: usize,
) -> FileOperationError {
    let rollback_errors = rollback_batch_rename(stages, committed_count);
    if rollback_errors.is_empty() {
        error
    } else {
        FileOperationError::io(format!(
            "{}; rollback incomplete: {}",
            error.user_message(),
            rollback_errors.join("; ")
        ))
    }
}

#[cfg(any(target_os = "linux", target_os = "android", target_vendor = "apple"))]
pub(super) fn rename_no_replace(source: &Path, destination: &Path) -> std::io::Result<()> {
    rustix::fs::renameat_with(
        rustix::fs::CWD,
        source,
        rustix::fs::CWD,
        destination,
        rustix::fs::RenameFlags::NOREPLACE,
    )
    .map_err(std::io::Error::from)
}

#[cfg(windows)]
pub(super) fn rename_no_replace(source: &Path, destination: &Path) -> std::io::Result<()> {
    let source = windows_path(source)?;
    let destination = windows_path(destination)?;
    let result = unsafe { MoveFileExW(source.as_ptr(), destination.as_ptr(), 0) };
    if result == 0 {
        Err(std::io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(windows)]
fn windows_path(path: &Path) -> std::io::Result<Vec<u16>> {
    let mut encoded = path.as_os_str().encode_wide().collect::<Vec<_>>();
    if encoded.contains(&0) {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "path contains a null character",
        ));
    }
    encoded.push(0);
    Ok(encoded)
}

#[cfg(all(
    unix,
    not(any(target_os = "linux", target_os = "android", target_vendor = "apple"))
))]
pub(super) fn rename_no_replace(source: &Path, destination: &Path) -> std::io::Result<()> {
    match fs::symlink_metadata(destination) {
        Ok(_) => Err(std::io::Error::new(
            std::io::ErrorKind::AlreadyExists,
            "destination already exists",
        )),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            fs::rename(source, destination)
        }
        Err(error) => Err(error),
    }
}

fn batch_rename_path_key(path: &Path) -> String {
    #[cfg(any(windows, target_vendor = "apple"))]
    {
        path.to_string_lossy().to_lowercase()
    }
    #[cfg(not(any(windows, target_vendor = "apple")))]
    {
        path.to_string_lossy().into_owned()
    }
}

pub(super) fn execute_create_directory(
    vfs: &VfsFilesystem,
    plan: &FileOperationPlan,
) -> Result<(), FileOperationError> {
    let destination = plan
        .items
        .first()
        .and_then(|item| item.destination.as_ref())
        .ok_or_else(|| FileOperationError::InvalidRequest {
            message: "create directory plan has no destination".to_string(),
        })?;

    if vfs.exists(destination)? {
        return Err(FileOperationError::DestinationConflict {
            uri: destination.as_str().to_string(),
        });
    }

    vfs.mkdir(destination)
}

pub(super) fn execute_create_file(
    vfs: &VfsFilesystem,
    plan: &FileOperationPlan,
) -> Result<(), FileOperationError> {
    let destination = plan
        .items
        .first()
        .and_then(|item| item.destination.as_ref())
        .ok_or_else(|| FileOperationError::InvalidRequest {
            message: "create file plan has no destination".to_string(),
        })?;

    if vfs.exists(destination)? {
        return Err(FileOperationError::DestinationConflict {
            uri: destination.as_str().to_string(),
        });
    }

    vfs.create_empty_file(destination)
}

pub(super) fn execute_trash(
    vfs: &VfsFilesystem,
    plan: &FileOperationPlan,
) -> Result<(), FileOperationError> {
    for source in &plan.sources {
        if source.scheme() == "local" {
            move_to_trash(&source.to_local_path()?)?;
        } else {
            return Err(FileOperationError::UnsupportedTrash {
                message: "remote trash is not supported".to_string(),
            });
        }
    }

    let _ = vfs;
    Ok(())
}

pub(super) fn execute_delete_permanently(
    vfs: &VfsFilesystem,
    plan: &FileOperationPlan,
) -> Result<(), FileOperationError> {
    for source in &plan.sources {
        vfs.remove(source, true)?;
    }

    Ok(())
}
#[allow(clippy::too_many_arguments)]
pub(super) fn copy_file_streaming(
    source: &Path,
    destination: &Path,
    conflict_policy: ConflictPolicy,
    job_id: &JobId,
    cancel: &CancellationToken,
    pause: &PauseToken,
    progress: &mut ExecutionProgress<'_>,
    sink: &FileOperationEventSink,
) -> Result<bool, FileOperationError> {
    match fs::symlink_metadata(destination) {
        Ok(_) if conflict_policy == ConflictPolicy::Fail => {
            return Err(FileOperationError::DestinationConflict {
                uri: ResourceUri::from_local_path(destination)?
                    .as_str()
                    .to_string(),
            });
        }
        Ok(_) if conflict_policy == ConflictPolicy::Skip => return Ok(false),
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(map_std_io_error(destination, error)),
    }

    let mut input = File::open(source).map_err(|error| map_std_io_error(source, error))?;
    let parent = destination
        .parent()
        .ok_or_else(|| FileOperationError::InvalidRequest {
            message: "copy destination has no parent directory".to_string(),
        })?;
    let (staging_path, mut output) = create_copy_staging_file(parent)?;
    let mut staging = CopyStagingCleanup::new(staging_path.clone());
    let mut buffer = vec![0_u8; COPY_BUFFER_SIZE];

    loop {
        check_cancelled(cancel, pause, job_id)?;

        let bytes = input
            .read(&mut buffer)
            .map_err(|error| map_std_io_error(source, error))?;

        if bytes == 0 {
            break;
        }

        output
            .write_all(&buffer[..bytes])
            .map_err(|error| map_std_io_error(&staging_path, error))?;
        progress.completed_bytes += bytes as u64;
        progress.emit_chunk(job_id, destination, sink);
    }

    output
        .sync_all()
        .map_err(|error| map_std_io_error(&staging_path, error))?;
    drop(output);

    if let Ok(metadata) = fs::metadata(source) {
        let modified = FileTime::from_last_modification_time(&metadata);
        let accessed = FileTime::from_last_access_time(&metadata);
        let _ = filetime::set_file_times(&staging_path, accessed, modified);
    }

    if conflict_policy == ConflictPolicy::Skip && fs::symlink_metadata(destination).is_ok() {
        return Ok(false);
    }
    check_cancelled(cancel, pause, job_id)?;
    let resolved = resolve_conflict_path(destination.to_path_buf(), conflict_policy)?;
    if let Err(error) = rename_no_replace(&staging_path, &resolved) {
        if error.kind() == std::io::ErrorKind::AlreadyExists {
            return Err(FileOperationError::DestinationConflict {
                uri: ResourceUri::from_local_path(&resolved)?
                    .as_str()
                    .to_string(),
            });
        } else {
            return Err(map_std_io_error(&staging_path, error));
        }
    }
    staging.disarm();
    check_cancelled(cancel, pause, job_id)?;

    Ok(true)
}

fn create_copy_staging_file(parent: &Path) -> Result<(PathBuf, File), FileOperationError> {
    for _ in 0..100 {
        let path = parent.join(format!(".fileoctopus-copy-{}.tmp", uuid::Uuid::new_v4()));
        match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(file) => return Ok((path, file)),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
            Err(error) => return Err(map_std_io_error(&path, error)),
        }
    }
    Err(FileOperationError::io(
        "could not allocate a copy staging file",
    ))
}

struct CopyStagingCleanup {
    path: PathBuf,
    active: bool,
}

impl CopyStagingCleanup {
    fn new(path: PathBuf) -> Self {
        Self { path, active: true }
    }

    fn disarm(&mut self) {
        self.active = false;
    }
}

impl Drop for CopyStagingCleanup {
    fn drop(&mut self) {
        if self.active {
            let _ = fs::remove_file(&self.path);
        }
    }
}

pub(super) fn resolve_conflict_uri(
    vfs: &VfsFilesystem,
    destination: &ResourceUri,
    policy: ConflictPolicy,
) -> Result<ResourceUri, FileOperationError> {
    if !vfs.exists(destination)? {
        return Ok(destination.clone());
    }

    if destination.scheme() != "local" {
        return match policy {
            ConflictPolicy::Fail => Err(FileOperationError::DestinationConflict {
                uri: destination.as_str().to_string(),
            }),
            ConflictPolicy::Skip => Ok(destination.clone()),
            ConflictPolicy::Overwrite => {
                vfs.remove(destination, true)?;
                Ok(destination.clone())
            }
            ConflictPolicy::RenameNew | ConflictPolicy::RenameExisting => {
                Err(FileOperationError::InvalidRequest {
                    message: "remote conflict rename policies are not supported yet".to_string(),
                })
            }
        };
    }

    let resolved = resolve_conflict_path(destination.to_local_path()?, policy)?;
    ResourceUri::from_local_path(&resolved).map_err(FileOperationError::from)
}

pub(super) fn resolve_conflict_path(
    destination: PathBuf,
    policy: ConflictPolicy,
) -> Result<PathBuf, FileOperationError> {
    if !destination.exists() {
        return Ok(destination);
    }

    match policy {
        ConflictPolicy::Fail => Err(FileOperationError::DestinationConflict {
            uri: ResourceUri::from_local_path(&destination)?
                .as_str()
                .to_string(),
        }),
        ConflictPolicy::Skip => Ok(destination),
        ConflictPolicy::Overwrite => {
            if destination.is_dir() {
                fs::remove_dir_all(&destination)
                    .map_err(|error| map_std_io_error(&destination, error))?;
            } else {
                fs::remove_file(&destination)
                    .map_err(|error| map_std_io_error(&destination, error))?;
            }

            Ok(destination)
        }
        ConflictPolicy::RenameNew => Ok(next_available_path(&destination)),
        ConflictPolicy::RenameExisting => {
            let renamed = next_available_path(&destination);
            fs::rename(&destination, &renamed)
                .map_err(|error| map_std_io_error(&destination, error))?;
            Ok(destination)
        }
    }
}

pub(super) fn next_available_path(path: &Path) -> PathBuf {
    let parent = path.parent().unwrap_or_else(|| Path::new(""));
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("file");
    let extension = path.extension().and_then(|value| value.to_str());

    for index in 1..10_000 {
        let name = match extension {
            Some(extension) => format!("{stem} ({index}).{extension}"),
            None => format!("{stem} ({index})"),
        };
        let candidate = parent.join(name);

        if !candidate.exists() {
            return candidate;
        }
    }

    path.to_path_buf()
}

pub(super) fn check_cancelled(
    cancel: &CancellationToken,
    pause: &PauseToken,
    job_id: &JobId,
) -> Result<(), FileOperationError> {
    pause.wait_while_paused(cancel);
    if cancel.is_cancelled() {
        return Err(FileOperationError::Cancelled {
            job_id: Some(job_id.as_str().to_string()),
        });
    }

    Ok(())
}

pub(super) struct ExecutionProgress<'a> {
    plan: &'a FileOperationPlan,
    completed_items: u64,
    pub(super) completed_bytes: u64,
    last_emitted_bytes: u64,
}

impl<'a> ExecutionProgress<'a> {
    pub(super) fn new(plan: &'a FileOperationPlan) -> Self {
        Self {
            plan,
            completed_items: 0,
            completed_bytes: 0,
            last_emitted_bytes: 0,
        }
    }

    pub(super) fn emit_initial(&self, job_id: &JobId, sink: &FileOperationEventSink) {
        self.emit(job_id, None, sink);
    }

    pub(super) fn complete_item(
        &mut self,
        item: &FileOperationItem,
        job_id: &JobId,
        sink: &FileOperationEventSink,
    ) {
        self.completed_items += 1;
        self.emit(
            job_id,
            item.destination
                .as_ref()
                .or(item.source.as_ref())
                .map(|uri| uri.display_path()),
            sink,
        );
    }

    fn emit(&self, job_id: &JobId, current_item: Option<String>, sink: &FileOperationEventSink) {
        sink(JobEvent::Progress(JobProgressEvent {
            job_id: job_id.clone(),
            operation_kind: self.plan.kind,
            current_item,
            completed_items: self.completed_items,
            total_items: self.plan.total_items,
            completed_bytes: self.completed_bytes,
            total_bytes: self.plan.total_bytes,
            updated_at: Utc::now(),
        }));
    }

    pub(super) fn emit_chunk(
        &mut self,
        job_id: &JobId,
        path: &Path,
        sink: &FileOperationEventSink,
    ) {
        if self.completed_bytes.saturating_sub(self.last_emitted_bytes) < PROGRESS_BYTE_INTERVAL {
            return;
        }

        self.last_emitted_bytes = self.completed_bytes;
        self.emit(job_id, Some(path.to_string_lossy().to_string()), sink);
    }

    pub(super) fn emit_chunk_uri(
        &mut self,
        job_id: &JobId,
        uri: &ResourceUri,
        sink: &FileOperationEventSink,
    ) {
        if self.completed_bytes.saturating_sub(self.last_emitted_bytes) < PROGRESS_BYTE_INTERVAL {
            return;
        }

        self.last_emitted_bytes = self.completed_bytes;
        self.emit(job_id, Some(uri.display_path()), sink);
    }
}
