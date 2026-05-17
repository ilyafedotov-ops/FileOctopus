# FileOctopus Release Candidate (v0.1.0) Engineering Specification

## 1. Document Purpose

This document describes the **Release Candidate (RC)** engineering scope for FileOctopus v0.1.0: what ships in RC, known gaps versus the original MVP vision, as-built crate boundaries, IPC contracts, persistence, testing expectations, and acceptance criteria. It is the RC counterpart to the historical MVP build plan—not a greenfield implementation guide.

The RC is a high-performance local dual-pane file manager with safe job-based file operations. Post-RC capabilities (Git decorations, embedded terminal, multi-tab panes, tar archives, full job SQLite schema) are tracked explicitly in §3.2 and §17. Broader product vision items (cloud, plugins, AI) remain in §3.3.

### RC delivery matrix (2026-05-17)

| Area                       | RC status     | Shipped                                                                                                                                           | Not in RC                                                                       |
| -------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Core navigation & file ops | **Delivered** | Dual pane, streamed listing, virtualization, plan/start jobs, operation history; `fs-core` / `app-core` / Tauri `commands/*` / ts-api `clients/*` | Multi-tab per panel                                                             |
| Zip archives               | **Delivered** | `CreateArchive` / `ExtractArchive` in `fs-core/file_ops`, zip-slip tests, toolbar + context menu                                                  | Tar and other formats                                                           |
| Jobs & persistence         | **Partial**   | In-memory jobs, progress events, cancel; SQLite `operation_history`                                                                               | Full `job` / `job_item_result` schema (§9.2)                                    |
| Git                        | **Deferred**  | —                                                                                                                                                 | `git-intel`, branch/badges (MVP-GIT-\*)                                         |
| Terminal                   | **Partial**   | `fs_open_terminal` (external emulator in active folder)                                                                                           | Embedded xterm panel, `terminal-core`                                           |
| UI                         | **Partial**   | Command palette, context menus, activity/history, preview, theme prefs, `MenuBar` shell                                                           | Full menu-bar wiring (many items stub); Menu spec parity                        |
| Platform & release         | **Partial**   | Windows/macOS/Linux CI builds                                                                                                                     | Formal RC sign-off (§16, [mvp-rc-checklist.md](../release/mvp-rc-checklist.md)) |

**Authoritative references:**

- Runtime IPC → [api-reference.md](api-reference.md)
- Living doc ↔ code matrix → [PROJECT_STATUS_AND_DOC_ALIGNMENT.md](../planning/PROJECT_STATUS_AND_DOC_ALIGNMENT.md)
- RC release gate → [mvp-rc-checklist.md](../release/mvp-rc-checklist.md)

---

## 2. RC Product Definition

## 2.1 RC Goal

Deliver a fast, reliable, cross-platform dual-pane file manager suitable for daily local file work in the RC validation window: safe file operations with job progress and history, virtualized large-directory rendering, keyboard-first navigation, zip archive create/extract, and external-terminal integration. Git awareness, embedded terminal, and multi-tab panes are **post-RC** (§3.2).

## 2.2 User Persona

Primary user:

- IT infrastructure consultant
- Developer
- DevOps engineer
- System administrator
- Power user managing large directory trees, repositories, archives, logs, VM images, scripts, backups, and cloud/remote assets

## 2.3 RC Value Proposition

FileOctopus RC should prove three things:

1. It is faster and more responsive than default OS file managers in large folders.
2. It is safer and more controllable than ad-hoc shell operations for bulk file tasks.
3. Its architecture (typed IPC, planned jobs, streaming listings) is extensible enough for post-RC workflow features (Git, embedded terminal, remote providers) without rework.

---

## 3. Scope

## 3.1 RC scope (shipped)

### Core Navigation

- Dual-pane file browsing (single tab per pane; tab model ready for post-RC).
- Breadcrumb navigation and editable path bar.
- Back/forward history; sidebar (favorites, devices, pinned, recent, starred).
- Keyboard navigation, shortcuts dialog, command palette (Ctrl/Cmd+P).
- Hidden file toggle; sort and filter in current directory.
- View modes: details, list, icons, columns; recursive search job.
- Filesystem watcher with debounced refresh.

### File Operations

- Copy files and directories.
- Move files and directories.
- Rename file or directory.
- Create directory.
- Trash/delete file or directory.
- Conflict detection.
- Conflict policy: ask, skip, replace, keep both.
- Progress reporting.
- Cancellation.
- Durable job records.
- Failed job inspection.

### Large Directory Handling

- Asynchronous listing.
- Batched directory result streaming.
- Frontend row virtualization.
- Non-blocking sorting/filtering.
- Stable selection during incremental updates.

### Job System

- Plan/start file operations with progress events and cancellation.
- Activity panel and in-memory job snapshots.
- SQLite **operation history** (inspectable after restart; interrupted jobs marked on startup).
- Not in RC: full durable `job` / `job_item_result` tables (§9.2).

### Archive support (RC)

- Create zip archives and extract zip archives via `FileOperationKind::CreateArchive` / `ExtractArchive` in `fs-core/file_ops`.
- Path traversal blocked (`sanitize_archive_entry_path`; tests in `file_ops/tests.rs`).
- Progress reported through the standard job event channel.
- Not in RC: tar or other archive formats; separate `archive-core` crate.

### Terminal (RC)

- Open default external terminal in active panel directory (`fs_open_terminal`).
- Not in RC: embedded terminal panel or `terminal-core` PTY IPC.

### UI/UX

- Two-pane layout, resizable split, status bar, toasts.
- Application menu bar shell (`MenuBar` in title bar); many menu actions still stubbed (§3.2).
- Context menus, operation dialogs, settings/shortcuts/diagnostics dialogs.
- Job activity / operation history panel; text preview (Space on text files).
- Theme, density, accent, font/icon scale preferences.

### Platform Support

- Windows 10/11.
- macOS current supported releases.
- Common Linux desktop distributions.

---

## 3.2 RC known gaps

Items from the original MVP §3.1 that are **not** required for RC sign-off but may follow in 1.0:

- Git repository detection, branch display, and file status badges (`git-intel`, MVP-GIT-\*).
- Embedded terminal panel (xterm.js + PTY); RC uses external emulator only.
- Multi-tab per panel (model exists; UI uses one tab per pane).
- Tar and non-zip archive formats (RC ships zip create/extract only).
- Full application menu bar per [Menu & Modal Spec](../plans/FileOctopus_Menu_and_Modal_Specification.md) (shell present; Copy To…, diagnostics export from menu, etc. still stubbed).
- Full `job` / `job_item_result` SQLite schema and per-item recovery.
- Formal performance and RC checklist sign-off (MVP-PERF-\*, §16).

