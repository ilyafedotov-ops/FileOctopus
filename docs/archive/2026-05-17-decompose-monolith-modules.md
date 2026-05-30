# Decompose Monolith Modules — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose six oversized modules into focused, single-responsibility files without changing any runtime behavior. Each task is an independent, fully-revertible restructure that ships green on its own.

**Architecture:** Pure mechanical refactor. The existing Rust + Vitest + e2e test suites are the safety net — no new behaviors, no API changes at module boundaries. Public APIs of `fs-core`, `app-core`, and `@fileoctopus/ts-api` stay byte-identical via re-exports. Each task ends with `cargo fmt/clippy/test` and `pnpm typecheck/lint/test` all green before committing.

**Tech Stack:** Rust 2021 (workspace), pnpm 10 / Node 22, React 19 / TypeScript, Tauri v2, Vitest.

**Targets (in execution order):**

| #   | Target                                             | LOC  | Replaces                                                                                          |
| --- | -------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------- |
| 1   | `apps/desktop-tauri/src-tauri/src/lib.rs`          | 1897 | → `commands/*.rs` + `state.rs` + `emit.rs` + slim `lib.rs`                                        |
| 2   | `crates/fs-core/src/sprint4.rs`                    | 730  | → `metadata.rs` + `search.rs` + `locations.rs` + `external_open.rs` + `direct_ops.rs`             |
| 3   | `crates/fs-core/src/file_ops.rs`                   | 1929 | → `file_ops/{mod,planning,execution,archive,trash,paths}.rs`                                      |
| 4   | `crates/app-core/src/lib.rs`                       | 1040 | → `lib.rs` + `runtime.rs` + `history.rs` + `paths.rs`                                             |
| 5   | `packages/ts-api/src/client.ts`                    | 1210 | → `client.ts` (facade) + `clients/*.ts` + `transports/{tauri,preview}.ts` + `normalizeError.ts`   |
| 6   | `packages/frontend/src/hooks/useFileOpHandlers.ts` | 866  | → `useFileOpHandlers.ts` (facade) + `fileOps/{clipboard,mutations,transfers,metadata,archive}.ts` |

Tasks are independent — pick any subset, ship in any order. **Each task ends in its own commit** so it can be reviewed and reverted alone.

---

## Task 0: Baseline & Branch Setup

**Files:** none (verification only)

- [ ] **Step 0.1: Confirm clean working tree**

```bash
cd /home/ilya/FileOctupus
git status
```

Expected: `working tree clean` on branch `main` (or whichever branch the worktree is on).

- [ ] **Step 0.2: Capture baseline test results**

```bash
pnpm install
pnpm rust:fmt
pnpm rust:clippy
pnpm rust:test
pnpm typecheck
pnpm lint
pnpm test
```

Expected: every command exits 0. If any baseline command already fails on `main`, **stop** — fix or document the failure before refactoring. This suite is the regression net for every subsequent task.

- [ ] **Step 0.3: Record the baseline commit SHA**

```bash
git rev-parse HEAD | tee /tmp/refactor-baseline-sha.txt
```

This SHA is the rollback target if any task gets stuck.

---

## Task 1: Split `apps/desktop-tauri/src-tauri/src/lib.rs`

**Files:**

- Create: `apps/desktop-tauri/src-tauri/src/state.rs`
- Create: `apps/desktop-tauri/src-tauri/src/emit.rs`
- Create: `apps/desktop-tauri/src-tauri/src/commands/mod.rs`
- Create: `apps/desktop-tauri/src-tauri/src/commands/app_info.rs`
- Create: `apps/desktop-tauri/src-tauri/src/commands/fs.rs`
- Create: `apps/desktop-tauri/src-tauri/src/commands/folder_size.rs`
- Create: `apps/desktop-tauri/src-tauri/src/commands/recursive_search.rs`
- Create: `apps/desktop-tauri/src-tauri/src/commands/watch.rs`
- Create: `apps/desktop-tauri/src-tauri/src/commands/preferences.rs`
- Create: `apps/desktop-tauri/src-tauri/src/commands/autostart.rs`
- Create: `apps/desktop-tauri/src-tauri/src/commands/navigation.rs`
- Create: `apps/desktop-tauri/src-tauri/src/commands/file_operations.rs`
- Create: `apps/desktop-tauri/src-tauri/src/commands/diagnostics.rs`
- Modify: `apps/desktop-tauri/src-tauri/src/lib.rs` (shrink to <250 lines)

**Target boundaries (line ranges from current `lib.rs`):**

| Destination                    | Source lines              | Contents                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `state.rs`                     | 48–96, 147–151, 1202–1335 | `WatchState`, `WatchRuntime`, `MetadataJobState`, `MetadataJobRuntime` (note: this struct is positioned at 147–151, after `emit_with_eval` — move it with the rest of state), `ListingRegistry` + `impl ListingRegistry`, `start_metadata_job`, `metadata_job_token`, `metadata_job_snapshot`, `cancel_metadata_job`, `set_metadata_job_status`, `update_metadata_job_progress` |
| `emit.rs`                      | 97–146, 1336–1341         | `emit_with_eval`, `emit_job`                                                                                                                                                                                                                                                                                                                                                    |
| `commands/app_info.rs`         | 152–167                   | `app_get_info`                                                                                                                                                                                                                                                                                                                                                                  |
| `commands/fs.rs`               | 169–386, 594–664          | `fs_stat`, `fs_read_text_file`, `fs_compute_hash`, `fs_open_terminal`, `fs_list_start`, `fs_standard_locations`, `fs_open_default`, `fs_reveal`, `fs_properties`                                                                                                                                                                                                                |
| `commands/folder_size.rs`      | 656–789, 1342–1352        | `fs_folder_size`, `fs_folder_size_start`, `folder_summary_to_dto`                                                                                                                                                                                                                                                                                                               |
| `commands/recursive_search.rs` | 791–940, 1353–1375        | `fs_recursive_search`, `fs_recursive_search_start`, `search_match_to_dto`, `search_result_to_dto`                                                                                                                                                                                                                                                                               |
| `commands/watch.rs`            | 941–996, 1376–1410        | `fs_watch_start`, `fs_watch_stop`, `stop_watcher`, `folder_fingerprint`                                                                                                                                                                                                                                                                                                         |
| `commands/preferences.rs`      | 388–414                   | `get_preferences`, `set_preference`                                                                                                                                                                                                                                                                                                                                             |
| `commands/autostart.rs`        | 415–456                   | `get_autostart`, `set_autostart`                                                                                                                                                                                                                                                                                                                                                |
| `commands/navigation.rs`       | 457–592                   | `navigation_error`, all `navigation_*` commands                                                                                                                                                                                                                                                                                                                                 |
| `commands/file_operations.rs`  | 998–1095, 1188–1201       | `plan_file_operation`, `start_file_operation`, `cancel_job`, `get_job_status`, `list_recent_operations`, `clear_operation_history`, `operation_history_record_to_dto`                                                                                                                                                                                                           |
| `commands/diagnostics.rs`      | 1096–1128, 1411–1571      | `diagnostics_app_data_health`, `export_diagnostics_bundle`, `write_diagnostics_bundle`, `add_archive_file`, `redact_history_record`, `read_recent_log_excerpt`, `latest_log_file`, `redact_home`, `home_dir`                                                                                                                                                                    |
| `lib.rs` (kept)                | 1–48, 1129–1187           | imports, `pub fn run()`, handler registration, mod decls                                                                                                                                                                                                                                                                                                                        |

