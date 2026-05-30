# FileOctopus Sprint 0 / Sprint 1 Implementation Backlog

## 1. Purpose

This document converts the FileOctopus MVP engineering specification into concrete GitHub-ready issues for Sprint 0 and Sprint 1.

The goal is to move from architecture to executable engineering work while preserving the core product constraints:

1. Tauri v2 desktop shell.
2. Rust owns all privileged operations.
3. Frontend has no unrestricted filesystem access.
4. Directory listing is streamed and virtualized.
5. MVP architecture must support future durable jobs, Git, terminal, archive, indexing, cloud, local-first sync, and AI.

---

## 2. Sprint Structure

## Sprint 0: Engineering Foundation

### Sprint Goal

Create the repository, build system, workspace skeleton, coding standards, CI foundation, and minimal Tauri application shell required for feature development.

### Duration

Recommended: 1 week.

### Sprint 0 Outcome

At the end of Sprint 0, the team should have a working monorepo that launches a minimal Tauri desktop app, builds the Rust workspace, builds the frontend, runs tests, enforces formatting/linting, and contains architecture decision records for the main MVP technical choices.

---

## Sprint 1: Local Navigation Vertical Slice

### Sprint Goal

Implement the first end-to-end local filesystem navigation slice: `local://` URI parsing, local filesystem provider, streamed directory listing, typed IPC, frontend dual-pane shell, virtualized file table, and basic keyboard navigation.

### Duration

Recommended: 2 weeks.

### Sprint 1 Outcome

At the end of Sprint 1, a user should be able to launch FileOctopus, view two panels, navigate local directories, see streamed directory batches, and open a synthetic folder with 100,000 entries without freezing the UI.

---

## 3. Recommended GitHub Labels

Create these labels before issue creation.

| Label              | Purpose                                    |
| ------------------ | ------------------------------------------ |
| `area:repo`        | Repository, monorepo, tooling.             |
| `area:tauri`       | Tauri shell and desktop integration.       |
| `area:rust-core`   | Rust application core.                     |
| `area:vfs`         | Virtual filesystem and URI model.          |
| `area:fs-core`     | Local filesystem provider.                 |
| `area:ipc`         | Rust/frontend IPC contracts.               |
| `area:frontend`    | Frontend application.                      |
| `area:ui`          | UI components and layout.                  |
| `area:testing`     | Unit, integration, E2E, performance tests. |
| `area:ci`          | CI/CD and build automation.                |
| `area:docs`        | Documentation and ADRs.                    |
| `type:feature`     | New product or platform capability.        |
| `type:task`        | Engineering task.                          |
| `type:bug`         | Defect.                                    |
| `type:chore`       | Maintenance.                               |
| `type:spike`       | Investigation or proof of concept.         |
| `priority:p0`      | Blocks all development or MVP feasibility. |
| `priority:p1`      | Required for current sprint goal.          |
| `priority:p2`      | Important but not immediately blocking.    |
| `risk:high`        | Requires extra review/testing.             |
| `good-first-issue` | Safe for new contributors.                 |

---

## 4. Recommended GitHub Milestones

Create these milestones:

1. `Sprint 0 - Engineering Foundation`
2. `Sprint 1 - Local Navigation Vertical Slice`
3. `MVP - Local File Operations`
4. `MVP - Hardening`

This document covers only the first two milestones.

---

# 5. Sprint 0 Backlog

## FO-0001: Initialize monorepo structure

**Milestone:** Sprint 0 - Engineering Foundation  
**Labels:** `area:repo`, `type:task`, `priority:p0`  
**Estimate:** 2 points

### Description

Create the initial FileOctopus monorepo layout with separate areas for desktop app, Rust crates, frontend packages, documentation, and scripts.

### Proposed Structure

```text
fileoctopus/
  apps/
    desktop-tauri/
    cli/
  crates/
    app-core/
    app-ipc/
    vfs/
    fs-core/
    jobs/
    platform/
    config/
    telemetry/
    test-support/
  packages/
    frontend/
    ui/
    ts-api/
  docs/
    adr/
    architecture/
    security/
    testing/
  scripts/
  Cargo.toml
  package.json
  pnpm-workspace.yaml
  README.md
```

### Tasks

- [ ] Create root directory layout.
- [ ] Add root `README.md`.
- [ ] Add root `.gitignore`.
- [ ] Add root `Cargo.toml` workspace.
- [ ] Add root `package.json`.
- [ ] Add `pnpm-workspace.yaml` or equivalent package manager workspace file.
- [ ] Add placeholder README files in major directories.

### Acceptance Criteria

- [ ] Repository has the proposed top-level structure.
- [ ] `cargo metadata` succeeds from repository root.
- [ ] Package manager workspace command succeeds from repository root.
- [ ] README explains local development prerequisites.

### Dependencies

None.

---

## FO-0002: Scaffold Tauri v2 desktop application

**Milestone:** Sprint 0 - Engineering Foundation  
**Labels:** `area:tauri`, `area:frontend`, `type:task`, `priority:p0`  
**Estimate:** 3 points

### Description

Create a minimal Tauri v2 desktop application under `apps/desktop-tauri` with a placeholder frontend and a Rust shell capable of launching an empty FileOctopus window.

### Tasks

