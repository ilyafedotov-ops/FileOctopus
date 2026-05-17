# FileOctopus MVP Engineering Specification and Rust Crate/API Design

## 1. Document Purpose

This document translates the FileOctopus technical architecture into an implementation-ready MVP specification. It defines the minimum viable product scope, engineering milestones, crate boundaries, public Rust APIs, IPC contracts, data structures, testing strategy, and acceptance criteria required to build the first usable desktop release.

The MVP is intentionally focused on a high-performance local dual-pane file manager. Advanced capabilities such as peer-to-peer synchronization, full local AI indexing, and broad cloud provider support are deferred, but the MVP architecture must not block them.

### Implementation status (2026-05-17)

| Area                               | Delivered                                                                                                                                              | Not delivered                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Core navigation & file ops         | Dual pane, streamed listing, virtualization, plan/start jobs, operation history; decomposed `fs-core`/`app-core`/Tauri `commands/*`/ts-api `clients/*` | Multi-tab per panel                                                                |
| Jobs & persistence                 | In-memory jobs + SQLite operation history                                                                                                              | Full `job` / `job_item_result` schema from §9                                      |
| Git / archives / embedded terminal | —                                                                                                                                                      | `git-intel`, `archive-core`, `terminal-core` crates; MVP-GIT/ARC/embedded terminal |
| UI (MVP §3.1)                      | Command palette, context menus, activity panel, preview, theme prefs                                                                                   | App menu bar per Menu spec                                                         |
| Platform                           | Windows/macOS/Linux builds in CI                                                                                                                       | Formal MVP §16 release sign-off                                                    |

Authoritative cross-doc matrix: [PROJECT_STATUS_AND_DOC_ALIGNMENT.md](../planning/PROJECT_STATUS_AND_DOC_ALIGNMENT.md). Runtime IPC: [api-reference.md](api-reference.md).

---

## 2. MVP Product Definition

## 2.1 MVP Goal

Deliver a fast, reliable, cross-platform dual-pane file manager with safe local file operations, durable job execution, virtualized large-directory rendering, keyboard-first navigation, basic Git awareness, basic archive extraction, and an embedded terminal.

## 2.2 MVP User Persona

Primary user:

- IT infrastructure consultant
- Developer
- DevOps engineer
- System administrator
- Power user managing large directory trees, repositories, archives, logs, VM images, scripts, backups, and cloud/remote assets

## 2.3 MVP Value Proposition

FileOctopus MVP should prove three things:

1. It is faster and more responsive than default OS file managers in large folders.
2. It is safer and more controllable than ad-hoc shell operations for bulk file tasks.
3. It is more workflow-oriented than legacy dual-pane tools because Git, terminal, jobs, and modern UI are built into the core design.

---

## 3. MVP Scope

## 3.1 Included in MVP

### Core Navigation

- Dual-pane file browsing.
- Tabs per panel.
- Breadcrumb navigation.
- Editable path bar.
- Back/forward history.
- Keyboard navigation.
- Configurable shortcuts foundation.
- Hidden file toggle.
- Basic sorting by name, extension, size, modified time, and type.
- Basic filtering in current directory.

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

- Job creation.
- Job queue.
- Job progress events.
- Job cancellation.
- Job failure reporting.
- SQLite job journal.
- Job recovery inspection after app restart.

### Git Integration v1

- Detect Git repository root.
- Display current branch for active panel.
- Show basic file status badges:
  - modified
  - added
  - deleted
  - untracked
  - ignored
  - clean
- Avoid blocking initial directory rendering.

### Archive Support v1

- List common archive metadata where practical.
- Extract zip and tar archives.
- Extract zstd/lz4-compressed tar where supported by implementation.
- Prevent archive path traversal.
- Show extraction progress as a job.

### Embedded Terminal v1

- Open terminal panel.
- Spawn default shell.
- Terminal starts in active panel directory.
- Sync terminal cwd manually through command.
- Resize terminal with UI.
- Close terminal safely.

### UI/UX

- Two-pane layout.
- Command palette.
- Context menu.
- Job queue panel.
- Basic file preview panel for text files.
- Theme system foundation using design tokens.
- Light/dark mode.

### Platform Support

- Windows 10/11.
- macOS current supported releases.
- Common Linux desktop distributions.

---

## 3.2 Excluded from MVP

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

## 4. MVP Acceptance Criteria

## 4.1 Functional Acceptance Criteria