- [ ] **Step 1.1: Create `state.rs` with the shared state types and helpers**

Cut lines 48–96 (`WatchState`, `WatchRuntime`, `MetadataJobState`, `ListingRegistry` struct + `impl ListingRegistry`), lines 147–151 (`MetadataJobRuntime` struct — positioned awkwardly between `emit_with_eval` and the first command, move it with the rest of state), and lines 1202–1335 (metadata job helpers) from `lib.rs`. Paste into `apps/desktop-tauri/src-tauri/src/state.rs`. Add at the top:

```rust
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use app_ipc::{job_event_name, job_event_payload, IpcError};
use chrono::Utc;
use jobs::{
    CancellationToken, JobCancelledEvent, JobCompletedEvent, JobEvent, JobFailedEvent, JobId,
    JobProgressEvent, JobSnapshot, JobStartedEvent, JobStatus,
};
use tauri::{AppHandle, Emitter};
use vfs::{FileOperationError, FileOperationKind, ListCancellation};

use crate::emit::emit_with_eval;
```

Make every struct, field, helper `pub(crate)` so the command modules can construct/use them. Field access patterns to keep working: `state.current.lock()`, `state.jobs.lock()`, `state.tokens.lock()`.

- [ ] **Step 1.2: Create `emit.rs`**

Cut lines 97–146 (`emit_with_eval`) and lines 1336–1341 (`emit_job`) from `lib.rs`. New file:

```rust
use app_ipc::{job_event_name, job_event_payload};
use jobs::JobEvent;
use tauri::{AppHandle, Emitter};

pub(crate) fn emit_with_eval<S: serde::Serialize + Clone>(app: &AppHandle, event: &str, payload: S) {
    // ... body verbatim from lib.rs ...
}

pub(crate) fn emit_job(app: &AppHandle, event: JobEvent) {
    // ... body verbatim from lib.rs ...
}
```

- [ ] **Step 1.3: Create `commands/mod.rs`**

```rust
pub mod app_info;
pub mod autostart;
pub mod diagnostics;
pub mod file_operations;
pub mod folder_size;
pub mod fs;
pub mod navigation;
pub mod preferences;
pub mod recursive_search;
pub mod watch;
```

- [ ] **Step 1.4: Move each command group into its `commands/*.rs` file**

For each row in the "Target boundaries" table above (app_info → diagnostics):

1. Create the file under `apps/desktop-tauri/src-tauri/src/commands/`.
2. Cut the listed line range from `lib.rs` and paste verbatim into the new file.
3. At the top of each new file, add only the imports its bodies use. The IDE/clippy will reject unused imports — start with the same imports from current `lib.rs` and let `cargo check` prune. Always include:
   ```rust
   use crate::state::*;        // if the module touches WatchState/MetadataJobState/ListingRegistry
   use crate::emit::{emit_job, emit_with_eval};  // if the module emits
   ```
4. The `#[tauri::command]` attribute stays — Tauri picks commands up via `generate_handler!`, regardless of which module they live in, as long as the path resolves.

Do this one command-group at a time. After each move, run `cargo check -p fileoctopus-desktop-tauri` and resolve the missing/unused imports it reports. Do not move the next group until the current one compiles.

- [ ] **Step 1.5: Slim `lib.rs` down**

After all command groups are extracted, `lib.rs` should keep only:

- `mod state;`, `mod emit;`, `mod commands;` declarations (top of file)
- Workspace imports needed by `pub fn run()`
- The original `pub fn run()` body (lines 1129–1187)
- Update `tauri::generate_handler!` to use the new paths, e.g.:
  ```rust
  tauri::generate_handler![
      commands::app_info::app_get_info,
      commands::fs::fs_stat,
      commands::fs::fs_read_text_file,
      commands::fs::fs_compute_hash,
      commands::fs::fs_open_terminal,
      commands::fs::fs_list_start,
      commands::fs::fs_standard_locations,
      commands::fs::fs_open_default,
      commands::fs::fs_reveal,
      commands::fs::fs_properties,
      commands::folder_size::fs_folder_size,
      commands::folder_size::fs_folder_size_start,
      commands::recursive_search::fs_recursive_search,
      commands::recursive_search::fs_recursive_search_start,
      commands::watch::fs_watch_start,
      commands::watch::fs_watch_stop,
      commands::preferences::get_preferences,
      commands::preferences::set_preference,
      commands::autostart::get_autostart,
      commands::autostart::set_autostart,
      commands::navigation::navigation_record_visit,
      commands::navigation::navigation_list_favorites,
      commands::navigation::navigation_add_favorite,
      commands::navigation::navigation_remove_favorite,
      commands::navigation::navigation_rename_favorite,
      commands::navigation::navigation_list_recent,
      commands::navigation::navigation_list_starred,
      commands::navigation::navigation_toggle_starred,
      commands::navigation::navigation_is_starred,
      commands::file_operations::plan_file_operation,
      commands::file_operations::start_file_operation,
      commands::file_operations::cancel_job,
      commands::file_operations::get_job_status,
      commands::file_operations::list_recent_operations,
      commands::file_operations::clear_operation_history,
      commands::diagnostics::diagnostics_app_data_health,
      commands::diagnostics::export_diagnostics_bundle,
  ]
  ```
- The `.manage(...)` registrations for `WatchState`, `MetadataJobState`, `ListingRegistry` stay where they are — those types are now imported from `crate::state`.

- [ ] **Step 1.6: Compile and lint the Tauri crate**

```bash
cd /home/ilya/FileOctupus
cargo check -p fileoctopus-desktop-tauri
pnpm rust:fmt
pnpm rust:clippy
```

Expected: all green. Fix any reported missing/unused imports.

- [ ] **Step 1.7: Run full Rust + integration tests**

```bash
pnpm rust:test
```

Expected: same pass count as the baseline from Step 0.2. The three integration tests `ipc_folder_test.rs`, `ipc_search_test.rs`, `ipc_error_test.rs` exercise the IPC surface — they must stay green without modification.

