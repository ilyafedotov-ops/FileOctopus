# `@fileoctopus/ts-api` — Typed frontend IPC client

`packages/ts-api` is the **only** package that talks to Tauri. Everything else in the frontend imports from `@fileoctopus/ts-api`, never from `@tauri-apps/api` directly. This keeps the IPC surface small, typed, and swappable.

> **Doc freshness (2026-06-12):** `commandMap` and per-domain clients are split out of the monolithic `client.ts`; Git Review uses `GitClient.statusForRepository` and `GitClient.diffFile` in addition to the existing branch/status helpers.

- Source: `packages/ts-api/src/{client,types,index,commandMap,events,normalizeError}.ts`, `packages/ts-api/src/clients/*.ts`, `packages/ts-api/src/transports/{tauri,preview}.ts`
- Depends on: `@tauri-apps/api` (peer/dev only at the import path).
- Used by: `@fileoctopus/frontend`, tests in `packages/ts-api/tests/client.test.ts`.

## Public surface

`src/index.ts` re-exports the whole client and type module:

```ts
export * from "./client";
export * from "./types";
```

The shape is documented in [api-reference.md](../api-reference.md) §TypeScript client. This document focuses on the **internals**: command mapping, transports, event subscription, and error normalization.

## Architecture

```
FileOctopusClient (client.ts)
 ├── fs ────────────────► clients/fs.ts
 ├── git ───────────────► clients/git.ts
 ├── fileOperations ────► clients/fileOperations.ts
 ├── jobs ──────────────► clients/jobs.ts
 ├── operationHistory ──► clients/history.ts
 ├── diagnostics ───────► clients/diagnostics.ts
 ├── preferences ───────► clients/preferences.ts
 ├── navigation ────────► clients/navigation.ts
 └── autostart ─────────► clients/autostart.ts
              │
              ▼
        IpcTransport ◄── transports/tauri.ts (uses commandMap.ts)
                      └── transports/preview.ts

events.ts — channel name constants (mirrors app-ipc)
normalizeError.ts — normalizeIpcError / isIpcError
```

`FileOctopusClient` owns the transport and one sub-client per IPC domain. Each sub-client calls `transport.invoke<TResponse>(dottedName, { request })` and normalizes errors. Event subscriptions go through `transport.listen` (optional on the interface); channel strings come from `events.ts`.

## `IpcTransport`

```ts
export interface IpcTransport {
  invoke<TResponse>(
    command: string,
    args?: Record<string, unknown>,
  ): Promise<TResponse>;
  listen?<TPayload>(
    event: string,
    handler: (payload: TPayload) => void,
  ): Promise<UnlistenFn>;
}
```

Two ship in-box:

- `createTauriTransport()` — wraps `@tauri-apps/api/core::invoke` and `@tauri-apps/api/event::listen`. Translates dotted command names through `commandMap`. The Tauri `listen` callback hands you `{ payload }`; the transport unwraps it so handlers receive the payload directly.
- `createPreviewTransport()` — degraded transport for running the React build in a plain browser (e.g. Storybook, design previews). `app.get_info` returns a stub; `fs.list_start` synthesizes a session id and emits an empty `directory:batch` event; Git Review has deterministic preview status/diff data; diagnostics returns safe stubs; mutating commands reject with `code: "tauri_unavailable"` unless explicitly stubbed for preview.

`createFileOctopusClient(transport?)` auto-selects: if `globalThis.__TAURI_INTERNALS__` is present, the Tauri transport; otherwise the preview transport. Tests inject a mock transport directly into `new FileOctopusClient(transport)`.

## `commandMap`

