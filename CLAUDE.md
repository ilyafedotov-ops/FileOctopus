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

# Rust checks (run locally before commits touching Rust; CI runs the same suite via `pnpm test:backend:rc`)
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

The trust boundary is the IPC layer. Read these together to understand a feature: the domain types in `crates/vfs`, the runtime in `crates/app-core`, the DTOs in `crates/app-ipc`, the Tauri command handlers in `apps/desktop-tauri/src-tauri/src/commands/*.rs` (registered from `lib.rs`), and the TS client in `packages/ts-api` (`clients/*`, `commandMap.ts`, facade `client.ts`).

### Rust workspace (`crates/`)

- **`vfs`** — domain types only. `ResourceUri`, `FileEntry`, `FileKind`, capabilities, `FileOperation*` (request/plan/item/conflict/warning/error taxonomy), the `VfsProvider` async trait, and `VfsRegistry` (scheme → provider). Has no I/O; everything else depends on it. `FileOperationError::code()` is the stable error vocabulary surfaced to the UI.
- **`fs-core`** — `LocalFsProvider` (read/list/stat) plus the file-operation pipeline split across:
  - `file_ops/` — planning, execution, archive, trash, and path helpers for copy/move/rename/delete-to-trash/create-directory/create-file/archive/extract jobs.
  - `direct_ops` — non-job direct mutators (`create_empty_file`, `delete_permanently`).
  - `metadata` — `path_properties`, folder-size computations.
  - `search` — recursive search (sync + progress variants).
  - `locations` — `standard_locations` enumeration.
  - `external_open` — `open_path_with_default_app`, `reveal_path_in_file_manager`.
- **`jobs`** — `JobId`, `JobStatus`, `JobSnapshot`, the `JobEvent` variants (`Started`/`Progress`/`Completed`/`Failed`/`Cancelled`), and `CancellationToken`. Job event JSON names are defined as constants in `app-ipc` and resolved by `app_ipc::job_event_name` / `job_event_payload`.
- **`app-core`** — `AppCore::boot()` returns an `Arc<AppState>` containing the `VfsRegistry` and `OperationRuntime`. Split into:
  - `lib.rs` — `AppCore`, `AppState`, `AppCoreError`, public re-exports.
  - `runtime.rs` — `OperationRuntime` (planning, job table, history hand-off).
  - `history.rs` — `OperationHistoryRepository`, `OperationHistoryRecord`, SQLite schema/migration.
  - `paths.rs` — `AppPaths`, `AppDataHealth`, default platform paths.
- **`app-ipc`** — every IPC DTO (`StatRequest`/`Response`, `ListStartRequest`/`Response`, `FileOperationRequestDto`, `FileOperationPlanDto`, `JobSnapshot` wire form, `OperationHistoryRecordDto`, `IpcError`) plus event-name constants (`DIRECTORY_BATCH_EVENT`, `JOB_*_EVENT`). DTOs use `#[serde(rename_all = "camelCase")]` and are organized into per-domain modules (`fs`, `network`, `search`, `file_operations`, …) re-exported from `lib.rs`, which also holds the conversions and `error_codes`. `IpcError: From<VfsError>` and `From<FileOperationError>` preserve stable error codes.
- **`telemetry`** — `tracing` + `tracing-subscriber` init and thin `info/debug/error` helpers.
- **`config`** — SQLite-backed configuration: `UserPreferences` (with schema migrations), `NetworkProfile`, and the `PreferencesRepository`/`NavigationRepository`/`NetworkProfileRepository` CRUD + caching layers.
- **`platform`** — thin platform abstractions: `SecretStore` (OS keychain) and `open_external_terminal`.
- **`test-support`** — `fileoctopus-test-tree` binary that materializes large directory trees for the perf protocol.
- **`git-intel`** — Git repository discovery and file status decoration (`GitDiscover`, `GitStatusForDirectory`).
- **`terminal-core`** — PTY management for embedded terminal (local + SSH sessions).
- **`remote-core`** — shared traits and types for remote providers (`RemoteConnector`, `RemoteSession`, `AuthSecrets`).
- **`provider-sftp`**, **`provider-smb`**, **`provider-s3`** — VFS provider implementations for SFTP, SMB, and S3 protocols.
- **`provider-gdrive`**, **`provider-dropbox`**, **`provider-onedrive`** — cloud provider connectors with OAuth authentication.
- **`plugin-core`** — plugin manifest schema, sandboxed execution, and install/enable/disable lifecycle.

### Tauri shell (`apps/desktop-tauri/`)