- [ ] Scaffold Tauri v2 app.
- [ ] Configure app name as `FileOctopus`.
- [ ] Configure development command for frontend.
- [ ] Configure build command for frontend.
- [ ] Set basic app window title.
- [ ] Add placeholder landing screen.
- [ ] Verify app launches on development machine.

### Acceptance Criteria

- [ ] `pnpm dev` or equivalent launches the Tauri app.
- [ ] Window title is `FileOctopus`.
- [ ] App displays placeholder screen.
- [ ] No filesystem plugin with unrestricted access is enabled.

### Dependencies

- FO-0001

---

## FO-0003: Configure Rust workspace crates

**Milestone:** Sprint 0 - Engineering Foundation  
**Labels:** `area:rust-core`, `type:task`, `priority:p0`  
**Estimate:** 3 points

### Description

Create empty Rust crates required for the MVP architecture and wire them into the workspace.

### Crates

```text
crates/app-core
crates/app-ipc
crates/vfs
crates/fs-core
crates/jobs
crates/platform
crates/config
crates/telemetry
crates/test-support
```

### Tasks

- [ ] Create each crate with `Cargo.toml` and `src/lib.rs`.
- [ ] Add crate-level documentation comments.
- [ ] Add minimal compile tests.
- [ ] Configure dependencies only where required.
- [ ] Ensure crates do not depend on Tauri unless explicitly needed.

### Acceptance Criteria

- [ ] `cargo check --workspace` succeeds.
- [ ] `cargo test --workspace` succeeds.
- [ ] Crate dependency direction follows architecture rules.
- [ ] No business logic is placed in the Tauri shell.

### Dependencies

- FO-0001

---

## FO-0004: Add frontend package skeleton

**Milestone:** Sprint 0 - Engineering Foundation  
**Labels:** `area:frontend`, `area:ui`, `type:task`, `priority:p0`  
**Estimate:** 3 points

### Description

Create the frontend package structure with a minimal application shell, shared UI package, and typed API package.

### Packages

```text
packages/frontend
packages/ui
packages/ts-api
```

### Tasks

- [ ] Create `packages/frontend`.
- [ ] Create `packages/ui`.
- [ ] Create `packages/ts-api`.
- [ ] Enable strict TypeScript.
- [ ] Add basic frontend app component.
- [ ] Add placeholder API client class.
- [ ] Add shared UI placeholder component.

### Acceptance Criteria

- [ ] Frontend builds successfully.
- [ ] TypeScript strict mode is enabled.
- [ ] No raw IPC usage exists outside `packages/ts-api` placeholder layer.
- [ ] Frontend renders placeholder screen in Tauri app.

### Dependencies

- FO-0001
- FO-0002

---

## FO-0005: Configure formatting and linting

**Milestone:** Sprint 0 - Engineering Foundation  
**Labels:** `area:repo`, `type:chore`, `priority:p1`  
**Estimate:** 2 points

### Description

Configure formatting and linting for Rust, TypeScript, and Markdown.

### Tasks

- [ ] Configure `rustfmt`.
- [ ] Configure `clippy` baseline.
- [ ] Configure frontend formatter.
- [ ] Configure frontend linter.
- [ ] Configure Markdown formatting or linting.
- [ ] Add root scripts for lint and format.

### Acceptance Criteria

- [ ] `cargo fmt --check` succeeds.
- [ ] `cargo clippy --workspace` succeeds with agreed baseline.
- [ ] Frontend lint command succeeds.
- [ ] Frontend format check succeeds.
- [ ] README documents commands.

### Dependencies

- FO-0003
- FO-0004

---

## FO-0006: Create CI workflow for build and tests

**Milestone:** Sprint 0 - Engineering Foundation  
**Labels:** `area:ci`, `type:task`, `priority:p0`  
**Estimate:** 5 points

### Description

Create an initial GitHub Actions workflow to validate Rust and frontend builds.

### Tasks

- [ ] Add workflow for pull requests.
- [ ] Run `cargo check --workspace`.
- [ ] Run `cargo test --workspace`.
- [ ] Run `cargo fmt --check`.
- [ ] Run `cargo clippy --workspace`.
- [ ] Install frontend dependencies.
- [ ] Run frontend typecheck.
- [ ] Run frontend build.
- [ ] Cache Rust and frontend dependencies.

### Acceptance Criteria

- [ ] CI runs on pull requests.
- [ ] CI fails on Rust compile errors.
- [ ] CI fails on frontend compile errors.
- [ ] CI fails on formatting violations.
- [ ] CI status is visible on PRs.

### Dependencies

- FO-0003
- FO-0004
- FO-0005

---

## FO-0007: Add architecture decision record template

**Milestone:** Sprint 0 - Engineering Foundation  
**Labels:** `area:docs`, `type:task`, `priority:p1`, `good-first-issue`  
**Estimate:** 1 point

### Description

Add an ADR template and initial ADR index to document core technical decisions.

### Tasks

- [ ] Create `docs/adr/README.md`.
- [ ] Create `docs/adr/0000-template.md`.
- [ ] Define ADR fields: status, context, decision, consequences, alternatives.
- [ ] Add ADR naming convention.

### Acceptance Criteria

- [ ] ADR template exists.
- [ ] ADR index explains how to add new ADRs.
- [ ] Template is linked from root README or docs README.

### Dependencies

- FO-0001

---

## FO-0008: ADR - Choose Tauri v2 as desktop application framework

