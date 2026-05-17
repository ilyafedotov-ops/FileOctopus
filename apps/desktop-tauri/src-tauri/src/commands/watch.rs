use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use app_ipc::{IpcError, OkResponse, WatchEventDto, WatchStartRequest, WATCH_CHANGED_EVENT};
use chrono::Utc;
use tauri::{AppHandle, State};
use vfs::ResourceUri;

use crate::emit::emit_with_eval;
use crate::state::{WatchRuntime, WatchState};

#[tauri::command]
pub async fn fs_watch_start(
    request: WatchStartRequest,
    app: AppHandle,
    watch: State<'_, WatchState>,
) -> Result<OkResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let path = uri.to_local_path().map_err(IpcError::from)?;

    if !path.is_dir() {
        return Err(IpcError::folder_not_found(
            "Choose an existing folder to watch.",
        ));
    }

    stop_watcher(&watch)?;

    let stop = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let thread_stop = stop.clone();
    let event_uri = uri.as_str().to_string();
    let handle = std::thread::spawn(move || {
        let mut previous = folder_fingerprint(&path);

        while !thread_stop.load(std::sync::atomic::Ordering::Relaxed) {
            std::thread::sleep(Duration::from_millis(1200));
            let current = folder_fingerprint(&path);

            if current != previous {
                previous = current;
                emit_with_eval(
                    &app,
                    WATCH_CHANGED_EVENT,
                    WatchEventDto {
                        uri: event_uri.clone(),
                        changed_at: Utc::now(),
                    },
                );
            }
        }
    });

    *watch
        .current
        .lock()
        .map_err(|_| IpcError::internal("watch state lock poisoned"))? =
        Some(WatchRuntime { stop, handle });

    Ok(OkResponse { ok: true })
}

#[tauri::command]
pub async fn fs_watch_stop(watch: State<'_, WatchState>) -> Result<OkResponse, IpcError> {
    stop_watcher(&watch)?;

    Ok(OkResponse { ok: true })
}

pub(crate) fn stop_watcher(watch: &WatchState) -> Result<(), IpcError> {
    let current = watch
        .current
        .lock()
        .map_err(|_| IpcError::internal("watch state lock poisoned"))?
        .take();

    if let Some(runtime) = current {
        runtime
            .stop
            .store(true, std::sync::atomic::Ordering::Relaxed);
        let _ = runtime.handle.join();
    }

    Ok(())
}

pub(crate) fn folder_fingerprint(path: &Path) -> Vec<(String, u64)> {
    let mut entries = std::fs::read_dir(path)
        .ok()
        .into_iter()
        .flat_map(|items| items.filter_map(Result::ok))
        .filter_map(|entry| {
            let metadata = entry.metadata().ok()?;
            Some((
                entry.file_name().to_string_lossy().to_string(),
                metadata.len(),
            ))
        })
        .collect::<Vec<_>>();

    entries.sort();
    entries
}
