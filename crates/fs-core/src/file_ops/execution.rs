use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use chrono::Utc;
use filetime::FileTime;
use jobs::{CancellationToken, JobEvent, JobId, JobProgressEvent, PauseToken};
use vfs::{
    ConflictPolicy, FileKind, FileOperationError, FileOperationItem, FileOperationPlan, ResourceUri,
};

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
    let mut progress = ExecutionProgress::new(plan);
    progress.emit_initial(job_id, sink);

    for item in &plan.items {
        check_cancelled(cancel, pause, job_id)?;
        let Some(destination) = &item.destination else {
            continue;
        };

        if vfs.exists(destination)? && plan.conflict_policy == ConflictPolicy::Skip {
            progress.complete_item(item, job_id, sink);
            continue;
        }

        let destination = resolve_conflict_uri(vfs, destination, plan.conflict_policy)?;

        match item.kind {
            FileKind::Directory => vfs.mkdir(&destination)?,
            FileKind::File | FileKind::Archive | FileKind::Virtual | FileKind::Unknown => {
                if let Some(source) = &item.source {
                    if source.scheme() == "local" && destination.scheme() == "local" {
                        copy_file_streaming(
                            &source.to_local_path()?,
                            &destination.to_local_path()?,
                            job_id,
                            cancel,
                            pause,
                            &mut progress,
                            sink,
                        )?;
                    } else {
                        let destination_uri = destination.clone();
                        vfs.copy_file(source, &destination_uri, |bytes| {
                            progress.completed_bytes = bytes;
                            progress.emit_chunk_uri(job_id, &destination_uri, sink);
                        })?;
                    }
                }
            }
            FileKind::Symlink => {
                let source =
                    item.source
                        .as_ref()
                        .ok_or_else(|| FileOperationError::InvalidRequest {
                            message: "symlink item has no source".to_string(),
                        })?;

                return Err(FileOperationError::UnsupportedSymlink {
                    uri: source.as_str().to_string(),
                    message: "copying symlink objects is not supported in the MVP".to_string(),
                });
            }
        }

        progress.complete_item(item, job_id, sink);
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

    execute_copy(vfs, plan, job_id, cancel, pause, sink)?;

    for source in &plan.sources {
        vfs.remove(source, true)?;
    }

    Ok(())
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

    if vfs.exists(destination)? {
        return Err(FileOperationError::DestinationConflict {
            uri: destination.as_str().to_string(),
        });
    }

    vfs.rename(source, destination)
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
pub(super) fn copy_file_streaming(
    source: &Path,
    destination: &Path,
    job_id: &JobId,
    cancel: &CancellationToken,
    pause: &PauseToken,
    progress: &mut ExecutionProgress<'_>,
    sink: &FileOperationEventSink,
) -> Result<(), FileOperationError> {
    let mut input = File::open(source).map_err(|error| map_std_io_error(source, error))?;
    let mut output =
        File::create(destination).map_err(|error| map_std_io_error(destination, error))?;
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
            .map_err(|error| map_std_io_error(destination, error))?;
        progress.completed_bytes += bytes as u64;
        progress.emit_chunk(job_id, destination, sink);
    }

    if let Ok(metadata) = fs::metadata(source) {
        let modified = FileTime::from_last_modification_time(&metadata);
        let accessed = FileTime::from_last_access_time(&metadata);
        let _ = filetime::set_file_times(destination, accessed, modified);
    }

    Ok(())
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
