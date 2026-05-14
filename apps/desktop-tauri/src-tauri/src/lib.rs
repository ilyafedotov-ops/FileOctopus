use std::sync::Arc;

use app_core::{AppCore, AppState};
use app_ipc::{
    DirectoryBatchEventDto, IpcError, ListStartRequest, ListStartResponse, StatRequest,
    StatResponse, DIRECTORY_BATCH_EVENT,
};
use tauri::{AppHandle, Emitter, State};
use vfs::{DirectoryBatch, ListOptions, ListSessionId, ResourceUri};

#[tauri::command]
fn app_get_info() -> serde_json::Value {
    serde_json::json!({
        "name": "FileOctopus",
        "version": env!("CARGO_PKG_VERSION")
    })
}

#[tauri::command]
async fn fs_stat(
    request: StatRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<StatResponse, IpcError> {
    telemetry::debug("fs.stat requested");

    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let entry = state.vfs().stat(&uri).await.map_err(IpcError::from)?;

    Ok(StatResponse {
        entry: entry.into(),
    })
}

#[tauri::command]
async fn fs_list_start(
    request: ListStartRequest,
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<ListStartResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let session_id = ListSessionId::new(&uuid::Uuid::new_v4().to_string());
    let response = ListStartResponse {
        session_id: session_id.as_str().to_string(),
    };
    let options = ListOptions {
        session_id,
        batch_size: request.batch_size.unwrap_or(256).max(1),
        include_hidden: request.include_hidden.unwrap_or(false),
    };
    let (sender, mut receiver) = tokio::sync::mpsc::channel::<DirectoryBatch>(16);
    let events_app = app.clone();
    let listing_app = app.clone();
    let vfs = state.vfs();
    let list_uri = uri.clone();
    let error_uri = uri.clone();
    let error_session_id = response.session_id.clone();

    telemetry::debug("fs.list_start requested");

    tauri::async_runtime::spawn(async move {
        while let Some(batch) = receiver.recv().await {
            if let Err(error) =
                events_app.emit(DIRECTORY_BATCH_EVENT, DirectoryBatchEventDto::from(batch))
            {
                telemetry::error(&format!("failed to emit directory batch: {error}"));
                break;
            }
        }
    });

    tauri::async_runtime::spawn(async move {
        if let Err(error) = vfs.list(&list_uri, options, sender).await {
            telemetry::error(&format!("directory listing failed: {error}"));
            let event = DirectoryBatchEventDto {
                session_id: error_session_id,
                uri: error_uri.as_str().to_string(),
                entries: Vec::new(),
                batch_index: 0,
                is_complete: true,
                total_hint: None,
                error: Some(IpcError::from(error)),
            };

            let _ = listing_app.emit(DIRECTORY_BATCH_EVENT, event);
        }

        telemetry::debug("fs.list_start completed");
    });

    Ok(response)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppCore::boot().expect("failed to boot FileOctopus app core");

    tauri::Builder::default()
        .manage(app_state)
        .setup(|_app| {
            telemetry::info("FileOctopus Tauri shell started");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_get_info,
            fs_stat,
            fs_list_start
        ])
        .run(tauri::generate_context!())
        .expect("failed to run FileOctopus");
}
