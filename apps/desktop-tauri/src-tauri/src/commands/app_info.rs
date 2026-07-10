use std::sync::Arc;

use app_core::{is_network_enabled, AppPaths, AppState};
use app_ipc::AppInfoResponse;
use tauri::State;

#[tauri::command]
pub fn app_get_info(state: State<'_, Arc<AppState>>) -> AppInfoResponse {
    app_info_for_paths(state.paths())
}

pub(crate) fn app_info_for_paths(paths: &AppPaths) -> AppInfoResponse {
    AppInfoResponse {
        name: "FileOctopus".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        build_profile: if cfg!(debug_assertions) {
            "debug".to_string()
        } else {
            "release".to_string()
        },
        commit_sha: option_env!("FILEOCTOPUS_COMMIT_SHA")
            .or(option_env!("GIT_COMMIT_SHA"))
            .map(ToString::to_string),
        target_os: std::env::consts::OS.to_string(),
        data_dir: paths.data_dir.to_string_lossy().to_string(),
        network_enabled: is_network_enabled(),
    }
}