**Milestone:** Sprint 0 - Engineering Foundation  
**Labels:** `area:docs`, `area:tauri`, `type:task`, `priority:p1`  
**Estimate:** 1 point

### Description

Record the decision to use Tauri v2 as the desktop shell framework.

### ADR Must Cover

- Why Tauri v2 is selected.
- Why Electron is not selected for MVP.
- Rust backend ownership of privileged logic.
- Web frontend as UI layer only.
- Capability/permission implications.
- Cross-platform packaging considerations.

### Acceptance Criteria

- [ ] ADR is added under `docs/adr`.
- [ ] ADR status is `Accepted`.
- [ ] ADR documents consequences and tradeoffs.

### Dependencies

- FO-0007

---

## FO-0009: ADR - Frontend has no unrestricted filesystem access

**Milestone:** Sprint 0 - Engineering Foundation  
**Labels:** `area:docs`, `area:ipc`, `area:tauri`, `type:task`, `priority:p0`, `risk:high`  
**Estimate:** 1 point

### Description

Record the security decision that the frontend must not receive unrestricted filesystem access. All file operations must go through typed Rust APIs.

### ADR Must Cover

- Frontend is treated as less trusted.
- Generic unrestricted filesystem access is disallowed.
- Rust APIs own validation, planning, and execution.
- Dangerous operations become jobs.
- Future plugin security implications.

### Acceptance Criteria

- [ ] ADR is added under `docs/adr`.
- [ ] ADR status is `Accepted`.
- [ ] ADR explicitly prohibits unrestricted frontend filesystem access.
- [ ] ADR references IPC/API boundary requirements.

### Dependencies

- FO-0007

---

## FO-0010: ADR - Use `local://` ResourceUri model for MVP

**Milestone:** Sprint 0 - Engineering Foundation  
**Labels:** `area:docs`, `area:vfs`, `type:task`, `priority:p1`  
**Estimate:** 1 point

### Description

Record the decision to represent file resources using canonical URIs rather than raw paths at the IPC/domain boundary.

### ADR Must Cover

- `local://` as MVP scheme.
- Future schemes: `archive://`, `s3://`, `sftp://`, `content://`.
- Platform-native path conversion stays in Rust.
- UI may show friendly display paths but stores canonical URI.

### Acceptance Criteria

- [ ] ADR is added.
- [ ] ADR defines canonical URI examples for Windows and Unix.
- [ ] ADR explains why raw paths are not the primary IPC boundary.

### Dependencies

- FO-0007

---

## FO-0011: Add local development bootstrap script

**Milestone:** Sprint 0 - Engineering Foundation  
**Labels:** `area:repo`, `type:chore`, `priority:p2`, `good-first-issue`  
**Estimate:** 2 points

### Description

Add a developer bootstrap script that checks prerequisites and installs frontend dependencies.

### Tasks

- [ ] Add script for Unix/macOS.
- [ ] Add script for Windows PowerShell.
- [ ] Check Rust toolchain.
- [ ] Check Node.js.
- [ ] Check package manager.
- [ ] Install frontend dependencies.
- [ ] Print next commands.

### Acceptance Criteria

- [ ] Bootstrap script runs on at least one development platform.
- [ ] Missing prerequisites produce clear messages.
- [ ] README references the script.

### Dependencies

- FO-0001

---

## FO-0012: Define code ownership and pull request template

**Milestone:** Sprint 0 - Engineering Foundation  
**Labels:** `area:repo`, `type:chore`, `priority:p2`, `good-first-issue`  
**Estimate:** 1 point

### Description

Add GitHub repository hygiene files for review consistency.

### Tasks

- [ ] Add `CODEOWNERS` placeholder.
- [ ] Add pull request template.
- [ ] Add issue template for feature.
- [ ] Add issue template for bug.
- [ ] Add issue template for technical task.

### Acceptance Criteria

- [ ] PR template prompts for test evidence.
- [ ] PR template prompts for security impact.
- [ ] Issue templates include acceptance criteria field.

### Dependencies

- FO-0001

---

# 6. Sprint 1 Backlog

## FO-0101: Implement `ResourceUri` parser for `local://` URIs

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:vfs`, `area:rust-core`, `type:feature`, `priority:p0`  
**Estimate:** 5 points

### Description

Implement the canonical resource URI type used at the Rust domain and IPC boundary. Sprint 1 only needs `local://`, but the design must not prevent future schemes.

### Required URI Examples

```text
Windows:
  local://C:/Users/Ilya/Documents
  local://D:/Projects/FileOctopus

Unix/macOS/Linux:
  local:///home/ilya/Documents
  local:///Users/ilya/Documents
```

### Tasks

- [ ] Add `ResourceUri` type in `vfs` crate.
- [ ] Implement parser.
- [ ] Implement scheme extraction.
- [ ] Implement conversion from platform path to local URI.
- [ ] Implement conversion from local URI to platform path.
- [ ] Add display path helper.
- [ ] Add invalid URI errors.
- [ ] Add unit tests for Windows-style URIs.
- [ ] Add unit tests for Unix-style URIs.
- [ ] Add unit tests for invalid schemes.

### Acceptance Criteria

- [ ] `ResourceUri::parse` accepts valid `local://` URIs.
- [ ] Invalid URI returns structured error.
- [ ] Conversion functions are tested.
- [ ] API does not expose raw string parsing throughout the codebase.

