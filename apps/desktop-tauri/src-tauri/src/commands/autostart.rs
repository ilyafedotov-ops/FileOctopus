use app_ipc::{AutostartStatusDto, IpcError};
use tauri_plugin_autostart::ManagerExt;

#[tauri::command]
pub async fn get_autostart(app: tauri::AppHandle) -> Result<AutostartStatusDto, IpcError> {
    let manager = app.autolaunch();
    match manager.is_enabled() {
        Ok(enabled) => Ok(AutostartStatusDto {
            enabled,
            supported: true,
        }),
        Err(error) => {
            telemetry::error(&format!("autostart_unavailable: {}", error));
            Ok(AutostartStatusDto {
                enabled: false,
                supported: false,
            })
        }
    }
}

#[tauri::command]
pub async fn set_autostart(
    app: tauri::AppHandle,
    enabled: bool,
) -> Result<AutostartStatusDto, IpcError> {
    let manager = app.autolaunch();
    let result = if enabled {
        manager.enable()
    } else {
        manager.disable()
    };

    match result {
        Ok(()) => match manager.is_enabled() {
            Ok(state) => Ok(AutostartStatusDto {
                enabled: state,
                supported: true,
            }),
            Err(error) => Err(IpcError::autostart_unavailable(error.to_string())),
        },
        Err(error) => Err(IpcError::autostart_unavailable(error.to_string())),
    }
}