---

## 3.3 Post-RC deferred

- Peer-to-peer sync.
- AI semantic search.
- Full content-addressed library model.
- Plugin marketplace.
- Full Lua/WASM plugin runtime.
- Production cloud provider support.
- SMB/SFTP/S3/Azure Blob production providers.
- Native shell extensions.
- File content diff/merge.
- Multi-user collaboration.
- Mobile clients.
- Advanced ACL editing.
- Full metadata editor.

---

## 4. RC acceptance criteria (MVP IDs retained)

## 4.1 Functional acceptance criteria

| ID           | RC status      | Requirement             | Acceptance criteria                                                      |
| ------------ | -------------- | ----------------------- | ------------------------------------------------------------------------ |
| MVP-FS-001   | **Met**        | Directory navigation    | User can navigate local filesystem in both panels.                       |
| MVP-FS-002   | **Met**        | Large directory listing | Folder with 100,000 files opens without UI freeze (see `docs/testing/`). |
| MVP-FS-003   | **Met**        | Copy operation          | User can copy files/folders between panels with progress.                |
| MVP-FS-004   | **Met**        | Move operation          | User can move files/folders between panels with progress.                |
| MVP-FS-005   | **Met**        | Rename                  | User can rename selected item.                                           |
| MVP-FS-006   | **Met**        | New folder              | User can create a folder in active panel.                                |
| MVP-FS-007   | **Met**        | Trash/delete            | User can send items to OS trash where supported.                         |
| MVP-FS-008   | **Met**        | Conflict handling       | User is prompted when destination conflict occurs.                       |
| MVP-JOB-001  | **Met**        | Job queue               | Long operations appear in job queue / activity panel.                    |
| MVP-JOB-002  | **Met**        | Cancellation            | Running copy/move/archive jobs can be cancelled.                         |
| MVP-JOB-003  | **Met**        | Failure visibility      | Failed jobs expose error detail.                                         |
| MVP-JOB-004  | **Mostly met** | Restart persistence     | Operation history inspectable after restart; live jobs in-memory only.   |
| MVP-GIT-001  | **Deferred**   | Git branch              | Active panel shows repository branch when inside Git repo.               |
| MVP-GIT-002  | **Deferred**   | Git badges              | File list shows basic Git status badges asynchronously.                  |
| MVP-ARC-001  | **Partial**    | Archive extraction      | Zip create/extract to destination; tar not implemented.                  |
| MVP-ARC-002  | **Met**        | Archive safety          | Malicious archive path traversal is blocked (zip-slip tests).            |
| MVP-TERM-001 | **Partial**    | Terminal open           | External terminal in active panel path; embedded panel deferred.         |
| MVP-UI-001   | **Partial**    | Keyboard flow           | Shortcuts + command palette; menu bar shell partial.                     |
| MVP-SEC-001  | **Met**        | No direct FS frontend   | Frontend has no unrestricted generic filesystem access (ADR-0002).       |

## 4.2 Performance acceptance criteria

| ID           | RC status          | Scenario                     | Target                                                               |
| ------------ | ------------------ | ---------------------------- | -------------------------------------------------------------------- |
| MVP-PERF-001 | **Not signed off** | Cold start to visible window | Under 1.5 s on modern laptop target hardware.                        |
| MVP-PERF-002 | **Not signed off** | Warm start                   | Under 700 ms where practical.                                        |
| MVP-PERF-003 | **Not signed off** | 10k file directory           | No visible freeze.                                                   |
| MVP-PERF-004 | **Not signed off** | 100k file directory          | Incremental listing with responsive scrolling.                       |
| MVP-PERF-005 | **Not signed off** | Copy 10k small files         | Progress updates at least every 250 ms or meaningful batch interval. |
| MVP-PERF-006 | **Met** (design)   | UI event loop                | No file operation blocks UI thread.                                  |

Protocol: [`docs/testing/large-directory-performance.md`](../testing/large-directory-performance.md), [`docs/performance.md`](../performance.md).

## 4.3 Reliability acceptance criteria

| ID          | RC status      | Requirement              | Acceptance criteria                                                                      |
| ----------- | -------------- | ------------------------ | ---------------------------------------------------------------------------------------- |
| MVP-REL-001 | **Mostly met** | Cancellation consistency | Cancelled copy leaves known partial state and reports it.                                |
| MVP-REL-002 | **Mostly met** | Job persistence          | App restart does not lose operation history.                                             |
| MVP-REL-003 | **Met**        | Error handling           | Permission denied, path missing, disk full, and destination conflict handled gracefully. |
| MVP-REL-004 | **Met**        | Path safety              | Paths are normalized before dangerous operations.                                        |
| MVP-REL-005 | **Met**        | Archive safety           | Zip extraction blocks zip-slip style payloads.                                           |

---

## 5. Engineering Milestones

| Milestone                      | RC status                                                                    |
| ------------------------------ | ---------------------------------------------------------------------------- |
| M0 — Repo & build foundation   | **Done**                                                                     |
| M1 — Local navigation slice    | **Done**                                                                     |
| M2 — Durable job engine        | **Mostly done** (in-memory jobs + operation history)                         |
| M3 — Conflict & safety         | **Mostly done**                                                              |
| M4 — Git, archive, terminal v1 | **Partial** (zip archives in `fs-core`; Git + embedded terminal not started) |
| M5 — RC hardening              | **In progress**                                                              |

## 5.1 Milestone 0: Repository and Build Foundation

### Deliverables

- Monorepo layout.
- Tauri v2 app scaffold.
- Rust workspace scaffold.
- Frontend scaffold.
- Shared TypeScript API package.
- CI build for Windows, macOS, Linux.
- Basic linting and formatting.

### Done Criteria

- `cargo test` runs.
- Frontend tests run.
- Tauri app launches empty shell.
- CI produces build artifacts or validates builds.

---

## 5.2 Milestone 1: Local Navigation Vertical Slice

### Deliverables

- `fs-core` crate.
- `vfs` crate with `local://` provider.
- `app-ipc` commands for `fs.list` and `fs.stat`.
- Streamed directory batch events.
- Dual-pane UI.
- Virtualized table.
- Basic keyboard navigation.

### Done Criteria

- User can navigate local filesystem.
- Directory batches stream to UI.
- 100k synthetic folder does not freeze UI.
- Both panels maintain independent current location and selection state.

---

## 5.3 Milestone 2: Durable Job Engine

### Deliverables

- `jobs` crate.
- SQLite persistence.
- Copy job.
- Move job.
- Rename job.
- Create directory job.
- Trash/delete job.
- Job progress events.
- Job queue UI.

### Done Criteria