- [ ] **Step 1.8: Commit**

```bash
git add apps/desktop-tauri/src-tauri/src/
git commit -m "refactor(desktop-tauri): split lib.rs into per-domain command modules"
```

---

## Task 2: Rename and split `crates/fs-core/src/sprint4.rs`

**Files:**

- Create: `crates/fs-core/src/metadata.rs`
- Create: `crates/fs-core/src/search.rs`
- Create: `crates/fs-core/src/locations.rs`
- Create: `crates/fs-core/src/external_open.rs`
- Create: `crates/fs-core/src/direct_ops.rs`
- Delete: `crates/fs-core/src/sprint4.rs`
- Modify: `crates/fs-core/src/lib.rs` (module declarations + re-exports for back-compat)
- Modify: `apps/desktop-tauri/src-tauri/src/commands/folder_size.rs` (rename `sprint4::` → `metadata::`)
- Modify: `apps/desktop-tauri/src-tauri/src/commands/recursive_search.rs` (rename `sprint4::` → `search::`)
- Modify: `apps/desktop-tauri/src-tauri/src/commands/fs.rs` (rename `sprint4::` → `locations::` / `external_open::`)
- Modify: `apps/desktop-tauri/src-tauri/tests/ipc_folder_test.rs`
- Modify: `apps/desktop-tauri/src-tauri/tests/ipc_search_test.rs`
- Modify: `apps/desktop-tauri/src-tauri/tests/ipc_error_test.rs`
- Modify: `crates/fs-core/tests/sprint4_baseline.rs` → rename to `fs_core_baseline.rs` and update imports

**Target boundaries (line ranges from current `sprint4.rs`):**

| Destination        | Source lines   | Contents                                                                                                                 |
| ------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `direct_ops.rs`    | 65–116         | `create_empty_file`, `delete_permanently`                                                                                |
| `metadata.rs`      | 19–48, 117–200 | `PathProperties`, `FolderSizeSummary`, `path_properties`, `calculate_folder_size`, `calculate_folder_size_with_progress` |
| `search.rs`        | 49–64, 201–245 | `SearchResult`, `SearchMatch`, `recursive_search`, `recursive_search_with_progress`                                      |
| `locations.rs`     | 11–18, 246–293 | `StandardLocation`, `standard_locations`                                                                                 |
| `external_open.rs` | 294–305        | `open_path_with_default_app`, `reveal_path_in_file_manager`                                                              |

- [ ] **Step 2.1: Create the five new module files**

For each file in the table, create it with:

1. The struct/fn definitions cut verbatim from `sprint4.rs`.
2. The minimal `use` block at the top (start from `sprint4.rs`'s imports — keep only those referenced).

Example for `metadata.rs`:

```rust
use std::path::Path;

use chrono::{DateTime, Utc};
use serde::Serialize;
use vfs::{FileOperationError, ResourceUri};

// PathProperties, FolderSizeSummary, path_properties, calculate_folder_size, calculate_folder_size_with_progress
// (bodies copied verbatim from sprint4.rs)
```

- [ ] **Step 2.2: Update `crates/fs-core/src/lib.rs` module decls**

Replace:

```rust
pub mod file_ops;
pub mod sprint4;
```

With:

```rust
pub mod direct_ops;
pub mod external_open;
pub mod file_ops;
pub mod locations;
pub mod metadata;
pub mod search;
```

Do **not** add a `pub use sprint4::*;` shim — we update every caller in this same task.

- [ ] **Step 2.3: Delete the old file**

```bash
git rm crates/fs-core/src/sprint4.rs
```

- [ ] **Step 2.4: Update Tauri callers (already-split command modules)**

In `apps/desktop-tauri/src-tauri/src/commands/folder_size.rs`, replace `use fs_core::sprint4;` with `use fs_core::metadata;` and replace every `sprint4::FolderSizeSummary` / `sprint4::calculate_folder_size*` reference accordingly.

In `apps/desktop-tauri/src-tauri/src/commands/recursive_search.rs`, same pattern: `sprint4::` → `search::` for `SearchResult`, `SearchMatch`, `recursive_search`, `recursive_search_with_progress`.

In `apps/desktop-tauri/src-tauri/src/commands/fs.rs`, split between `locations::` (for `standard_locations`, `StandardLocation`), `external_open::` (for `open_path_with_default_app`, `reveal_path_in_file_manager`), and `metadata::` (for `path_properties`). `create_empty_file` and `delete_permanently` (if called from here) → `direct_ops::`.

Use `grep -n "sprint4" apps/desktop-tauri/src-tauri/src/commands/` and resolve every remaining reference.

- [ ] **Step 2.5: Update integration tests**

```bash
grep -rn "sprint4" apps/desktop-tauri/src-tauri/tests/ crates/fs-core/tests/
```

For each hit, replace `fs_core::sprint4::X` with the matching `fs_core::<module>::X` based on the boundary table.

Rename:

```bash
git mv crates/fs-core/tests/sprint4_baseline.rs crates/fs-core/tests/fs_core_baseline.rs
```

Update its imports to match the new module split.

- [ ] **Step 2.6: Compile and verify**

```bash
cd /home/ilya/FileOctupus
cargo check -p fs-core -p fileoctopus-desktop-tauri
pnpm rust:fmt
pnpm rust:clippy
pnpm rust:test
```

Expected: all green. Same test counts as baseline.

- [ ] **Step 2.7: Confirm no stale `sprint4` references remain**

```bash
grep -rn "sprint4" --include="*.rs" --include="*.toml" --include="*.md" .
```

Expected: zero hits outside of git history / changelogs / older planning docs. If any source/test file still references it, fix it.

- [ ] **Step 2.8: Commit**

```bash
git add crates/fs-core/ apps/desktop-tauri/src-tauri/
git commit -m "refactor(fs-core): split sprint4 module into metadata/search/locations/external_open/direct_ops"
```

---

## Task 3: Split `crates/fs-core/src/file_ops.rs` into a module directory

**Files:**

- Create: `crates/fs-core/src/file_ops/mod.rs`
- Create: `crates/fs-core/src/file_ops/planning.rs`
- Create: `crates/fs-core/src/file_ops/execution.rs`
- Create: `crates/fs-core/src/file_ops/archive.rs`
- Create: `crates/fs-core/src/file_ops/trash.rs`
- Create: `crates/fs-core/src/file_ops/paths.rs`
- Delete: `crates/fs-core/src/file_ops.rs`

**Target boundaries (line ranges from current `file_ops.rs`):**

| Destination    | Source lines       | Contents                                                                                                                                                                                                                                                                  |
| -------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mod.rs`       | 1–112 (selected)   | imports, `FileOperationEventSink` type alias, `plan_file_operation`, `execute_file_operation`, `validate_request_shape`, `validate_basename` (lines 20–222), `pub use` re-exports if needed                                                                               |
| `planning.rs`  | 224–572            | `plan_copy_or_move_items`, `plan_rename_item`, `plan_create_directory_item`, `plan_create_file_item`, `plan_delete_items`, `plan_create_archive_items`, `plan_extract_archive_items`, `collect_copy_or_move_items`, `detect_conflicts`, `collect_archive_files`           |
| `execution.rs` | 574–766, 1054–1162 | `execute_copy`, `execute_move`, `execute_rename`, `execute_create_directory`, `execute_create_file`, `execute_trash`, `execute_delete_permanently`, `copy_file_streaming`, `resolve_conflict_path`, `next_available_path`, `check_cancelled`, `reject_self_or_descendant` |
| `archive.rs`   | 768–984            | `execute_create_archive`, `execute_extract_archive`, `archive_entry_name`, `sanitize_archive_entry_path`, `normalize_archive_entry_path`                                                                                                                                  |
| `trash.rs`     | 986–1053           | `move_to_trash` (all four `#[cfg(...)]` platform variants)                                                                                                                                                                                                                |
| `paths.rs`     | 1185–1246          | `require_existing_directory`, `canonical_existing_path`, `file_kind`, `map_io_error`, `map_std_io_error`, `is_cross_device_error`                                                                                                                                         |

- [ ] **Step 3.1: Delete the old monolith file**

```bash
git rm crates/fs-core/src/file_ops.rs
```

We're moving to a directory module; the file must go before `mod.rs` is created or `rustc` will see ambiguous module paths.

- [ ] **Step 3.2: Create `file_ops/mod.rs`**

Top of file:

```rust
mod archive;
mod execution;
mod paths;
mod planning;
mod trash;

use std::sync::Arc;

use jobs::{CancellationToken, JobEvent, JobId};
use vfs::{
    FileOperationError, FileOperationKind, FileOperationPlan, FileOperationRequest, ResourceUri,
};

use self::archive::{execute_create_archive, execute_extract_archive};
use self::execution::{
    execute_copy, execute_create_directory, execute_create_file, execute_delete_permanently,
    execute_move, execute_rename, execute_trash,
};
use self::planning::{
    plan_copy_or_move_items, plan_create_archive_items, plan_create_directory_item,
    plan_create_file_item, plan_delete_items, plan_extract_archive_items, plan_rename_item,
};

pub type FileOperationEventSink = dyn Fn(JobEvent) + Send + Sync;

pub fn plan_file_operation(
    request: FileOperationRequest,
) -> Result<FileOperationPlan, FileOperationError> {
    // body copied verbatim from lines 22–82 of the old file_ops.rs
}

pub fn execute_file_operation(
    plan: FileOperationPlan,
    cancel: CancellationToken,
    job_id: JobId,
    sink: Arc<FileOperationEventSink>,
) -> Result<(), FileOperationError> {
    // body copied verbatim from lines 84–111 of the old file_ops.rs
}

fn validate_request_shape(request: &FileOperationRequest) -> Result<(), FileOperationError> {
    // body verbatim from lines 113–207
}

fn validate_basename(name: &str) -> Result<(), FileOperationError> {
    // body verbatim from lines 208–222
}
```

- [ ] **Step 3.3: Create `planning.rs`**

Copy lines 224–572 from the old file. Add minimal imports at the top:

```rust
use std::fs::{self};
use std::path::PathBuf;

use vfs::{
    ConflictPolicy, FileKind, FileOperationConflict, FileOperationError, FileOperationItem,
    FileOperationKind, FileOperationRequest, FileOperationWarning, ResourceUri,
};

use super::paths::{canonical_existing_path, file_kind, map_io_error};
```

All `plan_*`, `collect_*`, `detect_conflicts` functions stay `pub(super)` so `mod.rs` can call them.

- [ ] **Step 3.4: Create `execution.rs`**

Copy lines 574–766 (executors) plus 1054–1162 (streaming + conflict + cancel + safety helpers). Imports:

```rust
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use filetime::FileTime;
use jobs::{CancellationToken, JobEvent, JobId, JobProgressEvent};
use vfs::{
    ConflictPolicy, FileOperationError, FileOperationItem, FileOperationPlan, ResourceUri,
};

use super::trash::move_to_trash;
use super::paths::{canonical_existing_path, map_io_error, map_std_io_error};
use super::FileOperationEventSink;

const COPY_BUFFER_SIZE: usize = 64 * 1024;
const PROGRESS_BYTE_INTERVAL: u64 = 1024 * 1024;
```

All `execute_*` are `pub(super)`.

- [ ] **Step 3.5: Create `archive.rs`**

Copy lines 768–984. Imports:

```rust
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use vfs::{FileOperationError, FileOperationItem, FileOperationPlan};
use zip::write::FileOptions;

use super::paths::map_io_error;
```

`execute_create_archive`, `execute_extract_archive` are `pub(super)`. The three sanitize/normalize helpers stay private to the module.

- [ ] **Step 3.6: Create `trash.rs`**

Copy lines 986–1053 verbatim (all four `#[cfg(target_os = "...")]` `move_to_trash` blocks). Imports:

```rust
use std::path::Path;

use vfs::FileOperationError;
```

`move_to_trash` is `pub(super)`.

- [ ] **Step 3.7: Create `paths.rs`**

Copy lines 1185–1246. Imports:

```rust
use std::fs;
use std::path::{Path, PathBuf};

use vfs::{FileKind, FileOperationError, ResourceUri};
```

All helpers `pub(super)`.

- [ ] **Step 3.8: Compile, lint, test**

```bash
cd /home/ilya/FileOctupus
cargo check -p fs-core
pnpm rust:fmt
pnpm rust:clippy
pnpm rust:test
```

Expected: all green. Fix any remaining missing/unused imports by following the compiler's reports.

- [ ] **Step 3.9: Verify external API unchanged**

```bash
grep -rn "fs_core::file_ops::" --include="*.rs" . | grep -v target | grep -v "src/file_ops/"
```

Every hit should still compile against the new `mod.rs` exports — `plan_file_operation`, `execute_file_operation`, `FileOperationEventSink`. If any caller previously imported a private helper, restore it through `pub use` in `mod.rs`.

- [ ] **Step 3.10: Commit**

```bash
git add crates/fs-core/src/
git commit -m "refactor(fs-core): split file_ops into planning/execution/archive/trash/paths submodules"
```

---

## Task 4: Split `crates/app-core/src/lib.rs`

**Files:**

- Create: `crates/app-core/src/paths.rs`
- Create: `crates/app-core/src/runtime.rs`
- Create: `crates/app-core/src/history.rs`
- Modify: `crates/app-core/src/lib.rs` (shrink to ~200 lines: `AppCore`, `AppState`, `AppCoreError`, `AppDataHealth`, mod decls, re-exports)

**Target boundaries (line ranges from current `app-core/src/lib.rs`):**

| Destination     | Source lines | Contents                                                                                                                                                        |
| --------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paths.rs`      | 142–200      | `AppPaths` struct, `impl AppPaths`, `impl Default for AppPaths`, `AppDataHealth` (if it only depends on paths — verify and keep with paths or move with lib.rs) |
| `runtime.rs`    | 201–451      | `OperationRuntime` struct + `impl OperationRuntime` (all methods including private `start`)                                                                     |
| `history.rs`    | 453–1040     | `OperationHistoryRepository`, `impl OperationHistoryRepository`, `OperationHistoryRecord`, `SCHEMA_VERSION`, `HISTORY_RETENTION_LIMIT` constants                |
| `lib.rs` (kept) | 1–141        | `use` block, `AppCoreError`, `AppState`, `AppCore::boot`, `AppCore::boot_with_history_path`, mod decls, public re-exports                                       |

- [ ] **Step 4.1: Create `history.rs`**

Cut lines 453–1040 from `lib.rs`. Paste into `crates/app-core/src/history.rs`. Move the two constants (`SCHEMA_VERSION`, `HISTORY_RETENTION_LIMIT`) into this file as well — they belong with the repository.

Imports for `history.rs`:

```rust
use std::path::PathBuf;

use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use vfs::FileOperationKind;

pub(crate) const SCHEMA_VERSION: u32 = 1;
pub(crate) const HISTORY_RETENTION_LIMIT: u32 = 500;
```

Both `OperationHistoryRepository` and `OperationHistoryRecord` stay `pub`.

- [ ] **Step 4.2: Create `runtime.rs`**

Cut lines 201–451. Imports:

```rust
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use chrono::Utc;
use fs_core::file_ops::{execute_file_operation, plan_file_operation, FileOperationEventSink};
use jobs::{
    CancellationToken, JobCancelledEvent, JobCompletedEvent, JobEvent, JobFailedEvent, JobId,
    JobSnapshot, JobStartedEvent, JobStatus,
};
use vfs::{FileOperationError, FileOperationPlan, FileOperationRequest};

use crate::history::{OperationHistoryRecord, OperationHistoryRepository};
```

`OperationRuntime` stays `pub`.

- [ ] **Step 4.3: Create `paths.rs`**

Cut lines 142–200. Imports:

```rust
use std::path::PathBuf;
```

(Add `serde` derives + `dirs` crate if those are used in the moved bodies — keep imports the same as the source.)

`AppPaths`, `AppDataHealth` stay `pub`.

- [ ] **Step 4.4: Slim `lib.rs`**

After all three extractions, `lib.rs` retains: top imports, `AppCoreError`, `AppState` struct+impl, `AppCore` struct+impl (just `boot`/`boot_with_history_path`), plus:

```rust
pub mod history;
pub mod paths;
pub mod runtime;

pub use history::{OperationHistoryRecord, OperationHistoryRepository};
pub use paths::{AppDataHealth, AppPaths};
pub use runtime::OperationRuntime;
```

These `pub use`s keep the existing flat API (`use app_core::OperationHistoryRecord;` etc.) working without changing any caller.

- [ ] **Step 4.5: Compile, lint, test**

```bash
cd /home/ilya/FileOctupus
cargo check -p app-core
pnpm rust:fmt
pnpm rust:clippy
pnpm rust:test
```

Expected: all green.

- [ ] **Step 4.6: Verify callers untouched**

```bash
grep -rn "use app_core::" --include="*.rs" . | grep -v target
```

Each line should still resolve via the re-exports in step 4.4. Do not touch any caller — that's the whole point of the re-export.

- [ ] **Step 4.7: Commit**

```bash
git add crates/app-core/src/
git commit -m "refactor(app-core): extract OperationRuntime, OperationHistoryRepository, AppPaths into siblings"
```

---

## Task 5: Split `packages/ts-api/src/client.ts`

**Files:**

- Create: `packages/ts-api/src/clients/fs.ts`
- Create: `packages/ts-api/src/clients/fileOperations.ts`
- Create: `packages/ts-api/src/clients/jobs.ts`
- Create: `packages/ts-api/src/clients/history.ts`
- Create: `packages/ts-api/src/clients/diagnostics.ts`
- Create: `packages/ts-api/src/clients/preferences.ts`
- Create: `packages/ts-api/src/clients/autostart.ts`
- Create: `packages/ts-api/src/clients/navigation.ts`
- Create: `packages/ts-api/src/transports/tauri.ts`
- Create: `packages/ts-api/src/transports/preview.ts`
- Create: `packages/ts-api/src/normalizeError.ts`
- Modify: `packages/ts-api/src/client.ts` (shrink to facade — `FileOctopusClient`, `createFileOctopusClient`, event-name constants, `commandMap`)
- Modify: `packages/ts-api/src/index.ts` (re-export the same surface)

**Target boundaries (line ranges from current `client.ts`):**

| Destination                 | Source lines               | Contents                                                                               |
| --------------------------- | -------------------------- | -------------------------------------------------------------------------------------- |
| `clients/fileOperations.ts` | 152–207                    | `FileOperationsClient`                                                                 |
| `clients/jobs.ts`           | 208–231                    | `JobsClient`                                                                           |
| `clients/history.ts`        | 232–258                    | `OperationHistoryClient`                                                               |
| `clients/diagnostics.ts`    | 259–285                    | `DiagnosticsClient`                                                                    |
| `clients/preferences.ts`    | 286–312                    | `PreferencesClient`, plus `preferenceValue` helper from lines 1063–1087                |
| `clients/autostart.ts`      | 313–334                    | `AutostartClient`                                                                      |
| `clients/navigation.ts`     | 335–430                    | `NavigationClient`                                                                     |
| `clients/fs.ts`             | 431–653                    | `FsClient`                                                                             |
| `transports/tauri.ts`       | 654–705, 1148–1162         | `createTauriTransport`, `requireListen`, `isTauriRuntime`                              |
| `transports/preview.ts`     | 706–1062, 1088–1147        | `createPreviewTransport`, `previewEntriesForUri`, preview fixture data                 |
| `normalizeError.ts`         | 1171–1207                  | `normalizeIpcError`, `isIpcError`                                                      |
| `client.ts` (kept)          | 1–151, 1163–1170, 1208–end | imports, event constants, `commandMap`, `FileOctopusClient`, `createFileOctopusClient` |

- [ ] **Step 5.1: Create `clients/*.ts` files**

For each per-domain client in the table:

1. Create the file under `packages/ts-api/src/clients/`.
2. Cut the class verbatim from `client.ts` and paste in.
3. At the top, add the imports the class needs. The pattern for every file:
   ```ts
   import type { IpcTransport } from "../types";
   import type {} from /* the request/response DTOs this client uses */ "../types";
   ```
4. Each class stays `export class`.

The `preferenceValue` helper (lines 1063–1087) is only used by `PreferencesClient`; move it into `clients/preferences.ts` and drop the `export` (file-local).

- [ ] **Step 5.2: Create `transports/tauri.ts`**

```ts
import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen } from "@tauri-apps/api/event";
import type { IpcTransport, UnlistenFn } from "../types";
import { normalizeIpcError } from "../normalizeError";

