# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

FileOctopus is a Tauri v2 desktop file manager. Rust owns all privileged filesystem and platform operations; the React 19 + TypeScript frontend is a UI layer that talks to Rust through typed IPC. Two workspaces share the same tree: a Cargo workspace (`Cargo.toml`) and a pnpm workspace (`pnpm-workspace.yaml`, pnpm 10.26.2, Node 22 in CI).

## Common commands

```bash
# Bootstrap
pnpm install                                # install JS deps
bash scripts/bootstrap.sh                   # also installs rustup if missing

# Dev / build (frontend chain feeds the Tauri shell)
pnpm dev                                    # builds ts-api → ui → frontend, then `tauri dev`
pnpm build                                  # `pnpm -r --sort --if-present build`

# JS checks (run before commits touching TS)
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test                                   # Vitest, where configured

# Rust checks (run before commits touching Rust; CI enforces all four)
pnpm rust:check     # cargo check --workspace
pnpm rust:test      # cargo test --workspace
pnpm rust:fmt       # cargo fmt --all --check
pnpm rust:clippy    # cargo clippy --workspace --all-targets -- -D warnings

# Single test
cargo test -p <crate> <test_name>           # Rust
pnpm --filter @fileoctopus/<pkg> test -- -t "<name>"   # Vitest

# Performance fixtures (10k / 100k entries, see docs/testing/)
cargo run -p test-support --bin fileoctopus-test-tree -- --root ./tmp/100k --files 100000 --dirs 0

# Sprint 2 manual QA fixture
bash scripts/sprint-2-manual-qa.sh [root]
```

## Architecture

The trust boundary is the IPC layer. Read these together to understand a feature: the domain types in `crates/vfs`, the runtime in `crates/app-core`, the DTOs in `crates/app-ipc`, the Tauri command handlers in `apps/desktop-tauri/src-tauri/src/lib.rs`, and the TS client in `packages/ts-api/src/client.ts`.

### Rust workspace (`crates/`)

- **`vfs`** — domain types only. `ResourceUri`, `FileEntry`, `FileKind`, capabilities, `FileOperation*` (request/plan/item/conflict/warning/error taxonomy), the `VfsProvider` async trait, and `VfsRegistry` (scheme → provider). Has no I/O; everything else depends on it. `FileOperationError::code()` is the stable error vocabulary surfaced to the UI.
- **`fs-core`** — `LocalFsProvider` (read/list/stat) and `file_ops` (planning + execution of copy/move/rename/delete-to-trash/create-directory with conflict detection and progress events). This is where filesystem mutation actually happens.
- **`jobs`** — `JobId`, `JobStatus`, `JobSnapshot`, the `JobEvent` variants (`Started`/`Progress`/`Completed`/`Failed`/`Cancelled`), and `CancellationToken`. Job event JSON names are defined as constants in `app-ipc` and resolved by `app_ipc::job_event_name` / `job_event_payload`.
- **`app-core`** — `AppCore::boot()` returns an `Arc<AppState>` containing the `VfsRegistry` (with `LocalFsProvider` registered for `local`) and the `OperationRuntime`. `OperationRuntime` plans operations, spawns jobs, holds an in-memory job table, and persists completed jobs to a SQLite operation-history DB (`OperationHistoryRepository`). Default history path is platform-specific (see `default_history_path`); tests should use `boot_with_history_path`.
- **`app-ipc`** — every IPC DTO (`StatRequest`/`Response`, `ListStartRequest`/`Response`, `FileOperationRequestDto`, `FileOperationPlanDto`, `JobSnapshot` wire form, `OperationHistoryRecordDto`, `IpcError`) plus event-name constants (`DIRECTORY_BATCH_EVENT`, `JOB_*_EVENT`). DTOs use `#[serde(rename_all = "camelCase")]`. `IpcError: From<VfsError>` and `From<FileOperationError>` preserve stable error codes.
- **`telemetry`** — `tracing` + `tracing-subscriber` init and thin `info/debug/error` helpers.
- **`platform`**, **`config`** — currently empty crates reserved for future platform abstractions.
- **`test-support`** — `fileoctopus-test-tree` binary that materializes large directory trees for the perf protocol.

