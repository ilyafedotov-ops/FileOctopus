mod archive;
mod execution;
mod paths;
pub(crate) mod planning;
mod trash;

use crate::vfs_io::VfsFilesystem;
use jobs::{CancellationToken, JobEvent, JobId, PauseToken};
use vfs::{
    ConflictPolicy, FileOperationError, FileOperationKind, FileOperationPlan, FileOperationRequest,
    ResourceUri, REMOTE_SCHEMES,
};

use archive::{bind_archive_fingerprint, execute_create_archive, execute_extract_archive};
use execution::{
    execute_batch_rename, execute_copy, execute_create_directory, execute_create_file,
    execute_delete_permanently, execute_move, execute_rename, execute_trash,
};
use planning::{
    detect_conflicts, plan_batch_rename_items, plan_copy_or_move_items, plan_create_archive_items,
    plan_create_directory_item, plan_create_file_item, plan_delete_items,
    plan_extract_archive_items, plan_rename_item,
};

pub type FileOperationEventSink = dyn Fn(JobEvent) + Send + Sync;

pub fn plan_file_operation(
    vfs: &VfsFilesystem,
    request: FileOperationRequest,
) -> Result<FileOperationPlan, FileOperationError> {
    validate_request_shape(vfs, &request)?;

    let operation_id = uuid::Uuid::new_v4().to_string();
    let mut archive_fingerprint = None;
    let mut warnings = Vec::new();
    let mut items = match request.kind {
        FileOperationKind::Copy | FileOperationKind::Move => {
            plan_copy_or_move_items(vfs, &request, &mut warnings)?
        }
        FileOperationKind::Rename => vec![plan_rename_item(vfs, &request)?],
        FileOperationKind::BatchRename => plan_batch_rename_items(&request)?,
        FileOperationKind::CreateDirectory => vec![plan_create_directory_item(vfs, &request)?],
        FileOperationKind::CreateFile => vec![plan_create_file_item(vfs, &request)?],
        FileOperationKind::DeleteToTrash | FileOperationKind::DeletePermanently => {
            plan_delete_items(vfs, &request)?
        }
        FileOperationKind::CreateArchive => plan_create_archive_items(&request, &mut warnings)?,
        FileOperationKind::ExtractArchive => {
            let (items, fingerprint) = plan_extract_archive_items(&request)?;
            archive_fingerprint = Some(fingerprint);
            items
        }
        FileOperationKind::WriteTextFile
        | FileOperationKind::FolderSize
        | FileOperationKind::RecursiveSearch
        | FileOperationKind::ContentSearch => {
            return Err(FileOperationError::InvalidRequest {
                message: "operation is started through a dedicated filesystem command".to_string(),
            });
        }
    };

    items.sort_by(|left, right| {
        let left_key = left
            .source
            .as_ref()
            .or(left.destination.as_ref())
            .map(ResourceUri::as_str)
            .unwrap_or("");
        let right_key = right
            .source
            .as_ref()
            .or(right.destination.as_ref())
            .map(ResourceUri::as_str)
            .unwrap_or("");

        left_key.cmp(right_key)
    });

    let conflicts = if request.kind == FileOperationKind::BatchRename {
        Vec::new()
    } else {
        detect_conflicts(vfs, &items)
    };
    let total_items = items.len() as u64;
    let total_bytes = items
        .iter()
        .try_fold(0_u64, |total, item| item.size.map(|size| total + size));

    let operation_id = archive_fingerprint
        .as_deref()
        .map(|fingerprint| bind_archive_fingerprint(operation_id.clone(), fingerprint))
        .unwrap_or(operation_id);

    Ok(FileOperationPlan {
        operation_id,
        kind: request.kind,
        sources: request.sources,
        destination: request.destination,
        new_name: request.new_name,
        conflict_policy: request.conflict_policy,
        items,
        conflicts,
        warnings,
        total_items,
        total_bytes,
    })
}

pub fn execute_file_operation(
    vfs: &VfsFilesystem,
    plan: &FileOperationPlan,
    job_id: &JobId,
    cancel: &CancellationToken,
    pause: &PauseToken,
    sink: &FileOperationEventSink,
) -> Result<(), FileOperationError> {
    if plan.conflict_policy == ConflictPolicy::Fail && !plan.conflicts.is_empty() {
        let uri = plan.conflicts[0].destination.as_str().to_string();
        return Err(FileOperationError::DestinationConflict { uri });
    }

    match plan.kind {
        FileOperationKind::Copy => execute_copy(vfs, plan, job_id, cancel, pause, sink),
        FileOperationKind::Move => execute_move(vfs, plan, job_id, cancel, pause, sink),
        FileOperationKind::Rename => execute_rename(vfs, plan),
        FileOperationKind::BatchRename => execute_batch_rename(plan, job_id, cancel, pause, sink),
        FileOperationKind::CreateDirectory => execute_create_directory(vfs, plan),
        FileOperationKind::CreateFile => execute_create_file(vfs, plan),
        FileOperationKind::DeleteToTrash => execute_trash(vfs, plan),
        FileOperationKind::DeletePermanently => execute_delete_permanently(vfs, plan),
        FileOperationKind::CreateArchive => {
            execute_create_archive(plan, job_id, cancel, pause, sink)
        }
        FileOperationKind::ExtractArchive => {
            execute_extract_archive(plan, job_id, cancel, pause, sink)
        }
        FileOperationKind::WriteTextFile
        | FileOperationKind::FolderSize
        | FileOperationKind::RecursiveSearch
        | FileOperationKind::ContentSearch => Err(FileOperationError::InvalidRequest {
            message: "operation is started through a dedicated filesystem command".to_string(),
        }),
    }
}

