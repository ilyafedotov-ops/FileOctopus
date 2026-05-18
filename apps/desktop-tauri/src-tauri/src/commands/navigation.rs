use std::sync::Arc;

use app_core::AppState;
use app_ipc::{
    IpcError, NavigationAddFavoriteRequest, NavigationFavoriteResponse, NavigationIsStarredRequest,
    NavigationIsStarredResponse, NavigationListFavoritesResponse, NavigationListRecentRequest,
    NavigationListRecentResponse, NavigationListStarredResponse, NavigationRecordVisitRequest,
    NavigationRemoveFavoriteRequest, NavigationRemoveRecentRequest,
    NavigationRenameFavoriteRequest, NavigationToggleStarredRequest,
    NavigationToggleStarredResponse, OkResponse,
};
use config::RecentBucket;
use tauri::State;
use vfs::ResourceUri;

fn navigation_error(error: config::NavigationError) -> IpcError {
    IpcError::navigation_error(error.to_string())
}

#[tauri::command]
pub fn navigation_record_visit(
    request: NavigationRecordVisitRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<OkResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    state
        .navigation()
        .record_visit(uri.as_str(), &request.label)
        .map_err(navigation_error)?;

    Ok(OkResponse { ok: true })
}

#[tauri::command]
pub fn navigation_list_favorites(
    state: State<'_, Arc<AppState>>,
) -> Result<NavigationListFavoritesResponse, IpcError> {
    let favorites = state
        .navigation()
        .list_favorites()
        .map_err(navigation_error)?
        .into_iter()
        .map(Into::into)
        .collect();

    Ok(NavigationListFavoritesResponse { favorites })
}

#[tauri::command]
pub fn navigation_add_favorite(
    request: NavigationAddFavoriteRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<NavigationFavoriteResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let favorite = state
        .navigation()
        .add_favorite(uri.as_str(), &request.label)
        .map_err(navigation_error)?;

    Ok(NavigationFavoriteResponse {
        favorite: favorite.into(),
    })
}

#[tauri::command]
pub fn navigation_remove_favorite(
    request: NavigationRemoveFavoriteRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<OkResponse, IpcError> {
    state
        .navigation()
        .remove_favorite(request.id)
        .map_err(navigation_error)?;

    Ok(OkResponse { ok: true })
}

#[tauri::command]
pub fn navigation_rename_favorite(
    request: NavigationRenameFavoriteRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<NavigationFavoriteResponse, IpcError> {
    let favorite = state
        .navigation()
        .rename_favorite(request.id, &request.label)
        .map_err(navigation_error)?;

    Ok(NavigationFavoriteResponse {
        favorite: favorite.into(),
    })
}

#[tauri::command]
pub fn navigation_list_recent(
    request: NavigationListRecentRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<NavigationListRecentResponse, IpcError> {
    let bucket = RecentBucket::parse(&request.bucket).map_err(navigation_error)?;
    let entries = state
        .navigation()
        .list_recent(bucket)
        .map_err(navigation_error)?
        .into_iter()
        .map(Into::into)
        .collect();

    Ok(NavigationListRecentResponse { entries })
}

#[tauri::command]
pub fn navigation_list_starred(
    state: State<'_, Arc<AppState>>,
) -> Result<NavigationListStarredResponse, IpcError> {
    let entries = state
        .navigation()
        .list_starred()
        .map_err(navigation_error)?
        .into_iter()
        .map(Into::into)
        .collect();

    Ok(NavigationListStarredResponse { entries })
}

#[tauri::command]
pub fn navigation_toggle_starred(
    request: NavigationToggleStarredRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<NavigationToggleStarredResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let starred = state
        .navigation()
        .toggle_starred(uri.as_str(), &request.label)
        .map_err(navigation_error)?;

    Ok(NavigationToggleStarredResponse { starred })
}

#[tauri::command]
pub fn navigation_is_starred(
    request: NavigationIsStarredRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<NavigationIsStarredResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let starred = state
        .navigation()
        .is_starred(uri.as_str())
        .map_err(navigation_error)?;

    Ok(NavigationIsStarredResponse { starred })
}

#[tauri::command]
pub fn navigation_clear_recent(state: State<'_, Arc<AppState>>) -> Result<OkResponse, IpcError> {
    state
        .navigation()
        .clear_recent()
        .map_err(navigation_error)?;
    Ok(OkResponse { ok: true })
}

#[tauri::command]
pub fn navigation_remove_recent(
    request: NavigationRemoveRecentRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<OkResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    state
        .navigation()
        .remove_recent(uri.as_str())
        .map_err(navigation_error)?;
    Ok(OkResponse { ok: true })
}
