# FileOctopus

FileOctopus is a Tauri v2 desktop file manager with a Rust-owned filesystem boundary and a React TypeScript frontend. It is designed for high-performance local file operations, virtualized large-directory browsing, and safe job-based execution.

## Current Status

Sprint 3 (MVP Release Candidate) is complete. Sprint 4 (Baseline File Manager Completeness) is in progress.

### What Works Today

- **Dual-pane file browsing** with virtualized rendering for large directories (100k+ entries)
- **Local filesystem navigation** through `local://` resource URIs
- **File operations**: copy, move, rename, create folder, and move-to-trash with conflict detection
- **Job engine**: queued, running, paused, cancelled, completed, and failed states with progress reporting
- **Operation history** persisted in SQLite
- **Diagnostics export** with app info, health, and log bundles
- **Keyboard navigation** and shortcuts (arrow keys, Page Up/Down, Home/End, Enter, Delete, F5, Tab)
- **Sorting and filtering** by name, size, modified date, and type
- **Path bar** with editable navigation
- **Conflict resolution policies**: fail, skip, overwrite, rename new, rename existing

## Prerequisites

- Rust via `rustup`
- Node.js
- pnpm (managed via corepack)
- Platform prerequisites for Tauri v2

## Quick Start

```bash
# Install dependencies and bootstrap the workspace
pnpm install
pnpm bootstrap

# Start the Tauri desktop app in development mode
pnpm dev
```

## Development Commands

```bash
# TypeScript / Frontend
pnpm dev              # Build deps and start Tauri dev
pnpm build            # Build all pnpm packages
pnpm typecheck        # Run TypeScript checks
pnpm lint             # Run ESLint
pnpm format           # Run Prettier
pnpm format:check     # Check formatting without writing
pnpm test             # Run Vitest tests

# Rust / Backend
pnpm rust:check       # cargo check --workspace
pnpm rust:test        # cargo test --workspace
pnpm rust:fmt         # cargo fmt --all --check
pnpm rust:clippy      # cargo clippy --workspace --all-targets -- -D warnings

# Release Candidate Validation
pnpm rc:validate      # Run full backend and frontend RC checks
pnpm tauri:build      # Build Tauri release bundles (.deb, .rpm, .AppImage)
```

## Project Layout

### Desktop Shell

- `apps/desktop-tauri` — Tauri v2 desktop shell (React entry + Rust command handlers)
- `apps/cli` — Placeholder CLI binary

### Rust Workspace (`crates/`)

- `vfs` — Domain types, `ResourceUri`, `FileEntry`, `VfsProvider` trait
- `fs-core` — `LocalFsProvider` and the `file_ops` planner/executor
- `jobs` — `JobId`, `JobSnapshot`, `JobEvent`, `CancellationToken`
- `app-core` — `AppCore::boot`, `OperationRuntime`, SQLite operation history
- `app-ipc` — IPC DTOs, event-name constants, error mapping
- `telemetry` — `tracing` subscriber initialization
- `config` — Reserved for runtime configuration loading
- `platform` — Reserved for platform-specific abstractions
- `test-support` — `fileoctopus-test-tree` fixture generator

### TypeScript Workspace (`packages/`)

- `@fileoctopus/frontend` — `FileOctopusShell` component and `panelStore`
- `@fileoctopus/ui` — Shared React UI primitives
- `@fileoctopus/ts-api` — Typed frontend IPC client and transports

### Documentation

- `docs/adr` — Architecture decision records
- `docs/architecture` — Module architecture and API reference
- `docs/testing` — Test protocols and performance benchmarks
- `docs/release` — Sprint QA and release checklists
- `docs/release-notes` — Release candidate notes
- `docs/planning` — Sprint implementation backlogs

## Testing

Generate large directory fixtures and run performance tests:

```bash
cargo run -p test-support --bin fileoctopus-test-tree -- --root ./tmp/100k --files 100000 --dirs 0
```

See `docs/testing/large-directory-performance.md` and `docs/testing/sprint-1-demo.md` for full protocols.

## Architecture

Read `docs/architecture/README.md` for the module breakdown and `docs/architecture/api-reference.md` for the Rust↔TS runtime contract.

Key boundary invariants:

- All resources cross as `local://` `ResourceUri` strings
- The frontend has no unrestricted filesystem plugin access
- Every mutating effect goes through a planned `FileOperation*` job
- IPC contracts are mirrored on both sides with `#[serde(rename_all = "camelCase")]`

## ADRs

Start from `docs/adr/README.md` and use `docs/adr/0000-template.md` for new decisions.

## Contributing

This repository uses Conventional Commit prefixes (`feat:`, `chore:`, `fix:`). Pull requests should complete the template in `.github/pull_request_template.md`. CODEOWNERS assigns review to `@ilyafedotov`.