### Dependencies

- FO-0003
- FO-0010

---

## FO-0102: Define VFS domain types and provider trait

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:vfs`, `area:rust-core`, `type:feature`, `priority:p0`  
**Estimate:** 5 points

### Description

Define the core VFS domain types and provider trait that will be implemented by the local filesystem provider.

### Types to Implement

- `FileEntry`
- `FileKind`
- `EntryCapabilities`
- `ProviderCapabilities`
- `ListOptions`
- `DirectoryBatch`
- `ListSessionId`
- `VfsError`
- `VfsProvider`

### Tasks

- [ ] Add VFS domain types.
- [ ] Add serde support for IPC-safe DTO conversion.
- [ ] Add provider trait.
- [ ] Add documentation comments.
- [ ] Add minimal unit tests for serialization.

### Acceptance Criteria

- [ ] `vfs` crate exposes stable MVP domain types.
- [ ] Types compile without dependency on Tauri.
- [ ] Provider trait supports async `stat` and streamed `list`.
- [ ] Types can be serialized for IPC responses/events.

### Dependencies

- FO-0101

---

## FO-0103: Implement VFS registry

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:vfs`, `type:feature`, `priority:p0`  
**Estimate:** 3 points

### Description

Implement provider registration and provider lookup by URI scheme.

### Tasks

- [ ] Add `VfsRegistry` type.
- [ ] Implement provider registration.
- [ ] Implement provider lookup by scheme.
- [ ] Reject duplicate scheme registration.
- [ ] Add unit tests.

### Acceptance Criteria

- [ ] Registry can register a provider for `local` scheme.
- [ ] Registry returns correct provider for `local://` URI.
- [ ] Unknown scheme returns structured `UnsupportedProvider` error.
- [ ] Duplicate scheme registration fails deterministically.

### Dependencies

- FO-0102

---

## FO-0104: Implement local filesystem provider `stat`

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:fs-core`, `area:vfs`, `type:feature`, `priority:p0`  
**Estimate:** 5 points

### Description

Implement `LocalFsProvider.stat` for local files and directories.

### Tasks

- [ ] Create `LocalFsProvider` in `fs-core` crate.
- [ ] Convert `local://` URI to platform path.
- [ ] Read filesystem metadata.
- [ ] Map metadata to `FileEntry`.
- [ ] Detect file/directory/symlink.
- [ ] Detect hidden files using platform-appropriate MVP logic.
- [ ] Return structured errors for missing path and permission denied.
- [ ] Add unit/integration tests.

### Acceptance Criteria

- [ ] `stat` returns correct metadata for file.
- [ ] `stat` returns correct metadata for directory.
- [ ] Missing path returns `NotFound` error.
- [ ] Permission issue returns `PermissionDenied` where detectable.
- [ ] Implementation does not panic on invalid paths.

### Dependencies

- FO-0101
- FO-0102

---

## FO-0105: Implement streamed local directory listing

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:fs-core`, `area:vfs`, `type:feature`, `priority:p0`, `risk:high`  
**Estimate:** 8 points

### Description

Implement streamed, batched local directory listing to support large folders without blocking the UI.

### Requirements

- Read directory entries asynchronously or on a blocking task pool.
- Emit batches through `DirectorySink`.
- Support batch size option.
- Include basic metadata in each `FileEntry`.
- Mark final batch as complete.
- Avoid loading thumbnails or Git metadata.

### Tasks

- [ ] Implement `LocalFsProvider.list`.
- [ ] Add batch size handling.
- [ ] Emit `DirectoryBatch` events to sink.
- [ ] Add cancellation hook or session cancellation placeholder.
- [ ] Handle permission errors gracefully.
- [ ] Add integration test with temporary directory.
- [ ] Add performance test with generated large directory.

### Acceptance Criteria

- [ ] Listing emits one or more batches.
- [ ] Final batch has `is_complete = true`.
- [ ] Listing 10k entries does not require loading all entries before first batch.
- [ ] Listing errors are structured.
- [ ] No frontend code is needed to access native filesystem directly.

### Dependencies

- FO-0104

---

## FO-0106: Implement `AppState` composition root

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:rust-core`, `type:feature`, `priority:p0`  
**Estimate:** 5 points

### Description

Implement MVP `AppState` in `app-core` that initializes the VFS registry and registers the local filesystem provider.

### Tasks

- [ ] Add `AppState` type.
- [ ] Add `AppCore::boot`.
- [ ] Initialize VFS registry.
- [ ] Initialize platform services placeholder.
- [ ] Register `LocalFsProvider`.
- [ ] Expose state to Tauri shell.
- [ ] Add basic startup/shutdown logging.

### Acceptance Criteria

- [ ] Tauri shell can obtain shared `Arc<AppState>`.
- [ ] Local provider is registered at startup.
- [ ] `AppCore::boot` returns structured error on failure.
- [ ] `cargo test --workspace` passes.

### Dependencies

- FO-0103
- FO-0105

---

