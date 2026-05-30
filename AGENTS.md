# Repository Guidelines

## Project Structure & Module Organization

FileOctopus is a Tauri v2 desktop file manager with Rust owning privileged filesystem logic and React TypeScript owning the UI. The root Rust workspace is defined in `Cargo.toml`; workspace members include `apps/cli`, `apps/desktop-tauri/src-tauri`, and crates under `crates/`: `vfs` (domain types, resource URIs, provider trait), `fs-core` (`LocalFsProvider`, `file_ops/`, metadata/search/location/external-open/direct helpers), `app-core` (runtime, history, paths), `app-ipc` (IPC DTOs, error codes, event-name constants), `jobs`, `telemetry`, `config`, `platform`, `test-support`, `git-intel` (Git discovery + file status), `terminal-core` (PTY local + SSH), `remote-core` (remote provider traits), `provider-sftp`/`provider-smb`/`provider-s3` (remote VFS providers), `provider-gdrive`/`provider-dropbox`/`provider-onedrive` (cloud providers with OAuth), and `plugin-core` (plugin manifest + sandbox). The desktop shell is in `apps/desktop-tauri/`: a Vite/React wrapper in `src/`, the Tauri entrypoints in `src-tauri/src/{lib.rs,main.rs}`, per-domain handlers under `src-tauri/src/commands/` (app_info, fs, folder_size, recursive_search, watch, preferences, autostart, navigation, file_operations, diagnostics, acl, compare, plugin, sync, terminal, content_search, git, network), plus `state.rs` and `emit.rs`. Shared TypeScript packages live in `packages/frontend` (main UI: `app/`, `shell/`, `pane/`, `sidebar/`, `jobs/`, `dialogs/`, `hooks/`, `commands/`, `state/`, `styles/`), `packages/ui`, and `packages/ts-api` (`client.ts`, `clients/*`, `transports/*`, `commandMap.ts`, `events.ts`, `types.ts`). Frontend architecture: `docs/architecture/modules/frontend.md`. Architecture records are in `docs/adr/`; the runtime API surface is documented in `docs/architecture/api-reference.md`. Do not add new docs unless requested.

## API & Boundary Invariants

The Rust↔TS boundary is the trust boundary. Read `docs/architecture/api-reference.md` before changing anything that crosses it.

- Filesystem resources cross the boundary as `local://` `ResourceUri` strings (ADR-0003). Parse with `ResourceUri::parse` or create them with `ResourceUri::from_local_path`; do not pass raw OS paths for filesystem resources. The current diagnostics bundle export is an explicit exception: `ExportDiagnosticsBundleRequest.destination` is a host path string.
- The frontend has no unrestricted FS plugin access (ADR-0002). Filesystem mutations must go through the planned file-operation pipeline (`plan_file_operation` then `start_file_operation`) with progress, cancellation, and persisted operation history. Metadata jobs such as folder size and recursive search use the job event shape but are started through `fs_folder_size_start` / `fs_recursive_search_start` and are not persisted to operation history.
- IPC contracts are mirrored on both sides. When adding or changing a DTO in `crates/app-ipc`, update `packages/ts-api/src/types.ts`, the method on the matching `packages/ts-api/src/clients/*.ts` file, the `commandMap` entry in `packages/ts-api/src/commandMap.ts`, and the handler in `apps/desktop-tauri/src-tauri/src/commands/*.rs` (registered from `src-tauri/src/lib.rs`). DTOs use `#[serde(rename_all = "camelCase")]` to match the TS types.
- Errors cross the boundary as `IpcError { code, message }`. Use the stable codes from `FileOperationError::code()` / `VfsError::code()` (e.g. `permission_denied`, `not_found`, `destination_conflict`, `invalid_name`, `cancelled`); extend the catalog in the API reference when adding new variants.
- Event channel names live in `crates/app-ipc` constants (`DIRECTORY_BATCH_EVENT`, `JOB_*_EVENT`, `WATCH_CHANGED_EVENT`, `FOLDER_SIZE_COMPLETED_EVENT`, `RECURSIVE_SEARCH_*_EVENT`) and must match `packages/ts-api/src/events.ts` (re-exported from the package root). The Rust enum-to-name mapping for job events is `app_ipc::job_event_name`.

## Build, Test, and Development Commands

- `pnpm install`: install workspace dependencies using pnpm 10.26.2.
- `pnpm bootstrap`: run `scripts/bootstrap.sh`.
- `pnpm dev`: build `@fileoctopus/ts-api`, `@fileoctopus/ui`, and `@fileoctopus/frontend`, then start the Tauri desktop app.
- `pnpm build`: build all pnpm packages with declared build scripts.
- `pnpm typecheck`: run TypeScript checks across apps and packages.
- `pnpm lint`: run ESLint for `apps/**/*.ts(x)` and `packages/**/*.ts(x)`.
- `pnpm test`: run package tests, currently Vitest where configured.
- `pnpm format:check`: run Prettier checks for package metadata, docs, and TS/CSS/JSON/Markdown files.
- `pnpm test:frontend:rc`: run frontend release-candidate validation (`typecheck`, `lint`, `test`, `build`).
- `pnpm test:backend:rc`: run backend release-candidate validation (`cargo fmt --check`, `cargo check`, `cargo test`, `cargo clippy`).
- `pnpm rc:validate`: run backend and frontend release-candidate validation.
- `pnpm tauri:build`: create a Tauri production build.
- `pnpm test:e2e`, `pnpm test:e2e:ui`, `pnpm test:e2e:headed`: run Playwright end-to-end tests.
- `pnpm test:e2e:tauri`, `pnpm test:e2e:tauri:build`: run WebdriverIO/Tauri end-to-end tests.
- `pnpm rust:check`, `pnpm rust:test`, `pnpm rust:fmt`, `pnpm rust:clippy`: run Rust workspace checks locally (not in CI).
- GitHub Actions CI runs `pnpm typecheck` and `pnpm test` only (path-filtered); optional `E2E Tauri (manual)` workflow via Actions tab.

## Coding Style & Naming Conventions

Use Rust 2021 and TypeScript ES modules. Keep Rust formatted with `cargo fmt`; `rustfmt.toml` sets Unix newlines and `max_width = 100`. TypeScript uses ESLint flat config with `@eslint/js` and `typescript-eslint`. Follow existing naming: Rust crates use kebab-case directories, Rust modules use snake_case, React components use PascalCase, and package names use the `@fileoctopus/*` scope. Do not add comments unless explicitly requested.

## Testing Guidelines

Prefer new tests under a `tests/` folder in the relevant crate or package, for example `crates/vfs/tests/...`, `apps/desktop-tauri/src-tauri/tests/...`, or `packages/ts-api/tests/client.test.ts`. Keep Vitest test names as `*.test.ts` and Rust integration tests as descriptive snake_case files. Run `pnpm test` and `pnpm rust:test` before submitting changes; also run typecheck, lint, format checks, clippy, and focused e2e tests when touching related code. Target 85%+ coverage for changed behavior where coverage measurement exists.

## Commit & Pull Request Guidelines

Current history uses Conventional Commit prefixes such as `feat:` and `chore:`. Keep commits small and imperative, for example `feat: add vfs provider registry`. Pull requests should complete `.github/pull_request_template.md`: summary, tests, and security impact. Link issues when relevant, include screenshots for UI changes, and note any filesystem, IPC, or permission boundary changes. `.github/CODEOWNERS` currently assigns review to `@ilyafedotov`.