export function isTauriRuntime(): boolean {
  // body verbatim from current client.ts lines 1208–end
}

export function requireListen<TPayload>(/* ...verbatim signature */) {
  // body verbatim from current lines 1148–1162
}

export function createTauriTransport(): IpcTransport {
  // body verbatim from current lines 654–705
}
```

- [ ] **Step 5.3: Create `transports/preview.ts`**

Move `createPreviewTransport` (lines 706–1062) and `previewEntriesForUri` (lines 1088–1147) plus all the fixture constants those functions reference. Imports:

```ts
import type { FileEntryDto, IpcTransport } from "../types";
```

Keep `export function createPreviewTransport(): IpcTransport`; the rest are file-local helpers.

- [ ] **Step 5.4: Create `normalizeError.ts`**

```ts
import { IPC_ERROR_CODES } from "./types";
import type { IpcError } from "./types";

export function normalizeIpcError(error: unknown): IpcError {
  // body verbatim from current lines 1171–1195
}

function isIpcError(error: unknown): error is IpcError {
  // body verbatim from current lines 1196–1207
}
```

- [ ] **Step 5.5: Slim `client.ts`**

After extraction, `client.ts` should contain only:

1. Top-level imports for the facade
2. All event-name constants (lines 75–84)
3. The `commandMap` (lines 86–125)
4. The `FileOctopusClient` class (lines 126–151) — update its imports to pull from `./clients/*`
5. The `createFileOctopusClient` factory (lines 1163–1170) — update to import transports from `./transports/*`

Example facade composition (replace the current `FileOctopusClient`):

```ts
import { FsClient } from "./clients/fs";
import { FileOperationsClient } from "./clients/fileOperations";
import { JobsClient } from "./clients/jobs";
import { OperationHistoryClient } from "./clients/history";
import { DiagnosticsClient } from "./clients/diagnostics";
import { PreferencesClient } from "./clients/preferences";
import { AutostartClient } from "./clients/autostart";
import { NavigationClient } from "./clients/navigation";
import { createTauriTransport, isTauriRuntime } from "./transports/tauri";
import { createPreviewTransport } from "./transports/preview";
import { normalizeIpcError } from "./normalizeError";

// FileOctopusClient class body kept verbatim, but the per-domain
// fields now reference the imported classes.
```

- [ ] **Step 5.6: Update `packages/ts-api/src/index.ts`**

Ensure the barrel re-exports the same public surface that current consumers expect. Add any new module paths only if external code uses them — consumers currently import from the package root (`@fileoctopus/ts-api`), so any new internal subpath is invisible. Verify with:

```bash
grep -rn "@fileoctopus/ts-api/" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v dist
```

Expected: zero hits (no deep imports). Therefore `index.ts` only needs to keep the existing exports — no API change.

- [ ] **Step 5.7: Build, typecheck, lint, test**

```bash
cd /home/ilya/FileOctupus
pnpm --filter @fileoctopus/ts-api build
pnpm typecheck
pnpm lint
pnpm test
```

Expected: all green. Existing tests in `packages/ts-api/tests/client.test.ts` must pass without modification — they import from `@fileoctopus/ts-api`, not from internal files.

- [ ] **Step 5.8: Commit**

```bash
git add packages/ts-api/
git commit -m "refactor(ts-api): split client.ts into per-domain clients and transports"
```

---

## Task 6: Split `packages/frontend/src/hooks/useFileOpHandlers.ts`

**Files:**

- Create: `packages/frontend/src/hooks/fileOps/types.ts`
- Create: `packages/frontend/src/hooks/fileOps/useClipboardHandlers.ts`
- Create: `packages/frontend/src/hooks/fileOps/useMutationHandlers.ts`
- Create: `packages/frontend/src/hooks/fileOps/useTransferHandlers.ts`
- Create: `packages/frontend/src/hooks/fileOps/useMetadataHandlers.ts`
- Create: `packages/frontend/src/hooks/fileOps/useArchiveHandlers.ts`
- Modify: `packages/frontend/src/hooks/useFileOpHandlers.ts` (shrink to <120 lines: imports, `FileClipboardState`, `UseFileOpHandlersDeps`, the `useFileOpHandlers` facade that composes the five sub-hooks)

**Returned-handler routing (from existing return block at line 161+):**

| Sub-hook               | Handlers returned                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `useClipboardHandlers` | clipboard state mutators (cut/copy/paste — find by searching for `setClipboard(` and `clipboard?.uris`) |
| `useMutationHandlers`  | `handleCreateFolder`, `handleCreateFile`, `handleRename`, `handleTrash`, `handlePermanentDelete`        |
| `useTransferHandlers`  | `handleCopyOrMove` (and any paste-triggered copy/move call)                                             |
| `useMetadataHandlers`  | `handleProperties`, `handleChecksum`                                                                    |
| `useArchiveHandlers`   | `handleCompress`, `handleExtract`                                                                       |

- [ ] **Step 6.1: Survey & catalogue handlers**

```bash
grep -n "const handle\|const create\w*Handler\|useCallback" /home/ilya/FileOctupus/packages/frontend/src/hooks/useFileOpHandlers.ts
```

For each handler returned at line 161+ (`handleCreateFolder` through `handleExtract`), find its `const handle... = useCallback(...)` definition. Record:

- Which `deps` it reads
- Which other handlers (if any) it calls

If a handler calls a peer (e.g., paste calls handleCopyOrMove), the caller's sub-hook must import the callee's sub-hook or both must move together. Keep the cross-hook surface to a minimum — when in doubt, keep the handler with the data it operates on (mutation vs transfer vs archive).

- [ ] **Step 6.2: Create `fileOps/types.ts`**

Move the shared types so each sub-hook can import them without depending on each other:

```ts
import type { Dispatch, SetStateAction } from "react";
import type {
  FileEntryDto,
  FileOperationKind,
  JobSnapshot,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import type { createFileOctopusClient } from "@fileoctopus/ts-api";
import type { FileOctopusState, PanelAction, PanelId } from "../../panelStore";
import type { OperationDialog } from "../../dialogs/OperationDialogView";
import type { SearchState } from "../../pane/PaneFilterBar";
import type { ToastMessage } from "../../components/ToastStack";

export type CopyMoveKind = Extract<FileOperationKind, "copy" | "move">;

export interface FileClipboardState {
  kind: CopyMoveKind;
  uris: string[];
  providerId: string;
  timestamp: number;
}

export interface UseFileOpHandlersDeps {
  // body verbatim from current useFileOpHandlers.ts lines 41–73
}
```

- [ ] **Step 6.3: Create the five sub-hook files**

For each row in the routing table:

1. Create `packages/frontend/src/hooks/fileOps/<name>.ts`.
2. Define `export function <name>(deps: UseFileOpHandlersDeps)` that destructures only the deps that sub-hook needs.
3. Move every `useCallback` for that sub-hook's handlers verbatim into the function body.
4. Return an object with just that sub-hook's handlers.

Example skeleton for `useMutationHandlers.ts`:

```ts
import { useCallback } from "react";
import { normalizeIpcError } from "@fileoctopus/ts-api";
import { activeTab, normalizeLocalInput, parentUri, selectVisibleEntries } from "../../panelStore";
import { localPathFromUri } from "../../utils/paneUtils";
import { isValidName, joinLocalUri, operationErrorMessage } from "../../dialogs/OperationDialogView";
import type { UseFileOpHandlersDeps } from "./types";

export function useMutationHandlers(deps: UseFileOpHandlersDeps) {
  const { client, state, dispatch, setDialog, /* etc. */ } = deps;

  const handleCreateFolder = useCallback(/* body verbatim */, [/* deps */]);
  const handleCreateFile   = useCallback(/* body verbatim */, [/* deps */]);
  const handleRename       = useCallback(/* body verbatim */, [/* deps */]);
  const handleTrash        = useCallback(/* body verbatim */, [/* deps */]);
  const handlePermanentDelete = useCallback(/* body verbatim */, [/* deps */]);

  return { handleCreateFolder, handleCreateFile, handleRename, handleTrash, handlePermanentDelete };
}
```

Repeat the pattern for the other four sub-hooks. Keep callback dependency arrays unchanged (move the deps along with the body).

- [ ] **Step 6.4: Reduce `useFileOpHandlers.ts` to a facade**

After all handlers are extracted, `useFileOpHandlers.ts` becomes:

```ts
import { useClipboardHandlers } from "./fileOps/useClipboardHandlers";
import { useMutationHandlers } from "./fileOps/useMutationHandlers";
import { useTransferHandlers } from "./fileOps/useTransferHandlers";
import { useMetadataHandlers } from "./fileOps/useMetadataHandlers";
import { useArchiveHandlers } from "./fileOps/useArchiveHandlers";
import type {
  FileClipboardState,
  UseFileOpHandlersDeps,
} from "./fileOps/types";