## FO-0107: Implement IPC DTOs for filesystem listing

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:ipc`, `area:rust-core`, `type:feature`, `priority:p0`  
**Estimate:** 5 points

### Description

Define IPC-safe request, response, and event DTOs for filesystem `stat` and streamed listing.

### DTOs

- `StatRequest`
- `StatResponse`
- `ListStartRequest`
- `ListStartResponse`
- `FileEntryDto`
- `DirectoryBatchEventDto`
- `IpcError`

### Tasks

- [ ] Add DTO types to `app-ipc`.
- [ ] Add domain-to-DTO conversion.
- [ ] Add DTO serialization tests.
- [ ] Add error conversion from `VfsError` to `IpcError`.

### Acceptance Criteria

- [ ] DTOs are serializable.
- [ ] Domain errors map to frontend-safe errors.
- [ ] DTOs do not expose platform-native private implementation details unnecessarily.

### Dependencies

- FO-0102
- FO-0106

---

## FO-0108: Implement Tauri command `fs.stat`

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:ipc`, `area:tauri`, `type:feature`, `priority:p1`  
**Estimate:** 3 points

### Description

Expose `fs.stat` as a Tauri command backed by `AppState.vfs.stat`.

### Tasks

- [ ] Add Tauri command handler.
- [ ] Parse request URI.
- [ ] Call VFS registry.
- [ ] Convert result to DTO.
- [ ] Convert errors to `IpcError`.
- [ ] Register command in Tauri builder.

### Acceptance Criteria

- [ ] Frontend can call `fs.stat` through typed API client.
- [ ] Valid local URI returns metadata.
- [ ] Invalid URI returns structured frontend-safe error.
- [ ] No raw path access is exposed.

### Dependencies

- FO-0107

---

## FO-0109: Implement Tauri command `fs.list_start` with event bridge

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:ipc`, `area:tauri`, `area:fs-core`, `type:feature`, `priority:p0`, `risk:high`  
**Estimate:** 8 points

### Description

Expose streamed directory listing to the frontend. The command starts a listing session and returns a session ID. Directory batches are emitted as frontend events.

### Tasks

- [ ] Add `fs.list_start` command.
- [ ] Generate `ListSessionId`.
- [ ] Spawn async listing task.
- [ ] Bridge `DirectoryBatch` to Tauri events.
- [ ] Return `ListStartResponse` immediately.
- [ ] Add basic task error event.
- [ ] Add event throttling placeholder if needed.
- [ ] Add logging for listing start/end/failure.

### Acceptance Criteria

- [ ] Command returns quickly with session ID.
- [ ] Frontend receives one or more `directory.batch` events.
- [ ] Final event marks listing complete.
- [ ] Listing invalid URI emits or returns structured error.
- [ ] UI thread is not blocked while listing large directory.

### Dependencies

- FO-0105
- FO-0106
- FO-0107

---

## FO-0110: Add TypeScript API client for filesystem commands

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:frontend`, `area:ipc`, `type:feature`, `priority:p0`  
**Estimate:** 5 points

### Description

Implement the frontend API wrapper for filesystem commands and directory batch events.

### Tasks

- [ ] Define TypeScript DTOs matching Rust IPC DTOs.
- [ ] Add `FsClient.stat`.
- [ ] Add `FsClient.listStart`.
- [ ] Add directory batch event subscription helper.
- [ ] Add centralized error normalization.
- [ ] Ensure raw Tauri invoke calls are isolated to transport layer.

### Acceptance Criteria

- [ ] Frontend code can call `client.fs.stat`.
- [ ] Frontend code can call `client.fs.listStart`.
- [ ] Directory batch event subscription works.
- [ ] No feature component calls raw Tauri invoke directly.

### Dependencies

- FO-0108
- FO-0109

---

## FO-0111: Implement frontend application layout shell

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:frontend`, `area:ui`, `type:feature`, `priority:p0`  
**Estimate:** 5 points

### Description

Create the MVP UI layout shell with two panels, top command/path area placeholder, and bottom status area placeholder.

### Tasks

- [ ] Add `DualPaneLayout` component.
- [ ] Add `FilePanel` component shell.
- [ ] Add active panel focus state.
- [ ] Add basic responsive sizing.
- [ ] Add placeholder path bars.
- [ ] Add placeholder status bars.
- [ ] Add light/dark base styles.

### Acceptance Criteria

- [ ] App shows two side-by-side panels.
- [ ] Active panel is visually distinguishable.
- [ ] Layout fills the Tauri window.
- [ ] Layout does not require backend data to render.

### Dependencies

- FO-0004

---

## FO-0112: Implement panel state store

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:frontend`, `type:feature`, `priority:p0`  
**Estimate:** 5 points

### Description

Implement frontend state for panels, tabs, current URI, entries, selection, loading, and errors.

### State Requirements

- Left and right panel state.
- Active panel ID.
- Active tab per panel.
- Current URI per tab.
- Entries keyed by stable row ID.
- Ordered entry ID list.
- Selection state.
- Loading state.
- Error state.

### Tasks

- [ ] Create panel store.
- [ ] Add actions for setting URI.
- [ ] Add actions for starting list session.
- [ ] Add action for applying directory batch.
- [ ] Add action for selection update.
- [ ] Add action for setting loading/error.
- [ ] Add unit tests for state updates.

### Acceptance Criteria

- [ ] Left and right panels maintain independent state.
- [ ] Directory batches can be merged into panel state.
- [ ] Selection state is independent of rendered rows.
- [ ] Store unit tests pass.

### Dependencies

- FO-0110
- FO-0111

---