- User can copy/move/delete files from UI.
- Long operation exposes progress.
- User can cancel running copy.
- Job records persist across restart.

---

## 5.4 Milestone 3: Conflict Handling and Safety

### Deliverables

- Operation planning.
- Conflict detection.
- Conflict policy handling.
- Path normalization and validation.
- Trash abstraction.
- Dangerous operation confirmations.

### Done Criteria

- Destination conflicts are detected before overwrite.
- User can choose ask/skip/replace/keep both.
- Delete uses OS trash where available.
- Permanent delete requires explicit action.

---

## 5.5 Milestone 4: Git, Archive, Terminal v1

**RC status: Partial.** Zip create/extract shipped inside `fs-core/file_ops` (not separate `archive-core`). External terminal via `fs_open_terminal`. Git and embedded terminal deferred to post-RC.

### Deliverables (original plan)

- `git-intel` crate — **post-RC**
- `archive-core` crate — **superseded at RC** by `fs-core/file_ops/archive.rs`
- `terminal-core` crate — **post-RC** (embedded panel)
- Git branch and status badges — **post-RC**
- Zip archive create/extract as planned file operations — **done**
- Embedded terminal panel — **post-RC**

### Done criteria (RC)

- Zip archive creates and extracts safely with path-traversal guards.
- User can open external terminal in active panel path.
- Git branch/badges and embedded terminal are not RC blockers.

---

## 5.6 Milestone 5: RC Hardening

**RC status: In progress.** Tracks [mvp-rc-checklist.md](../release/mvp-rc-checklist.md).

### Deliverables

- Error handling pass.
- Logging and diagnostics export.
- Cross-platform test pass.
- Installer packaging.
- Performance profiling per `docs/testing/`.
- RC documentation alignment (this spec, API reference, PROJECT_STATUS).

### Done criteria

- RC functional criteria in §4.1 met or explicitly deferred.
- No known data-loss bug remains open.
- Release candidate packages build for target platforms.
- RC checklist owner sign-off.

---

## 6. Repository layout (as built, RC)

```text
fileoctopus/
  apps/
    desktop-tauri/
      src-tauri/src/
        lib.rs
        commands/          # app_info, fs, file_operations, watch, navigation, …
        state.rs, emit.rs
      src/                 # mounts FileOctopusShell
    cli/                   # placeholder binary

  crates/
    vfs/
    fs-core/               # LocalFsProvider, file_ops/, metadata, search, …
    jobs/
    app-core/              # boot, OperationRuntime, operation_history SQLite
    app-ipc/
    config/                # preferences + navigation stores
    platform/              # minimal placeholder
    telemetry/
    test-support/          # fileoctopus-test-tree

  packages/
    frontend/src/
      index.tsx            # FileOctopusShell
      panelStore.ts
      shell/               # ShellLayout, TitleBar, MenuBar
      pane/                # FilePanel, OperationToolbar, FileTable, …
      hooks/fileOps/       # useArchiveHandlers, useTransferHandlers, …
      components/, dialogs/
    ui/
    ts-api/src/
      client.ts, commandMap.ts, events.ts
      clients/, transports/

  docs/
  scripts/
  Cargo.toml
  pnpm-workspace.yaml
```

**Post-RC crates (not in workspace):** `git-intel`, `archive-core`, `terminal-core`, `indexer`, `content-id`.

---

## 7. Rust Crate Design

Module-level detail: [`docs/architecture/modules/`](modules/). Runtime IPC: [api-reference.md](api-reference.md).

Sections §7.2–§7.7 describe **as-built (RC)** composition. §7.8–§7.11 and long sample APIs for `git-intel`, `archive-core`, `terminal-core`, and `indexer` are **non-normative post-RC targets**—those crates are not in the workspace at RC.

## 7.1 Crate dependency direction (RC)

```text
desktop-tauri (commands)
  └─ app-core
       ├─ app-ipc (DTOs)
       ├─ vfs
       ├─ fs-core  ── file_ops/ (copy, move, archive, trash, …)
       ├─ jobs
       ├─ config
       └─ telemetry

fs-core → vfs, jobs
jobs → vfs
vfs → (domain types only; no I/O)
```

Rules:

1. `app-core` composes `VfsRegistry`, `OperationRuntime`, preferences, navigation, and history.
2. `app-ipc` defines DTOs only; Tauri handlers live in `apps/desktop-tauri`.
3. `fs-core` does not depend on Tauri.
4. Archive create/extract at RC lives in `fs-core/file_ops`, not a separate crate.
5. `platform` and parts of `config` are minimal placeholders until expanded post-RC.

---

## 7.2 `app-core` Crate (as built, RC)

### Purpose

Application composition root: boot, `AppState`, `OperationRuntime` (plan/start jobs), and SQLite operation history.

### Responsibilities (RC)

- Resolve `AppPaths` and initialize telemetry.
- Register `LocalFsProvider` on `VfsRegistry`.
- Construct `OperationRuntime` with in-memory job table and `OperationHistoryRepository`.
- Load preferences and navigation repositories (`config` crate).
- Mark interrupted operations on startup.

### Public surface (RC)

```rust
pub struct AppCore;

impl AppCore {
    pub fn boot() -> Result<Arc<AppState>, AppCoreError>;
}

pub struct AppState {
    // vfs, operations, preferences, navigation, paths — accessors on AppState
}

pub struct OperationRuntime { /* plan, start, cancel, list jobs */ }
pub struct OperationHistoryRepository { /* SQLite operation_history */ }
```

See [`modules/app-core.md`](modules/app-core.md) and `crates/app-core/src/{lib,runtime,history,paths}.rs`.

---

## 7.3 `app-ipc` Crate

### Purpose

Typed command and event boundary between the Tauri shell and Rust domain services.

### Responsibilities

- Define IPC DTOs.
- Define command request/response structures.
- Convert domain errors into frontend-safe errors.
- Register command handlers.
- Emit typed app events.

### Example Error DTO

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpcError {
    pub code: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
    pub retryable: bool,
}
```

### Command Handler Pattern

```rust
#[tauri::command]
pub async fn fs_stat(
    state: tauri::State<'_, Arc<AppState>>,
    request: StatRequest,
) -> Result<StatResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let entry = state.vfs.stat(&uri).await.map_err(IpcError::from)?;
    Ok(StatResponse { entry: entry.into() })
}
```

### IPC commands (RC)

The authoritative registry is [api-reference.md](api-reference.md) (**37 commands** as of 2026-05-17). Highlights:

```text
# Filesystem & listing
fs.stat, fs.list_start, fs.read_text_file, fs.compute_hash, fs.open_terminal, …
fs.watch_start, fs.watch_stop, fs.folder_size, fs.recursive_search_start, …

