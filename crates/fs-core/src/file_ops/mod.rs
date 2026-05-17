mod archive;
mod execution;
mod paths;
mod planning;
mod trash;

use jobs::{CancellationToken, JobEvent, JobId};
use vfs::{
    ConflictPolicy, FileOperationError, FileOperationKind, FileOperationPlan, FileOperationRequest,
    ResourceUri,
};

use archive::{execute_create_archive, execute_extract_archive};
use execution::{
    execute_copy, execute_create_directory, execute_create_file, execute_delete_permanently,
    execute_move, execute_rename, execute_trash,
};
use planning::{
    detect_conflicts, plan_copy_or_move_items, plan_create_archive_items,
    plan_create_directory_item, plan_create_file_item, plan_delete_items,
    plan_extract_archive_items, plan_rename_item,
};

pub type FileOperationEventSink = dyn Fn(JobEvent) + Send + Sync;

pub fn plan_file_operation(
    request: FileOperationRequest,
) -> Result<FileOperationPlan, FileOperationError> {
    validate_request_shape(&request)?;

    let operation_id = uuid::Uuid::new_v4().to_string();
    let mut warnings = Vec::new();
    let mut items = match request.kind {
        FileOperationKind::Copy | FileOperationKind::Move => {
            plan_copy_or_move_items(&request, &mut warnings)?
        }
        FileOperationKind::Rename => vec![plan_rename_item(&request)?],
        FileOperationKind::CreateDirectory => vec![plan_create_directory_item(&request)?],
        FileOperationKind::CreateFile => vec![plan_create_file_item(&request)?],
        FileOperationKind::DeleteToTrash | FileOperationKind::DeletePermanently => {
            plan_delete_items(&request)?
        }
        FileOperationKind::CreateArchive => plan_create_archive_items(&request, &mut warnings)?,
        FileOperationKind::ExtractArchive => plan_extract_archive_items(&request)?,
        FileOperationKind::FolderSize | FileOperationKind::RecursiveSearch => {
            return Err(FileOperationError::InvalidRequest {
                message: "metadata jobs are started through filesystem commands".to_string(),
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

    let conflicts = detect_conflicts(&items);
    let total_items = items.len() as u64;
    let total_bytes = items
        .iter()
        .try_fold(0_u64, |total, item| item.size.map(|size| total + size));

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
    plan: &FileOperationPlan,
    job_id: &JobId,
    cancel: &CancellationToken,
    sink: &FileOperationEventSink,
) -> Result<(), FileOperationError> {
    if plan.conflict_policy == ConflictPolicy::Fail && !plan.conflicts.is_empty() {
        let uri = plan.conflicts[0].destination.as_str().to_string();
        return Err(FileOperationError::DestinationConflict { uri });
    }

    match plan.kind {
        FileOperationKind::Copy => execute_copy(plan, job_id, cancel, sink),
        FileOperationKind::Move => execute_move(plan, job_id, cancel, sink),
        FileOperationKind::Rename => execute_rename(plan),
        FileOperationKind::CreateDirectory => execute_create_directory(plan),
        FileOperationKind::CreateFile => execute_create_file(plan),
        FileOperationKind::DeleteToTrash => execute_trash(plan),
        FileOperationKind::DeletePermanently => execute_delete_permanently(plan),
        FileOperationKind::CreateArchive => execute_create_archive(plan, job_id, cancel, sink),
        FileOperationKind::ExtractArchive => execute_extract_archive(plan, job_id, cancel, sink),
        FileOperationKind::FolderSize | FileOperationKind::RecursiveSearch => {
            Err(FileOperationError::InvalidRequest {
                message: "metadata jobs are started through filesystem commands".to_string(),
            })
        }
    }
}

fn validate_request_shape(request: &FileOperationRequest) -> Result<(), FileOperationError> {
    for source in &request.sources {
        source.to_local_path()?;
    }

    if let Some(destination) = &request.destination {
        destination.to_local_path()?;
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
        FileOperationKind::FolderSize | FileOperationKind::RecursiveSearch => {
            return Err(FileOperationError::InvalidRequest {
                message: "metadata jobs are started through filesystem commands".to_string(),
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