export type { FileClipboardState, UseFileOpHandlersDeps };

export function useFileOpHandlers(deps: UseFileOpHandlersDeps) {
  const clipboard = useClipboardHandlers(deps);
  const mutations = useMutationHandlers(deps);
  const transfers = useTransferHandlers(deps);
  const metadata = useMetadataHandlers(deps);
  const archive = useArchiveHandlers(deps);

  return {
    ...clipboard,
    ...mutations,
    ...transfers,
    ...metadata,
    ...archive,
  };
}
```

Verify the spread object exposes the **same** keys as the original `return { ... }` block (lines 161+). If any handler in the original was renamed or omitted, the consumers in `packages/frontend/src/shell/`, `pane/`, `components/ContextMenu.tsx` will break. Grep:

```bash
grep -rn "useFileOpHandlers\|handleCreateFolder\|handleCreateFile\|handleRename\|handleCopyOrMove\|handleTrash\|handlePermanentDelete\|handleProperties\|handleChecksum\|handleCompress\|handleExtract" packages/frontend/src/ | grep -v "useFileOpHandlers.ts" | grep -v "hooks/fileOps/"
```

Every hit should still match a key returned by the new facade.

- [ ] **Step 6.5: Typecheck, lint, test**

```bash
cd /home/ilya/FileOctupus
pnpm --filter @fileoctopus/frontend build
pnpm typecheck
pnpm lint
pnpm test
```

Expected: all green. `packages/frontend/tests/appShell.test.tsx` and the per-handler tests must pass unmodified.

- [ ] **Step 6.6: Run e2e smoke (Tauri shell)**

The frontend is a UI; type-checks alone don't catch broken handler wiring. Run the Tauri shell against the existing e2e suite:

```bash
pnpm dev   # in one terminal; wait for "ready" output
# in another terminal:
pnpm --filter @fileoctopus/desktop-tauri test:e2e  # or whatever the e2e script alias is
```

If no e2e script exists, manually exercise: create folder, create file, rename, copy-paste, move-paste, trash, restore, properties, checksum, compress, extract — all from the context menu in the running app. Behavior should be identical to baseline.

- [ ] **Step 6.7: Commit**

```bash
git add packages/frontend/src/hooks/
git commit -m "refactor(frontend): split useFileOpHandlers into per-operation sub-hooks"
```

---

## Task 7: Update `CLAUDE.md` to reflect the new structure

**Files:**

- Modify: `CLAUDE.md`

The "Architecture" section's bullet for `fs-core` currently reads: _"`LocalFsProvider` (read/list/stat) and `file_ops` (planning + execution …)"_ and the `app-core` bullet describes everything in a single file. Both are now stale.

- [ ] **Step 7.1: Update the `fs-core` bullet**

Replace the existing bullet with:

```markdown
- **`fs-core`** — `LocalFsProvider` (read/list/stat) plus the file-operation pipeline split across:
  - `file_ops/` — planning, execution, archive, trash, and path helpers for copy/move/rename/delete-to-trash/create-directory/create-file/archive/extract jobs.
  - `direct_ops` — non-job direct mutators (`create_empty_file`, `delete_permanently`).
  - `metadata` — `path_properties`, folder-size computations.
  - `search` — recursive search (sync + progress variants).
  - `locations` — `standard_locations` enumeration.
  - `external_open` — `open_path_with_default_app`, `reveal_path_in_file_manager`.
