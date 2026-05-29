use app_ipc::{IpcError, SyncDirectoriesRequest, SyncDirectoriesResponse, SyncEntryDto};
use fs_core::sync::{self, SyncComparison, SyncFileStatus};

#[tauri::command]
pub async fn fs_sync_directories(
    request: SyncDirectoriesRequest,
) -> Result<SyncDirectoriesResponse, IpcError> {
    let left_uri = vfs::ResourceUri::parse(&request.left_uri).map_err(IpcError::from)?;
    let right_uri = vfs::ResourceUri::parse(&request.right_uri).map_err(IpcError::from)?;

    let comparison = match request.comparison.as_str() {
        "size" => SyncComparison::BySize,
        "date" => SyncComparison::ByDate,
        _ => SyncComparison::ByName,
    };

    let plan = sync::compare_directories(&left_uri, &right_uri, comparison, request.recursive)
        .map_err(IpcError::from)?;

    Ok(SyncDirectoriesResponse {
        left_uri: plan.left_uri,
        right_uri: plan.right_uri,
        recursive: plan.recursive,
        entries: plan
            .entries
            .into_iter()
            .map(|e| {
                let status = match e.status {
                    SyncFileStatus::OnlyLeft => "onlyLeft",
                    SyncFileStatus::OnlyRight => "onlyRight",
                    SyncFileStatus::Same => "same",
                    SyncFileStatus::NewerLeft => "newerLeft",
                    SyncFileStatus::NewerRight => "newerRight",
                    SyncFileStatus::Different => "different",
                };
                SyncEntryDto {
                    name: e.name,
                    left_uri: e.left_uri,
                    right_uri: e.right_uri,
                    left_size: e.left_size,
                    right_size: e.right_size,
                    left_modified: e.left_modified.map(|dt| dt.to_rfc3339()),
                    right_modified: e.right_modified.map(|dt| dt.to_rfc3339()),
                    left_is_dir: e.left_is_dir,
                    right_is_dir: e.right_is_dir,
                    status: status.to_string(),
                }
            })
            .collect(),
    })
}
