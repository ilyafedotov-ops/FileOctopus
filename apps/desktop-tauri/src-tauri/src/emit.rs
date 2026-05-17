use app_ipc::{job_event_name, job_event_payload};
use jobs::JobEvent;
use tauri::{AppHandle, Emitter, Manager};

/// Emit a Tauri event AND replay it via `webview.eval()` as a fallback for
/// WebKitGTK-headless environments where `app.emit()` does not deliver events
/// to the WebView. The eval path pushes the payload onto a per-event JS queue
/// and drains it through any handler registered via `__FO_EVENT_HANDLERS__`,
/// then dispatches a `fo-event-<name>` CustomEvent for redundancy. A
/// `setTimeout(0)` defers delivery one macrotask so any in-flight `invoke()`
/// response promise resolves first (avoiding a sessionId race in panel state).
pub(crate) fn emit_with_eval<S: serde::Serialize + Clone>(
    app: &AppHandle,
    event: &str,
    payload: S,
) {
    let json = match serde_json::to_string(&payload) {
        Ok(j) => j,
        Err(e) => {
            telemetry::error(&format!("emit_with_eval: failed to serialize {event}: {e}"));
            return;
        }
    };
    if let Err(error) = app.emit(event, payload) {
        telemetry::error(&format!("failed to emit {event}: {error}"));
    }
    let Some(webview) = app.get_webview_window("main") else {
        return;
    };
    let event_lit = event.replace('\\', "\\\\").replace('\'', "\\'");
    let js = format!(
        r#"(function() {{
    try {{
        var payload = {json};
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
                }}
                try {{ window.dispatchEvent(new CustomEvent('fo-event-' + name, {{ detail: payload }})); }} catch (_) {{}}
            }} catch (_) {{}}
        }}, 0);
    }} catch (_) {{}}
}})();"#
    );
    if let Err(e) = webview.eval(&js) {
        telemetry::error(&format!(
            "emit_with_eval: webview.eval failed for {event}: {e}"
        ));
    }
}

pub(crate) fn emit_job(app: &AppHandle, event: JobEvent) {
    let name = job_event_name(&event);
    let payload = job_event_payload(event);
    emit_with_eval(app, name, payload);
}
