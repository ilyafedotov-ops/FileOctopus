# FileOctopus API Reference

This document is the authoritative description of FileOctopus's runtime API surface: the Tauri IPC commands, the events streamed back from Rust, the `@fileoctopus/ts-api` client that wraps them, and the domain types that flow across the boundary. It is the contract every change to filesystem behaviour must respect (see ADR-0002 and ADR-0003).

> **Doc freshness (2026-06-12):** Command registry aligned with `generate_handler!` in `lib.rs` and `commandMap.ts` (99 handlers). Event channels aligned with `crates/app-ipc/src/lib.rs` and `packages/ts-api/src/events.ts` (19 channels). `packages/ts-api/tests/catalogs.test.ts` guards the command count, command map, error codes, warning codes, and event constants.

- Source of truth (Rust): `apps/desktop-tauri/src-tauri/src/lib.rs` (handler registration), `apps/desktop-tauri/src-tauri/src/commands/*.rs`, `crates/app-ipc/src/lib.rs`, `crates/app-core/src/{lib,runtime,history,paths}.rs`, `crates/vfs/src/lib.rs`, `crates/jobs/src/lib.rs`, `crates/remote-core/src/lib.rs`, `crates/provider-sftp/src/lib.rs`, `crates/config/src/network.rs`, `crates/platform/src/lib.rs`, `crates/fs-core/src/file_ops/mod.rs` (and `metadata`, `search`, `locations`, `external_open`, `direct_ops` for non-job FS helpers).
- Source of truth (TypeScript): `packages/ts-api/src/{client,types,commandMap,events,normalizeError,uri}.ts`, `packages/ts-api/src/clients/*.ts`, `packages/ts-api/src/transports/{tauri,preview}.ts`.