## FO-0113: Implement virtualized file table component

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:frontend`, `area:ui`, `type:feature`, `priority:p0`, `risk:high`  
**Estimate:** 8 points

### Description

Implement a virtualized file table capable of rendering very large directory listings without creating a DOM node for every entry.

### Columns for Sprint 1

- Name
- Size
- Modified
- Type

### Tasks

- [ ] Select virtualization library or implement simple virtualization.
- [ ] Add `FileTable` component.
- [ ] Render rows from ordered entry IDs.
- [ ] Add basic file/folder icons.
- [ ] Add focused row style.
- [ ] Add selected row style.
- [ ] Add double-click/open handler placeholder.
- [ ] Add column headers.
- [ ] Add empty/loading/error states.

### Acceptance Criteria

- [ ] Table renders 100k entries without mounting 100k DOM rows.
- [ ] Scrolling remains responsive.
- [ ] Selection visual state works.
- [ ] Component can receive incremental entry updates.

### Dependencies

- FO-0112

---

## FO-0114: Wire directory listing into panels

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:frontend`, `area:ipc`, `type:feature`, `priority:p0`  
**Estimate:** 8 points

### Description

Connect frontend panel state to `fs.list_start` and directory batch events.

### Tasks

- [ ] Add panel navigation action.
- [ ] Call `client.fs.listStart` when panel URI changes.
- [ ] Store returned session ID.
- [ ] Subscribe to directory batch events.
- [ ] Route events to correct panel/tab by session ID.
- [ ] Mark panel loading false on final batch.
- [ ] Show listing errors.
- [ ] Ignore stale session events.

### Acceptance Criteria

- [ ] User can load a local URI into a panel.
- [ ] Directory entries appear incrementally.
- [ ] Final batch clears loading state.
- [ ] Stale events do not corrupt panel state after fast navigation.
- [ ] Invalid path shows error without crashing app.

### Dependencies

- FO-0109
- FO-0110
- FO-0112
- FO-0113

---

## FO-0115: Implement path bar and basic navigation

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:frontend`, `area:ui`, `type:feature`, `priority:p1`  
**Estimate:** 5 points

### Description

Implement editable path bar for each panel that allows user to enter a `local://` URI or display path and navigate to it.

### Tasks

- [ ] Add `PathBar` component.
- [ ] Show current panel path.
- [ ] Support edit mode.
- [ ] Submit path with Enter.
- [ ] Cancel edit with Escape.
- [ ] Normalize display path to `local://` where possible.
- [ ] Show validation error.

### Acceptance Criteria

- [ ] User can type a path/URI and navigate.
- [ ] Invalid input shows error.
- [ ] Path bar updates when panel URI changes.
- [ ] Path entry does not freeze UI.

### Dependencies

- FO-0114

---

## FO-0116: Implement open directory action

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:frontend`, `area:fs-core`, `type:feature`, `priority:p1`  
**Estimate:** 5 points

### Description

Allow user to open a directory from the file table using Enter or double-click.

### Tasks

- [ ] Add row activation handler.
- [ ] If selected entry is directory, navigate panel to that URI.
- [ ] If selected entry is file, no-op or show placeholder notification.
- [ ] Add parent directory navigation entry or command.
- [ ] Add keyboard Enter action.
- [ ] Add double-click action.

### Acceptance Criteria

- [ ] Double-clicking directory opens it.
- [ ] Pressing Enter on focused directory opens it.
- [ ] File activation does not crash app.
- [ ] Parent navigation is possible.

### Dependencies

- FO-0113
- FO-0114

---

## FO-0117: Implement basic keyboard navigation in file table

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:frontend`, `area:ui`, `type:feature`, `priority:p1`  
**Estimate:** 5 points

### Description

Implement keyboard movement and selection for the file table.

### Required Keys

- Arrow Up
- Arrow Down
- Page Up
- Page Down
- Home
- End
- Enter
- Tab to switch active panel

### Tasks

- [ ] Add focus management.
- [ ] Add arrow navigation.
- [ ] Add page navigation.
- [ ] Add Home/End.
- [ ] Add Enter activation.
- [ ] Add Tab panel switching.
- [ ] Ensure virtualized row scrolls into view.
- [ ] Add unit or component tests for navigation logic.

### Acceptance Criteria

- [ ] User can navigate rows without mouse.
- [ ] Focused row remains visible while navigating.
- [ ] Tab switches active panel.
- [ ] Enter opens directory.

### Dependencies

- FO-0113
- FO-0116

---

## FO-0118: Add basic sorting for visible directory entries

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:frontend`, `area:ui`, `type:feature`, `priority:p2`  
**Estimate:** 5 points

### Description

Add basic client-side sorting for loaded directory entries.

### Sort Fields

- Name
- Type
- Size
- Modified time

### Tasks

- [ ] Add sort state to panel tab.
- [ ] Add sortable column headers.
- [ ] Implement sorting selectors.
- [ ] Keep directories-first option enabled by default.
- [ ] Preserve selection across sort.
- [ ] Add tests for sort logic.

### Acceptance Criteria

- [ ] User can sort by name, size, type, modified time.
- [ ] Sort direction toggles.
- [ ] Selection remains stable after sort.
- [ ] Sorting 100k entries does not permanently freeze UI; if needed, defer heavy optimization to later issue.

### Dependencies

- FO-0112
- FO-0113

---

## FO-0119: Add current directory filter

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:frontend`, `area:ui`, `type:feature`, `priority:p2`  
**Estimate:** 3 points

