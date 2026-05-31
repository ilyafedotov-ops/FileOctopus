use app_ipc::{job_event_name, job_event_payload};
use jobs::JobEvent;
#[cfg(target_os = "linux")]
use tauri::Manager;
use tauri::{AppHandle, Emitter};

#[cfg(target_os = "linux")]
fn eval_event_js(event: &str, payload_json: &str) -> String {
    let event_lit = event.replace('\\', "\\\\").replace('\'', "\\'");
    let safe = serde_json::to_string(payload_json).unwrap_or_else(|_| "\"{}\"".to_string());
    format!(
        r#"(function() {{
    try {{
        var payload = JSON.parse({safe});
        var name = '{event_lit}';
        if (!window.__FO_EVENT_BUFFER__) {{ window.__FO_EVENT_BUFFER__ = {{}}; }}
        if (!window.__FO_EVENT_BUFFER__[name]) {{ window.__FO_EVENT_BUFFER__[name] = []; }}
        window.__FO_EVENT_BUFFER__[name].push(payload);
        setTimeout(function() {{
            try {{
                var handlers = (window.__FO_EVENT_HANDLERS__ || {{}})[name];
                var queue = window.__FO_EVENT_BUFFER__[name] || [];
                if (handlers && handlers.length) {{
                    window.__FO_EVENT_BUFFER__[name] = [];
                    for (var i = 0; i < queue.length; i++) {{
                        for (var j = 0; j < handlers.length; j++) {{
                            try {{ handlers[j](queue[i]); }} catch (_) {{}}
                        }}
                    }}
                }} else {{
                    try {{ window.dispatchEvent(new CustomEvent('fo-event-' + name, {{ detail: payload }})); }} catch (_) {{}}
                }}
            }} catch (_) {{}}
        }}, 0);
    }} catch (_) {{}}
}})();"#
    )
}

fn emit_event_on_webview<S: serde::Serialize + Clone>(
    app: &AppHandle,
    window_label: &str,
    event: &str,
    payload: S,
) {
    if let Err(error) = app.emit_to(window_label, event, payload.clone()) {
        telemetry::error(&format!(
            "failed to emit {event} to {window_label}: {error}"
        ));
    }

    // WebKitGTK on Linux often does not deliver app.emit() to the webview; replay
    // through eval there only. On macOS/Windows, eval plus emit duplicates every event.
    #[cfg(target_os = "linux")]
    {
        let json = match serde_json::to_string(&payload) {
            Ok(j) => j,
            Err(e) => {
                telemetry::error(&format!("emit_event: failed to serialize {event}: {e}"));
                return;
            }
        };
        let Some(webview) = app.get_webview_window(window_label) else {
            return;
        };
        let js = eval_event_js(event, &json);
        if let Err(e) = webview.eval(&js) {
            telemetry::error(&format!(
                "emit_event: webview.eval failed for {event} on {window_label}: {e}"
            ));
        }
    }
}

/// Emit a Tauri event AND replay it via `webview.eval()` as a fallback for
/// WebKitGTK-headless environments where `app.emit()` does not deliver events
/// to the WebView. The eval path pushes the payload onto a per-event JS queue
/// and drains it through any handler registered via `__FO_EVENT_HANDLERS__`,
/// then dispatches a `fo-event-<name>` CustomEvent for redundancy. A
/// `setTimeout(0)` defers delivery one macrotask so any in-flight `invoke()`
/// response promise resolves first (avoiding a sessionId race in panel state).
pub(crate) fn emit_event<S: serde::Serialize + Clone>(app: &AppHandle, event: &str, payload: S) {
    emit_event_on_webview(app, "main", event, payload);
}

pub(crate) fn emit_event_to<S: serde::Serialize + Clone>(
    app: &AppHandle,
    window_label: &str,
    event: &str,
    payload: S,
) {
    emit_event_on_webview(app, window_label, event, payload);
}

pub(crate) fn emit_job(app: &AppHandle, event: JobEvent) {
    let name = job_event_name(&event);
    let payload = job_event_payload(event);
    emit_event(app, name, payload);
}

#[cfg(test)]
mod tests {
    #[test]
    fn exposes_platform_neutral_emit_entrypoint() {
        let _: fn(&tauri::AppHandle, &str, serde_json::Value) =
            super::emit_event::<serde_json::Value>;
    }
}