```

- [ ] **Step 7.2: Update the `app-core` bullet**

Replace the relevant sentences with:

```markdown
- **`app-core`** — `AppCore::boot()` returns an `Arc<AppState>` containing the `VfsRegistry` and `OperationRuntime`. Split into:
  - `lib.rs` — `AppCore`, `AppState`, `AppCoreError`, public re-exports.
  - `runtime.rs` — `OperationRuntime` (planning, job table, history hand-off).
  - `history.rs` — `OperationHistoryRepository`, `OperationHistoryRecord`, SQLite schema/migration.
  - `paths.rs` — `AppPaths`, `AppDataHealth`, default platform paths.
```

- [ ] **Step 7.3: Update the Tauri shell bullet**

Replace the existing paragraph with:

```markdown
`src-tauri/src/lib.rs` is the thin entrypoint: it builds `AppCore::boot()`, manages plugin state, and registers handlers. Commands live in `commands/{app_info,fs,folder_size,recursive_search,watch,preferences,autostart,navigation,file_operations,diagnostics}.rs`. Shared infrastructure is in `state.rs` (watch/metadata/listing state) and `emit.rs` (job + directory event emitters).
```

- [ ] **Step 7.4: Update the frontend bullet**

Append the per-domain client split:

```markdown
- **`@fileoctopus/ts-api`** — typed IPC client. `FileOctopusClient` (in `client.ts`) composes per-domain clients in `clients/{fs,fileOperations,jobs,history,diagnostics,preferences,autostart,navigation}.ts`. Transports live in `transports/{tauri,preview}.ts`. Error normalisation in `normalizeError.ts`. Public surface is unchanged — all consumers still import from `@fileoctopus/ts-api`.
```

And for the frontend handlers:

```markdown
- File-op handlers are composed in `packages/frontend/src/hooks/useFileOpHandlers.ts` from per-operation hooks under `hooks/fileOps/{useClipboardHandlers,useMutationHandlers,useTransferHandlers,useMetadataHandlers,useArchiveHandlers}.ts`.
```

- [ ] **Step 7.5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md to reflect decomposed module layout"
```