Dotted method names → snake_case Tauri command names. **Source of truth:** `packages/ts-api/src/commandMap.ts` (imported by `transports/tauri.ts`). The [API reference](../api-reference.md#full-registry-2026-06-12) lists the full registry.

The Tauri transport translates dotted names before `invoke` — e.g. `fileOperation.plan` → `plan_file_operation`. Mock transports in tests only see the dotted name.

When you add a new Tauri command:

1. Pick a dotted name (`scope.actionName`, camelCase action).
2. Add a row to `commandMap.ts` mapping it to the snake_case Rust name.
3. Add a method on the matching file in `clients/*.ts`.
4. Mirror the request/response types in `types.ts`.
5. Register the handler in `src-tauri/src/commands/<domain>.rs` and `lib.rs`'s `generate_handler!`.

## Sub-clients

Each sub-client follows the same pattern: `invoke` inside `try`/`catch`, throw the normalized error.

```ts
async stat(request: StatRequest): Promise<StatResponse> {
  try {
    return await this.transport.invoke<StatResponse>("fs.stat", { request });
  } catch (error) {
    throw normalizeIpcError(error);
  }
}
```

Event subscriptions use `requireListen` (a helper that rejects with `unsupported_transport` if the transport has no `listen`). The `FsClient` inlines the same check for `onDirectoryBatch` for clarity, since it is the only path on that client that needs events.

### Method ↔ event matrix

| Client                   | Methods                                                             | Events                                                                             |
| ------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `FsClient`               | `stat`, `listStart`                                                 | `onDirectoryBatch`                                                                 |
| `GitClient`              | `discover`, `statusForDirectory`, `statusForRepository`, `diffFile` | —                                                                                  |
| `FileOperationsClient`   | `planFileOperation`, `startFileOperation`                           | `onJobStarted`, `onJobProgress`, `onJobCompleted`, `onJobFailed`, `onJobCancelled` |
| `JobsClient`             | `cancelJob`, `getJobStatus`                                         | —                                                                                  |
| `OperationHistoryClient` | `listRecentOperations`                                              | —                                                                                  |

`onDirectoryBatch` and the `onJob*` family each return an `UnlistenFn`; the frontend cleans them up in `useEffect` teardown.

## Types module

`src/types.ts` mirrors `crates/app-ipc` field-for-field. Notes on subtle bits:

- `FileKind` is a string literal union (`"file" | "directory" | …`); Rust's `FileKind` enum serializes that way thanks to `#[serde(rename_all = "camelCase")]`.
- `JobSnapshot.jobId` is typed `string | JobId` because `JobId` (in `crates/jobs`) serializes either as a plain string or as `{ value }` depending on the path. UI code coerces via `typeof jobId === "string" ? jobId : jobId.value`.
- Every optional field uses `?` _and_ a nullable type (`size?: number | null`) because the Rust DTO is `Option<u64>` and serde serializes `None` as `null`.

## Error normalization

Implemented in `normalizeError.ts` and re-exported from `client.ts` / the package root:

```ts
export function normalizeIpcError(error: unknown): IpcError;
```

- Already-shaped `IpcError` passes through (duck-typed: both `code` and `message` strings).
- `Error` instances become `{ code: "unknown", message: error.message }`.
- Strings become `{ code: "unknown", message: error }`.
- Everything else becomes `{ code: "unknown", message: "Unexpected IPC error" }`.

`isIpcError(error)` lives in the same module.

## Conventions

- **The client doesn't know about React.** Don't import `react` or any UI library here; the package is consumable from non-React contexts (CLI tests, future Node scripts).
- **One sub-client per dotted scope.** Don't sprinkle `fs.` calls across `JobsClient`. If you need cross-cutting orchestration, do it in the frontend, not in the client.
- **All thrown errors are `IpcError`.** Wrap any call site that can throw a non-IPC error in `normalizeIpcError`.
- **No persistent state.** Sub-clients hold only their transport. No caches, no observables. The frontend's `useReducer` panel store and `useState` job map are the right home for state.

## Tests

`packages/ts-api/tests/client.test.ts` uses Vitest with hand-rolled `IpcTransport` mocks. Coverage:

- App-info round-trip through the transport.
- `fs.stat` and `fs.list_start` command names.
- Directory batch subscription and unlisten plumbing.
- `JobsClient` cancel/status routing.
- Error normalization for `IpcError`, native `Error`, string throws, and unknowns.

Run with `pnpm --filter @fileoctopus/ts-api test`.
