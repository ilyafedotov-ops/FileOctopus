use app_core::{is_network_enabled, AppPaths};
use app_ipc::AppInfoResponse;

#[tauri::command]
pub fn app_get_info() -> AppInfoResponse {
    let paths = AppPaths::default();
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