---

## Task 8: Final Verification

**Files:** none (verification only)

- [ ] **Step 8.1: Full clean rebuild**

```bash
cd /home/ilya/FileOctupus
cargo clean -p fileoctopus-desktop-tauri -p app-core -p fs-core
rm -rf node_modules/.vite packages/*/dist
pnpm install --frozen-lockfile
pnpm rust:fmt
pnpm rust:clippy
pnpm rust:test
pnpm typecheck
pnpm lint
pnpm test
```

Expected: every command exits 0 with the **same** test counts as the Step 0.2 baseline. Diff if needed:

```bash
pnpm rust:test 2>&1 | tail -20
pnpm test 2>&1 | tail -20
```

- [ ] **Step 8.2: Boot the Tauri shell**

```bash
pnpm dev
```

Wait for the Tauri window to open. Smoke-test:

1. Browse a directory (verifies `fs_list_start` wiring).
2. Open file properties (verifies `metadata::path_properties` + `commands::fs::fs_properties` path).
3. Copy a file via context menu, paste into another panel (verifies `commands::file_operations::plan_file_operation` + `commands::file_operations::start_file_operation`).
4. Trigger a folder-size job on a large directory (verifies `commands::folder_size` + metadata-job state).
5. Compress a selection, then extract it (verifies `file_ops::archive` + the archive handler split).

If any step misbehaves, identify which task broke it and revert just that commit:

```bash
git log --oneline | head -10
git revert <bad-commit-sha>
```

- [ ] **Step 8.3: Confirm line-count reductions**

```bash
wc -l \
  apps/desktop-tauri/src-tauri/src/lib.rs \
  crates/fs-core/src/file_ops/mod.rs \
  crates/app-core/src/lib.rs \
  packages/ts-api/src/client.ts \
  packages/frontend/src/hooks/useFileOpHandlers.ts
```

Expected approximate targets:

- `desktop-tauri/src-tauri/src/lib.rs` → under 250 lines
- `fs-core/src/file_ops/mod.rs` → under 250 lines
- `app-core/src/lib.rs` → under 250 lines
- `ts-api/src/client.ts` → under 250 lines
- `frontend/src/hooks/useFileOpHandlers.ts` → under 120 lines

If any target overshoots significantly, audit whether more code can move to a sibling without pulling in a circular dependency.

- [ ] **Step 8.4: Open the PR**

```bash
git log --oneline main..HEAD
gh pr create --title "refactor: decompose monolith modules" --body "$(cat <<'EOF'
## Summary
- Split `apps/desktop-tauri/src-tauri/src/lib.rs` (1897 LoC) into per-domain command modules + shared state/emit helpers.
- Split `crates/fs-core/src/file_ops.rs` (1929 LoC) into `file_ops/{planning,execution,archive,trash,paths}.rs`.
- Renamed and split `crates/fs-core/src/sprint4.rs` (730 LoC) into `metadata`, `search`, `locations`, `external_open`, `direct_ops`.
- Extracted `OperationRuntime`, `OperationHistoryRepository`, `AppPaths` out of `crates/app-core/src/lib.rs` (1040 LoC).
- Split `packages/ts-api/src/client.ts` (1210 LoC) into per-domain clients and transports; preview fixtures isolated.
- Split `packages/frontend/src/hooks/useFileOpHandlers.ts` (866 LoC) into per-operation sub-hooks.
- No behavior changes. All public re-exports preserved so external callers compile unchanged.
- `CLAUDE.md` updated to describe the new layout.

## Tests
- [ ] `pnpm rust:fmt`, `pnpm rust:clippy`, `pnpm rust:test` — green
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` — green
- [ ] Manual smoke in `pnpm dev`: browse, properties, copy/paste, folder-size, compress/extract

## Security impact
None — pure restructure. The IPC trust boundary (ADR-0002, ADR-0003) and stable `FileOperationError::code()` vocabulary are unchanged.
EOF
)"
```

---

## Rollback Strategy

Each task ends in exactly one commit. To revert a single task:

```bash
git log --oneline main..HEAD                   # find the offending commit
git revert --no-edit <commit-sha>              # revert it
pnpm rust:test && pnpm test                    # confirm baseline restored
```

Because every task preserves the public API (via re-exports in `lib.rs`, `mod.rs`, or `index.ts`), partial completion is safe — you can ship Tasks 1–3 and leave Tasks 4–6 for a follow-up PR if review pressure demands it.

---

## Out of Scope (do not do in this plan)

- Reorganising the `vfs` crate (983 LoC — cohesive domain primitives, leave alone).
- Reorganising the `app-ipc` crate (1206 LoC — single-file contract surface is intentional).
- Reorganising `panelStore.ts` (single `useReducer` store; splitting reducer cases is a net loss).
- Any behavior change, new feature, or bug fix. If a latent bug is found mid-refactor, file it and keep moving — fixing belongs in a separate PR so the restructure stays mechanical.
- ADRs: this is mechanical restructuring inside existing trust boundaries; no ADR needed.
