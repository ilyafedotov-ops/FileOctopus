# `apps/desktop-tauri` — Tauri v2 desktop shell

> **Doc freshness (2026-06-12):** Handler bodies live under `src-tauri/src/commands/`; `lib.rs` only boots and registers them. The live command list is in the [API reference catalog](../api-reference.md#full-registry-2026-06-12) (94 commands as of 2026-06-12; re-count with `grep` on `generate_handler!` in `lib.rs` if the doc lags).

The desktop shell is the **only place Rust and TypeScript meet at runtime**. It is a Tauri v2 application that boots `AppCore`, registers the IPC command surface, emits asynchronous events, and hosts the React `FileOctopusShell` component as its only WebView content. The trust boundary documented across the rest of this directory is enforced here.

- Frontend entry: `apps/desktop-tauri/src/{main,App,App.css}.tsx`
- Rust entry: `apps/desktop-tauri/src-tauri/src/lib.rs` (thin; ~70 lines)
- Command modules: `apps/desktop-tauri/src-tauri/src/commands/{app_info,fs,git,folder_size,recursive_search,content_search,watch,preferences,autostart,navigation,network,file_operations,diagnostics,acl,compare,plugin,sync,terminal}.rs`
- Shared shell state: `state.rs` (listing sessions, watch handles, metadata jobs), `emit.rs` (directory + job event helpers)
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

The library's public entry is `pub fn run()`, called by the auto-generated `main.rs`. It boots `AppCore`, registers plugin state (`WatchState`, `MetadataJobState`, `ListingRegistry` in `state.rs`), and wires `tauri::generate_handler!` with fully qualified paths such as `commands::fs::fs_stat` and `commands::file_operations::plan_file_operation`. Handler implementations are **not** inlined in `lib.rs` — each domain file under `commands/` owns its `#[tauri::command]` functions.

Boot is fail-fast: if `AppCore::boot()` returns `Err(AppCoreError::…)` the process panics. The user-visible failure mode is a window that never appears; this is intentional — we'd rather a missing telemetry/registry/history surface a crash than a half-initialized app.

## Registered commands

The privileged API is the union of every function listed in `generate_handler!` inside `lib.rs`. Grouping by module file:

| Module file                    | Examples (snake_case)                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `commands/app_info.rs`         | `app_get_info`                                                                                            |
| `commands/fs.rs`               | `fs_stat`, `fs_list_start`, `fs_read_text_file`, `fs_properties`, `fs_reveal`, `fs_read_file_as_data_uri` |
| `commands/folder_size.rs`      | `fs_folder_size`, `fs_folder_size_start`                                                                  |
| `commands/recursive_search.rs` | `fs_recursive_search`, `fs_recursive_search_start`                                                        |
| `commands/watch.rs`            | `fs_watch_start`, `fs_watch_stop`                                                                         |
| `commands/preferences.rs`      | `get_preferences`, `set_preference`                                                                       |
| `commands/autostart.rs`        | `get_autostart`, `set_autostart`                                                                          |
| `commands/navigation.rs`       | `navigation_record_visit`, `navigation_list_favorites`, …                                                 |
| `commands/file_operations.rs`  | `plan_file_operation`, `start_file_operation`, `cancel_job`, …                                            |
| `commands/diagnostics.rs`      | `diagnostics_app_data_health`, `export_diagnostics_bundle`                                                |
| `commands/git.rs`              | `git_discover`, `git_status_for_directory`, `git_status_for_repository`, `git_diff_file`                  |
| `commands/terminal.rs`         | `terminal_spawn`, `terminal_write`, `terminal_resize`, `terminal_kill`                                    |
| `commands/acl.rs`              | `fs_get_acl`, `fs_set_acl`                                                                                |
| `commands/compare.rs`          | `fs_diff_text`                                                                                            |
| `commands/sync.rs`             | `fs_sync_directories`                                                                                     |
| `commands/content_search.rs`   | Content search across files                                                                               |
| `commands/network.rs`          | `network_connect`, `network_disconnect`, `network_profiles_list`, …                                       |
| `commands/plugin.rs`           | `plugin_list`, `plugin_install`, `plugin_uninstall`, …                                                    |

For dotted IPC names, request/response DTOs, and the authoritative row-by-row registry, see [api-reference.md §Tauri command catalog](../api-reference.md#tauri-command-catalog).

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

- `productName: "FileOctopus"`, `identifier: "com.fileoctopus.desktop"`, version pinned to `0.1.4`.
- `build.beforeDevCommand = "pnpm dev"`, `devUrl = "http://localhost:1420"`, `beforeBuildCommand = "pnpm build"`, `frontendDist = "../dist"`.
- A single undecorated window at 1280×800 with title `"FileOctopus"`.
- `security.csp` is explicit: self/tauri/ipc/asset sources, data images, inline styles for the current CSS pipeline, and self-only scripts.
- `bundle.targets = "all"` with bundled icons.

## Capabilities

`apps/desktop-tauri/src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:event:default",
    "autostart:default",
    "core:window:allow-close",
    "core:window:allow-minimize",
    "core:window:allow-toggle-maximize",
    "core:window:allow-start-dragging"
  ]
}
```

The granted permissions cover core IPC/events, autostart, and the custom window controls used by the undecorated title bar. There is **no** `tauri-plugin-fs` permission, **no** `tauri-plugin-shell`, **no** `tauri-plugin-dialog`. This is the surface ADR-0002 was written to lock down — every filesystem effect must be a registered command we control, not a plugin-provided capability the frontend could invoke directly.

Adding a capability requires:

1. Declaring the plugin in `Cargo.toml`.
2. Editing `capabilities/default.json` to grant the specific permission (always the narrowest scope, e.g. a path allowlist).
3. Updating the ADR set (start from `docs/adr/0000-template.md`).

## Frontend bridge

`apps/desktop-tauri/src/App.tsx` is intentionally thin: it imports shared UI tokens/styles, renders `FileOctopusShell`, and passes window-control callbacks backed by `@tauri-apps/api/window`.

```tsx
export default function App() {
  return <FileOctopusShell onRequestExit={...} onRequestMinimize={...} onRequestToggleMaximize={...} />;
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
- `crates/app-core/src/tests.rs` — operation runtime end-to-end.
- `apps/desktop-tauri/src-tauri/src/tests.rs` — shell-level tests where present.
- `packages/ts-api/tests/client.test.ts` — client-side command map and event handlers.
- `packages/frontend/tests/` — Vitest renders of the shell against a mock transport.

Manual smoke-test guidance lives in `docs/testing/`.
