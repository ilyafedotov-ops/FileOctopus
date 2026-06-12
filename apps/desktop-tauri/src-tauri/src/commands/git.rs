use std::sync::Arc;

use app_core::AppState;
use app_ipc::{
    GitDiffFileRequest, GitDiffFileResponse, GitDiscoverRequest, GitDiscoverResponse,
    GitStatusForDirectoryRequest, GitStatusForDirectoryResponse, GitStatusForRepositoryRequest,
    GitStatusForRepositoryResponse, IpcError,
};
use tauri::State;
use vfs::ResourceUri;

#[tauri::command]
pub async fn git_discover(
    state: State<'_, Arc<AppState>>,
    request: GitDiscoverRequest,
) -> Result<GitDiscoverResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let repo = state.git().discover(&uri).await.map_err(IpcError::from)?;

    Ok(GitDiscoverResponse {
        repo: repo.map(Into::into),
    })
}

#[tauri::command]
pub async fn git_status_for_directory(
    state: State<'_, Arc<AppState>>,
    request: GitStatusForDirectoryRequest,
) -> Result<GitStatusForDirectoryResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let status = state
        .git()
        .status_for_directory(&uri)
        .await
        .map_err(IpcError::from)?;

    Ok(status.into())
}

#[tauri::command]
pub async fn git_status_for_repository(
    state: State<'_, Arc<AppState>>,
    request: GitStatusForRepositoryRequest,
) -> Result<GitStatusForRepositoryResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let status = state
        .git()
        .status_for_repository(&uri)
        .await
        .map_err(IpcError::from)?;

    Ok(status.into())
}

#[tauri::command]
pub async fn git_diff_file(
    state: State<'_, Arc<AppState>>,
    request: GitDiffFileRequest,
) -> Result<GitDiffFileResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let diff = state
        .git()
        .diff_file(&uri, request.max_bytes)
        .await
        .map_err(IpcError::from)?;

    Ok(diff.into())
}