`src-tauri/src/lib.rs` is the thin entrypoint: it builds `AppCore::boot()`, manages plugin state, and registers handlers. Commands live in `commands/{app_info,fs,folder_size,recursive_search,watch,preferences,autostart,navigation,file_operations,diagnostics,acl,compare,plugin,sync,terminal,content_search,git,network}.rs`. Shared infrastructure is in `state.rs` (watch/metadata/listing state) and `emit.rs` (job + directory event emitters). `fs_list_start` returns a `sessionId` immediately, then streams `DirectoryBatchEventDto` events through a tokio mpsc channel into `app.emit(DIRECTORY_BATCH_EVENT, ...)`. Job event emission goes through `app_ipc::job_event_name` / `job_event_payload`.

### Frontend (`packages/`, `apps/desktop-tauri/src/`)

- **`@fileoctopus/ts-api`** (`packages/ts-api/`) — typed IPC client. `FileOctopusClient` (in `client.ts`) composes per-domain clients in `clients/{fs,fileOperations,jobs,history,diagnostics,preferences,autostart,navigation,git,network,plugin,terminal}.ts`. Transports live in `transports/{tauri,preview}.ts`. Error normalisation in `normalizeError.ts`. `commandMap.ts` translates dotted IPC names to Tauri command names — if you add a command, update both sides. Public surface is unchanged — all consumers still import from `@fileoctopus/ts-api`.
- **`@fileoctopus/frontend`** (`packages/frontend/`) — `FileOctopusApp` (`FileOctopusShell` alias) in `app/FileOctopusApp.tsx`: providers (`ShellProvider`, `JobsProvider`, `ModalsProvider`), shell layout, `commands/{registry,dispatch,paletteEntries}`, `state/{paneReducer,slices,layoutStore}`, `jobs/` activity rail, regional CSS under `styles/regions/`. `panelStore.ts` delegates to slice reducers. File-op handlers: `hooks/useFileOpHandlers.ts` → `hooks/fileOps/*`. See `docs/architecture/modules/frontend.md`.
- **`@fileoctopus/ui`** — shared primitives.
- **`@fileoctopus/desktop-tauri`** — the Vite/Tauri shell; the React shell is mounted from `apps/desktop-tauri/src/`. `pnpm dev` builds `ts-api`, `ui`, `frontend` in order before launching `tauri dev`, so workspace changes must be rebuilt to be picked up.

## Boundary invariants (do not break)

- **`local://` URIs at every Rust↔TS boundary** (ADR-0003). UI may display friendly paths, but persistent state and IPC use `ResourceUri`. Parse with `ResourceUri::parse` or construct from a platform path with `ResourceUri::from_local_path` — both reject relative paths and unknown schemes.
- **No unrestricted FS plugins in the frontend** (ADR-0002). All filesystem effects go through a Rust command that validates URI, provider, capability, conflict, and safety. New mutating operations should become planned jobs with structured progress, cancellation, and history rows, not direct calls.
- **IPC contract is mirrored on both sides**. When adding/changing a DTO in `crates/app-ipc`, update `packages/ts-api/src/types.ts`, the client method in the relevant `clients/*.ts` file, the `commandMap` entry, and the Tauri handler in `src-tauri/src/commands/*.rs` together. Keep `serde(rename_all = "camelCase")` and the TS types aligned.
- **Stable error codes**: surface `FileOperationError::code()` / `VfsError::code()` (e.g. `permission_denied`, `not_found`, `destination_conflict`, `invalid_name`, `unsupported_trash`, `cancelled`) so the UI can branch on them — see `operationErrorMessage` in `packages/frontend/src/dialogs/OperationDialogView.tsx`.

## Conventions

- Rust 2021; `rustfmt.toml` sets `max_width = 100` and Unix newlines. Crate dirs are kebab-case, modules are snake_case.
- TypeScript ES modules via ESLint flat config (`@eslint/js` + `typescript-eslint`). React components are PascalCase; packages live under the `@fileoctopus/*` scope.
- Tests go under `tests/` in the relevant crate or package (`crates/vfs/tests/...`, `packages/ts-api/tests/*.test.ts`). Vitest filenames are `*.test.ts`. Target 85%+ coverage for changed behavior.
- Commits follow Conventional Commits (`feat:`, `chore:`, `fix:`, …). PRs use the template (Summary / Tests / Security impact); note any filesystem, IPC, or permission boundary changes.
- Do not add comments unless explicitly requested. Do not add docs under `docs/` unless asked — ADRs are the exception and use `docs/adr/0000-template.md`. CODEOWNERS routes review to `@ilyafedotov`.