### Tauri shell (`apps/desktop-tauri/`)

`src-tauri/src/lib.rs` declares the Tauri commands (`app_get_info`, `fs_stat`, `fs_list_start`, `plan_file_operation`, `start_file_operation`, `cancel_job`, `get_job_status`, `list_recent_operations`) and registers them via `tauri::generate_handler!`. `fs_list_start` returns a `sessionId` immediately, then streams `DirectoryBatchEventDto` events through a tokio mpsc channel into `app.emit(DIRECTORY_BATCH_EVENT, ...)`. Job event emission goes through `app_ipc::job_event_name` / `job_event_payload`.

### Frontend (`packages/`, `apps/desktop-tauri/src/`)

- **`@fileoctopus/ts-api`** (`packages/ts-api/`) — typed IPC client. `FileOctopusClient` exposes `fs`, `fileOperations`, `jobs`, `operationHistory`. There is an explicit `commandMap` translating dotted IPC names (`fs.stat`, `fileOperation.plan`, …) to Tauri command names (`fs_stat`, `plan_file_operation`, …) — if you add a command, update both sides. `createTauriTransport()` is the real transport; `createPreviewTransport()` is a stub for running the UI in a plain browser. `normalizeIpcError` flattens any thrown value into `IpcError`.
- **`@fileoctopus/frontend`** (`packages/frontend/`) — the `FileOctopusShell` React component (two-panel UI, operation toolbar, activity/history panel) plus `panelStore.ts` (`useReducer`-based state, virtualized rows, `normalizeLocalInput`).
- **`@fileoctopus/ui`** — shared primitives.
- **`@fileoctopus/desktop-tauri`** — the Vite/Tauri shell; the React shell is mounted from `apps/desktop-tauri/src/`. `pnpm dev` builds `ts-api`, `ui`, `frontend` in order before launching `tauri dev`, so workspace changes must be rebuilt to be picked up.

## Boundary invariants (do not break)

- **`local://` URIs at every Rust↔TS boundary** (ADR-0003). UI may display friendly paths, but persistent state and IPC use `ResourceUri`. Parse with `ResourceUri::parse` or construct from a platform path with `ResourceUri::from_local_path` — both reject relative paths and unknown schemes.
- **No unrestricted FS plugins in the frontend** (ADR-0002). All filesystem effects go through a Rust command that validates URI, provider, capability, conflict, and safety. New mutating operations should become planned jobs with structured progress, cancellation, and history rows, not direct calls.
- **IPC contract is mirrored on both sides**. When adding/changing a DTO in `crates/app-ipc`, update `packages/ts-api/src/types.ts`, the client method in `client.ts`, the `commandMap` entry, and the Tauri handler in `src-tauri/src/lib.rs` together. Keep `serde(rename_all = "camelCase")` and the TS types aligned.
- **Stable error codes**: surface `FileOperationError::code()` / `VfsError::code()` (e.g. `permission_denied`, `not_found`, `destination_conflict`, `invalid_name`, `unsupported_trash`, `cancelled`) so the UI can branch on them — see `operationErrorMessage` in `packages/frontend/src/index.tsx`.

## Conventions

- Rust 2021; `rustfmt.toml` sets `max_width = 100` and Unix newlines. Crate dirs are kebab-case, modules are snake_case.
- TypeScript ES modules via ESLint flat config (`@eslint/js` + `typescript-eslint`). React components are PascalCase; packages live under the `@fileoctopus/*` scope.
- Tests go under `tests/` in the relevant crate or package (`crates/vfs/tests/...`, `packages/ts-api/tests/*.test.ts`). Vitest filenames are `*.test.ts`. Target 85%+ coverage for changed behavior.
- Commits follow Conventional Commits (`feat:`, `chore:`, `fix:`, …). PRs use the template (Summary / Tests / Security impact); note any filesystem, IPC, or permission boundary changes.
- Do not add comments unless explicitly requested. Do not add docs under `docs/` unless asked — ADRs are the exception and use `docs/adr/0000-template.md`. CODEOWNERS routes review to `@ilyafedotov`.
