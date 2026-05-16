# `apps/desktop-tauri` — Tauri v2 desktop shell

> **Doc freshness (2026-05-16):** The handler list in §Rust entry below is **out of date**. The live registry is **39 commands** in `src-tauri/src/lib.rs` (`generate_handler!`). See the [API reference command catalog](../api-reference.md#full-registry-2026-05-16).

The desktop shell is the **only place Rust and TypeScript meet at runtime**. It is a Tauri v2 application that boots `AppCore`, registers the IPC command surface, emits asynchronous events, and hosts the React `FileOctopusShell` component as its only WebView content. The trust boundary documented across the rest of this directory is enforced here.

- Frontend entry: `apps/desktop-tauri/src/{main,App,App.css}.tsx`
- Rust entry: `apps/desktop-tauri/src-tauri/src/lib.rs`
- Manifest: `apps/desktop-tauri/src-tauri/Cargo.toml` (binary crate `fileoctopus-desktop`)
- Tauri config: `apps/desktop-tauri/src-tauri/tauri.conf.json`
- Capabilities: `apps/desktop-tauri/src-tauri/capabilities/default.json`

## Process model

```
WebView (React, @fileoctopus/frontend)
   │     ─── invoke / listen ───►
   ▼                              ▲
@tauri-apps/api                   │ app.emit (events)
   │ tauri::invoke                │
   ▼                              │
Tauri main process (Rust)         │
   ├── tauri::Builder::default()
   ├── .manage(Arc<AppState>)     ← from app_core::AppCore::boot()
   ├── .invoke_handler(generate_handler![…])
   └── .run(generate_context!())  ← reads tauri.conf.json
```

A single OS window hosts the WebView; the React app is built by Vite (see `apps/desktop-tauri/vite.config.ts` and the `pnpm dev` chain that builds `ts-api → ui → frontend` before `tauri dev`). The Tauri main process exposes no other I/O surface — no devtools server, no plugin endpoints beyond the registered commands.

## Rust entry (`src-tauri/src/lib.rs`)

The library's public entry is `pub fn run()`, called by the auto-generated `main.rs`:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppCore::boot().expect("failed to boot FileOctopus app core");

    tauri::Builder::default()
        .manage(app_state)
        .setup(|_app| { telemetry::info("FileOctopus Tauri shell started"); Ok(()) })
        .invoke_handler(tauri::generate_handler![
            app_get_info, fs_stat, fs_list_start, plan_file_operation,
            start_file_operation, cancel_job, get_job_status, list_recent_operations
        ])
        .run(tauri::generate_context!())
        .expect("failed to run FileOctopus");
}
```

Boot is fail-fast: if `AppCore::boot()` returns `Err(AppCoreError::…)` the process panics. The user-visible failure mode is a window that never appears; this is intentional — we'd rather a missing telemetry/registry/history surface a crash than a half-initialized app.

## Registered commands

Eleven handlers, each taking a typed request DTO and (where state is needed) `State<'_, Arc<AppState>>`. They are the entire privileged API:

