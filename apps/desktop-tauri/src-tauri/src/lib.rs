use app_core::AppCore;

mod commands;
mod emit;
mod state;

use state::{ListingRegistry, MetadataJobState, WatchState};

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
        .setup(|_app| {
            telemetry::info("FileOctopus Tauri shell started");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_info::app_get_info,
            commands::fs::fs_stat,
            commands::fs::fs_read_text_file,
            commands::fs::fs_compute_hash,
            commands::fs::fs_open_terminal,
            commands::fs::fs_list_start,
            commands::fs::fs_standard_locations,
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
            commands::file_operations::plan_file_operation,
            commands::file_operations::start_file_operation,
            commands::file_operations::cancel_job,
            commands::file_operations::get_job_status,
            commands::file_operations::list_recent_operations,
            commands::file_operations::clear_operation_history,
            commands::diagnostics::diagnostics_app_data_health,
            commands::diagnostics::export_diagnostics_bundle,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run FileOctopus");
}

#[cfg(test)]
mod tests;