| ID           | Requirement             | Acceptance Criteria                                                         |
| ------------ | ----------------------- | --------------------------------------------------------------------------- |
| MVP-FS-001   | Directory navigation    | User can navigate local filesystem in both panels.                          |
| MVP-FS-002   | Large directory listing | Folder with 100,000 files opens without UI freeze.                          |
| MVP-FS-003   | Copy operation          | User can copy files/folders between panels with progress.                   |
| MVP-FS-004   | Move operation          | User can move files/folders between panels with progress.                   |
| MVP-FS-005   | Rename                  | User can rename selected item.                                              |
| MVP-FS-006   | New folder              | User can create a folder in active panel.                                   |
| MVP-FS-007   | Trash/delete            | User can send items to OS trash where supported.                            |
| MVP-FS-008   | Conflict handling       | User is prompted when destination conflict occurs.                          |
| MVP-JOB-001  | Job queue               | Long operations appear in job queue.                                        |
| MVP-JOB-002  | Cancellation            | Running copy/move/extract jobs can be cancelled.                            |
| MVP-JOB-003  | Failure visibility      | Failed jobs expose error detail.                                            |
| MVP-JOB-004  | Restart persistence     | Previous jobs remain inspectable after restart.                             |
| MVP-GIT-001  | Git branch              | Active panel shows repository branch when inside Git repo.                  |
| MVP-GIT-002  | Git badges              | File list shows basic Git status badges asynchronously.                     |
| MVP-ARC-001  | Archive extraction      | User can extract zip/tar archive to selected destination.                   |
| MVP-ARC-002  | Archive safety          | Malicious archive path traversal is blocked.                                |
| MVP-TERM-001 | Terminal open           | User can open terminal in active panel path.                                |
| MVP-UI-001   | Keyboard flow           | Core actions can be executed through keyboard shortcuts or command palette. |
| MVP-SEC-001  | No direct FS frontend   | Frontend has no unrestricted generic filesystem access.                     |

## 4.2 Performance Acceptance Criteria

| ID           | Scenario                     |                                                               Target |
| ------------ | ---------------------------- | -------------------------------------------------------------------: |
| MVP-PERF-001 | Cold start to visible window |                  Under 1.5 seconds on modern laptop target hardware. |
| MVP-PERF-002 | Warm start                   |                                        Under 700 ms where practical. |
| MVP-PERF-003 | 10k file directory           |                                                   No visible freeze. |
| MVP-PERF-004 | 100k file directory          |                       Incremental listing with responsive scrolling. |
| MVP-PERF-005 | Copy 10k small files         | Progress updates at least every 250 ms or meaningful batch interval. |
| MVP-PERF-006 | UI event loop                |                                  No file operation blocks UI thread. |

## 4.3 Reliability Acceptance Criteria

| ID          | Requirement              | Acceptance Criteria                                                                          |
| ----------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| MVP-REL-001 | Cancellation consistency | Cancelled copy leaves known partial state and reports it.                                    |
| MVP-REL-002 | Job persistence          | App restart does not lose job history.                                                       |
| MVP-REL-003 | Error handling           | Permission denied, path missing, disk full, and destination conflict are handled gracefully. |
| MVP-REL-004 | Path safety              | Paths are normalized before dangerous operations.                                            |
| MVP-REL-005 | Archive safety           | Archive extraction blocks zip-slip style payloads.                                           |

---

## 5. Engineering Milestones

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

### Deliverables

- `git-intel` crate.
- `archive-core` crate.
- `terminal-core` crate.
- Git branch and status badges.
- Archive extraction job.
- Embedded terminal panel.

### Done Criteria

- Active Git branch is visible.
- File status badges appear asynchronously.
- Zip/tar archive extracts safely.
- Terminal opens in active panel path.

---

## 5.6 Milestone 5: MVP Hardening

### Deliverables

- Error handling pass.
- Logging and diagnostics.
- Cross-platform test pass.
- Installer packaging.
- Performance profiling.
- Basic documentation.

### Done Criteria

- MVP acceptance criteria pass.
- No known data-loss bug remains open.
- Release candidate packages are generated for target platforms.

---

## 6. Recommended Repository Layout

```text
fileoctopus/
  apps/
    desktop-tauri/
      src-tauri/
      src/
      package.json
      tauri.conf.json
    cli/
      src/
      Cargo.toml

  crates/
    app-core/
    app-ipc/
    fs-core/
    vfs/
    jobs/
    indexer/
    git-intel/
    archive-core/
    terminal-core/
    content-id/
    platform/
    config/
    telemetry/
    test-support/

  packages/
    frontend/
    ui/
    ts-api/

  docs/
    architecture/
    adr/
    security/
    testing/

  scripts/
    generate-test-tree/
    package/

  Cargo.toml
  package.json
  pnpm-workspace.yaml
```