### Description

Add simple text filter for current loaded directory entries.

### Tasks

- [ ] Add filter state per panel tab.
- [ ] Add filter input or command placeholder.
- [ ] Filter by case-insensitive name contains.
- [ ] Preserve unfiltered entries in state.
- [ ] Add tests for filter logic.

### Acceptance Criteria

- [ ] User can filter current directory by text.
- [ ] Clearing filter restores all loaded entries.
- [ ] Filter does not trigger backend recursive search.

### Dependencies

- FO-0112
- FO-0113

---

## FO-0120: Create synthetic directory performance test tool

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:testing`, `area:repo`, `type:task`, `priority:p1`  
**Estimate:** 5 points

### Description

Create a test utility that generates large local directory trees for performance testing.

### CLI Examples

```bash
fileoctopus-test-tree --root ./tmp/100k --files 100000 --dirs 0
fileoctopus-test-tree --root ./tmp/tree --files 10000 --dirs 1000 --max-depth 5
```

### Tasks

- [ ] Add script or Rust CLI under `scripts` or `crates/test-support`.
- [ ] Support number of files.
- [ ] Support number of directories.
- [ ] Support max depth.
- [ ] Support file size option.
- [ ] Support cleanup option.
- [ ] Document usage.

### Acceptance Criteria

- [ ] Tool can generate 100k empty files.
- [ ] Tool can generate nested directory tree.
- [ ] Tool can clean generated tree.
- [ ] README documents performance test workflow.

### Dependencies

- FO-0001

---

## FO-0121: Add large directory manual performance test protocol

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:testing`, `area:docs`, `type:task`, `priority:p1`  
**Estimate:** 2 points

### Description

Document a repeatable manual test protocol for validating large directory behavior during Sprint 1.

### Tasks

- [ ] Create `docs/testing/large-directory-performance.md`.
- [ ] Define test hardware notes.
- [ ] Define 10k file test.
- [ ] Define 100k file test.
- [ ] Define expected behavior.
- [ ] Define what evidence to capture.

### Acceptance Criteria

- [ ] Test protocol exists.
- [ ] Protocol references synthetic directory tool.
- [ ] Protocol defines pass/fail behavior.
- [ ] Protocol can be executed by any developer.

### Dependencies

- FO-0120

---

## FO-0122: Add structured logging foundation

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:rust-core`, `type:task`, `priority:p1`  
**Estimate:** 3 points

### Description

Initialize structured logging for backend startup, IPC command handling, and directory listing.

### Tasks

- [ ] Add logging initialization in `telemetry` crate.
- [ ] Log app startup.
- [ ] Log app shutdown.
- [ ] Log `fs.stat` calls at debug level.
- [ ] Log `fs.list_start` session start/end/failure.
- [ ] Ensure logs do not dump excessive directory contents.

### Acceptance Criteria

- [ ] Backend logs are visible in dev mode.
- [ ] Directory listing failures are logged.
- [ ] Logs avoid dumping large file lists.
- [ ] Logging setup does not crash app if log directory is unavailable.

### Dependencies

- FO-0106
- FO-0109

---

## FO-0123: Add frontend error boundary and error display foundation

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:frontend`, `area:ui`, `type:task`, `priority:p1`  
**Estimate:** 3 points

### Description

Add basic frontend error handling for panel-level errors and application-level render errors.

### Tasks

- [ ] Add global error boundary.
- [ ] Add panel error display.
- [ ] Normalize IPC errors into user-readable messages.
- [ ] Add retry action placeholder for failed listing.

### Acceptance Criteria

- [ ] Invalid path error is displayed in panel.
- [ ] Render error does not blank entire app without message.
- [ ] IPC error structure is visible in developer console/log where appropriate.

### Dependencies

- FO-0110
- FO-0114

---

## FO-0124: Add smoke E2E test for app launch

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:testing`, `area:frontend`, `type:task`, `priority:p2`  
**Estimate:** 3 points

### Description

Add a smoke test that launches the desktop app or frontend shell and verifies the main layout renders.

### Tasks

- [ ] Choose initial E2E strategy.
- [ ] Add smoke test for app shell.
- [ ] Assert two panels are visible.
- [ ] Add command to run smoke test locally.
- [ ] Consider CI execution if stable.

### Acceptance Criteria

- [ ] Smoke test passes locally.
- [ ] Test verifies two-panel layout.
- [ ] Test command is documented.

### Dependencies

- FO-0111

---

## FO-0125: Sprint 1 demo scenario

**Milestone:** Sprint 1 - Local Navigation Vertical Slice  
**Labels:** `area:docs`, `area:testing`, `type:task`, `priority:p1`  
**Estimate:** 2 points

### Description

Create a scripted demo scenario for Sprint 1 review.

### Demo Flow

1. Launch FileOctopus.
2. Show two panels.
3. Navigate left panel to user home directory.
4. Navigate right panel to generated 100k test directory.
5. Show incremental listing.
6. Scroll through large directory.
7. Use keyboard navigation.
8. Open subdirectory.
9. Show invalid path error handling.

### Acceptance Criteria

- [ ] Demo script exists under `docs/testing` or `docs/demo`.
- [ ] Demo uses only Sprint 1 features.
- [ ] Demo includes expected outcomes.

### Dependencies

- FO-0114
- FO-0117
- FO-0120

---

# 7. Sprint 0 Definition of Done

Sprint 0 is complete when:

- [ ] Repository structure exists.
- [ ] Tauri shell launches.
- [ ] Rust workspace compiles.
- [ ] Frontend package builds.
- [ ] Formatting and linting commands exist.
- [ ] CI validates Rust and frontend.
- [ ] ADR template exists.
- [ ] ADRs for Tauri, frontend filesystem restrictions, and `local://` URI model are accepted.
- [ ] Developer bootstrap instructions exist.

