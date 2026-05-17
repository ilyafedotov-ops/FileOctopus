# Repository Guidelines

## Project Structure & Module Organization

FileOctopus is a Tauri v2 desktop file manager with Rust owning privileged filesystem logic and React TypeScript owning the UI. The root Rust workspace is defined in `Cargo.toml`; crates live in `crates/`, including `vfs` (domain types and provider trait), `fs-core` (`LocalFsProvider` plus `file_ops/` and helper modules for metadata, search, locations, and direct ops), `app-core` (`lib.rs`, `runtime.rs`, `history.rs`, `paths.rs`), `app-ipc` (IPC DTOs and event-name constants), `jobs`, `telemetry`, `config`, `platform`, and `test-support`. The desktop shell is in `apps/desktop-tauri/`: React in `src/`, a thin `src-tauri/src/lib.rs` entrypoint, per-domain handlers under `src-tauri/src/commands/`, plus `state.rs` and `emit.rs`. Shared TypeScript packages live in `packages/frontend` (`app/FileOctopusApp.tsx`, `commands/*`, `state/*`, `styles/regions/`), `packages/ui`, and `packages/ts-api` (`client.ts` facade, `clients/*`, `transports/*`, `commandMap.ts`, `events.ts`). Frontend architecture: `docs/architecture/modules/frontend.md`. Architecture records are in `docs/adr/`; the runtime API surface is documented in `docs/architecture/api-reference.md`. Do not add new docs unless requested.

## API & Boundary Invariants

The Rust↔TS boundary is the trust boundary. Read `docs/architecture/api-reference.md` before changing anything that crosses it.

- All resources cross the boundary as `local://` `ResourceUri` strings (ADR-0003). Parse with `ResourceUri::parse` or `ResourceUri::from_local_path`; do not pass raw OS paths.
- The frontend has no unrestricted FS plugin access (ADR-0002). Every mutating effect must go through a planned `FileOperation*` job with progress, cancellation, and a history row.
- IPC contracts are mirrored on both sides. When adding or changing a DTO in `crates/app-ipc`, update `packages/ts-api/src/types.ts`, the method on the matching `packages/ts-api/src/clients/*.ts` file, the `commandMap` entry in `packages/ts-api/src/commandMap.ts`, and the handler in `apps/desktop-tauri/src-tauri/src/commands/*.rs` (registered from `lib.rs`). DTOs use `#[serde(rename_all = "camelCase")]` to match the TS types.
- Errors cross the boundary as `IpcError { code, message }`. Use the stable codes from `FileOperationError::code()` / `VfsError::code()` (e.g. `permission_denied`, `not_found`, `destination_conflict`, `invalid_name`, `cancelled`); extend the catalog in the API reference when adding new variants.
- Event channel names live in `crates/app-ipc` constants (`DIRECTORY_BATCH_EVENT`, `JOB_*_EVENT`) and must match `packages/ts-api/src/events.ts` (re-exported from the package root). The Rust enum→name mapping is `app_ipc::job_event_name`.

## Build, Test, and Development Commands

- `pnpm install`: install workspace dependencies using pnpm 10.26.2.
- `pnpm bootstrap`: run `scripts/bootstrap.sh`.
- `pnpm dev`: build `@fileoctopus/frontend` and start the Tauri desktop app.
- `pnpm build`: build all pnpm packages with declared build scripts.
- `pnpm typecheck`: run TypeScript checks across apps and packages.
- `pnpm lint`: run ESLint for `apps/**/*.ts(x)` and `packages/**/*.ts(x)`.
- `pnpm test`: run package tests, currently Vitest where configured.
- `pnpm rust:check`, `pnpm rust:test`, `pnpm rust:fmt`, `pnpm rust:clippy`: run Rust workspace checks used by CI.

## Coding Style & Naming Conventions

Use Rust 2021 and TypeScript ES modules. Keep Rust formatted with `cargo fmt`; `rustfmt.toml` sets Unix newlines and `max_width = 100`. TypeScript uses ESLint flat config with `@eslint/js` and `typescript-eslint`. Follow existing naming: Rust crates use kebab-case directories, Rust modules use snake_case, React components use PascalCase, and package names use the `@fileoctopus/*` scope. Do not add comments unless explicitly requested.

## Testing Guidelines

Prefer new tests under a `tests/` folder in the relevant crate or package, for example `crates/vfs/tests/...` or `packages/ts-api/tests/client.test.ts`. Keep Vitest test names as `*.test.ts` and Rust integration tests as descriptive snake_case files. Run `pnpm test` and `pnpm rust:test` before submitting changes; also run typecheck, lint, fmt, and clippy when touching related code. Target 85%+ coverage for changed behavior.

## Commit & Pull Request Guidelines

Current history uses Conventional Commit prefixes such as `feat:` and `chore:`. Keep commits small and imperative, for example `feat: add vfs provider registry`. Pull requests should complete the repository template: summary, tests, and security impact. Link issues when relevant, include screenshots for UI changes, and note any filesystem, IPC, or permission boundary changes. CODEOWNERS currently assigns review to `@ilyafedotov`.