---

## 7. Rust Crate Design

## 7.1 Crate Dependency Direction

Dependency direction should be strict.

```text
app-core
  ├─ app-ipc
  ├─ vfs
  ├─ fs-core
  ├─ jobs
  ├─ git-intel
  ├─ archive-core
  ├─ terminal-core
  ├─ indexer
  ├─ platform
  └─ config

app-ipc
  ├─ shared DTOs only
  └─ no platform-specific logic

jobs
  ├─ vfs
  ├─ platform
  └─ config

vfs
  ├─ fs-core
  └─ shared domain types
```

Rules:

1. `app-core` composes services.
2. `app-ipc` exposes DTOs and handlers, not business logic.
3. `fs-core` does not know about Tauri.
4. `jobs` does not know about frontend framework.
5. `vfs` is provider-oriented and async.
6. `platform` hides OS-specific behavior.
7. No crate other than `app-core` should own global application state.

---

## 7.2 `app-core` Crate

### Purpose

Application composition root. Owns dependency injection, service startup, service shutdown, application state, and cross-service coordination.

### Responsibilities

- Initialize config.
- Initialize database.
- Initialize VFS registry.
- Initialize job manager.
- Initialize event bus.
- Initialize platform services.
- Register local provider.
- Register archive provider.
- Register terminal service.
- Expose `AppState` to Tauri command handlers.

### Public API

```rust
pub struct AppCore {
    pub state: Arc<AppState>,
}

pub struct AppState {
    pub config: Arc<ConfigService>,
    pub events: Arc<EventBus>,
    pub vfs: Arc<VfsRegistry>,
    pub jobs: Arc<JobManager>,
    pub git: Arc<GitService>,
    pub archive: Arc<ArchiveService>,
    pub terminal: Arc<TerminalService>,
    pub platform: Arc<PlatformServices>,
}

impl AppCore {
    pub async fn boot(options: BootOptions) -> Result<Self>;
    pub async fn shutdown(&self) -> Result<()>;
}

pub struct BootOptions {
    pub app_data_dir: PathBuf,
    pub config_dir: PathBuf,
    pub log_dir: PathBuf,
    pub profile: AppProfile,
}
```

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

### IPC Commands for MVP

```text
fs.stat
fs.list_start
fs.list_cancel
fs.plan_operation
fs.start_operation
fs.reveal_native

jobs.list
jobs.get
jobs.cancel
jobs.clear_completed

git.status_for_directory

archive.plan_extract
archive.start_extract

terminal.spawn
terminal.write
terminal.resize
terminal.kill

settings.get
settings.update
app.get_platform_info
```

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

## 7.8 `git-intel` Crate

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

## 7.9 `archive-core` Crate

### Purpose

Archive extraction and later archive browsing/creation.

### MVP Responsibilities

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

## 7.10 `terminal-core` Crate

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

## 7.11 `indexer` Crate

### MVP Purpose

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

## 8.1 IPC TypeScript Client

The frontend should consume a typed API wrapper rather than calling raw Tauri commands directly throughout the UI.

**As implemented (2026-05-17):**

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

**Target (post-MVP)** — additional clients when `git-intel`, `archive-core`, and `terminal-core` land:

```text
  clients/git.ts, archive.ts, terminal.ts  # not present yet
```

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

### `fs.plan_operation`

Request:

```ts
export interface PlanOperationRequest {
  kind:
    | "copy"
    | "move"
    | "rename"
    | "createDirectory"
    | "trash"
    | "deletePermanent";
  sources: string[];
  destination?: string;
  options: OperationOptionsDto;
}
```

Response:

```ts
export interface PlanOperationResponse {
  plan: OperationPlanDto;
}
```

### `fs.start_operation`

Request:

```ts
export interface StartOperationRequest {
  planId: string;
  conflictPolicy?: ConflictPolicyDto;
}
```

Response:

```ts
export interface StartOperationResponse {
  jobId: string;
}
```

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

## 8.4 Git IPC

### `git.status_for_directory`

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

## 8.5 Archive IPC

### `archive.plan_extract`

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

## 8.6 Terminal IPC

### `terminal.spawn`

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

## 9. SQLite Schema for MVP

## 9.1 Tables

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

