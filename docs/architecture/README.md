# Architecture

Architecture notes for FileOctopus v0.1.4. Contributors should start with the
API reference for runtime contracts, then use the per-module docs for
implementation detail.

- [API reference](api-reference.md) — Tauri commands, event channels, the `@fileoctopus/ts-api` client, domain types, and the error catalog.

## Per-module architecture

Rust workspace (`crates/`):

- [`vfs`](modules/vfs.md) — Domain types, `ResourceUri`, `FileEntry`, `VfsProvider` trait, error taxonomy.
- [`fs-core`](modules/fs-core.md) — `LocalFsProvider`, `file_ops/` planner/executor, and IPC helper modules (metadata, search, …).
- [`jobs`](modules/jobs.md) — `JobId`, `JobSnapshot`, `JobEvent`, `CancellationToken`.
- [`app-core`](modules/app-core.md) — `AppCore::boot`, `OperationRuntime`, SQLite operation history.
- [`app-ipc`](modules/app-ipc.md) — IPC DTOs, event-name constants, error mapping.
- [`telemetry`](modules/telemetry.md) — `tracing` subscriber initialization and helpers.
- [`test-support`](modules/test-support.md) — `fileoctopus-test-tree` fixture generator.

Desktop shell:

- [`apps/desktop-tauri`](modules/desktop-tauri.md) — Tauri v2 shell (`commands/*`, thin `lib.rs`), event emission, capabilities.

TypeScript workspace (`packages/`):

- [`@fileoctopus/ts-api`](modules/ts-api.md) — Typed frontend IPC client and transports.
- [`@fileoctopus/frontend`](modules/frontend.md) — `FileOctopusApp` shell, command dispatch, `panelStore` + slices, jobs rail, regional CSS.
- [`@fileoctopus/ui`](modules/ui.md) — Shared React primitives package.

## Placeholders

These modules exist in the workspace as named crates / apps but currently contain only a one-line marker and reserved naming. They do not have architecture docs yet — when they grow, add the corresponding `modules/<name>.md` page and link it from this index.

- `crates/config` — Reserved for runtime configuration loading.
- `crates/platform` — Reserved for platform-specific abstractions (notifications, system trash backends, etc.).
- `apps/cli` — Placeholder binary (`println!` only). When the CLI grows it will get its own page parallel to `desktop-tauri`.