fn validate_request_shape(
    vfs: &VfsFilesystem,
    request: &FileOperationRequest,
) -> Result<(), FileOperationError> {
    for source in &request.sources {
        vfs.validate_uri(source)?;
    }

    for rename in &request.batch_renames {
        vfs.validate_uri(&rename.source)?;
    }

    if let Some(destination) = &request.destination {
        vfs.validate_uri(destination)?;
    }

    if request.kind != FileOperationKind::BatchRename && !request.batch_renames.is_empty() {
        return Err(FileOperationError::InvalidRequest {
            message: "batch renames are only valid for batch rename operations".to_string(),
        });
    }

    if matches!(
        request.kind,
        FileOperationKind::CreateArchive | FileOperationKind::ExtractArchive
    ) {
        for source in &request.sources {
            if REMOTE_SCHEMES.contains(&source.scheme()) {
                return Err(FileOperationError::UnsupportedProvider {
                    scheme: source.scheme().to_string(),
                });
            }
        }
        if let Some(destination) = &request.destination {
            if REMOTE_SCHEMES.contains(&destination.scheme()) {
                return Err(FileOperationError::UnsupportedProvider {
                    scheme: destination.scheme().to_string(),
                });
            }
        }
    }

    match request.kind {
        FileOperationKind::Copy | FileOperationKind::Move => {
            if request.sources.is_empty() {
                return Err(FileOperationError::InvalidRequest {
                    message: "operation requires at least one source".to_string(),
                });
            }

            if request.destination.is_none() {
                return Err(FileOperationError::InvalidRequest {
                    message: "operation requires a destination".to_string(),
                });
            }
        }
        FileOperationKind::Rename => {
            if request.sources.len() != 1 {
                return Err(FileOperationError::InvalidRequest {
                    message: "rename requires exactly one source".to_string(),
                });
            }

            validate_basename(request.new_name.as_deref().unwrap_or_default())?;
        }
        FileOperationKind::BatchRename => {
            if request.batch_renames.is_empty() {
                return Err(FileOperationError::InvalidRequest {
                    message: "batch rename requires at least one source".to_string(),
                });
            }

            if request.sources.len() != request.batch_renames.len()
                || request
                    .sources
                    .iter()
                    .zip(&request.batch_renames)
                    .any(|(source, rename)| source != &rename.source)
            {
                return Err(FileOperationError::InvalidRequest {
                    message: "batch rename sources must match the rename entries".to_string(),
                });
            }

            if request.destination.is_some() || request.new_name.is_some() {
                return Err(FileOperationError::InvalidRequest {
                    message: "batch rename does not accept a destination or single new name"
                        .to_string(),
                });
            }

            if request.conflict_policy != ConflictPolicy::Fail {
                return Err(FileOperationError::InvalidRequest {
                    message: "batch rename requires the fail conflict policy".to_string(),
                });
            }

            for rename in &request.batch_renames {
                if rename.source.scheme() != "local" {
                    return Err(FileOperationError::UnsupportedProvider {
                        scheme: rename.source.scheme().to_string(),
                    });
                }
                validate_basename(&rename.new_name)?;
            }
        }
        FileOperationKind::CreateDirectory => {
            if request.destination.is_none() {
                return Err(FileOperationError::InvalidRequest {
                    message: "create directory requires a destination".to_string(),
                });
            }
        }
        FileOperationKind::CreateFile => {
            if request.destination.is_none() {
                return Err(FileOperationError::InvalidRequest {
                    message: "create file requires a destination".to_string(),
                });
            }
        }
        FileOperationKind::DeleteToTrash | FileOperationKind::DeletePermanently => {
            if request.sources.is_empty() {
                let message = if request.kind == FileOperationKind::DeleteToTrash {
                    "trash operation requires at least one source"
                } else {
                    "delete permanently operation requires at least one source"
                };

                return Err(FileOperationError::InvalidRequest {
                    message: message.to_string(),
                });
            }
        }
        FileOperationKind::CreateArchive => {
            if request.sources.is_empty() {
                return Err(FileOperationError::InvalidRequest {
                    message: "create archive requires at least one source".to_string(),
                });
            }

            if request.destination.is_none() {
                return Err(FileOperationError::InvalidRequest {
                    message: "create archive requires a destination".to_string(),
                });
            }
        }
        FileOperationKind::ExtractArchive => {
            if request.sources.len() != 1 {
                return Err(FileOperationError::InvalidRequest {
                    message: "extract archive requires exactly one source".to_string(),
                });
            }

            if request.destination.is_none() {
                return Err(FileOperationError::InvalidRequest {
                    message: "extract archive requires a destination".to_string(),
                });
            }
        }
        FileOperationKind::WriteTextFile
        | FileOperationKind::FolderSize
        | FileOperationKind::RecursiveSearch
        | FileOperationKind::ContentSearch => {
            return Err(FileOperationError::InvalidRequest {
                message: "operation is started through a dedicated filesystem command".to_string(),
            });
        }
    }

    Ok(())
}

fn validate_basename(name: &str) -> Result<(), FileOperationError> {
    if name.trim().is_empty()
        || name.contains('/')
        || name.contains('\\')
        || name.contains('\0')
        || name == "."
        || name == ".."
    {
        return Err(FileOperationError::InvalidName {
            name: name.to_string(),
        });
    }

    Ok(())
}

#[cfg(test)]
mod tests;