---

# 8. Sprint 1 Definition of Done

Sprint 1 is complete when:

- [ ] `ResourceUri` supports MVP `local://` parsing and conversion.
- [ ] VFS provider trait and registry exist.
- [ ] Local provider supports `stat` and streamed `list`.
- [ ] Tauri IPC exposes `fs.stat` and `fs.list_start`.
- [ ] Directory batch events reach frontend.
- [ ] Frontend displays two panels.
- [ ] Each panel can load a local directory.
- [ ] File table is virtualized.
- [ ] User can navigate into directories.
- [ ] Keyboard navigation works for core movement.
- [ ] 100k generated file directory opens without UI freeze.
- [ ] Invalid paths produce user-visible errors.
- [ ] Large directory performance test protocol has been executed and results recorded.

---

# 9. Suggested Sprint Assignment Order

## Sprint 0 Recommended Order

1. FO-0001 Initialize monorepo structure.
2. FO-0003 Configure Rust workspace crates.
3. FO-0002 Scaffold Tauri v2 desktop application.
4. FO-0004 Add frontend package skeleton.
5. FO-0005 Configure formatting and linting.
6. FO-0006 Create CI workflow.
7. FO-0007 Add ADR template.
8. FO-0008/FO-0009/FO-0010 Add core ADRs.
9. FO-0011 Add bootstrap scripts.
10. FO-0012 Add PR/issue templates.

## Sprint 1 Recommended Order

1. FO-0101 Implement `ResourceUri` parser.
2. FO-0102 Define VFS types and provider trait.
3. FO-0103 Implement VFS registry.
4. FO-0104 Implement local `stat`.
5. FO-0105 Implement streamed local listing.
6. FO-0106 Implement `AppState`.
7. FO-0107 Implement IPC DTOs.
8. FO-0108 Implement `fs.stat`.
9. FO-0109 Implement `fs.list_start`.
10. FO-0110 Add TypeScript API client.
11. FO-0111 Implement layout shell.
12. FO-0112 Implement panel state store.
13. FO-0113 Implement virtualized file table.
14. FO-0114 Wire listing into panels.
15. FO-0115/FO-0116/FO-0117 Add navigation and keyboard behavior.
16. FO-0120/FO-0121 Add performance tooling and protocol.
17. FO-0122/FO-0123 Add logging and error handling.
18. FO-0125 Prepare sprint demo.

---

# 10. Sprint 1 Technical Risks

| Risk                                                  | Impact | Mitigation                                                                      |
| ----------------------------------------------------- | -----: | ------------------------------------------------------------------------------- |
| Directory listing blocks runtime thread               |   High | Use blocking task pool or async-safe directory enumeration strategy.            |
| Frontend accidentally stores raw paths inconsistently | Medium | Enforce `ResourceUri` at API boundary and panel state.                          |
| 100k files causes frontend memory/DOM issue           |   High | Use strict virtualization and avoid derived object duplication.                 |
| Directory batch events arrive after navigation        | Medium | Track session IDs and ignore stale sessions.                                    |
| Windows path URI handling is wrong                    |   High | Add explicit Windows URI tests even when running on non-Windows where possible. |
| Tauri event bridge becomes too chatty                 | Medium | Batch events and throttle progress-like updates.                                |
| CI matrix too slow too early                          |    Low | Start with validation CI, add packaging matrix later.                           |

---

# 11. Issues Deferred to Sprint 2

These are intentionally not part of Sprint 1.

- Durable job engine implementation.
- Copy/move/delete operations.
- Conflict handling.
- OS Trash integration.
- Git status badges.
- Archive extraction.
- Embedded terminal.
- Settings UI.
- Command palette.
- File preview panel.
- Watcher integration.
- Full indexing.

---

# 12. Sprint 2 Preview

Sprint 2 should likely focus on the durable job engine and first file operation vertical slice.

Expected Sprint 2 epic:

> Implement copy operation as a durable job with progress, cancellation, and persisted job state.

Candidate Sprint 2 issues:

1. Define `JobId`, `JobKind`, `JobState`, `JobProgress`.
2. Implement SQLite migration system.
3. Implement job store.
4. Implement job manager skeleton.
5. Implement operation planning for copy.
6. Implement copy executor.
7. Emit job progress events.
8. Add job queue frontend panel.
9. Add cancellation support.
10. Add failed job inspection.

---

## 13. Sprint 0 / Sprint 1 Summary

Sprint 0 establishes the engineering foundation. Sprint 1 proves the most important technical claim of the product: FileOctopus can browse very large local directories through a secure Rust-owned backend and a responsive virtualized frontend without granting the web layer unrestricted filesystem access.

That vertical slice is the foundation for every later MVP capability: jobs, copy/move/delete, Git, archives, terminal, cloud providers, indexing, AI, and local-first sync.
