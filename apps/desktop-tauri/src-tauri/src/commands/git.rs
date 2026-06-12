use std::sync::Arc;

use app_core::AppState;
use app_ipc::{
    GitBranchesRequest, GitBranchesResponse, GitDiffFileRequest, GitDiffFileResponse,
    GitDiscoverRequest, GitDiscoverResponse, GitHistoryRequest, GitHistoryResponse,
    GitStatusForDirectoryRequest, GitStatusForDirectoryResponse, GitStatusForRepositoryRequest,
    GitStatusForRepositoryResponse, GitWorktreesRequest, GitWorktreesResponse, IpcError,
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

#[tauri::command]
pub async fn git_history(
    state: State<'_, Arc<AppState>>,
    request: GitHistoryRequest,
) -> Result<GitHistoryResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let history = state
        .git()
        .history(&uri, request.max_count)
        .await
        .map_err(IpcError::from)?;

    Ok(history.into())
}

#[tauri::command]
pub async fn git_branches(
    state: State<'_, Arc<AppState>>,
    request: GitBranchesRequest,
) -> Result<GitBranchesResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let branches = state.git().branches(&uri).await.map_err(IpcError::from)?;

    Ok(branches.into())
}

#[tauri::command]
pub async fn git_worktrees(
    state: State<'_, Arc<AppState>>,
    request: GitWorktreesRequest,
) -> Result<GitWorktreesResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let worktrees = state.git().worktrees(&uri).await.map_err(IpcError::from)?;

    Ok(worktrees.into())
}