# File operations (includes archives at RC)
file_operations.plan, file_operations.start, file_operations.cancel
  # kinds: copy, move, rename, createDirectory, createFile, trash,
  #        deletePermanent, createArchive, extractArchive

# Jobs & history
jobs.list, jobs.get, jobs.cancel
operation_history.list_recent, operation_history.get

# Preferences, navigation, diagnostics, autostart
preferences.get, preferences.set, navigation.*, diagnostics.*, …
```

**Post-RC (not registered):** `git.*`, `archive.plan_extract` / `archive.start_extract` as separate domains, embedded `terminal.write` / `terminal.resize` / output events. Archives use `file_operations.*` with `createArchive` / `extractArchive` kinds.

---

## 7.4 `vfs` Crate

### Purpose

Unified abstraction over local filesystem, archive contents, and future remote/cloud/content providers.

### Core Types

```rust
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ResourceUri(String);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ProviderId(pub &'static str);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub uri: ResourceUri,
    pub name: String,
    pub extension: Option<String>,
    pub kind: FileKind,
    pub size: Option<u64>,
    pub modified_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub accessed_at: Option<DateTime<Utc>>,
    pub is_hidden: bool,
    pub is_symlink: bool,
    pub symlink_target: Option<ResourceUri>,
    pub provider_id: String,
    pub capabilities: EntryCapabilities,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FileKind {
    File,
    Directory,
    Symlink,
    Archive,
    Virtual,
    Unknown,
}
```

### Provider Trait

```rust
#[async_trait::async_trait]
pub trait VfsProvider: Send + Sync {
    fn id(&self) -> ProviderId;
    fn schemes(&self) -> &'static [&'static str];
    fn capabilities(&self) -> ProviderCapabilities;

    async fn stat(&self, uri: &ResourceUri) -> Result<FileEntry, VfsError>;

    async fn list(
        &self,
        uri: &ResourceUri,
        options: ListOptions,
        sink: DirectorySink,
    ) -> Result<(), VfsError>;

    async fn read(
        &self,
        uri: &ResourceUri,
        range: Option<ByteRange>,
    ) -> Result<ByteStream, VfsError>;

    async fn create_dir(
        &self,
        uri: &ResourceUri,
        options: CreateDirOptions,
    ) -> Result<(), VfsError>;

    async fn remove(
        &self,
        uri: &ResourceUri,
        options: RemoveOptions,
    ) -> Result<(), VfsError>;

    async fn rename(
        &self,
        from: &ResourceUri,
        to: &ResourceUri,
        options: RenameOptions,
    ) -> Result<(), VfsError>;
}
```

### VFS Registry

```rust
pub struct VfsRegistry {
    providers_by_scheme: DashMap<String, Arc<dyn VfsProvider>>,
}

impl VfsRegistry {
    pub fn new() -> Self;
    pub fn register(&self, provider: Arc<dyn VfsProvider>) -> Result<(), VfsError>;
    pub fn provider_for(&self, uri: &ResourceUri) -> Result<Arc<dyn VfsProvider>, VfsError>;
    pub async fn stat(&self, uri: &ResourceUri) -> Result<FileEntry, VfsError>;
    pub async fn list(&self, uri: &ResourceUri, options: ListOptions, sink: DirectorySink) -> Result<(), VfsError>;
}
```

### Directory Streaming

```rust
#[derive(Debug, Clone)]
pub struct DirectoryBatch {
    pub session_id: ListSessionId,
    pub uri: ResourceUri,
    pub entries: Vec<FileEntry>,
    pub batch_index: u64,
    pub is_complete: bool,
    pub total_hint: Option<u64>,
}

pub type DirectorySink = tokio::sync::mpsc::Sender<DirectoryBatch>;
```

---

## 7.5 `fs-core` Crate

### Purpose

Native local filesystem implementation and low-level safe path operations.

### Responsibilities

- Local path normalization.
- Directory enumeration.
- Metadata extraction.
- Local file read/write helpers.
- Safe rename/create/remove.
- Copy primitives.
- Platform-specific path behavior delegated to `platform` where required.

### Key APIs

```rust
pub struct LocalFsProvider {
    platform: Arc<PlatformServices>,
}

impl LocalFsProvider {
    pub fn new(platform: Arc<PlatformServices>) -> Self;
}

pub fn normalize_local_path(path: &Path) -> Result<PathBuf, FsError>;
pub fn is_probably_hidden(path: &Path, metadata: &std::fs::Metadata) -> bool;
pub async fn list_dir_batched(path: PathBuf, options: ListOptions, sink: DirectorySink) -> Result<(), FsError>;
```

### Local URI Mapping

```text
Windows:
  local://C:/Users/Ilya/Documents

Unix:
  local:///home/ilya/Documents
```

Rules:

1. Internal normalized representation must be platform-native `PathBuf`.
2. IPC representation must be canonical `local://` URI.
3. UI may show user-friendly display paths.
4. Dangerous operations must use normalized paths.

---

## 7.6 `jobs` Crate

### Purpose

Durable execution engine for long-running and dangerous operations.

### Responsibilities

- Create job records.
- Plan operations.
- Execute jobs.
- Persist job state.
- Emit job progress events.
- Support cancellation.
- Handle conflicts.
- Track per-item results.
- Recover incomplete jobs after restart.