When you change any of the above, update the rest as a unit (see [Maintenance](#maintenance)).

## Contents

1. [Architectural surface](#architectural-surface)
2. [Tauri command catalog](#tauri-command-catalog)
3. [Event channels](#event-channels)
4. [TypeScript client (`@fileoctopus/ts-api`)](#typescript-client-fileoctopusts-api)
5. [Resource URIs](#resource-uris)
6. [File entries and capabilities](#file-entries-and-capabilities)
7. [File operations: plan and execute](#file-operations-plan-and-execute)
8. [Jobs and job lifecycle](#jobs-and-job-lifecycle)
9. [Operation history](#operation-history)
10. [Error model](#error-model)
11. [Rust crate APIs](#rust-crate-apis)
12. [Maintenance](#maintenance)

## Architectural surface

The trust boundary is the Tauri IPC layer. Every privileged effect (filesystem read, mutation, trash, history) is exposed only through a registered Tauri command. The frontend has no `tauri-plugin-fs` permissions; it talks to Rust through `FileOctopusClient`.

```
React UI ──► @fileoctopus/ts-api ──► Tauri invoke / listen ──► Rust commands
                                                                │
                                                                ▼
                                       AppState { VfsRegistry, OperationRuntime, history }
                                                                │
                                                                ▼
                                       LocalFsProvider · SftpProvider · file_ops planner/executor · SQLite
```

Each IPC payload is a `serde(rename_all = "camelCase")` DTO defined in `crates/app-ipc`. The TypeScript types in `packages/ts-api/src/types.ts` mirror those DTOs exactly. The TS client translates dotted method names (e.g. `fs.stat`) into the underlying snake_case Tauri command names (`fs_stat`) via `commandMap`; both sides must stay aligned.

## Tauri command catalog

The desktop shell registers these commands from `apps/desktop-tauri/src-tauri/src/lib.rs` (`tauri::generate_handler!` with `commands::*` paths). Handler bodies live in `apps/desktop-tauri/src-tauri/src/commands/{app_info,fs,git,folder_size,recursive_search,content_search,watch,preferences,autostart,navigation,network,file_operations,diagnostics,acl,compare,plugin,sync,terminal}.rs`. Dotted names are what `packages/ts-api` passes to `commandMap`; see `packages/ts-api/src/commandMap.ts` and the per-domain methods in `packages/ts-api/src/clients/*.ts`.

### Full registry (2026-06-12)

**99 commands** — verified by `packages/ts-api/tests/catalogs.test.ts`, which compares `generate_handler!`, `commandMap.ts`, and this advertised count.

| Tauri command                        | TS dotted name (typical)           | Client area              |
| ------------------------------------ | ---------------------------------- | ------------------------ |
| `app_get_info`                       | `app.get_info`                     | `FileOctopusClient`      |
| `fs_stat`                            | `fs.stat`                          | `FsClient`               |
| `fs_read_text_file`                  | `fs.read_text_file`                | `FsClient`               |
| `fs_read_file_range`                 | `fs.read_file_range`               | `FsClient`               |
| `fs_read_file_as_data_uri`           | `fs.read_file_as_data_uri`         | `FsClient`               |
| `fs_read_image_as_data_uri`          | `fs.read_image_as_data_uri`        | `FsClient`               |
| `fs_write_text_file`                 | `fs.write_text_file`               | `FsClient`               |
| `fs_compute_hash`                    | `fs.compute_hash`                  | `FsClient`               |
| `fs_open_terminal`                   | `fs.open_terminal`                 | `FsClient`               |
| `terminal_spawn`                     | `terminal.spawn`                   | `TerminalClient`         |
| `terminal_write`                     | `terminal.write`                   | `TerminalClient`         |
| `terminal_resize`                    | `terminal.resize`                  | `TerminalClient`         |
| `terminal_kill`                      | `terminal.kill`                    | `TerminalClient`         |
| `terminal_capabilities`              | `terminal.capabilities`            | `TerminalClient`         |
| `terminal_profiles_list`             | `terminal.profilesList`            | `TerminalClient`         |
| `terminal_profile_add`               | `terminal.profileAdd`              | `TerminalClient`         |
| `terminal_profile_update`            | `terminal.profileUpdate`           | `TerminalClient`         |
| `terminal_profile_delete`            | `terminal.profileDelete`           | `TerminalClient`         |
| `terminal_profile_set_default`       | `terminal.profileSetDefault`       | `TerminalClient`         |
| `terminal_sessions_list`             | `terminal.sessionsList`            | `TerminalClient`         |
| `terminal_send_text`                 | `terminal.sendText`                | `TerminalClient`         |
| `terminal_run_command`               | `terminal.runCommand`              | `TerminalClient`         |
| `terminal_spawn_and_run`             | `terminal.spawnAndRun`             | `TerminalClient`         |
| `fs_list_start`                      | `fs.list_start`                    | `FsClient`               |
| `fs_standard_locations`              | `fs.standard_locations`            | `FsClient`               |
| `fs_discover_volumes`                | `fs.discover_volumes`              | `FsClient`               |
| `fs_eject_volume`                    | `fs.eject_volume`                  | `FsClient`               |
| `fs_list_archive`                    | `fs.list_archive`                  | `FsClient`               |
| `fs_diff_text`                       | `fs.diff_text`                     | `FsClient`               |
| `fs_list_directories`                | `fs.list_directories`              | `FsClient`               |
| `fs_open_default`                    | `fs.open_default`                  | `FsClient`               |
| `fs_reveal`                          | `fs.reveal`                        | `FsClient`               |
| `fs_properties`                      | `fs.properties`                    | `FsClient`               |
| `git_discover`                       | `git.discover`                     | `GitClient`              |
| `git_status_for_directory`           | `git.statusForDirectory`           | `GitClient`              |
| `git_status_for_repository`          | `git.statusForRepository`          | `GitClient`              |
| `git_diff_file`                      | `git.diffFile`                     | `GitClient`              |
| `git_history`                        | `git.history`                      | `GitClient`              |
| `git_branches`                       | `git.branches`                     | `GitClient`              |
| `git_worktrees`                      | `git.worktrees`                    | `GitClient`              |
| `git_revision_diff`                  | `git.revisionDiff`                 | `GitClient`              |
| `git_revision_files`                 | `git.revisionFiles`                | `GitClient`              |
| `fs_folder_size`                     | `fs.folder_size`                   | `FsClient`               |
| `fs_folder_size_start`               | `fs.folder_size_start`             | `FsClient`               |
| `fs_recursive_search`                | `fs.recursive_search`              | `FsClient`               |
| `fs_recursive_search_start`          | `fs.recursive_search_start`        | `FsClient`               |
| `fs_content_search`                  | `fs.content_search`                | `FsClient`               |
| `fs_content_search_start`            | `fs.content_search_start`          | `FsClient`               |
| `fs_watch_start`                     | `fs.watch_start`                   | `FsClient`               |
| `fs_watch_stop`                      | `fs.watch_stop`                    | `FsClient`               |
| `get_preferences`                    | `preferences.get`                  | `PreferencesClient`      |
| `set_preference`                     | `preferences.set`                  | `PreferencesClient`      |
| `get_autostart`                      | `autostart.get`                    | `AutostartClient`        |
| `set_autostart`                      | `autostart.set`                    | `AutostartClient`        |
| `navigation_record_visit`            | `navigation.recordVisit`           | `NavigationClient`       |
| `navigation_list_favorites`          | `navigation.listFavorites`         | `NavigationClient`       |
| `navigation_add_favorite`            | `navigation.addFavorite`           | `NavigationClient`       |
| `navigation_remove_favorite`         | `navigation.removeFavorite`        | `NavigationClient`       |
| `navigation_rename_favorite`         | `navigation.renameFavorite`        | `NavigationClient`       |
| `navigation_list_recent`             | `navigation.listRecent`            | `NavigationClient`       |
| `navigation_list_starred`            | `navigation.listStarred`           | `NavigationClient`       |
| `navigation_toggle_starred`          | `navigation.toggleStarred`         | `NavigationClient`       |
| `navigation_is_starred`              | `navigation.isStarred`             | `NavigationClient`       |
| `navigation_clear_recent`            | `navigation.clearRecent`           | `NavigationClient`       |
| `navigation_remove_recent`           | `navigation.removeRecent`          | `NavigationClient`       |
| `network_profiles_list`              | `network.profilesList`             | `NetworkClient`          |
| `network_providers_list`             | `network.providersList`            | `NetworkClient`          |
| `network_profile_add`                | `network.profileAdd`               | `NetworkClient`          |
| `network_profile_update`             | `network.profileUpdate`            | `NetworkClient`          |
| `network_profile_delete`             | `network.profileDelete`            | `NetworkClient`          |
| `network_profile_set_secret`         | `network.profileSetSecret`         | `NetworkClient`          |
| `network_connect`                    | `network.connect`                  | `NetworkClient`          |
| `network_disconnect`                 | `network.disconnect`               | `NetworkClient`          |
| `network_connection_status`          | `network.connectionStatus`         | `NetworkClient`          |
| `network_profile_test`               | `network.profileTest`              | `NetworkClient`          |
| `network_discover_neighborhood`      | `network.discoverNeighborhood`     | `NetworkClient`          |
| `network_profile_forget_fingerprint` | `network.profileForgetFingerprint` | `NetworkClient`          |
| `network_profile_trust_fingerprint`  | `network.profileTrustFingerprint`  | `NetworkClient`          |
| `network_validate_uri`               | `network.validateUri`              | `NetworkClient`          |
| `plan_file_operation`                | `fileOperation.plan`               | `FileOperationsClient`   |
| `start_file_operation`               | `fileOperation.start`              | `FileOperationsClient`   |
| `pause_job`                          | `job.pause`                        | `JobsClient`             |
| `resume_job`                         | `job.resume`                       | `JobsClient`             |
| `cancel_job`                         | `job.cancel`                       | `JobsClient`             |
| `get_job_status`                     | `job.status`                       | `JobsClient`             |
| `list_recent_operations`             | `operationHistory.listRecent`      | `OperationHistoryClient` |
| `clear_operation_history`            | `operationHistory.clear`           | `OperationHistoryClient` |
| `diagnostics_app_data_health`        | `diagnostics.appDataHealth`        | `DiagnosticsClient`      |
| `export_diagnostics_bundle`          | `diagnostics.exportBundle`         | `DiagnosticsClient`      |
| `diagnostics_start_log_stream`       | `diagnostics.startLogStream`       | `DiagnosticsClient`      |
| `diagnostics_stop_log_stream`        | `diagnostics.stopLogStream`        | `DiagnosticsClient`      |
| `plugin_list`                        | `plugin.list`                      | `PluginClient`           |
| `plugin_install`                     | `plugin.install`                   | `PluginClient`           |
| `plugin_uninstall`                   | `plugin.uninstall`                 | `PluginClient`           |
| `plugin_toggle`                      | `plugin.toggle`                    | `PluginClient`           |
| `fs_get_acl`                         | `fs.get_acl`                       | `FsClient`               |
| `fs_set_acl`                         | `fs.set_acl`                       | `FsClient`               |
| `fs_compare_files`                   | `fs.compare_files`                 | `FsClient`               |
| `fs_sync_directories`                | `fs.sync_directories`              | `FsClient`               |

Per-command request/response detail below covers the **core** surface first; extend subsections when you add handlers.

All command handlers return `Result<TResponse, IpcError>`. Errors carry a stable string `code` (see [Error model](#error-model)).

### `app_get_info`

Returns the application's name, semantic version, build profile, optional commit SHA, and target OS.

```ts
const info = await client.getAppInfo();
// { name: "FileOctopus", version: "0.1.0", buildProfile: "release", commitSha: "abc123", targetOs: "linux" }
```

### `fs_stat`

Synchronous (one-shot) metadata read for a single `ResourceUri`.

```ts
const { entry } = await client.fs.stat({ uri: "local:///home/me/file.txt" });
```

| Field            | Type           | Notes                                               |
| ---------------- | -------------- | --------------------------------------------------- |
| `request.uri`    | `string`       | Must parse as `ResourceUri`.                        |
| `response.entry` | `FileEntryDto` | See [File entries](#file-entries-and-capabilities). |

Errors: `invalid_uri`, `unsupported_provider`, `not_found`, `permission_denied`, `internal`.

### `fs_list_start`

Begins a streamed directory listing. Returns immediately with a `sessionId`; entries arrive asynchronously as `directory:batch` events keyed by that `sessionId`.

```ts
const unlisten = await client.fs.onDirectoryBatch((event) => {
  if (event.error) {
    /* surface event.error */
    return;
  }
  /* append event.entries */
  if (event.isComplete) unlisten();
});

const { sessionId, requestId } = await client.fs.listStart({
  uri: "local:///home/me",
  requestId: crypto.randomUUID(),
  panelId: "left",
  batchSize: 256,
  includeHidden: false,
});
```

| Field                   | Type       | Notes                                                                 |
| ----------------------- | ---------- | --------------------------------------------------------------------- |
| `request.uri`           | `string`   | Directory `ResourceUri`.                                              |
| `request.requestId`     | `string`   | Client-generated correlation id; echoed on every batch for this list. |
| `request.panelId`       | `string?`  | `"left"` or `"right"`; used to cancel superseded listings per pane.   |
| `request.batchSize`     | `number?`  | Default `256`, clamped to `>= 1`.                                     |
| `request.includeHidden` | `boolean?` | Default `false`. Dotfiles are hidden.                                 |
| `response.sessionId`    | `string`   | UUID; matches `DirectoryBatchEventDto.sessionId`.                     |
| `response.requestId`    | `string`   | Echo of `request.requestId`.                                          |

Errors arrive on the event stream as `DirectoryBatchEventDto.error` when listing fails mid-stream (including `permission_denied` and `timeout` after 30s). The synchronous response only fails for invalid input (`invalid_uri`, `unsupported_provider`).

### Other `fs.*` commands

The `FsClient` exposes several one-shot filesystem helpers. These still cross the Rust trust boundary, so every path argument is a `local://` `ResourceUri`.

| Command                                                       | Request                                                                                              | Response                                    | Notes                                                                                                                               |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `fs_read_text_file` / `fs.read_text_file`                     | `{ uri, maxBytes? }`                                                                                 | `{ content, truncated, byteSize }`          | Reads up to `maxBytes` bytes, default 1 MiB. Uses lossy UTF-8 decoding. Directories fail with `is_directory`.                       |
| `fs_read_file_range` / `fs.read_file_range`                   | `{ uri, offset, length }`                                                                            | `{ bytesBase64, bytesRead, byteSize, eof }` | Paged binary read for the built-in viewer. `length` capped at 4 MiB. `local://` only; remote schemes return `unsupported_provider`. |
| `fs_write_text_file` / `fs.write_text_file`                   | `{ uri, content, maxBytes? }`                                                                        | `{ byteSize, job }`                         | Atomic temp+rename write for the built-in editor. Default 10 MiB cap. `local://` only. Emits operation job events and history rows. |
| `fs_compute_hash` / `fs.compute_hash`                         | `{ uri, algorithm }`                                                                                 | `{ hash, algorithm, byteSize }`             | Supports `sha256` / `sha-256`; files over 100 MiB fail with `file_too_large`.                                                       |
| `fs_open_terminal` / `fs.open_terminal`                       | `{ uri }`                                                                                            | `{ success }`                               | Opens the platform external terminal in an existing local directory; can fail with `no_terminal`.                                   |
| `terminal_spawn` / `terminal.spawn`                           | `{ uri?, profileId?, terminalProfileId?, cols, rows, shell?, args?, env?, initialCommand?, title? }` | `{ sessionId }`                             | Spawns a local PTY for `local://` `uri` or an SSH PTY for terminal-capable network `profileId`.                                     |
| `terminal_write` / `terminal.write`                           | `{ sessionId, data }`                                                                                | `{ success }`                               | Writes base64-encoded bytes to the PTY stdin. Applies to local and SSH terminal sessions.                                           |
| `terminal_resize` / `terminal.resize`                         | `{ sessionId, cols, rows }`                                                                          | `{ success }`                               | Resizes the PTY window. Applies to local and SSH terminal sessions.                                                                 |
| `terminal_kill` / `terminal.kill`                             | `{ sessionId }`                                                                                      | `{ success }`                               | Closes the PTY session. Applies to local and SSH terminal sessions.                                                                 |
| `terminal_capabilities` / `terminal.capabilities`             | none                                                                                                 | shell/theme/cursor capabilities             | Returns OS default shell metadata, discovered shells, SSH support, and supported terminal appearance options.                       |
| `terminal_profiles_list` / `terminal.profilesList`            | none                                                                                                 | `{ profiles, defaultProfileId }`            | Lists persisted terminal profiles.                                                                                                  |
| `terminal_profile_add` / `terminal.profileAdd`                | `{ profile }`                                                                                        | `{ profile }`                               | Creates a terminal profile.                                                                                                         |
| `terminal_profile_update` / `terminal.profileUpdate`          | `{ id, profile }`                                                                                    | `{ profile }`                               | Updates a terminal profile.                                                                                                         |
| `terminal_profile_delete` / `terminal.profileDelete`          | `{ id }`                                                                                             | `{ success }`                               | Deletes a non-default terminal profile.                                                                                             |
| `terminal_profile_set_default` / `terminal.profileSetDefault` | `{ id }`                                                                                             | `{ profile }`                               | Marks a terminal profile as the default.                                                                                            |
| `terminal_sessions_list` / `terminal.sessionsList`            | none                                                                                                 | `{ sessions }`                              | Lists live terminal sessions owned by the current window.                                                                           |
| `terminal_send_text` / `terminal.sendText`                    | `{ sessionId, text }`                                                                                | `{ success }`                               | Writes UTF-8 text to a terminal session.                                                                                            |
| `terminal_run_command` / `terminal.runCommand`                | `{ sessionId, command, appendNewline, focus }`                                                       | `{ success }`                               | Writes a command to an existing session, optionally appending a newline.                                                            |
| `terminal_spawn_and_run` / `terminal.spawnAndRun`             | `{ uri?, profileId?, terminalProfileId?, cols, rows, command, title? }`                              | `{ sessionId }`                             | Spawns a terminal and runs the supplied command.                                                                                    |
| `fs_standard_locations` / `fs.standard_locations`             | none                                                                                                 | `{ locations }`                             | Returns standard local locations as `{ id, name, uri, section }`.                                                                   |
| `fs_open_default` / `fs.open_default`                         | `{ uri }`                                                                                            | `{ ok }`                                    | Opens the resource with the OS default application.                                                                                 |
| `fs_reveal` / `fs.reveal`                                     | `{ uri }`                                                                                            | `{ ok }`                                    | Reveals the resource in the platform file manager.                                                                                  |
| `fs_properties` / `fs.properties`                             | `{ uri, includeFolderSummary? }`                                                                     | `{ properties }`                            | Returns metadata plus optional recursive summary for directories.                                                                   |

`PathPropertiesDto` includes `uri`, `name`, `kind`, file `size`, optional `totalSize`/`itemCount`/`fileCount`/`directoryCount`, timestamps, hidden/symlink flags, `symlinkTarget`, `readonly`, and non-fatal `warnings`.

### Git commands

Git commands are local-only metadata helpers backed by `crates/git-intel`. They accept `ResourceUri` strings and return empty repository state when the URI is outside a Git repository. Git Review is read-only: these commands inspect repository state, history, branches, worktrees, and worktree-vs-HEAD diffs, but they do not checkout, stage, commit, discard, branch, push, or pull.

| Command                                                 | Request                          | Response                                                                                                                        | Notes                                                                                 |
| ------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `git_discover` / `git.discover`                         | `{ uri }`                        | `{ repo }`                                                                                                                      | Returns repository root, branch, short HEAD, and dirty state.                         |
| `git_status_for_directory` / `git.statusForDirectory`   | `{ uri }`                        | `{ repo, entries }`                                                                                                             | Returns repository info plus visible-directory status keyed by URI.                   |
| `git_status_for_repository` / `git.statusForRepository` | `{ uri }`                        | `{ repo, files }`                                                                                                               | Returns changed files for whole-repository review, excluding ignored files.           |
| `git_diff_file` / `git.diffFile`                        | `{ uri, maxBytes? }`             | `{ repo, file, oldLabel, newLabel, hunks, oldLineCount, newLineCount, oldTruncated, newTruncated, binary, unsupportedReason? }` | Returns a worktree-vs-HEAD text diff, or summary state for binary or oversized files. |
| `git_history` / `git.history`                           | `{ uri, maxCount? }`             | `{ repo, commits }`                                                                                                             | Returns newest-first commit metadata, capped at 100 commits.                          |
| `git_branches` / `git.branches`                         | `{ uri }`                        | `{ repo, branches }`                                                                                                            | Returns local and remote branch metadata without checkout actions.                    |
| `git_worktrees` / `git.worktrees`                       | `{ uri }`                        | `{ repo, worktrees }`                                                                                                           | Returns worktree path, branch, head, and state flags without worktree mutations.      |
| `git_revision_diff` / `git.revisionDiff`                | `{ uri, base, head, maxBytes? }` | `{ repo, base, head, files }`                                                                                                   | Returns changed files and diff hunks between two revisions.                           |
| `git_revision_files` / `git.revisionFiles`              | `{ uri, revision?, maxCount? }`  | `{ repo, revision, files }`                                                                                                     | Returns tracked files at a revision for read-only repository tree views.              |

`GitFileStatusDto` values are `clean`, `modified`, `added`, `deleted`, `renamed`, `untracked`, `ignored`, `conflicted`, and `unknown`. Remote Git status remains deferred.

### Metadata jobs: folder size and recursive search

Folder size and recursive search support synchronous commands for small/preview usage and job-backed commands for longer work. Job-backed metadata commands emit the same `fileOperation:job:*` lifecycle events as file mutations, but their `operationKind` is `folderSize` or `recursiveSearch` and they are tracked in desktop in-memory metadata job state, not persisted to operation history.

| Command                                                   | Request                                                           | Response      | Extra events                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------------- | ------------- | --------------------------------------------------------------- |
| `fs_folder_size` / `fs.folder_size`                       | `{ uri }`                                                         | `{ summary }` | none                                                            |
| `fs_folder_size_start` / `fs.folder_size_start`           | `{ uri }`                                                         | `{ job }`     | `fs:folderSize:completed` with `{ jobId, uri, summary }`        |
| `fs_recursive_search` / `fs.recursive_search`             | `{ uri, query, limit? }`                                          | `{ result }`  | none                                                            |
| `fs_recursive_search_start` / `fs.recursive_search_start` | `{ uri, query, limit? }`                                          | `{ job }`     | `fs:recursiveSearch:match`, then `fs:recursiveSearch:completed` |
| `fs_content_search` / `fs.content_search`                 | `{ uri, query, limit?, caseSensitive?, useRegex?, filePattern? }` | `{ result }`  | none                                                            |
| `fs_content_search_start` / `fs.content_search_start`     | `{ uri, query, limit?, caseSensitive?, useRegex?, filePattern? }` | `{ job }`     | `fs:contentSearch:match`, then `fs:contentSearch:completed`     |
| `fs_watch_start` / `fs.watch_start`                       | `{ uri }`                                                         | `{ ok }`      | `fs:watch:changed` while active                                 |
| `fs_watch_stop` / `fs.watch_stop`                         | none                                                              | `{ ok }`      | stops the single active folder watcher                          |

`FolderSizeSummaryDto` is `{ totalSize, itemCount, fileCount, directoryCount, warnings, incomplete }`. Recursive search defaults `limit` to 500, trims the query, returns an empty result for an empty query, and clamps traversal to at least one result slot. `SearchMatchDto` is `{ uri, parentUri, name, kind, size?, modifiedAt? }`.

### `get_preferences` / `set_preference`

Preferences persist in SQLite (`preferences.sqlite` under the app data directory). Keys include `theme` (`system` \| `light` \| `dark`), `density` (`compact` \| `comfortable` \| `spacious`), `defaultViewMode`, `showHiddenFiles` (boolean string), `sidebarWidth`, `splitRatio`, `activityPanelVisible`, `activityPanelWidth`, `confirmDelete`, `confirmPermanentDelete`, `useTrashByDefault`, `defaultConflictPolicy`, `accentColor`, `fontScale`, `iconScale`, `confirmOverwrite`, `sidebarVisible`, `statusBarVisible`, `toolbarVisible`, `toolbarEntries`, `paneMode`, `splitDirection`, `jobDrawerBehavior`, `showAdvancedCopyOptions`, pane terminal settings, `terminalShell`, `terminalArgs`, `rememberLastUsedPanes`, and `diagnosticsExportPath`. Planned keys for Network tab: `networkTimeout`, `networkAutoReconnect`, `networkDefaultProtocol`, `networkSshKeyPath`. Planned keys for Editor tab: `editorFontFamily`, `editorFontSize`, `editorTabSize`, `editorWordWrap`, `editorAutoSave`, `editorSyntaxTheme`, `editorLineNumbers`. Planned keys for Viewer tab: `viewerDefaultMode`, `viewerImageZoom`, `viewerMediaAutoplay`, `viewerMaxPreviewSize`. Planned keys for Advanced tab: `logLevel`, `enableExperimentalFeatures`, `cacheSizeLimit`, `operationThreadCount`.

```ts
const { preferences } = await client.preferences.get();
await client.preferences.set({ key: "theme", value: "dark" });
```

Invalid values reject with `IpcError` code `preferences_error`.

`diagnosticsExportPath` is the default host-path destination used by the diagnostics bundle dialog. It defaults to `/tmp/fileoctopus-diagnostics.zip`; empty values reset to that default, values are trimmed before storage, and values longer than 2048 bytes are rejected.

### `plan_file_operation`

Validates a user-issued `FileOperationRequest` and produces a `FileOperationPlan` with concrete items, detected conflicts, warnings, and totals. **Planning never mutates the filesystem.** Use the plan to render a preview (item count, byte total, conflict list) and confirm before calling `start_file_operation`.

```ts
const { plan } = await client.fileOperations.planFileOperation({
  operation: {
    kind: "copy",
    sources: ["local:///home/me/a.txt"],
    destination: "local:///home/me/Documents",
    conflictPolicy: "fail",
  },
});
```

### `start_file_operation`

Spawns a background worker thread that executes the plan. Returns the initial `JobSnapshot` (status `queued` → `running`). Progress flows through `fileOperation:job:*` events. The runtime persists a row to the operation-history SQLite DB on start and updates it on terminal states.

```ts
const { plan } = await client.fileOperations.planFileOperation({
  operation: {
    kind: "copy",
    sources: ["local:///home/me/a.txt"],
    destination: "local:///home/me/Documents",
    conflictPolicy: "fail",
  },
});

const { job } = await client.fileOperations.startFileOperation({
  operationId: plan.operationId,
});
```

### `cancel_job` / `get_job_status`

Both take a `jobId` string and return the current `JobSnapshot`. The handler checks in-memory metadata jobs first, then the file-operation runtime. Cancellation flips a `CancellationToken`; workers check it between items and during byte-level loops where applicable, then surface `cancelled` via the job event channel. Cancellation of a completed/failed job may return the already-terminal snapshot.

### `list_recent_operations`

Reads the most recent N rows from the operation-history DB (`limit` clamped to `[1, 100]`, default `20`). Rows are `OperationHistoryRecordDto`, ordered by `started_at` descending.

### Navigation, autostart, and diagnostics

Navigation commands persist UI navigation state in `navigation.sqlite` under the app data directory. URI-bearing navigation requests parse and re-serialize `ResourceUri` values before storage.

| Command family | Commands                                                                                                                  | Request/response shape                                                                                                                                                                                                                                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visits         | `navigation_record_visit`, `navigation_list_recent`                                                                       | Record `{ uri, label }`; list recent with `{ bucket: "today" \| "thisWeek" }` and return `{ entries }`.                                                                                                                                                                                                                                                                           |
| Favorites      | `navigation_list_favorites`, `navigation_add_favorite`, `navigation_remove_favorite`, `navigation_rename_favorite`        | Favorites are `{ id, uri, label }`; remove/rename operate by numeric `id`.                                                                                                                                                                                                                                                                                                        |
| Starred        | `navigation_list_starred`, `navigation_toggle_starred`, `navigation_is_starred`                                           | Starred entries are keyed by `uri`; toggle returns `{ starred }`.                                                                                                                                                                                                                                                                                                                 |
| Autostart      | `get_autostart`, `set_autostart`                                                                                          | Returns `{ enabled, supported }`; `set_autostart` receives `enabled: boolean` as a top-level Tauri argument.                                                                                                                                                                                                                                                                      |
| Diagnostics    | `diagnostics_app_data_health`, `export_diagnostics_bundle`, `diagnostics_start_log_stream`, `diagnostics_stop_log_stream` | Health returns redacted app paths and history DB schema state. Export writes a zip with `app-info.json`, `app-data-health.json`, `operation-history.json`, and `recent-log.txt`; `destination` is currently a host path string. Start/stop log stream toggle the `tracing` broadcast layer and relay backend log records to the UI debug console via the `diagnostics:log` event. |

### Network profiles and connections

Network commands manage saved SFTP server profiles in `network.sqlite` under the app data directory. Passwords and key passphrases are stored in the OS keychain via `platform::SecretStore` (`network/{profileId}/password` or `passphrase`); they never cross IPC back to the frontend.

| Command                              | TS dotted name                     | Purpose                                                                                                   |
| ------------------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `network_profiles_list`              | `network.profilesList`             | List saved profiles with metadata and `defaultUri` (`sftp://{profileId}{defaultPath}`).                   |
| `network_providers_list`             | `network.providersList`            | List provider capabilities, supported auth kinds, and unavailable providers.                              |
| `network_profile_add`                | `network.profileAdd`               | Create a profile row (non-secret fields only).                                                            |
| `network_profile_update`             | `network.profileUpdate`            | Update label, host, port, username, auth kind, default path.                                              |
| `network_profile_delete`             | `network.profileDelete`            | Remove profile and keychain entries.                                                                      |
| `network_profile_set_secret`         | `network.profileSetSecret`         | Store password or key passphrase in keychain (`{ profileId, field: "password" \| "passphrase", value }`). |
| `network_connect`                    | `network.connect`                  | Eager connect and validate credentials for `{ id }`.                                                      |
| `network_disconnect`                 | `network.disconnect`               | Drop active session for `{ id }`.                                                                         |
| `network_connection_status`          | `network.connectionStatus`         | Returns `{ statuses: NetworkConnectionStatusDto[] }` with `connected`, `disconnected`, or `error`.        |
| `network_profile_test`               | `network.profileTest`              | Test a saved profile or validate an unsaved draft without persisting transient secrets.                   |
| `network_discover_neighborhood`      | `network.discoverNeighborhood`     | Lists virtual `network:///` entries for cloud drives, LAN services, saved profiles, and add-connection.   |
| `network_profile_forget_fingerprint` | `network.profileForgetFingerprint` | Clears pinned host-key fingerprint for `{ id }`.                                                          |
| `network_profile_trust_fingerprint`  | `network.profileTrustFingerprint`  | Persists an explicitly confirmed OpenSSH-style SHA256 host-key fingerprint for `{ id, fingerprint }`.     |
| `network_validate_uri`               | `network.validateUri`              | Parse-check a remote `ResourceUri`.                                                                       |

### `network_profile_forget_fingerprint`

**Request:** `NetworkProfileActionRequest { id: string }`
**Response:** `OkResponse`

Clears the pinned host-key fingerprint for the given profile. Unknown fingerprints must be explicitly trusted through `network_profile_trust_fingerprint`.

### `network_profile_trust_fingerprint`

**Request:** `NetworkProfileTrustFingerprintRequest { id: string, fingerprint: string }`
**Response:** `OkResponse`

Persists a user-confirmed OpenSSH-style `SHA256:` host-key fingerprint for the given profile. Connect and terminal spawn paths do not auto-pin unknown fingerprints.

### Host-key TOFU

SFTP sessions and SSH terminal sessions compute the SHA-256 base64 (unpadded) fingerprint of the server's host key on every connect. Unknown fingerprints are not persisted automatically. A caller must explicitly confirm a fingerprint through `network_profile_trust_fingerprint`, which stores it in `network_profiles.host_key_fingerprint`. Subsequent connects compare the observed fingerprint against the pinned value and refuse the connection on mismatch. Users can clear the pin from the Edit Server dialog ("Forget pinned fingerprint"); this returns the profile to an untrusted state until a fingerprint is explicitly confirmed again.

Network profiles support `sftp` and `ssh` schemes. `sftp` profiles are file-capable and can also open SSH terminals. `ssh` profiles are terminal-only: they can be used as `terminal.spawn` `profileId` targets but do not produce browsable `sftp://` `defaultUri` values.

Once connected, `fs_stat` and `fs_list_start` work for `sftp://` URIs through `SftpProvider`. `plan_file_operation` / `start_file_operation` support copy, move, rename, create, and delete for `local://` and `sftp://` sources and destinations, including cross-scheme transfers (`local` ↔ `sftp`, and `sftp` ↔ `sftp` across profiles). Remote delete uses permanent delete (`unsupported_trash` on `deleteToTrash`). Archive create/extract, watch, folder size, and recursive search remain local-only in v1.

## Event channels

Rust pushes events via `app.emit(name, payload)`. The TS client wraps them in `transport.listen` and returns an `UnlistenFn`.

| Event name (constant)                                               | Payload                            | Emitted by                                |
| ------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------- |
| `directory:batch` (`DIRECTORY_BATCH_EVENT`)                         | `DirectoryBatchEventDto`           | `fs_list_start` worker                    |
| `fileOperation:job:started` (`JOB_STARTED_EVENT`)                   | `JobStartedEvent`                  | File-operation and metadata job runtimes  |
| `fileOperation:job:progress` (`JOB_PROGRESS_EVENT`)                 | `JobProgressEvent`                 | File-operation and metadata job runtimes  |
| `fileOperation:job:completed` (`JOB_COMPLETED_EVENT`)               | `JobCompletedEvent`                | File-operation and metadata job runtimes  |
| `fileOperation:job:failed` (`JOB_FAILED_EVENT`)                     | `JobFailedEvent`                   | File-operation and metadata job runtimes  |
| `fileOperation:job:cancelled` (`JOB_CANCELLED_EVENT`)               | `JobCancelledEvent`                | File-operation and metadata job runtimes  |
| `fs:watch:changed` (`WATCH_CHANGED_EVENT`)                          | `WatchEventDto`                    | Watch worker                              |
| `network:status` (`NETWORK_STATUS_EVENT`)                           | `NetworkStatusEventDto`            | `ConnectionSessionManager` status changes |
| `fs:folderSize:completed` (`FOLDER_SIZE_COMPLETED_EVENT`)           | `FolderSizeCompletedEventDto`      | Folder-size metadata job                  |
| `fs:recursiveSearch:match` (`RECURSIVE_SEARCH_MATCH_EVENT`)         | `RecursiveSearchMatchEventDto`     | Recursive-search metadata job             |
| `fs:recursiveSearch:completed` (`RECURSIVE_SEARCH_COMPLETED_EVENT`) | `RecursiveSearchCompletedEventDto` | Recursive-search metadata job             |
| `fs:contentSearch:match` (`CONTENT_SEARCH_MATCH_EVENT`)             | `ContentSearchMatchEventDto`       | Content-search metadata job               |
| `fs:contentSearch:completed` (`CONTENT_SEARCH_COMPLETED_EVENT`)     | `ContentSearchCompletedEventDto`   | Content-search metadata job               |
| `terminal:output` (`TERMINAL_OUTPUT_EVENT`)                         | `TerminalOutputEventDto`           | Local and SSH PTY output chunk            |
| `terminal:exit` (`TERMINAL_EXIT_EVENT`)                             | `TerminalExitEventDto`             | Local and SSH PTY session exit            |
| `terminal:session` (`TERMINAL_SESSION_EVENT`)                       | `TerminalSessionEventDto`          | Local and SSH PTY session metadata change |
| `nativeMenu:command` (`NATIVE_MENU_COMMAND_EVENT`)                  | `NativeMenuCommandEventDto`        | Native Tauri application menu selection   |

Names are exported as constants from both sides (`crates/app-ipc/src/lib.rs` and `packages/ts-api/src/events.ts`, re-exported from the package root). The Rust enum-to-name mapping lives in `app_ipc::job_event_name`; the payload serializer is `app_ipc::job_event_payload`.

### Event: `network:status`

**Payload:** `NetworkStatusEventDto { profileId, status: "connected" | "disconnected" | "error", message?: string }`

Emitted by `ConnectionSessionManager` whenever a session transitions between connected, disconnected, or error states. Frontends should subscribe via `client.network.subscribeStatusEvents(listener)` to keep the sidebar status in sync without polling. See `apps/desktop-tauri/src-tauri/src/lib.rs` for the forwarder.

### `DirectoryBatchEventDto`

```ts
{
  sessionId: string;          // matches ListStartResponse.sessionId
  requestId: string;          // matches ListStartResponse.requestId
  uri: string;                // listed directory URI
  entries: FileEntryDto[];    // up to batchSize entries
  batchIndex: number;         // 0-based, monotonically increasing
  isComplete: boolean;        // true on the final batch (including error frames)
  totalHint?: number | null;  // unused by local provider; reserved
  error?: IpcError | null;    // populated only when the listing fails mid-stream
}
```

A failing listing emits one final frame with `entries: []`, `isComplete: true`, and a populated `error`.

### Job events

All job events carry `jobId` and `operationKind`. Specific shapes:

- `JobStartedEvent`: `totalItems`, `totalBytes?`, `startedAt`.
- `JobProgressEvent`: `currentItem?`, `completedItems`, `totalItems`, `completedBytes`, `totalBytes?`, `updatedAt`.
- `JobCompletedEvent`: `completedItems`, `completedBytes`, `completedAt`.
- `JobFailedEvent`: `errorCode`, `message`, `failedAt`.
- `JobCancelledEvent`: `cancelledAt`.

Progress events are throttled by a byte interval (`PROGRESS_BYTE_INTERVAL = 1 MiB`) inside copy/move operations; for small operations a single progress event may precede the terminal event.

`JobSnapshot.jobId` is always a plain string on the TS side.

### Metadata and watch events

```ts
interface WatchEventDto {
  uri: string;
  changedAt: string;
}

interface FolderSizeCompletedEventDto {
  jobId: string;
  uri: string;
  summary: FolderSizeSummaryDto;
}

interface RecursiveSearchMatchEventDto {
  jobId: string;
  uri: string;
  query: string;
  item: SearchMatchDto;
}

interface RecursiveSearchCompletedEventDto {
  jobId: string;
  uri: string;
  query: string;
  result: RecursiveSearchResultDto;
}
```

Only one folder watcher is active in the desktop shell. Starting a new watch stops the previous watcher; stopping is idempotent.

## TypeScript client (`@fileoctopus/ts-api`)

The frontend constructs a `FileOctopusClient` from an `IpcTransport`. Two transports ship in the box:

- `createTauriTransport()` — real Tauri IPC; used in the desktop shell. Translates dotted command names to snake_case via `commandMap`.
- `createPreviewTransport()` — browser-preview stub for running the UI without Tauri. It returns deterministic preview data for app info, preferences, navigation, diagnostics, standard locations, directory listings, properties, folder size, and recursive search; unsupported commands reject with `tauri_unavailable`.

```ts
import { createFileOctopusClient } from "@fileoctopus/ts-api";

const client = createFileOctopusClient(); // auto-selects transport based on __TAURI_INTERNALS__
```

`createFileOctopusClient(transport?)` picks `createTauriTransport()` when `__TAURI_INTERNALS__` is on `globalThis`, else `createPreviewTransport()`.

### Client surface

```ts
class FileOctopusClient {
  readonly fs: FsClient;
  readonly fileOperations: FileOperationsClient;
  readonly jobs: JobsClient;
  readonly operationHistory: OperationHistoryClient;
  readonly diagnostics: DiagnosticsClient;
  readonly preferences: PreferencesClient;
  readonly navigation: NavigationClient;
  readonly autostart: AutostartClient;
  getAppInfo(): Promise<AppInfoResponse>;
}

class FsClient {
  stat(req: StatRequest): Promise<StatResponse>;
  readTextFile(req: ReadTextFileRequest): Promise<ReadTextFileResponse>;
  computeHash(req: ComputeHashRequest): Promise<ComputeHashResponse>;
  openTerminal(req: OpenTerminalRequest): Promise<OpenTerminalResponse>;
  listStart(req: ListStartRequest): Promise<ListStartResponse>;
  standardLocations(): Promise<StandardLocationsResponse>;
  openPathWithDefaultApp(req: PathRequest): Promise<OkResponse>;
  revealPathInFileManager(req: PathRequest): Promise<OkResponse>;
  properties(req: PathPropertiesRequest): Promise<PathPropertiesResponse>;
  folderSize(req: FolderSizeRequest): Promise<FolderSizeResponse>;
  startFolderSizeJob(req: FolderSizeRequest): Promise<FolderSizeJobResponse>;
  recursiveSearch(
    req: RecursiveSearchRequest,
  ): Promise<RecursiveSearchResponse>;
  startRecursiveSearchJob(
    req: RecursiveSearchRequest,
  ): Promise<RecursiveSearchJobResponse>;
  startWatching(req: WatchStartRequest): Promise<OkResponse>;
  stopWatching(): Promise<OkResponse>;
  onDirectoryBatch(
    handler: (e: DirectoryBatchEventDto) => void,
  ): Promise<UnlistenFn>;
  onFolderSizeCompleted(
    handler: (e: FolderSizeCompletedEventDto) => void,
  ): Promise<UnlistenFn>;
  onRecursiveSearchMatch(
    handler: (e: RecursiveSearchMatchEventDto) => void,
  ): Promise<UnlistenFn>;
  onRecursiveSearchCompleted(
    handler: (e: RecursiveSearchCompletedEventDto) => void,
  ): Promise<UnlistenFn>;
  onWatchChanged(handler: (e: WatchEventDto) => void): Promise<UnlistenFn>;
}

class FileOperationsClient {
  planFileOperation(
    req: PlanFileOperationRequest,
  ): Promise<PlanFileOperationResponse>;
  startFileOperation(
    req: StartFileOperationRequest,
  ): Promise<StartFileOperationResponse>;
  onJobStarted(h: (e: JobStartedEvent) => void): Promise<UnlistenFn>;
  onJobProgress(h: (e: JobProgressEvent) => void): Promise<UnlistenFn>;
  onJobCompleted(h: (e: JobCompletedEvent) => void): Promise<UnlistenFn>;
  onJobFailed(h: (e: JobFailedEvent) => void): Promise<UnlistenFn>;
  onJobCancelled(h: (e: JobCancelledEvent) => void): Promise<UnlistenFn>;
}

class OperationHistoryClient {
  listRecentOperations(
    req?: ListRecentOperationsRequest,
  ): Promise<ListRecentOperationsResponse>;
  clearOperationHistory(): Promise<ClearOperationHistoryResponse>;
}

class DiagnosticsClient {
  appDataHealth(): Promise<AppDataHealthResponse>;
  exportBundle(
    req: ExportDiagnosticsBundleRequest,
  ): Promise<ExportDiagnosticsBundleResponse>;
}

class JobsClient {
  cancelJob(req: CancelJobRequest): Promise<JobStatusResponse>;
  getJobStatus(req: JobStatusRequest): Promise<JobStatusResponse>;
}

class PreferencesClient {
  get(): Promise<GetPreferencesResponse>;
  set(req: SetPreferenceRequest): Promise<SetPreferenceResponse>;
}

class NavigationClient {
  recordVisit(req: NavigationRecordVisitRequest): Promise<OkResponse>;
  listFavorites(): Promise<NavigationListFavoritesResponse>;
  addFavorite(
    req: NavigationAddFavoriteRequest,
  ): Promise<NavigationFavoriteResponse>;
  removeFavorite(req: NavigationRemoveFavoriteRequest): Promise<OkResponse>;
  renameFavorite(
    req: NavigationRenameFavoriteRequest,
  ): Promise<NavigationFavoriteResponse>;
  listRecent(
    req: NavigationListRecentRequest,
  ): Promise<NavigationListRecentResponse>;
  listStarred(): Promise<NavigationListStarredResponse>;
  toggleStarred(
    req: NavigationToggleStarredRequest,
  ): Promise<NavigationToggleStarredResponse>;
  isStarred(
    req: NavigationIsStarredRequest,
  ): Promise<NavigationIsStarredResponse>;
}

class AutostartClient {
  get(): Promise<AutostartStatusDto>;
  set(enabled: boolean): Promise<AutostartStatusDto>;
}
```

### Error normalization

Every client method rejects with an `IpcError` (`{ code, message }`). Unknown throws are coerced through `normalizeIpcError`, which maps native `Error`s and string throws into `IpcError` with code `"unknown"`. The transport itself can reject with code `"tauri_unavailable"` (preview transport for unsupported commands) or `"unsupported_transport"` (event subscription on a transport without `listen`).

### `IpcTransport`

```ts
interface IpcTransport {
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

Implement this to plug an alternative transport (tests, mocks, an out-of-process bridge). The optional `listen` is required for any client method that subscribes to events.

## Resource URIs

Every filesystem resource crossing the IPC boundary is identified by a `ResourceUri` — a string `scheme://body`. Registered providers today: `local` (`LocalFsProvider`) and `sftp` (`SftpProvider`). Network profile scheme `ssh` is terminal-only and does not map to a browsable filesystem URI. Reserved schemes `smb` and `webdav` parse successfully but return `unsupported_provider` until providers are registered (ADR-0004).

### Local URIs

`ResourceUri::parse` for `local://` enforces:

- Scheme separator `://` is present.
- Scheme equals `local`.
- Body starts with `/` (POSIX absolute) or matches a Windows drive prefix `^[A-Za-z]:/`.
- No NUL bytes.

`ResourceUri::from_local_path` accepts a platform `Path` and produces a normalized `local://…` URI, replacing `\` with `/`. Both constructors reject relative paths.

```rust
let uri = ResourceUri::parse("local:///home/me/Documents")?;
assert_eq!(uri.scheme(), "local");
assert_eq!(uri.display_path(), "/home/me/Documents");
```

### Remote URIs (SFTP v1)

Remote URIs use POSIX path bodies only:

```
sftp://{profileUuid}/{remotePath}
```

Example: `sftp://550e8400-e29b-41d4-a716-446655440000/home/deploy`

- `{profileUuid}` is the saved profile id from `network.sqlite`.
- `{remotePath}` is a POSIX absolute path (`/home/user/docs`).
- `ResourceUri::remote_path()` returns the path segment; `to_local_path()` remains local-only.
- `ResourceUri::from_remote_profile(scheme, profile_id, path)` constructs profile-backed URIs.

The TS helpers in `packages/ts-api/src/uri.ts` expose `isRemoteUri`, `isSupportedNavigationUri`, and `profileIdFromRemoteUri`.

The TS side treats `ResourceUri` values as opaque strings. Do not parse them ad-hoc in the UI; if you need a friendly path, pull it from `FileEntryDto.name` or render `uri.replace(/^local:\/\//, "")` for display only.

## File entries and capabilities

`FileEntryDto` is the unified entry shape returned by `fs_stat` and streamed via directory batches.

```ts
interface FileEntryDto {
  uri: string;
  name: string;
  extension?: string | null;
  kind: FileKind; // "file" | "directory" | "symlink" | "archive" | "virtual" | "unknown"
  size?: number | null; // bytes; only meaningful for files
  modifiedAt?: string | null; // RFC3339
  createdAt?: string | null;
  accessedAt?: string | null;
  isHidden: boolean;
  isSymlink: boolean;
  symlinkTarget?: string | null; // absolute local:// URI when resolvable
  providerId: string; // "local" for LocalFsProvider
  canRead: boolean;
  canList: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canRename: boolean;
  permissions?: string | null;
  owner?: string | null;
}
```

`canRead`/`canList`/`canWrite`/`canDelete`/`canRename` are per-entry capabilities. The current `LocalFsProvider` exposes read and list capabilities from metadata; mutation still goes through the file-operation pipeline, which enforces its own checks. `permissions` and `owner` are optional display metadata. UI should still hide buttons whose capability is `false`.

## File operations: plan and execute

The mutation pipeline is two-phase: **plan first**, then **start**.

### Operation kinds

```ts
type FileOperationKind =
  | "copy"
  | "move"
  | "rename"
  | "deleteToTrash"
  | "createDirectory"
  | "createFile"
  | "deletePermanently"
  | "createArchive"
  | "extractArchive"
  | "folderSize"
  | "recursiveSearch";
```

Shape rules enforced by the planner (`crates/fs-core/src/file_ops/mod.rs` — `validate_request_shape`):

| Kind                                 | Sources   | Destination           | `newName` |
| ------------------------------------ | --------- | --------------------- | --------- |
| `copy`, `move`                       | ≥1        | required directory    | ignored   |
| `rename`                             | exactly 1 | optional              | required  |
| `createDirectory`                    | 0         | required final path   | ignored   |
| `createFile`                         | 0         | required final path   | ignored   |
| `deleteToTrash`, `deletePermanently` | ≥1        | none                  | none      |
| `createArchive`                      | ≥1        | required archive path | ignored   |
| `extractArchive`                     | exactly 1 | required directory    | ignored   |
| `folderSize`, `recursiveSearch`      | n/a       | n/a                   | n/a       |

`folderSize` and `recursiveSearch` are `FileOperationKind` values because metadata jobs reuse `JobSnapshot` and job events. They are not valid `plan_file_operation` requests; start them through `fs_folder_size_start` and `fs_recursive_search_start`.

### Conflict policies

```ts
type ConflictPolicy =
  | "fail"
  | "skip"
  | "overwrite"
  | "renameNew"
  | "renameExisting";
```

The planner always reports conflicts in `FileOperationPlanDto.conflicts`. The executor's reaction is policy-driven:

- `fail` — executor returns `destination_conflict` on the first conflict.
- `skip` — conflicting items are not written.
- `overwrite` — destination is replaced.
- `renameNew` — the incoming item is renamed (`name (1).ext`, `name (2).ext`, …).
- `renameExisting` — the existing destination is renamed before the operation proceeds.

If the UI presents a plan with `conflicts.length > 0`, surface the chosen policy explicitly before calling `start_file_operation`.

### `FileOperationPlanDto`

```ts
interface FileOperationPlanDto {
  operationId: string; // UUID
  kind: FileOperationKind;
  sources: string[]; // ResourceUri strings
  destination?: string | null;
  newName?: string | null;
  conflictPolicy: ConflictPolicy;
  items: FileOperationItemDto[];
  conflicts: FileOperationConflictDto[];
  warnings: FileOperationWarningDto[];
  totalItems: number;
  totalBytes?: number | null; // null when any item's size is unknown
}
```

Items are sorted deterministically by source/destination URI. `totalBytes` is `null` if any item lacks a size (e.g. directories, symlinks). Warnings are non-fatal planner diagnostics — surface them but do not block execution.

Current planner warning codes:

| Code              | Meaning                                                      |
| ----------------- | ------------------------------------------------------------ |
| `metadata_failed` | Planner could not stat a discovered path, so it was skipped. |

The warning-code source of truth is `vfs::file_operation_warning_codes::ALL`. The TS mirror is exported from `packages/ts-api/src/types.ts` as `FILE_OPERATION_WARNING_CODES`.

## Jobs and job lifecycle

Each `start_file_operation` allocates a `JobId` (UUID) and registers a `JobRuntimeState` in the in-memory file-operation job table. Folder-size and recursive-search job commands allocate the same `JobSnapshot` shape in `MetadataJobState`. State transitions:

```
queued ──► running ──► completed
                  └──► failed
                  └──► cancelled
```

`JobSnapshot` carries the live state:

```ts
interface JobSnapshot {
  jobId: string;
  operationKind: FileOperationKind;
  status: JobStatus; // "queued" | "running" | "paused" | "cancelled" | "completed" | "failed"
  currentItem?: string | null;
  completedItems: number;
  totalItems: number;
  completedBytes: number;
  totalBytes?: number | null;
  errorCode?: string | null;
  message?: string | null;
  startedAt: string;
  updatedAt: string;
}
```

`paused` is reserved; the current executor never enters it.

Cancellation is cooperative — the worker checks `CancellationToken::is_cancelled()` between items and during byte-level copy/archive loops where applicable. The UI should treat `cancel_job` as best-effort: the job may complete or fail before the token is observed.

## Operation history

A SQLite database stores one row per started file-operation job; rows are updated to a terminal status when the job ends. Metadata jobs (`folderSize`, `recursiveSearch`) are intentionally in-memory only and do not appear in operation history.

- Default path: `$HOME/.fileoctopus/operation-history.sqlite` (or `%USERPROFILE%\.fileoctopus\operation-history.sqlite`).
- Schema version: `1`, stored in `schema_meta` and SQLite `user_version`.
- Schema: `operation_history(job_id, operation_kind, source_count, representative_source_path, destination_path, status, started_at, completed_at, error_code)`.
- Startup recovery marks `queued`, `running`, and `cancelling` rows as `interrupted`.

`list_recent_operations` returns `OperationHistoryRecordDto`:

```ts
interface OperationHistoryRecordDto {
  jobId: string;
  operationKind: string; // Debug-formatted FileOperationKind (e.g. "Copy", "DeleteToTrash")
  sourceCount: number;
  representativeSourcePath?: string | null; // display path, not URI
  destinationPath?: string | null;
  status: string; // "running" | "completed" | "failed" | "cancelled" | "interrupted"
  startedAt: string; // RFC3339
  completedAt?: string | null;
  errorCode?: string | null;
}
```

`operationKind` and `status` are strings here (not the enum). The path fields are `display_path()` values, not `ResourceUri` strings, because the history is for human review.

## Error model

`IpcError` is the only error shape that crosses the IPC boundary:

```ts
interface IpcError {
  code: string;
  message: string;
}
```

The `code` is stable and is what the UI branches on (`packages/frontend/src/dialogs/OperationDialogView.tsx::operationErrorMessage`). All current codes:

| Code                      | Origin                                        | Meaning                                                         |
| ------------------------- | --------------------------------------------- | --------------------------------------------------------------- |
| `invalid_uri`             | `VfsError`                                    | URI failed to parse (missing scheme, relative path, NUL byte).  |
| `unsupported_provider`    | `VfsError`, `FileOperationError`              | No provider registered for the scheme.                          |
| `duplicate_provider`      | `VfsError`                                    | Two providers tried to claim the same scheme.                   |
| `not_found`               | `VfsError`, `FileOperationError`, Tauri shell | Resource or job id does not exist.                              |
| `permission_denied`       | `VfsError`, `FileOperationError`              | OS denied the read/write/delete.                                |
| `timeout`                 | `VfsError`                                    | Directory listing exceeded the server timeout (30s).            |
| `cancelled`               | `VfsError`, `FileOperationError`              | Directory listing or operation cancellation token was observed. |
| `preferences_error`       | Preferences repository                        | Invalid preference key/value or database failure.               |
| `is_directory`            | Tauri shell                                   | File-only command was pointed at a directory.                   |
| `file_too_large`          | Tauri shell                                   | Hash computation refused an oversized file.                     |
| `unsupported_algorithm`   | Tauri shell                                   | Hash request named an unsupported digest algorithm.             |
| `spawn_error`             | Tauri shell                                   | External process launch failed.                                 |
| `no_terminal`             | Tauri shell                                   | No terminal emulator was found for `fs.open_terminal`.          |
| `terminal_spawn_failed`   | `terminal-core`, Tauri shell                  | Embedded PTY session could not be started.                      |
| `terminal_not_found`      | `terminal-core`, Tauri shell                  | Unknown `sessionId` for terminal write/resize/kill.             |
| `invalid_terminal_size`   | `terminal-core`, Tauri shell                  | Terminal `cols` or `rows` must be greater than zero.            |
| `terminal_session_exited` | `terminal-core`, Tauri shell                  | Write attempted after the PTY session exited.                   |
| `autostart_unavailable`   | Tauri shell                                   | OS autostart integration is unavailable or failed.              |
| `navigation_error`        | Navigation repository                         | Favorites/recent/starred persistence failed.                    |
| `network_error`           | `RemoteError`, network handlers               | Generic remote/network failure.                                 |
| `connection_required`     | `VfsError`, `RemoteError`                     | Remote URI used before session connect.                         |
| `authentication_failed`   | `VfsError`, `RemoteError`, `terminal-core`    | SFTP or SSH terminal login/key auth rejected.                   |
| `connection_lost`         | `VfsError`, `RemoteError`                     | Active session dropped mid-operation.                           |
| `folder_not_found`        | Tauri shell                                   | Watch start requires an existing directory.                     |
| `git_command_failed`      | `git-intel`, Tauri shell                      | Local `git` command failed for a repository query.              |
| `invalid_request`         | `FileOperationError`                          | Operation request shape is wrong (missing sources, etc.).       |
| `invalid_name`            | `FileOperationError`                          | Proposed name is empty, contains separators, or is reserved.    |
| `invalid_path`            | `FileOperationError`                          | URI parsed but is not usable for this operation.                |
| `destination_missing`     | `FileOperationError`                          | Destination parent does not exist.                              |
| `destination_conflict`    | `FileOperationError`                          | Conflict detected and policy is `fail`.                         |
| `recursive_operation`     | `FileOperationError`                          | Source contains destination (move/copy into itself).            |
| `unsupported_symlink`     | `FileOperationError`                          | Symlink object copy is not supported in the MVP.                |
| `unsupported_trash`       | `FileOperationError`                          | Platform trash unavailable.                                     |
| `io_error`                | `FileOperationError`, Tauri shell             | Unclassified `std::io::Error`.                                  |
| `internal`                | `VfsError`, `FileOperationError`, Tauri shell | Bug or invariant violation — file an issue.                     |
| `unknown`                 | TS client                                     | A non-IPC error was caught and wrapped.                         |
| `tauri_unavailable`       | Preview transport                             | The requested command is unsupported outside the Tauri shell.   |
| `unsupported_transport`   | TS client                                     | Event subscription on a transport without `listen`.             |

The Rust source of truth is `crates/app-ipc/src/lib.rs`: `error_codes::ALL` for boundary-wide codes, plus `VfsError::code()` and `FileOperationError::code()` for the domain enums that feed into it. The TS mirror is exported from `packages/ts-api/src/types.ts` as `IPC_ERROR_CODES`.

## Rust crate APIs

The frontend never imports these directly, but internal callers and tests do.

### `vfs`

- `ResourceUri::parse(&str) -> Result<ResourceUri, VfsError>` / `ResourceUri::from_local_path(&Path) -> Result<…>` / `ResourceUri::from_remote_profile(scheme, profile_id, path) -> Result<…>` / `as_str()` / `scheme()` / `display_path()` / `to_local_path()` / `remote_path()` / `is_remote()`.
- `FileEntry`, `FileKind`, `EntryCapabilities`, `ProviderCapabilities`.
- `FileOperationRequest`, `FileOperationPlan`, `FileOperationItem`, `FileOperationConflict`, `FileOperationWarning`.
- `FileOperationError` and `VfsError` — each exposes `code()`.
- `#[async_trait] VfsProvider`:
  ```rust
  fn id(&self) -> ProviderId;
  fn schemes(&self) -> &'static [&'static str];
  fn capabilities(&self) -> ProviderCapabilities;
  async fn stat(&self, uri: &ResourceUri) -> Result<FileEntry, VfsError>;
  async fn list(&self, uri: &ResourceUri, options: ListOptions, sink: DirectorySink) -> Result<(), VfsError>;
  async fn create_directory(&self, uri: &ResourceUri) -> Result<(), VfsError>;
  async fn create_file(&self, uri: &ResourceUri) -> Result<(), VfsError>;
  async fn rename(&self, from: &ResourceUri, to: &ResourceUri) -> Result<(), VfsError>;
  async fn remove(&self, uri: &ResourceUri, recursive: bool) -> Result<(), VfsError>;
  async fn copy_file(&self, source: &ResourceUri, destination: &ResourceUri, on_progress: Box<dyn FnMut(u64) + Send>) -> Result<u64, VfsError>;
  async fn read_file_prefix(&self, uri: &ResourceUri, max_bytes: u64) -> Result<Vec<u8>, VfsError>;
  ```
  Unrelated providers inherit `UnsupportedOperation` defaults from the trait.
- `VfsRegistry::new()`, `register(Arc<dyn VfsProvider>)`, `provider_for(&ResourceUri)`, `stat`, `list`. A scheme can be registered at most once.

### `fs-core`

- `LocalFsProvider` — local stat + streamed list.
- `provider-sftp::SftpProvider` — SFTP stat + streamed list (read-only v1); registered alongside local at boot.
- `remote-core::ConnectionSessionManager` — profile session lifecycle shared by remote providers.
- `config::NetworkProfileRepository` — persisted server profiles in `network.sqlite`.
- `platform::SecretStore` — OS keychain wrapper for network credentials.
- `file_ops::plan_file_operation(FileOperationRequest) -> Result<FileOperationPlan, FileOperationError>` — pure validation, no I/O beyond stat where needed.
- `file_ops::execute_file_operation(plan, &JobId, &CancellationToken, &FileOperationEventSink) -> Result<(), FileOperationError>` — runs the plan, emits `JobEvent::Progress` through the sink, honours the cancellation token.
- `metadata::{path_properties, calculate_folder_size, calculate_folder_size_with_progress}` — local metadata helpers for `fs_properties` and folder-size commands.
- `search::{recursive_search, recursive_search_with_progress}` — local recursive name search for synchronous and job-backed search commands.
- `locations::standard_locations()` — platform standard locations surfaced through `fs_standard_locations`.
- `external_open::{open_path_with_default_app, reveal_path_in_file_manager}` — platform open/reveal helpers.
- `FileOperationEventSink = dyn Fn(JobEvent) + Send + Sync` — wrapped in `Arc` by callers.
- Constants: `COPY_BUFFER_SIZE = 64 KiB`, `PROGRESS_BYTE_INTERVAL = 1 MiB`.

### `jobs`

- `JobId`, `JobStatus`, `JobSnapshot`.
- `JobEvent::{Started, Progress, Completed, Failed, Cancelled}` and the corresponding event structs.
- `CancellationToken { new(), cancel(), is_cancelled() }` — internally a single `AtomicBool` shared via `Arc`.

### `app-core`

- `AppCore::boot() -> Result<Arc<AppState>, AppCoreError>` — registers `LocalFsProvider`, opens the history DB, marks previously running jobs as interrupted, returns shared state. Use `AppCore::boot_with_history_path(PathBuf)` in tests.
- `AppState { vfs, operations, paths, startup_recovery_count }`.
- `OperationRuntime::plan(request) -> FileOperationPlan` — delegates to `file_ops::plan_file_operation`.
- `OperationRuntime::start_planned(operation_id, sink) -> JobSnapshot` — consumes a previously planned file operation, spawns the worker thread, inserts a history row, returns the initial snapshot.
- `OperationRuntime::cancel(&str) -> JobSnapshot` / `status(&str) -> JobSnapshot` — look up the job by id.
- `OperationRuntime::recent_history(limit: u32) -> Vec<OperationHistoryRecord>` — clamped to `[1, 100]`.
- `OperationRuntime::clear_terminal_history()` / `cleanup_history()` — remove terminal rows without deleting active jobs.
- `OperationHistoryRepository::new(PathBuf)` runs idempotent migrations on open and pins `schema_version = 1`.

### `app-ipc`

Every public type here is a DTO with a `From`/`TryFrom` between the domain type and its wire form where a domain type exists, and a matching TypeScript interface. The event-name constants (`DIRECTORY_BATCH_EVENT`, `JOB_*_EVENT`, `WATCH_CHANGED_EVENT`, `FOLDER_SIZE_COMPLETED_EVENT`, `RECURSIVE_SEARCH_*_EVENT`, `TERMINAL_*_EVENT`, `NATIVE_MENU_COMMAND_EVENT`) and the helpers `job_event_name(&JobEvent) -> &'static str`, `job_event_payload(JobEvent) -> serde_json::Value` are the Rust source of truth for event channel names; the Tauri command and the TS client both depend on them.

## Maintenance

When you add or change anything in the API:

1. **Domain types** — start in `crates/vfs` (or `crates/jobs` for job-level types). Update `code()` if a new error variant.
2. **DTOs** — add the camelCase DTO in `crates/app-ipc` with `From` / `TryFrom` to the domain type, and matching tests.
3. **Tauri handler** — add the function in the matching `apps/desktop-tauri/src-tauri/src/commands/<domain>.rs` and register it in `tauri::generate_handler!` inside `lib.rs` (use the `commands::…::handler_name` path).
4. **TS types** — mirror the DTO in `packages/ts-api/src/types.ts`.
5. **TS client** — add the method on the right class in `packages/ts-api/src/clients/<domain>.ts`, add the dotted-to-snake-case row in `packages/ts-api/src/commandMap.ts`, and wrap the call in `normalizeIpcError` from `packages/ts-api/src/normalizeError.ts`.
6. **This document** — add the command to the [catalog](#tauri-command-catalog), document any new event, and extend the [error model](#error-model) for any new code.
7. **Tests** — add Rust unit tests in the crate, IPC roundtrip tests in `crates/app-ipc`, and a Vitest test in `packages/ts-api/tests` for the new client method.

For new event channels, also pick the constant name in `crates/app-ipc/src/lib.rs` first, then mirror it in `packages/ts-api/src/events.ts` (re-exported from `@fileoctopus/ts-api`). Update `job_event_name` / `job_event_payload` if the event is part of the job event enum; otherwise document the event DTO next to the command that emits it.

Boundary changes must be called out in the PR template's "Security impact" section per `AGENTS.md`.