## 10.1 Internal Event Bus

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CoreEvent {
    DirectoryBatch(DirectoryBatchEvent),
    JobUpdated(JobProgress),
    JobCompleted(JobId),
    JobFailed(JobFailureEvent),
    GitDirectoryStatusUpdated(GitDirectoryStatusEvent),
    TerminalOutput(TerminalOutputEvent),
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

## 11.1 Frontend Package Layout

```text
packages/frontend/src/
  app/
    App.tsx
    providers/
    routes/
  features/
    panels/
    files/
    jobs/
    git/
    terminal/
    archive/
    settings/
    command-palette/
  components/
    virtual-table/
    dialogs/
    layout/
    icons/
  state/
    panelStore.ts
    jobStore.ts
    settingsStore.ts
  api/
    client.ts
  styles/
    tokens.css
    themes/
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

| Component        | Responsibility                           |
| ---------------- | ---------------------------------------- |
| `DualPaneLayout` | Layout container and active panel focus. |
| `FilePanel`      | Panel state binding.                     |
| `FileTable`      | Virtualized file list.                   |
| `PathBar`        | Breadcrumb and path input.               |
| `PanelTabs`      | Tabs per panel.                          |
| `JobQueuePanel`  | Running/completed/failed jobs.           |
| `ConflictDialog` | Conflict resolution decisions.           |
| `CommandPalette` | Keyboard-accessible command execution.   |
| `TerminalPanel`  | xterm.js wrapper.                        |
| `PreviewPanel`   | Basic text preview.                      |

---

## 12. Security Requirements for MVP

## 12.1 Frontend Restrictions

- Do not enable unrestricted filesystem plugin permissions.
- Do not expose shell execution to frontend except via `terminal-core`.
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
- Keep unsafe Rust out of MVP unless strictly necessary.

## 15.2 TypeScript Standards

- Strict TypeScript.
- No raw Tauri invoke calls outside API client layer.
- No direct business logic in presentational components.
- Use stable IDs for file rows.
- Avoid rendering unbounded arrays.
- Keep keyboard logic testable.

## 15.3 API Versioning

IPC DTOs should include implicit app version compatibility during MVP. Before 1.0, breaking changes are allowed. After 1.0, API versioning should be explicit for plugin support.

---

## 16. MVP Release Checklist

### Engineering

- [ ] All MVP functional acceptance criteria pass.
- [ ] All MVP reliability acceptance criteria pass.
- [ ] Large directory performance test passes.
- [ ] Job cancellation test passes.
- [ ] Archive traversal tests pass.
- [ ] No unrestricted frontend filesystem access.
- [ ] Logs are structured.
- [ ] Diagnostics bundle works.

### Product

- [ ] Keyboard shortcut map documented.
- [ ] Basic onboarding or help screen exists.
- [ ] Settings are discoverable.
- [ ] Error messages are user-readable.
- [ ] Dark/light themes work.

### Platform

- [ ] Windows build signed or prepared for signing.
- [ ] macOS build signed/notarization plan ready.
- [ ] Linux package tested on at least two distributions.
- [ ] App data paths are platform-correct.
- [ ] Trash behavior verified per OS.

---

## 17. Immediate Next Implementation Steps

> **Historical (Milestone 0–1).** Completed on `main` as of 2026-05-16. Current priorities: Milestone 4 (`git-intel`, `archive-core`, embedded `terminal-core`), Menu & Modal Spec application menu bar, and MVP §16 hardening. See [PROJECT_STATUS_AND_DOC_ALIGNMENT.md](../planning/PROJECT_STATUS_AND_DOC_ALIGNMENT.md).

1. ~~Create monorepo structure.~~
2. ~~Scaffold Tauri v2 desktop app.~~
3. ~~Create Rust workspace and empty crates.~~
4. ~~Implement `ResourceUri` parsing.~~
5. ~~Implement `LocalFsProvider.stat` and `LocalFsProvider.list`.~~
6. ~~Implement directory batch streaming.~~
7. ~~Build dual-pane UI shell.~~
8. ~~Integrate virtualized file table.~~
9. ~~Add `JobManager` skeleton and SQLite migration system.~~
10. ~~Implement copy job vertical slice.~~

---

## 18. MVP Definition of Done

The MVP is done when a technical user can use FileOctopus as a daily local file manager for normal navigation and file operations, while the product demonstrates clear superiority in responsiveness, job visibility, and workflow integration over basic OS file managers.

The MVP should not be judged by the number of advanced features. It should be judged by whether its core architecture is safe, fast, extensible, and reliable enough to support the larger FileOctopus product vision.