| Command                                                     | Behaviour                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app_get_info`                                              | Static metadata `{ name, version, buildProfile, commitSha, targetOs }` derived from build/runtime constants.                                                                                                                                                                                |
| `fs_stat`                                                   | Parses URI, delegates to `state.vfs().stat`, wraps result in `StatResponse`.                                                                                                                                                                                                                |
| `fs_list_start`                                             | Allocates `ListSessionId` (UUID), spawns two `tauri::async_runtime::spawn` tasks: one drains the mpsc channel and forwards batches as `DIRECTORY_BATCH_EVENT` emissions, one runs `vfs.list(...)` and emits a final error frame if the listing aborts. Returns `{ sessionId }` immediately. |
| `plan_file_operation`                                       | `TryFrom` the DTO into `FileOperationRequest`, calls `state.operations().plan`, wraps the result. No side effects.                                                                                                                                                                          |
| `start_file_operation`                                      | `TryFrom` the plan DTO, builds a sink that fans `JobEvent` values out to `app.emit(job_event_name(event), job_event_payload(event))`, calls `operations.start`. Returns the initial `JobSnapshot`.                                                                                          |
| `cancel_job` / `get_job_status`                             | Look up the job in the runtime, return the current snapshot.                                                                                                                                                                                                                                |
| `list_recent_operations`                                    | Reads up to `limit` rows from the SQLite history; maps each `OperationHistoryRecord` into an `OperationHistoryRecordDto`.                                                                                                                                                                   |
| `clear_operation_history`                                   | Deletes terminal history rows while preserving active jobs.                                                                                                                                                                                                                                 |
| `diagnostics_app_data_health` / `export_diagnostics_bundle` | Report app data/log/schema health and write a redacted diagnostics ZIP.                                                                                                                                                                                                                     |

Every handler returns `Result<TResponse, IpcError>`. All conversions from `VfsError` / `FileOperationError` go through the `From` impls in `crates/app-ipc`.

### Streaming details

`fs_list_start` decouples the response from the data stream:

1. Clone the `AppHandle` so both spawned tasks can `emit`.
2. Build a `tokio::sync::mpsc::channel::<DirectoryBatch>(16)`.
3. **Drain task**: pull `DirectoryBatch` frames from the receiver, wrap each in `DirectoryBatchEventDto::from(batch)`, emit on `DIRECTORY_BATCH_EVENT`. Log and break on emit failure.
4. **Producer task**: call `vfs.list(&uri, options, sender)`. On error, synthesize a final frame with `entries: []`, `isComplete: true`, and `error: Some(IpcError::from(error))` and emit it once.
5. Return `ListStartResponse { sessionId }` synchronously.

This design lets the UI render results as they arrive (256 entries at a time by default) without blocking the IPC reply. Backpressure is bounded by the channel capacity of 16 batches in flight.

### Job event fan-out

`start_file_operation` constructs the sink inline:

```rust
let sink_app = app.clone();
let sink = Arc::new(move |event: JobEvent| {
    let name = job_event_name(&event);
    let payload = job_event_payload(event);
    if let Err(error) = sink_app.emit(name, payload) {
        telemetry::error(&format!("failed to emit job event: {error}"));
    }
});
let job = state.operations().start(plan, sink).map_err(IpcError::from)?;
```

The sink is `Arc<FileOperationEventSink>`; `OperationRuntime::start` clones it into the worker thread so emissions happen from the worker, not from the IPC handler. Emit failures are logged but never propagated — they would not be actionable.

## Tauri configuration

`tauri.conf.json` is intentionally minimal:

- `productName: "FileOctopus"`, `identifier: "com.fileoctopus.desktop"`, version pinned to `0.1.0`.
- `build.beforeDevCommand = "pnpm dev"`, `devUrl = "http://localhost:1420"`, `beforeBuildCommand = "pnpm build"`, `frontendDist = "../dist"`.
- A single window at 800×600 with title `"FileOctopus"`.
- `security.csp = null` for now. Hardening the CSP is on the post-MVP backlog.
- `bundle.targets = "all"` with bundled icons.

## Capabilities

`apps/desktop-tauri/src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": ["core:default"]
}
```

Only `core:default` is granted. There is **no** `tauri-plugin-fs` permission, **no** `tauri-plugin-shell`, **no** `tauri-plugin-dialog`. This is the surface ADR-0002 was written to lock down — every filesystem effect must be a registered command we control, not a plugin-provided capability the frontend could invoke directly.

Adding a capability requires:

1. Declaring the plugin in `Cargo.toml`.
2. Editing `capabilities/default.json` to grant the specific permission (always the narrowest scope, e.g. a path allowlist).
3. Updating the ADR set (start from `docs/adr/0000-template.md`).

## Frontend bridge

`apps/desktop-tauri/src/App.tsx` is one line:

```tsx
export default function App() {
  return <FileOctopusShell />;
}
```

`main.tsx` mounts it inside `React.StrictMode`. All product UI lives in `@fileoctopus/frontend` so the shell stays trivial to swap.

The frontend reaches Tauri via `createFileOctopusClient()` from `@fileoctopus/ts-api`. Detection (`__TAURI_INTERNALS__` on `globalThis`) is automatic; running the same React build in a plain browser falls back to `createPreviewTransport()` and a stubbed IPC.

## Build flow

`pnpm dev` from the workspace root runs:

1. `pnpm --filter @fileoctopus/ts-api build` (TypeScript declarations).
2. `pnpm --filter @fileoctopus/ui build`.
3. `pnpm --filter @fileoctopus/frontend build`.
4. `pnpm --filter @fileoctopus/desktop-tauri tauri dev`, which itself runs Vite (`pnpm dev` inside the package).

This serialization matters: `ts-api` exports the typed client other packages import, so it must build first. Skipping it manifests as `TS2307: Cannot find module '@fileoctopus/ts-api'`.

## Conventions

- **All new commands go through `tauri::generate_handler!`.** Never use the deprecated `invoke_handler` runtime registration.
- **All new event names live in `crates/app-ipc`.** This file imports and emits them; it never owns the string literal.
- **Errors come back as `IpcError`.** Handlers return `Result<TResponse, IpcError>`; let `?` and `From<…> for IpcError` do the conversion.
- **Boot must not require user data.** `AppCore::boot()` runs before the window appears. Anything that depends on user choice (preferences, last directory) belongs after boot, on first IPC call.
- **Capabilities stay minimal.** Adding a permission expands the attack surface; pair every addition with an ADR explaining why a Rust command isn't sufficient.

## Tests

The Tauri shell is exercised by integration with the rest of the workspace; there are no Rust unit tests in `src-tauri/src/lib.rs` itself. Coverage comes from:

- `crates/app-ipc/src/lib.rs::tests` — wire format round-trips.
- `crates/app-core/src/lib.rs::tests` — operation runtime end-to-end.
- `packages/ts-api/tests/client.test.ts` — client-side command map and event handlers.
- `packages/frontend/tests/` — Vitest renders of the shell against a mock transport.

Manual smoke-test scripts live in `scripts/sprint-2-manual-qa.sh` and the protocols under `docs/testing/`.
