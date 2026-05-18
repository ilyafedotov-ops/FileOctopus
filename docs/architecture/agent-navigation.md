# Agent Navigation Guide

This is the short map for autonomous coding agents working in FileOctopus. Use it to choose the right source files, docs, and checks before making a change.

## Start here

1. Read [`AGENTS.md`](../../AGENTS.md) for repository rules, boundary invariants, commands, and style.
2. Read this guide to route the task to the right subsystem.
3. If the change crosses Rust/TypeScript IPC, read [`api-reference.md`](api-reference.md) before editing.
4. Read the relevant module page under [`modules/`](modules/) for implementation details.
5. Check [`PROJECT_STATUS_AND_DOC_ALIGNMENT.md`](../planning/PROJECT_STATUS_AND_DOC_ALIGNMENT.md) before trusting older sprint plans, QA reports, or backlog notes.

## System map

```text
React UI
  packages/frontend
    |
    v
@fileoctopus/ts-api
  packages/ts-api
    |
    v
Tauri invoke/listen boundary
  apps/desktop-tauri/src-tauri/src/commands
    |
    v
AppState, AppCore, OperationRuntime
  crates/app-core, crates/app-ipc, crates/jobs
    |
    v
VFS and local filesystem implementation
  crates/vfs, crates/fs-core
```

The Tauri IPC layer is the trust boundary. The frontend does not get unrestricted filesystem access. Privileged filesystem reads, writes, metadata jobs, operation history, diagnostics, and preferences go through registered commands and typed DTOs.

## Change routing

| Task                                                                      | Start with                                                                             | Contract docs                                                                                                                                          | Focused checks                                                                                     |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Frontend UI behavior, panes, sidebar, jobs rail, dialogs, command palette | `packages/frontend/src`                                                                | [`modules/frontend.md`](modules/frontend.md), [`modules/ui.md`](modules/ui.md) when shared primitives change                                           | `pnpm typecheck`, `pnpm lint`, `pnpm --filter @fileoctopus/frontend test`                          |
| Shared IPC client, transports, event constants, TS DTOs                   | `packages/ts-api/src`                                                                  | [`api-reference.md`](api-reference.md), [`modules/ts-api.md`](modules/ts-api.md)                                                                       | `pnpm --filter @fileoctopus/ts-api build`, `pnpm typecheck`, `pnpm test`                           |
| New or changed Tauri command                                              | `apps/desktop-tauri/src-tauri/src/commands`, `apps/desktop-tauri/src-tauri/src/lib.rs` | [`api-reference.md`](api-reference.md), [`modules/desktop-tauri.md`](modules/desktop-tauri.md), [`modules/app-ipc.md`](modules/app-ipc.md)             | `pnpm rust:check`, `pnpm rust:test`, `pnpm typecheck`                                              |
| IPC DTO, event, or error code                                             | `crates/app-ipc`, `packages/ts-api/src/types.ts`, `commandMap.ts`, `events.ts`         | [`api-reference.md`](api-reference.md), [`ADR-0002`](../adr/0002-frontend-filesystem-restrictions.md), [`ADR-0003`](../adr/0003-local-resource-uri.md) | `pnpm rust:check`, `pnpm typecheck`, targeted Rust/TS tests                                        |
| File operation planning or execution                                      | `crates/fs-core/src/file_ops`, `crates/app-core/src/runtime`, `crates/jobs`            | [`modules/fs-core.md`](modules/fs-core.md), [`modules/app-core.md`](modules/app-core.md), [`modules/jobs.md`](modules/jobs.md)                         | `pnpm rust:test`, `pnpm rust:clippy`                                                               |
| VFS resource model, `ResourceUri`, provider trait, file entry shape       | `crates/vfs`                                                                           | [`modules/vfs.md`](modules/vfs.md), [`ADR-0003`](../adr/0003-local-resource-uri.md)                                                                    | `pnpm rust:test`, `pnpm rust:check`                                                                |
| Operation history, app data paths, runtime boot                           | `crates/app-core`                                                                      | [`modules/app-core.md`](modules/app-core.md)                                                                                                           | `pnpm rust:test`, `pnpm rust:check`                                                                |
| Desktop shell capabilities, Tauri config, event emission                  | `apps/desktop-tauri`                                                                   | [`modules/desktop-tauri.md`](modules/desktop-tauri.md), [`api-reference.md`](api-reference.md)                                                         | `pnpm rust:check`, `pnpm --filter @fileoctopus/desktop-tauri build` when frontend shell is touched |
| Tests, fixtures, large directory validation                               | `crates/test-support`, `docs/testing`                                                  | [`modules/test-support.md`](modules/test-support.md), [`../testing/README.md`](../testing/README.md)                                                   | `pnpm rust:test`, `pnpm test`, focused e2e command when relevant                                   |

For broad release-candidate validation, run `pnpm rc:validate`.

## Boundary rules

- Filesystem resources cross Rust/TypeScript as `local://` `ResourceUri` strings. Rust should parse with `ResourceUri::parse` or construct with `ResourceUri::from_local_path`.
- Do not pass raw host paths for filesystem resources across IPC. The diagnostics bundle export destination is the explicit exception documented in the API reference.
- Frontend filesystem mutations must use the file-operation pipeline: `plan_file_operation` then `start_file_operation`.
- Metadata jobs such as folder size and recursive search use job-shaped events but are started through their own `fs_*_start` commands and are not persisted to operation history.
- DTOs are mirrored on both sides: `crates/app-ipc` and `packages/ts-api/src/types.ts` must stay aligned with camelCase JSON.
- Command registration, `commandMap.ts`, client methods, Rust handlers, and API docs must change together for IPC work.
- Event names live in `crates/app-ipc` constants and `packages/ts-api/src/events.ts`; keep them byte-for-byte aligned.
- Errors cross IPC as `IpcError { code, message }`. Use stable error codes and update the API reference when adding new codes.

## Documentation freshness

Trust these first:

- [`api-reference.md`](api-reference.md) for IPC commands, events, DTOs, and error codes.
- [`PROJECT_STATUS_AND_DOC_ALIGNMENT.md`](../planning/PROJECT_STATUS_AND_DOC_ALIGNMENT.md) for what is current, target, stale, or historical.
- Module docs under [`modules/`](modules/) for implementation shape.
- ADRs under [`../adr/`](../adr/) for accepted architecture constraints.

Treat sprint backlogs, older plans, and QA snapshots as historical unless the status alignment page marks them current.

## Validation matrix

| Change type                    | Minimum validation                                                               |
| ------------------------------ | -------------------------------------------------------------------------------- |
| Markdown-only docs             | `pnpm format:check`                                                              |
| Frontend-only TypeScript/React | `pnpm typecheck`, `pnpm lint`, `pnpm test`                                       |
| Shared UI package              | `pnpm --filter @fileoctopus/ui build`, `pnpm typecheck`, relevant frontend tests |
| TS API contract                | `pnpm --filter @fileoctopus/ts-api build`, `pnpm typecheck`, `pnpm test`         |
| Rust crate behavior            | `pnpm rust:fmt`, `pnpm rust:check`, `pnpm rust:test`                             |
| IPC or file operation behavior | Rust checks plus TS typecheck/tests and API reference updates                    |
| Release-candidate confidence   | `pnpm rc:validate`                                                               |

When a command is too broad for the change, run the smallest focused check first and report what remains unrun.