### Core Types

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct JobId(pub Uuid);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JobKind {
    Copy,
    Move,
    Rename,
    CreateDirectory,
    Trash,
    DeletePermanent,
    ExtractArchive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JobState {
    Created,
    Planned,
    Queued,
    Running,
    Paused,
    NeedsDecision,
    Cancelling,
    Cancelled,
    Failed,
    Completed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobProgress {
    pub job_id: JobId,
    pub state: JobState,
    pub phase: String,
    pub completed_items: u64,
    pub total_items: Option<u64>,
    pub completed_bytes: u64,
    pub total_bytes: Option<u64>,
    pub current_item: Option<ResourceUri>,
    pub message: Option<String>,
}
```

### Operation Request

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationRequest {
    pub kind: JobKind,
    pub sources: Vec<ResourceUri>,
    pub destination: Option<ResourceUri>,
    pub options: OperationOptions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationOptions {
    pub conflict_policy: ConflictPolicy,
    pub use_trash: bool,
    pub preserve_timestamps: bool,
    pub follow_symlinks: bool,
}
```

### Operation Plan

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationPlan {
    pub plan_id: Uuid,
    pub kind: JobKind,
    pub sources: Vec<ResourceUri>,
    pub destination: Option<ResourceUri>,
    pub estimated_items: Option<u64>,
    pub estimated_bytes: Option<u64>,
    pub conflicts: Vec<ConflictCandidate>,
    pub warnings: Vec<OperationWarning>,
    pub reversible: bool,
}
```

### Job Manager API

```rust
pub struct JobManager {
    store: Arc<dyn JobStore>,
    vfs: Arc<VfsRegistry>,
    events: Arc<EventBus>,
    executor: JobExecutor,
}

impl JobManager {
    pub async fn plan(&self, request: OperationRequest) -> Result<OperationPlan, JobError>;
    pub async fn start(&self, plan: OperationPlan) -> Result<JobId, JobError>;
    pub async fn get(&self, id: JobId) -> Result<JobRecord, JobError>;
    pub async fn list(&self, filter: JobFilter) -> Result<Vec<JobRecord>, JobError>;
    pub async fn cancel(&self, id: JobId) -> Result<(), JobError>;
    pub async fn clear_completed(&self) -> Result<(), JobError>;
    pub async fn recover_incomplete(&self) -> Result<Vec<JobRecord>, JobError>;
}
```

### Job Store Trait

```rust
#[async_trait::async_trait]
pub trait JobStore: Send + Sync {
    async fn insert_job(&self, job: &JobRecord) -> Result<(), JobStoreError>;
    async fn update_job(&self, job: &JobRecord) -> Result<(), JobStoreError>;
    async fn insert_item_result(&self, item: &JobItemResult) -> Result<(), JobStoreError>;
    async fn get_job(&self, id: JobId) -> Result<Option<JobRecord>, JobStoreError>;
    async fn list_jobs(&self, filter: JobFilter) -> Result<Vec<JobRecord>, JobStoreError>;
    async fn list_incomplete_jobs(&self) -> Result<Vec<JobRecord>, JobStoreError>;
}
```

---

## 7.7 `platform` Crate

### Purpose

Cross-platform adapter for OS-specific operations.

### Responsibilities

- Trash/Recycle Bin integration.
- Reveal in native file manager.
- Open file with default application.
- Resolve default shell.
- Identify platform-specific paths.
- File hidden attribute detection.
- Long-path handling on Windows.
- macOS bundle and extended attribute helpers where needed.

### API

```rust
pub struct PlatformServices {
    trash: Arc<dyn TrashService>,
    shell: Arc<dyn ShellService>,
    opener: Arc<dyn OpenService>,
    paths: Arc<dyn PlatformPathService>,
}

#[async_trait::async_trait]
pub trait TrashService: Send + Sync {
    async fn trash(&self, uris: &[ResourceUri]) -> Result<Vec<TrashResult>, PlatformError>;
    fn supports_trash(&self, uri: &ResourceUri) -> bool;
}

#[async_trait::async_trait]
pub trait OpenService: Send + Sync {
    async fn reveal(&self, uri: &ResourceUri) -> Result<(), PlatformError>;
    async fn open_default(&self, uri: &ResourceUri) -> Result<(), PlatformError>;
}

pub trait ShellService: Send + Sync {
    fn default_shell(&self) -> Result<ShellSpec, PlatformError>;
}
```

---

## 7.8 `git-intel` Crate (post-RC target — not in workspace)

> Non-normative target API. Not shipped at RC.

### Purpose

Provide asynchronous Git repository information for file listings and panel status.

### Responsibilities

- Detect repository root.
- Detect branch name.
- Compute file status for visible directory.
- Cache repository metadata.
- Avoid blocking navigation.

### API

```rust
pub struct GitService {
    cache: GitCache,
}

impl GitService {
    pub async fn discover(&self, uri: &ResourceUri) -> Result<Option<GitRepoInfo>, GitError>;
    pub async fn status_for_directory(&self, uri: &ResourceUri) -> Result<GitDirectoryStatus, GitError>;
    pub async fn status_for_entries(&self, entries: &[FileEntry]) -> Result<HashMap<ResourceUri, GitFileStatus>, GitError>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitRepoInfo {
    pub root_uri: ResourceUri,
    pub branch: Option<String>,
    pub head_short: Option<String>,
    pub is_dirty: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GitFileStatus {
    Clean,
    Modified,
    Added,
    Deleted,
    Renamed,
    Untracked,
    Ignored,
    Conflicted,
    Unknown,
}
```

---

## 7.9 `archive-core` Crate (post-RC target — superseded at RC)

> At RC, zip create/extract lives in `fs-core/src/file_ops/archive.rs` via `FileOperationKind::CreateArchive` / `ExtractArchive`. The separate crate below is a post-RC consolidation option.

### Purpose

Archive extraction and later archive browsing/creation.

### Target responsibilities (post-RC)

- Identify supported archive formats.
- Plan extraction.
- Extract archive as a job.
- Prevent path traversal.
- Report progress.

### API

```rust
pub struct ArchiveService {
    jobs: Arc<JobManager>,
}

impl ArchiveService {
    pub async fn inspect(&self, uri: &ResourceUri) -> Result<ArchiveInfo, ArchiveError>;
    pub async fn plan_extract(&self, request: ExtractRequest) -> Result<OperationPlan, ArchiveError>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractRequest {
    pub archive_uri: ResourceUri,
    pub destination_uri: ResourceUri,
    pub options: ExtractOptions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractOptions {
    pub overwrite_policy: ConflictPolicy,
    pub preserve_paths: bool,
    pub allow_symlinks: bool,
}
```

### Archive Safety API

```rust
pub fn sanitize_archive_entry_path(
    destination_root: &Path,
    entry_path: &str,
) -> Result<PathBuf, ArchiveSafetyError>;
```

Rules:

1. Reject absolute paths.
2. Reject `..` traversal outside destination.
3. Reject unsafe symlinks by default.
4. Reject platform-specific reserved device paths where applicable.

---

## 7.10 `terminal-core` Crate (post-RC target — not in workspace)

> RC uses `fs_open_terminal` for external emulators only.

### Purpose

PTY process lifecycle and communication.

### Responsibilities

- Spawn terminal sessions.
- Write input to PTY.
- Read output from PTY.
- Resize PTY.
- Kill/close session.
- Emit output events.

### API

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TerminalId(pub Uuid);

pub struct TerminalService {
    sessions: DashMap<TerminalId, TerminalSessionHandle>,
    events: Arc<EventBus>,
    shell: Arc<dyn ShellService>,
}

impl TerminalService {
    pub async fn spawn(&self, request: SpawnTerminalRequest) -> Result<TerminalId, TerminalError>;
    pub async fn write(&self, id: TerminalId, data: Vec<u8>) -> Result<(), TerminalError>;
    pub async fn resize(&self, id: TerminalId, size: TerminalSize) -> Result<(), TerminalError>;
    pub async fn kill(&self, id: TerminalId) -> Result<(), TerminalError>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpawnTerminalRequest {
    pub cwd: ResourceUri,
    pub shell: Option<ShellSpec>,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSize {
    pub cols: u16,
    pub rows: u16,
}
```

---

## 7.11 `indexer` Crate (post-RC target — not in workspace)

### Target purpose

The MVP indexer should be minimal. It should not attempt full semantic indexing. It should support recent paths, basic metadata cache, and future extensibility.

### MVP Responsibilities

- Store basic metadata cache if needed.
- Track recent paths.
- Support current-tree search foundation.
- Expose future library indexing APIs.

### Future Responsibilities

- Full metadata indexing.
- Full-text extraction.
- Duplicate detection integration.
- AI metadata pipeline.
- Vector search.

### API

```rust
pub struct IndexService {
    store: Arc<dyn IndexStore>,
}

impl IndexService {
    pub async fn record_navigation(&self, uri: &ResourceUri) -> Result<(), IndexError>;
    pub async fn recent_paths(&self, limit: usize) -> Result<Vec<ResourceUri>, IndexError>;
    pub async fn search_names(&self, request: NameSearchRequest) -> Result<NameSearchResult, IndexError>;
}
```

---

## 7.12 `config` Crate

### Purpose

Settings and user preferences.

### MVP Settings

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub ui: UiSettings,
    pub file_ops: FileOperationSettings,
    pub terminal: TerminalSettings,
    pub git: GitSettings,
    pub privacy: PrivacySettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiSettings {
    pub theme: String,
    pub density: UiDensity,
    pub show_hidden_files: bool,
    pub confirm_delete: bool,
    pub confirm_permanent_delete: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileOperationSettings {
    pub default_conflict_policy: ConflictPolicy,
    pub use_trash_by_default: bool,
    pub preserve_timestamps_by_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSettings {
    pub shell_override: Option<String>,
    pub start_in_active_panel: bool,
}
```

---

## 7.13 `telemetry` Crate

### MVP Purpose

Local diagnostics and structured logging only. Product telemetry should be opt-in and can be deferred.

### Responsibilities

- Structured logs.
- Redacted diagnostics bundle.
- Panic/error reporting to local log file.
- Performance spans for internal profiling.

### API

```rust
pub fn init_logging(options: LoggingOptions) -> Result<(), TelemetryError>;
pub async fn export_diagnostics(request: DiagnosticsRequest) -> Result<DiagnosticsBundle, TelemetryError>;
```

---

## 8. IPC API Design

**Canonical contract:** [api-reference.md](api-reference.md) — full command registry, events, DTOs, and error catalog. Update that document with every boundary change.

The subsections below retain illustrative DTO samples. Dotted names map through `commandMap.ts` to snake_case Tauri handlers (e.g. `fileOperations.plan` → `file_operations_plan`).

## 8.1 IPC TypeScript Client

The frontend consumes `@fileoctopus/ts-api` rather than raw Tauri invokes.

**As implemented (RC, 2026-05-17):**

```text
packages/ts-api/src/
  client.ts              # FileOctopusClient facade + re-exports
  commandMap.ts
  events.ts
  normalizeError.ts
  types.ts
  clients/               # fs, fileOperations, jobs, history, diagnostics,
                         # preferences, navigation, autostart
  transports/            # tauri.ts, preview.ts
```

**Post-RC** — optional `clients/git.ts`, `clients/terminal.ts` when embedded Git/PTY land. Archives stay on `FileOperationsClient` at RC.

### Client Example

```ts
export class FileOctopusClient {
  fs: FsClient;
  fileOperations: FileOperationsClient;
  jobs: JobsClient;
  operationHistory: OperationHistoryClient;
  diagnostics: DiagnosticsClient;
  preferences: PreferencesClient;
  navigation: NavigationClient;
  autostart: AutostartClient;

  constructor(private transport: IpcTransport) {
    this.fs = new FsClient(transport);
    this.fileOperations = new FileOperationsClient(transport);
    this.jobs = new JobsClient(transport);
    this.operationHistory = new OperationHistoryClient(transport);
    this.diagnostics = new DiagnosticsClient(transport);
    this.preferences = new PreferencesClient(transport);
    this.navigation = new NavigationClient(transport);
    this.autostart = new AutostartClient(transport);
  }
}
```

## 8.2 Filesystem IPC

### `fs.stat`

Request:

```ts
export interface StatRequest {
  uri: string;
}
```

Response:

```ts
export interface StatResponse {
  entry: FileEntryDto;
}
```

### `fs.list_start`

Request:

```ts
export interface ListStartRequest {
  uri: string;
  options: ListOptionsDto;
}
```

Response:

```ts
export interface ListStartResponse {
  sessionId: string;
}
```

Directory batches are emitted as events:

```ts
export interface DirectoryBatchEvent {
  type: "directory.batch";
  sessionId: string;
  uri: string;
  entries: FileEntryDto[];
  batchIndex: number;
  isComplete: boolean;
  totalHint?: number;
}
```

### `fileOperations.plan` / `fileOperations.start`

At RC, mutations use `FileOperationsClient` (not `fs.plan_operation`). Kinds include `createArchive` and `extractArchive` in addition to copy/move/rename/trash.

Request (plan):

```ts
export interface FileOperationPlanRequest {
  kind:
    | "copy"
    | "move"
    | "rename"
    | "createDirectory"
    | "createFile"
    | "trash"
    | "deletePermanent"
    | "createArchive"
    | "extractArchive";
  sources: string[];
  destination?: string;
  options: FileOperationOptionsDto;
}
```

Start uses `operationId` from the returned plan. See [api-reference.md § File operations](api-reference.md).

---

## 8.3 Jobs IPC

### `jobs.list`

```ts
export interface JobsListRequest {
  state?: JobStateDto;
  limit?: number;
}

export interface JobsListResponse {
  jobs: JobSummaryDto[];
}
```

### `jobs.get`

```ts
export interface JobGetRequest {
  jobId: string;
}

export interface JobGetResponse {
  job: JobRecordDto;
}
```

### `jobs.cancel`

```ts
export interface JobCancelRequest {
  jobId: string;
}
```

### Job Event

```ts
export interface JobUpdatedEvent {
  type: "job.updated";
  jobId: string;
  state: JobStateDto;
  phase: string;
  completedItems: number;
  totalItems?: number;
  completedBytes: number;
  totalBytes?: number;
  currentItem?: string;
  message?: string;
}
```

---

## 8.4 Git IPC (post-RC — not implemented)

> Deferred. No `git.*` commands at RC.

### `git.status_for_directory` (target)

Request:

```ts
export interface GitStatusForDirectoryRequest {
  uri: string;
}
```

Response:

```ts
export interface GitStatusForDirectoryResponse {
  repo?: GitRepoInfoDto;
  entries: Record<string, GitFileStatusDto>;
}
```

---

## 8.5 Archive IPC (superseded at RC)

> At RC use `fileOperations.plan` / `start` with `extractArchive` or `createArchive`. The separate `archive.*` IPC below is a historical target.

### `archive.plan_extract` (target)

```ts
export interface ArchivePlanExtractRequest {
  archiveUri: string;
  destinationUri: string;
  options: ExtractOptionsDto;
}
```

### `archive.start_extract`

```ts
export interface ArchiveStartExtractRequest {
  planId: string;
}
```

Response:

```ts
export interface ArchiveStartExtractResponse {
  jobId: string;
}
```

---

## 8.6 Terminal IPC (post-RC embedded — not implemented)

> RC: `fs.open_terminal` only (external emulator). PTY IPC below is post-RC.

### `terminal.spawn` (target)

```ts
export interface TerminalSpawnRequest {
  cwd: string;
  shell?: string;
  cols: number;
  rows: number;
}

export interface TerminalSpawnResponse {
  terminalId: string;
}
```

### `terminal.write`

```ts
export interface TerminalWriteRequest {
  terminalId: string;
  dataBase64: string;
}
```

### `terminal.resize`

```ts
export interface TerminalResizeRequest {
  terminalId: string;
  cols: number;
  rows: number;
}
```

### Terminal Output Event

```ts
export interface TerminalOutputEvent {
  type: "terminal.output";
  terminalId: string;
  dataBase64: string;
}
```

---

## 9. SQLite Schema

## 9.1 As built (RC)

Operation history in `crates/app-core/src/history.rs`:

```sql
CREATE TABLE schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE operation_history (
  job_id TEXT PRIMARY KEY,
  operation_kind TEXT NOT NULL,
  source_count INTEGER NOT NULL,
  representative_source_path TEXT,
  destination_path TEXT,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  error_code TEXT
);
```

Preferences and navigation use separate stores in the `config` crate (not the history DB). Live job snapshots are **in-memory** in `OperationRuntime` until a post-RC durable job schema lands.

## 9.2 Target schema (post-RC)

Illustrative full job journal (not implemented at RC):

```sql
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE job (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  request_json TEXT NOT NULL,
  plan_json TEXT,
  completed_items INTEGER NOT NULL DEFAULT 0,
  total_items INTEGER,
  completed_bytes INTEGER NOT NULL DEFAULT 0,
  total_bytes INTEGER,
  current_item_uri TEXT,
  error_code TEXT,
  error_message TEXT
);

CREATE INDEX idx_job_state ON job(state);
CREATE INDEX idx_job_created_at ON job(created_at);

CREATE TABLE job_item_result (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  source_uri TEXT NOT NULL,
  destination_uri TEXT,
  state TEXT NOT NULL,
  bytes_processed INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(job_id) REFERENCES job(id)
);

CREATE INDEX idx_job_item_result_job_id ON job_item_result(job_id);

CREATE TABLE recent_path (
  uri TEXT PRIMARY KEY,
  last_opened_at TEXT NOT NULL,
  open_count INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE app_setting (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## 10. Event Bus Design

At RC, the desktop shell emits Tauri events directly from listing sessions and `OperationRuntime` (see [api-reference.md § Event channels](api-reference.md)). A unified internal `EventBus` with Git/terminal variants is a post-RC consolidation target.

## 10.1 Internal Event Bus (target)

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CoreEvent {
    DirectoryBatch(DirectoryBatchEvent),
    JobUpdated(JobProgress),
    JobCompleted(JobId),
    JobFailed(JobFailureEvent),
    // GitDirectoryStatusUpdated, TerminalOutput — post-RC
    Notification(NotificationEvent),
}

pub struct EventBus {
    tx: tokio::sync::broadcast::Sender<CoreEvent>,
}

impl EventBus {
    pub fn subscribe(&self) -> tokio::sync::broadcast::Receiver<CoreEvent>;
    pub fn publish(&self, event: CoreEvent) -> Result<(), EventBusError>;
}
```

## 10.2 Tauri Event Bridge

The Tauri shell subscribes to `EventBus` and forwards frontend-safe events to the active window.

Rules:

1. Redact sensitive paths only if privacy mode requires it.
2. Do not forward raw internal errors with stack traces.
3. Preserve event ordering per job/session where possible.
4. Throttle high-frequency progress events.

---

## 11. Frontend Engineering Design

See [`modules/frontend.md`](modules/frontend.md). Entry point: `FileOctopusShell` in `packages/frontend/src/index.tsx`.

## 11.1 Frontend package layout (RC)

```text
packages/frontend/src/
  index.tsx              # FileOctopusShell, wiring, dialogs
  panelStore.ts          # panelReducer, tabs, selection, sort/filter
  shell/
    ShellLayout.tsx
    TitleBar.tsx
    MenuBar.tsx          # File/Edit/View/Go/Tools/Window/Help (partial stubs)
  pane/
    FilePanel.tsx
    OperationToolbar.tsx
    FileTable.tsx
    PathBar.tsx
  hooks/
    useFileOpHandlers.ts
    fileOps/             # useArchiveHandlers, useTransferHandlers, …
    useMenuBarProps.ts
  components/            # ContextMenu, JobActivityPanel, ToastStack, …
  dialogs/               # OperationDialogView, settings, shortcuts, diagnostics
```

## 11.2 Panel State Model

```ts
export interface PanelState {
  id: string;
  activeTabId: string;
  tabs: Record<string, PanelTabState>;
}

export interface PanelTabState {
  id: string;
  uri: string;
  title: string;
  historyBack: string[];
  historyForward: string[];
  selection: SelectionState;
  sort: SortSpec;
  filter: string;
  listSessionId?: string;
  entriesById: Record<string, FileEntryDto>;
  orderedEntryIds: string[];
  loading: boolean;
  error?: string;
}

export interface SelectionState {
  focusedEntryId?: string;
  selectedEntryIds: string[];
  anchorEntryId?: string;
}
```

## 11.3 UI Components

| Component             | Responsibility                            |
| --------------------- | ----------------------------------------- |
| `DualPaneLayout`      | Layout container and active panel focus.  |
| `FilePanel`           | Panel state binding.                      |
| `FileTable`           | Virtualized file list.                    |
| `PathBar`             | Breadcrumb and path input.                |
| `MenuBar`             | Application menu (partial wiring).        |
| `JobActivityPanel`    | Running jobs + operation history.         |
| `OperationDialogView` | Conflict resolution for planned ops.      |
| `CommandPalette`      | Keyboard-accessible command execution.    |
| `PreviewPanel`        | Basic text preview (Space on text files). |

---

## 12. Security Requirements for RC

## 12.1 Frontend Restrictions

- Do not enable unrestricted filesystem plugin permissions.
- Do not expose shell execution to frontend except through validated Rust commands (`fs_open_terminal` at RC).
- Do not store secrets in frontend local storage.
- Do not render untrusted HTML previews in privileged context.
- Do not execute scripts from file previews.

## 12.2 Backend Validation

Every file operation must validate:

1. URI scheme is supported.
2. URI parses correctly.
3. Provider exists.
4. Provider supports requested capability.
5. Destination path is valid.
6. Source exists where required.
7. Conflict policy is valid.
8. Operation is not attempting archive traversal or unsafe path escape.

## 12.3 Archive Extraction Controls

- Reject absolute paths inside archive.
- Reject `..` escaping destination.
- Reject unsafe symlink extraction by default.
- Validate final normalized destination path starts with extraction root.
- Limit extremely deep path nesting.
- Limit suspicious decompression ratio where practical.

---

## 13. Testing Specification

## 13.1 Rust Unit Tests

Required tests:

```text
vfs_uri_parse_windows_path
vfs_uri_parse_unix_path
vfs_reject_invalid_scheme
local_path_normalization
conflict_policy_keep_both
conflict_policy_skip
operation_plan_detects_existing_destination
job_cancel_copy
job_store_persists_job
archive_rejects_dotdot_traversal
archive_rejects_absolute_path
trash_fallback_behavior
```

## 13.2 Rust Integration Tests

Required scenarios:

1. Copy nested directory tree.
2. Copy many small files.
3. Move directory across same volume.
4. Move directory across different volume fallback copy/delete.
5. Rename file.
6. Delete to trash where supported.
7. Permanent delete with explicit flag.
8. Extract safe archive.
9. Reject malicious archive.
10. Recover job history after restart.

## 13.3 Frontend Tests

Required tests:

1. Panel navigation.
2. Keyboard selection.
3. Multi-select.
4. Range select.
5. Sorting.
6. Filtering.
7. Job progress display.
8. Conflict dialog selection.
9. Command palette action execution.
10. Terminal component mount/unmount.

## 13.4 Performance Tests

Test tree generator should support:

```bash
fileoctopus-test-tree --root ./tmp/100k --files 100000 --dirs 1000 --max-depth 5
fileoctopus-test-tree --root ./tmp/small-files --files 10000 --size 1024
fileoctopus-test-tree --root ./tmp/large-files --files 10 --size 1073741824
```

Required performance tests:

1. Open 10k file directory.
2. Open 100k file directory.
3. Sort 100k entries by name.
4. Sort 100k entries by modified time.
5. Copy 10k small files.
6. Copy 10 large files.
7. Cancel copy mid-operation.
8. Watcher event storm simulation.

---

## 14. Error Model

## 14.1 Error Categories

```rust
pub enum AppErrorKind {
    InvalidInput,
    InvalidUri,
    UnsupportedProvider,
    UnsupportedOperation,
    PermissionDenied,
    NotFound,
    AlreadyExists,
    Conflict,
    Io,
    Cancelled,
    Platform,
    ArchiveSafety,
    Git,
    Terminal,
    Database,
    Internal,
}
```

## 14.2 Frontend Error DTO

```ts
export interface AppErrorDto {
  code: string;
  category: string;
  message: string;
  userMessage: string;
  retryable: boolean;
  details?: unknown;
}
```

Rules:

1. `message` may be technical.
2. `userMessage` must be safe and understandable.
3. Internal stack traces must not be sent to UI by default.
4. Logs may contain diagnostic context but must avoid secrets.

---

## 15. Development Standards

## 15.1 Rust Standards

- Use `tokio` for async runtime.
- Use `tracing` for structured logs.
- Use `thiserror` for domain errors.
- Use `serde` for DTOs.
- Use `uuid` for job/session IDs.
- Use `chrono` or `time` consistently for timestamps.
- Avoid `unwrap()` in production paths.
- Keep unsafe Rust out of RC unless strictly necessary.

## 15.2 TypeScript Standards

- Strict TypeScript.
- No raw Tauri invoke calls outside API client layer.
- No direct business logic in presentational components.
- Use stable IDs for file rows.
- Avoid rendering unbounded arrays.
- Keep keyboard logic testable.

## 15.3 API Versioning

IPC DTOs should include implicit app version compatibility during RC. Before 1.0, breaking changes are allowed. After 1.0, API versioning should be explicit for plugin support.

---

## 16. RC release checklist

Use the living checklist: **[mvp-rc-checklist.md](../release/mvp-rc-checklist.md)**.

Summary buckets:

| Bucket       | Examples                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------- |
| Build        | `pnpm rc:validate`, `pnpm tauri:build`, artifact under `target/release/bundle`            |
| Automated QA | `pnpm test:backend:rc`, `pnpm test:frontend:rc`, CI `release-candidate` workflow          |
| Manual QA    | `docs/qa/sprint-3-smoke-test.md`, `docs/qa/sprint-4-baseline-qa.md`, performance captures |
| Go/No-Go     | Owner, date, accepted non-blockers                                                        |

RC engineering gate: §4 criteria **Met** or **Deferred** with owner sign-off; zip-slip and ADR-0002 boundaries covered by automated tests.

---

## 17. Post-RC priorities

Ordered backlog after RC (see also [PROJECT_STATUS_AND_DOC_ALIGNMENT.md](../planning/PROJECT_STATUS_AND_DOC_ALIGNMENT.md)):

1. Complete menu bar wiring per [Menu & Modal Spec](../plans/FileOctopus_Menu_and_Modal_Specification.md).
2. `git-intel` — branch display and file badges (MVP-GIT-\*).
3. Embedded terminal (`terminal-core` + xterm panel).
4. Multi-tab per pane.
5. Tar and additional archive formats; optional `archive-core` extraction.
6. Durable `job` / `job_item_result` SQLite schema and recovery.
7. Formal MVP-PERF-\* sign-off per `docs/testing/`.
8. 1.0 packaging, signing, and platform QA matrix.

---

## 18. RC definition of done

FileOctopus v0.1.0 RC is done when:

1. A technical user can rely on it daily for local navigation, copy/move/rename, trash, zip archive jobs, and operation history—with responsive large directories and visible job progress.
2. RC packages build on target platforms and the [mvp-rc-checklist.md](../release/mvp-rc-checklist.md) is signed off.
3. The architecture remains safe (typed IPC, planned mutations, path normalization) and extensible for post-RC workflow features.

RC is **not** gated on Git decorations, embedded terminal, multi-tab panes, tar archives, or the full job SQLite schema in §9.2—those are explicit post-RC goals in §3.2 and §17.
