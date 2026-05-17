# FileOctopus

FileOctopus is a Tauri v2 desktop file manager with a Rust-owned filesystem boundary and a React TypeScript frontend. It is designed for high-performance local file operations, virtualized large-directory browsing, and safe job-based execution.

## Current status

**Release Candidate (v0.1.0).** Milestones M0–M3 of the [RC engineering spec](docs/architecture/rc-engineering-spec.md) are largely complete on `main`. M4 is partial (zip archives in `fs-core`; Git and embedded terminal deferred).

For a full doc ↔ code matrix, see **[docs/planning/PROJECT_STATUS_AND_DOC_ALIGNMENT.md](docs/planning/PROJECT_STATUS_AND_DOC_ALIGNMENT.md)**.

### What works today

- **Dual-pane browsing** with virtualization (100k+ entry protocol)
- **`local://` URIs** at every Rust↔TS boundary (ADR-0003)
- **File operations**: copy, move, rename, create folder/file, trash, permanent delete — plan → start with conflict policies
- **Navigation**: sidebar (favorites, devices, pinned, recent, starred), breadcrumbs, editable path bar, back/forward/up
- **Views**: details (9 columns), list, icons, columns; sort/filter; recursive search job
- **Jobs & history**: progress, cancel, SQLite operation history, activity panel
- **Preferences**: theme, density, accent, font/icon scale, layout toggles, autostart (where supported)
- **Polish**: command palette (Ctrl/Cmd+P), text preview (Space), filesystem watcher refresh, diagnostics export, shortcuts dialog
- **Platform helpers**: open with default app, reveal in file manager, external terminal in folder (`fs_open_terminal`), folder size job, file hash (`fs_compute_hash`)

### Not in RC yet

- Full application menu bar wiring (shell exists — see [Menu spec](docs/plans/FileOctopus_Menu_and_Modal_Specification.md))
- Git status badges and branch display
- Tar and non-zip archive formats
- Embedded terminal panel (external emulator via `fs_open_terminal` works)
- Multi-tab per pane, cloud/remote providers, plugins, AI search

## Prerequisites

- Rust via `rustup`
- Node.js
- pnpm 10.26.2+ (`packageManager` in `package.json`; `corepack enable` recommended)
- Platform prerequisites for Tauri v2

## Quick start

```bash
pnpm install
pnpm bootstrap
pnpm dev
```

## Development commands

```bash
# TypeScript / Frontend
pnpm dev              # Build deps and start Tauri dev
pnpm build            # Build all pnpm packages
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test             # Vitest (packages with tests)

# Rust / Backend
pnpm rust:check
pnpm rust:test
pnpm rust:fmt
pnpm rust:clippy

# Release candidate
pnpm rc:validate
pnpm tauri:build
```

## Project layout

- `apps/desktop-tauri` — Tauri v2 shell (React + `src-tauri/src/commands/*` handlers, thin `lib.rs` entrypoint)
- `apps/cli` — Placeholder CLI
- `crates/` — `vfs`, `fs-core`, `jobs`, `app-core`, `app-ipc`, `telemetry`, `config`, `platform`, `test-support`
- `packages/` — `@fileoctopus/frontend`, `@fileoctopus/ui`, `@fileoctopus/ts-api`
- `docs/` — Architecture, ADRs, QA, planning — start at [docs/architecture/README.md](docs/architecture/README.md)

## Testing

```bash
cargo run -p test-support --bin fileoctopus-test-tree -- --root ./tmp/100k --files 100000 --dirs 0
pnpm --filter @fileoctopus/frontend test
```

See [docs/testing/README.md](docs/testing/README.md) and [docs/testing/large-directory-performance.md](docs/testing/large-directory-performance.md).

## Architecture

- [API reference](docs/architecture/api-reference.md) — IPC commands and events (update with every boundary change)
- [Module docs](docs/architecture/README.md)
- ADRs: [docs/adr/README.md](docs/adr/README.md)

Boundary invariants: `local://` URIs only; no unrestricted frontend FS plugins; mutating work through planned jobs; mirrored IPC DTOs.

## Contributing

Conventional Commits (`feat:`, `fix:`, …). PRs use `.github/pull_request_template.md`. CODEOWNERS: `@ilyafedotov`.
