use app_core::AppCore;

mod commands;
mod emit;
mod state;

use state::{ListingRegistry, MetadataJobState, WatchState};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppCore::boot().expect("failed to boot FileOctopus app core");

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(app_state)
        .manage(WatchState::default())
        .manage(MetadataJobState::default())
        .manage(ListingRegistry::default())
        .setup(|app| {
            telemetry::info("FileOctopus Tauri shell started");

            let app_handle = app.handle().clone();
            let state = app_handle
                .state::<std::sync::Arc<app_core::AppState>>()
                .inner()
                .clone();

            commands::terminal::start_terminal_event_bridge(app_handle.clone(), state.clone());

            let sessions_for_reaper = state.sessions();
            tauri::async_runtime::spawn(async move {
                remote_core::run_idle_reaper(sessions_for_reaper).await;
            });

            let mut rx = state.sessions().subscribe_status();
            tauri::async_runtime::spawn(async move {
                use app_ipc::{NetworkStatusEventDto, NETWORK_STATUS_EVENT};
                while let Ok(event) = rx.recv().await {
                    let (status, message) = match event.status {
                        remote_core::ConnectionStatus::Connected => ("connected".to_string(), None),
                        remote_core::ConnectionStatus::Disconnected => {
                            ("disconnected".to_string(), None)
                        }
                        remote_core::ConnectionStatus::Error { message } => {
                            ("error".to_string(), Some(message))
                        }
                    };
                    crate::emit::emit_with_eval(
                        &app_handle,
                        NETWORK_STATUS_EVENT,
                        NetworkStatusEventDto {
                            profile_id: event.profile_id,
                            status,
                            message,
                        },
                    );
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_info::app_get_info,
            commands::fs::fs_stat,
            commands::fs::fs_read_text_file,
            commands::fs::fs_read_image_as_data_uri,
            commands::fs::fs_compute_hash,
            commands::fs::fs_open_terminal,
            commands::fs::fs_list_start,
            commands::fs::fs_standard_locations,
            commands::fs::fs_discover_volumes,
            commands::fs::fs_open_default,
            commands::fs::fs_reveal,
            commands::fs::fs_properties,
            commands::folder_size::fs_folder_size,
            commands::folder_size::fs_folder_size_start,
            commands::recursive_search::fs_recursive_search,
            commands::recursive_search::fs_recursive_search_start,
            commands::watch::fs_watch_start,
            commands::watch::fs_watch_stop,
            commands::preferences::get_preferences,
            commands::preferences::set_preference,
            commands::autostart::get_autostart,
            commands::autostart::set_autostart,
            commands::navigation::navigation_record_visit,
            commands::navigation::navigation_list_favorites,
            commands::navigation::navigation_add_favorite,
            commands::navigation::navigation_remove_favorite,
            commands::navigation::navigation_rename_favorite,
            commands::navigation::navigation_list_recent,
            commands::navigation::navigation_list_starred,
            commands::navigation::navigation_toggle_starred,
            commands::navigation::navigation_is_starred,
            commands::navigation::navigation_clear_recent,
            commands::navigation::navigation_remove_recent,
            commands::network::network_profiles_list,
            commands::network::network_profile_add,
            commands::network::network_profile_update,
            commands::network::network_profile_delete,
            commands::network::network_profile_set_secret,
            commands::network::network_profile_forget_fingerprint,
            commands::network::network_connect,
            commands::network::network_disconnect,
            commands::network::network_connection_status,
            commands::network::network_validate_uri,
            commands::file_operations::plan_file_operation,
            commands::file_operations::start_file_operation,
            commands::file_operations::cancel_job,
            commands::file_operations::get_job_status,
            commands::file_operations::list_recent_operations,
            commands::file_operations::clear_operation_history,
            commands::diagnostics::diagnostics_app_data_health,
            commands::diagnostics::export_diagnostics_bundle,
            commands::terminal::terminal_spawn,
            commands::terminal::terminal_write,
            commands::terminal::terminal_resize,
            commands::terminal::terminal_kill,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run FileOctopus");
}

#[cfg(test)]
mod tests;
