# `telemetry` — Tracing initialization and log helpers

`crates/telemetry` is the shared logging seam. It wraps `tracing`, `tracing-subscriber`, and file appender setup behind a tiny API so the rest of the workspace does not import `tracing` directly. This keeps log-level decisions, formatting, and one-time init in a single place.

- Source: `crates/telemetry/src/lib.rs`
- Depends on: `tracing`, `tracing-subscriber`, `tracing-appender`.
- Used by: every binary entry (`app-core::AppCore::boot`, `apps/desktop-tauri`) and any crate that wants structured logs.

## Surface

```rust
pub fn init() -> Result<(), Box<dyn Error + Send + Sync>>;
pub fn default_log_dir() -> PathBuf;
pub fn info(message: &str);
pub fn debug(message: &str);
pub fn error(message: &str);
```

`init` configures a global `tracing_subscriber::fmt` subscriber with an `EnvFilter` and a daily file appender under `~/.fileoctopus/logs`. It is **idempotent** — guarded by a `OnceLock`, so repeated calls in tests or after hot-reload are no-ops. The default filter when `RUST_LOG` is unset is `"fileoctopus=debug,info"`.

`info` / `debug` / `error` are thin wrappers around `tracing::{info!, debug!, error!}` that take a borrowed string. They exist so callers can log without pulling `tracing` macros into scope.

## Where it's called from

- `AppCore::boot_with_history_path` runs `telemetry::init()` first and lifts errors into `AppCoreError::Telemetry`. The Tauri shell panics on this — the app is unusable without a working subscriber attached for diagnostics.
- The Tauri command handlers (`fs_stat`, `fs_list_start`, `plan_file_operation`, …) call `telemetry::debug` at entry and on completion of the streamed list/job paths.
- `app-core::OperationHistoryRepository` calls `telemetry::error` when history writes fail, so that failures are visible without breaking the live IPC reply.

## Filtering

The default filter (`fileoctopus=debug,info`) emits **debug** for crates whose name starts with `fileoctopus` (currently none — all our crates are unprefixed), and **info** for everything else. To raise the level for our own crates locally:

```bash
RUST_LOG="vfs=trace,fs_core=debug,app_core=debug" pnpm dev
```

`RUST_LOG` is honoured because the filter goes through `EnvFilter::try_from_default_env`.

## Conventions

- **Do not import `tracing` directly** in workspace crates outside of `telemetry`. Add a helper here if a new shape is needed (`warn`, structured fields, etc.).
- **Strings, not formatted strings.** The helpers take `&str`; callers do their own `format!`. This keeps the trace events monomorphic and consistent.
- **No PII in logs.** File paths and URIs are user data. The Tauri command handlers log only the _event_ (`"fs.stat requested"`), not the URI; preserve that.
- **Errors are warnings, not panics.** `telemetry::error` is for _expected_ failure modes (e.g. history write fails). Panicking is reserved for boot-time invariants.

## Tests

`crates/telemetry/tests/` (if present) covers init idempotency. The crate-level tests are minimal because the subscriber is intentionally a thin shim.

Run with `cargo test -p telemetry`.
