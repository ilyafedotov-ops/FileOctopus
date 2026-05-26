# Commander Features Expansion Plan

**Date:** 2026-05-26
**Status:** Approved
**Priority:** High
**Goal:** Expand FileOctopus to match Total Commander/Norton Commander feature parity with enhanced layout customization and power-user workflows.

---

## Overview

This plan addresses gaps between FileOctopus and established dual-pane file managers (Total Commander, Norton Commander). The work is organized into 11 tasks across 4 phases, prioritized by user impact and implementation dependencies.

---

## Task 1: Restructure Settings Dialog (Foundation)

**Priority:** High
**Dependencies:** None
**Estimated Complexity:** Medium

### Goal

Transform the current 6-section settings dialog into a TC-style 12+ category dialog with tree navigation, providing better organization and room for new settings.

### New Category Structure

| #   | Category        | Subcategories                                       | Source               |
| --- | --------------- | --------------------------------------------------- | -------------------- |
| 1   | General         | Startup, Paths                                      | General              |
| 2   | Display         | Theme, Density, Fonts, Icons                        | Appearance (split)   |
| 3   | Colors          | Accent, File type rules, Row colors, Git colors     | New                  |
| 4   | Layout          | Panes, Sidebar, Toolbar, Status bar, Tab bar        | Layout               |
| 5   | Layout Profiles | Save/Load/Import/Export                             | New                  |
| 6   | File List       | View modes, Columns, Sort, Hidden files             | Files (part)         |
| 7   | Operations      | Confirmations, Conflict policy, Trash, Copy options | Files (part)         |
| 8   | Terminal        | Shell, Behavior, Appearance                         | Terminal             |
| 9   | Keyboard        | Shortcut editor                                     | Shortcuts (upgraded) |
| 10  | Network         | Connection defaults, Auto-reconnect                 | New                  |
| 11  | Editor          | Font, Tab size, Word wrap, Auto-save                | New                  |
| 12  | Viewer          | Default mode, Image zoom, Hex settings              | New                  |

### Implementation Details

**Files to Create:**

- `packages/frontend/src/components/settings/SettingsGeneral.tsx`
- `packages/frontend/src/components/settings/SettingsDisplay.tsx`
- `packages/frontend/src/components/settings/SettingsColors.tsx`
- `packages/frontend/src/components/settings/SettingsLayout.tsx`
- `packages/frontend/src/components/settings/SettingsLayoutProfiles.tsx`
- `packages/frontend/src/components/settings/SettingsFileList.tsx`
- `packages/frontend/src/components/settings/SettingsOperations.tsx`
- `packages/frontend/src/components/settings/SettingsTerminal.tsx`
- `packages/frontend/src/components/settings/SettingsKeyboard.tsx`
- `packages/frontend/src/components/settings/SettingsNetwork.tsx`
- `packages/frontend/src/components/settings/SettingsEditor.tsx`
- `packages/frontend/src/components/settings/SettingsViewer.tsx`
- `packages/frontend/src/components/settings/SettingsTree.tsx` (tree navigation component)

**Files to Modify:**

- `packages/frontend/src/components/SettingsDialog.tsx` — rewrite with tree nav + subcategory panels
- `packages/frontend/src/styles/regions/dialogs.css` — tree nav styles

### UI Pattern

- Left panel: tree navigation with expandable categories
- Right panel: selected category content
- Footer: Close button (changes are applied immediately via existing `onChange` pattern)
- Search/filter at top of tree (optional, phase 2)

---

## Task 2: Customizable Keyboard Shortcuts

**Priority:** High
**Dependencies:** Task 1 (Settings restructure)
**Estimated Complexity:** High

### Goal

Allow users to rebind keyboard shortcuts with conflict detection and persistence.

### Current Problem

- Key-to-command mapping is hardcoded as `if` statements in `useKeyboardShortcuts.ts:343`
- Registry shortcut strings in `registryData.ts` are display-only
- No persistence layer for shortcut overrides

### Implementation Plan

#### 1. Key Combo Parser/Serializer

**New file:** `packages/frontend/src/commands/keyCombo.ts`

```typescript
interface KeyCombo {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

function parseKeyCombo(str: string): KeyCombo;
function serializeKeyCombo(combo: KeyCombo): string;
function eventToKeyCombo(event: KeyboardEvent): KeyCombo;
function matchesKeyCombo(event: KeyboardEvent, combo: KeyCombo): boolean;
```

#### 2. Default Binding Table

**New file:** `packages/frontend/src/commands/defaultBindings.ts`

- Seed from `registryData.ts` shortcut strings + supplemental shortcuts
- Export `DEFAULT_KEY_BINDINGS: Map<CommandId, KeyCombo[]>`
- Array because some commands have multiple bindings (e.g., `Ctrl+.` and `Ctrl+H`)

#### 3. Refactor Keyboard Handler

**Modify:** `packages/frontend/src/hooks/useKeyboardShortcuts.ts`

- Replace `if` chain with table-driven lookup
- Load user overrides from preferences
- Build effective binding table: defaults merged with user overrides
- On keydown: `eventToKeyCombo(event)` → lookup in binding table → `runCommand(id)`
- Preserve input guards and escape cascade

#### 4. Add Preferences Persistence

**Modify:**

- `packages/ts-api/src/types.ts` — add `customShortcuts: string` field to `UserPreferencesDto`
- `crates/config/src/lib.rs` — add field to `UserPreferences`, add JSON parser in `apply_value`
- `crates/app-ipc/src/lib.rs` — add DTO field

**Storage format:** JSON string: `Record<CommandId, string[]>` where strings are serialized `KeyCombo` objects.

#### 5. Upgrade Shortcuts UI

**Modify:** `packages/frontend/src/components/ShortcutsDialog.tsx` (or integrate into Settings > Keyboard)

- Key recording UI: click "Record" → listen for next keydown → serialize → validate conflicts
- Conflict detection: highlight when two commands share the same combo
- Reset to defaults per-command or all
- Search/filter shortcuts

**Files to Create:**

- `packages/frontend/src/commands/keyCombo.ts`
- `packages/frontend/src/commands/defaultBindings.ts`

**Files to Modify:**

- `packages/frontend/src/hooks/useKeyboardShortcuts.ts` (rewrite)
- `packages/frontend/src/components/ShortcutsDialog.tsx` (or merge into Settings)
- `packages/ts-api/src/types.ts`
- `crates/config/src/lib.rs`
- `crates/app-ipc/src/lib.rs`

---

## Task 3: File Type Color Rules

**Priority:** High
**Dependencies:** Task 1 (Settings restructure)
**Estimated Complexity:** Medium

### Goal

Allow users to define color rules for file types by extension, name pattern, or regex.

### Implementation Plan

#### 1. Color Rule Model

**New file:** `packages/frontend/src/utils/fileTypeColors.ts`

```typescript
interface FileTypeColorRule {
  id: string;
  name: string;
  pattern: string; // glob or regex
  matchType: "extension" | "name" | "pattern";
  color: string; // CSS color or token name
  enabled: boolean;
}

function matchFileColor(
  entry: FileEntryDto,
  rules: FileTypeColorRule[],
): string | null;
```

**Default rules:**

- Images (`.jpg`, `.png`, `.gif`, etc.) → green
- Videos (`.mp4`, `.avi`, `.mkv`, etc.) → purple
- Archives (`.zip`, `.tar`, `.gz`, etc.) → orange
- Executables (`.exe`, `.sh`, `.bat`) → red
- Code (`.js`, `.ts`, `.rs`, `.py`, etc.) → blue
- Configs (`.json`, `.yaml`, `.toml`, `.ini`) → gray

#### 2. Persist Rules

**Modify:**

- `packages/ts-api/src/types.ts` — add `fileTypeColorRules: string` field to `UserPreferencesDto`
- `crates/config/src/lib.rs` — add field + JSON validation
- Storage format: JSON array of `FileTypeColorRule`

#### 3. Apply Colors in File List

**Modify:** `packages/frontend/src/pane/FileTable.tsx`

- In row rendering, match entry name against rules
- Apply CSS class or inline style for text color
- Priority: first matching rule wins (ordered list)

#### 4. Settings UI

**New section:** Settings > Colors > File Type Rules

- Reorderable list of rules with drag handles
- Pattern input with match type selector (extension/name/regex)
- Color picker (10-12 preset colors + custom)
- Enable/disable toggle per rule
- Add/remove/edit rules
- Preview with sample filenames

**Files to Create:**

- `packages/frontend/src/utils/fileTypeColors.ts`

**Files to Modify:**

- `packages/frontend/src/pane/FileTable.tsx`
- Settings dialog (new Colors section)
- `packages/ts-api/src/types.ts`
- `crates/config/src/lib.rs`
- `crates/app-ipc/src/lib.rs`

---

## Task 4: Layout Profiles with Import/Export

**Priority:** Medium
**Dependencies:** Task 1 (Settings restructure)
**Estimated Complexity:** Medium

### Goal

Allow users to save, restore, import, and export named layout profiles.

### Implementation Plan

#### 1. Layout Profile Model

**New file:** `packages/frontend/src/utils/layoutProfiles.ts`

```typescript
interface LayoutProfile {
  id: string;
  name: string;
  createdAt: string; // ISO timestamp
  sidebarWidth: number;
  sidebarVisible: boolean;
  splitRatio: number;
  paneMode: string;
  paneDirection: string;
  statusBarVisible: boolean;
  toolbarVisible: boolean;
  toolbarEntries: string;
  activityPanelVisible: boolean;
  activityPanelWidth: number;
  fontScale: string;
  iconScale: string;
  density: string;
  accentColor: string;
  theme: string;
}

function captureCurrentProfile(prefs: UserPreferencesDto): LayoutProfile;
function applyLayoutProfile(
  profile: LayoutProfile,
  updatePref: (key: string, value: string) => void,
): void;
function exportProfile(profile: LayoutProfile): string; // JSON
function importProfile(json: string): LayoutProfile; // with validation
```

#### 2. Storage

**Modify:**

- `packages/ts-api/src/types.ts` — add `layoutProfiles: string` and `activeLayoutProfile: string` fields
- `crates/config/src/lib.rs` — add fields + JSON validation
- Storage format: JSON array of `LayoutProfile` objects

#### 3. Settings UI

**New section:** Settings > Layout Profiles

- List saved profiles with name, date, "Apply", "Delete" buttons
- "Save current as..." with name input
- Export profile as `.json` file download (use `URL.createObjectURL` + `<a download>`)
- Import profile from `.json` file upload (use `<input type="file">`)
- "Reset to factory defaults" option

#### 4. Apply Logic

- Applying a profile sets all layout preferences at once
- Use existing `updatePreference` in a loop (or add batch update command if performance is an issue)

**Files to Create:**

- `packages/frontend/src/utils/layoutProfiles.ts`

**Files to Modify:**

- Settings dialog (new Layout Profiles section)
- `packages/ts-api/src/types.ts`
- `crates/config/src/lib.rs`
- `crates/app-ipc/src/lib.rs`

---

## Task 5: Per-Pane Layout Settings

**Priority:** Medium
**Dependencies:** Task 1 (Settings restructure)
**Estimated Complexity:** Medium

### Goal

Allow independent view mode, sort order, and column configuration per pane.

### Implementation Plan

#### 1. Move View Mode from Global to Per-Pane

- Currently `defaultViewMode` is a global preference
- Each tab already has its own `viewMode` in `tabsSlice.ts`
- Add per-pane column visibility/width overrides
- Persist per-pane settings in a new `paneSettings` slice or extend tab state

#### 2. Column Presets

**New preference:** `columnPresets: string` (JSON)

```typescript
interface ColumnPreset {
  id: string;
  name: string;
  columns: Array<{
    field: SortField;
    visible: boolean;
    width?: number;
  }>;
}
```

**Default presets:**

- "Default": name, size, modified, type
- "Code": name, size, modified
- "Media": name, size, type
- "Minimal": name only

#### 3. Settings UI

**New section:** Settings > File List > Per-Pane Settings

- Toggle: "Use independent settings per pane"
- Column preset manager (add/edit/delete presets)
- Apply preset to current pane button

**Files to Modify:**

- `packages/frontend/src/state/slices/tabsSlice.ts`
- `packages/frontend/src/pane/FileTable.tsx`
- Settings dialog (new per-pane section)
- `packages/ts-api/src/types.ts`
- `crates/config/src/lib.rs`

---

## Task 6: Multi-Rename Tool

**Priority:** High
**Dependencies:** None (can start after Task 1)
**Estimated Complexity:** High

### Goal

Provide a batch rename dialog with pattern-based renaming, regex support, and live preview.

### Implementation Plan

#### 1. Rename Engine

**New file:** `packages/frontend/src/utils/multiRename.ts`

```typescript
interface RenameOptions {
  pattern: string; // e.g., "[N]_[C:3:1:0]"
  search?: string;
  replace?: string;
  useRegex?: boolean;
  caseConversion?: "upper" | "lower" | "title" | "sentence" | "camel" | "snake";
}

interface RenameResult {
  entry: FileEntryDto;
  newName: string;
  hasConflict: boolean;
}

function applyRenamePattern(
  entries: FileEntryDto[],
  options: RenameOptions,
): RenameResult[];
```

**Pattern tokens:**

- `[N]` — original name (without extension)
- `[E]` — extension
- `[C:pad:start:step]` — counter (e.g., `[C:3:1:1]` → 001, 002, 003)
- `[Y]` — year (4-digit)
- `[M]` — month (2-digit)
- `[D]` — day (2-digit)
- `[P]` — parent folder name
- `$1`, `$2`, ... — regex capture groups (when `useRegex` is true)

#### 2. Multi-Rename Dialog

**New file:** `packages/frontend/src/components/MultiRenameDialog.tsx`

- Pattern input with token reference popup
- Search/replace inputs with regex toggle
- Case conversion dropdown
- Live preview table: original name → new name
- Conflict highlighting (duplicate names in red)
- Select/deselect individual items
- Undo support (store original names)

#### 3. Backend Execution

- Use existing `plan_file_operation` with `Rename` kind for each item
- Execute via existing job pipeline
- Show progress for large batches

#### 4. Integration

- Command: `tools.multiRename` with shortcut `Ctrl+M`
- Menu: Tools > Multi-Rename
- Context menu: available when 2+ items selected

**Files to Create:**

- `packages/frontend/src/components/MultiRenameDialog.tsx`
- `packages/frontend/src/utils/multiRename.ts`

**Files to Modify:**

- `packages/frontend/src/commands/registryData.ts` (add command)
- `packages/frontend/src/commands/dispatch.ts` (handle command)
- `packages/frontend/src/hooks/useKeyboardShortcuts.ts` (add Ctrl+M)
- ModalsProvider (add dialog open state)

---

## Task 7: Advanced Content Search

**Priority:** Medium
**Dependencies:** None (can start after Task 1)
**Estimated Complexity:** High

### Goal

Add file content search (grep) with regex support, file type filters, and streaming results.

### Implementation Plan

#### 1. Backend: Content Search in Rust

**New module:** `crates/fs-core/src/content_search.rs`

- Stream-based grep: read file chunks, match against pattern
- Support: plain text, regex (via `regex` crate), case-insensitive option
- File type filter (by extension glob)
- Size/date filters
- Encoding detection (UTF-8, UTF-16, Latin-1) via `encoding_rs`
- Result limit with pagination
- New IPC command: `fs_content_search_start` (job-based with streaming results)
- Event: `fs:contentSearch:match` per match, `fs:contentSearch:completed` at end

**Result structure:**

```rust
struct ContentSearchMatch {
  uri: ResourceUri,
  line_number: u64,
  line_content: String,
  match_start: usize,
  match_end: usize,
}
```

#### 2. Frontend: Search Panel

**Modify:** Expand current recursive search UI

- Add tabs: "Filename" / "Content"
- Content search form: pattern input, regex toggle, case-insensitive toggle
- File type filter (extension glob, e.g., `*.ts,*.js`)
- Size/date range filters
- Results as navigable list with match context (surrounding lines)
- Click result → navigate to file, highlight match (if viewer supports it)

#### 3. Save as Smart Folder

- Extend existing smart folder system to store content search queries
- Smart folder icon distinguishes filename vs content search

**Files to Create:**

- `crates/fs-core/src/content_search.rs`

**Files to Modify:**

- `crates/fs-core/src/lib.rs` (export module)
- `apps/desktop-tauri/src-tauri/src/commands/fs.rs` (add command)
- `crates/app-ipc/src/lib.rs` (add DTOs and event constants)
- `packages/ts-api/src/clients/fs.ts` (add client method)
- `packages/ts-api/src/events.ts` (add event names)
- `packages/frontend/src/pane/` (search UI)

---

## Task 8: Tab Session Management

**Priority:** Medium
**Dependencies:** None (can start after Task 1)
**Estimated Complexity:** Medium

### Goal

Allow users to save, restore, and manage tab sessions with auto-save on app close.

### Implementation Plan

#### 1. Session Model

**New preference:** `tabSessions: string` (JSON)

```typescript
interface TabSession {
  id: string;
  name: string;
  createdAt: string;
  panes: Array<{
    tabs: Array<{
      uri: string;
      viewMode: string;
      sortField: string;
      sortAscending: boolean;
      filter: string;
    }>;
  }>;
}
```

#### 2. Auto-Save/Restore

- On app close: save current tab state to `lastSession` preference
- On app start: offer to restore (or auto-restore based on preference)
- Extend `rememberLastUsedPanes` to full session restore

#### 3. Named Sessions

- Session manager dialog: list, save, load, delete named sessions
- "Save current tabs as..." with name input

#### 4. Tab Context Menu Enhancements

- Close other tabs
- Close tabs to right
- Duplicate tab
- Move tab to other pane

**Files to Create:**

- `packages/frontend/src/components/SessionManagerDialog.tsx`

**Files to Modify:**

- `packages/frontend/src/state/slices/tabsSlice.ts`
- `packages/frontend/src/pane/TabBar.tsx` (context menu)
- `packages/frontend/src/app/useAppInit.ts` (restore logic)
- `packages/ts-api/src/types.ts`
- `crates/config/src/lib.rs`

---

## Task 9: Directory Hotlist

**Priority:** Low
**Dependencies:** None (can start after Task 1)
**Estimated Complexity:** Low

### Goal

Provide a TC-style directory hotlist with keyboard shortcuts for quick access.

### Implementation Plan

#### 1. Hotlist Model

**New repository table:** `hotlist` in `navigation.sqlite`

```rust
struct HotlistEntry {
  id: i64,
  label: String,
  uri: String,
  shortcut: Option<i32>, // 1-9 for Ctrl+1..9
  sort_order: i32,
}
```

#### 2. Ctrl+D Dialog

- Quick-access popup showing numbered hotlist entries
- Fuzzy search/filter
- Click or Enter to navigate
- Right-click to manage

#### 3. Keyboard Shortcuts

- `Ctrl+1`..`Ctrl+9` for direct access to first 9 entries
- Configurable in Settings > Keyboard

#### 4. Manage Hotlist Dialog

- Add/remove/reorder entries
- Assign keyboard shortcuts (1-9)
- Drag-and-drop from file list to add

**Files to Create:**

- `packages/frontend/src/components/HotlistDialog.tsx`
- `packages/frontend/src/components/ManageHotlistDialog.tsx`
- `crates/config/src/hotlist.rs` (new module)

**Files to Modify:**

- `crates/config/src/lib.rs` (add repository)
- `apps/desktop-tauri/src-tauri/src/commands/navigation.rs` (add commands)
- `packages/ts-api/src/clients/navigation.ts`
- `packages/frontend/src/commands/registryData.ts`
- `packages/frontend/src/hooks/useKeyboardShortcuts.ts`

---

## Task 10: File Compare

**Priority:** Medium
**Dependencies:** None (can start after Task 1)
**Estimated Complexity:** High

### Goal

Provide side-by-side file comparison with diff highlighting for text and binary files.

### Implementation Plan

#### 1. Text Compare

- Use Myers diff algorithm (or `similar` crate) to compute line-level diffs
- Side-by-side view with synchronized scrolling
- Highlight added/removed/changed lines
- Jump to next/prev difference
- Copy differences left/right (if both files are editable)

#### 2. Binary Compare

- Byte-level comparison
- Hex display with highlighted differences
- Show offset and byte values

#### 3. Directory Compare

- Compare two pane directories by name, size, date
- Highlight: only in left, only in right, different, same
- Actions: copy missing, delete extra, sync

#### 4. Compare Dialog

**New file:** `packages/frontend/src/components/CompareDialog.tsx`

- Select two files (from panes or via path input)
- Choose compare mode: text, binary, directory
- Display diff view

#### 5. Backend

**New IPC command:** `fs_compare_files`

```rust
struct CompareFilesRequest {
  left_uri: ResourceUri,
  right_uri: ResourceUri,
  mode: CompareMode, // Text, Binary
}

struct CompareFilesResponse {
  hunks: Vec<DiffHunk>, // for text
  // or
  differences: Vec<ByteDifference>, // for binary
}
```

**Files to Create:**

- `crates/fs-core/src/compare.rs`
- `packages/frontend/src/components/CompareDialog.tsx`

**Files to Modify:**

- `crates/fs-core/src/lib.rs`
- `apps/desktop-tauri/src-tauri/src/commands/fs.rs`
- `crates/app-ipc/src/lib.rs`
- `packages/ts-api/src/clients/fs.ts`
- `packages/frontend/src/commands/registryData.ts`

---

## Task 11: Directory Synchronization

**Priority:** Medium
**Dependencies:** Task 10 (File Compare)
**Estimated Complexity:** Medium

### Goal

Compare two directories and offer synchronization actions (copy newer, copy missing, delete extra).

### Implementation Plan

#### 1. Directory Comparison

- Compare by name, size, modification date
- Optional: compare by content (hash)
- Recursive or flat comparison

#### 2. Sync Plan

- Show proposed actions in a table:
  - Copy from left to right (missing or newer)
  - Copy from right to left (missing or newer)
  - Delete (extra files)
  - Skip (same)
- User can select/deselect individual actions

#### 3. Execute Sync

- Use existing file operation pipeline
- Show progress, allow cancellation
- Log results

#### 4. Sync Dialog

**New file:** `packages/frontend/src/components/SyncDirectoriesDialog.tsx`

- Select two directories (from panes or via path input)
- Comparison options (by date, size, content)
- Preview sync plan
- Execute with progress

#### 5. Save Sync Pairs

- Remember frequently synced directory pairs
- Quick-access from Tools menu

**Files to Create:**

- `crates/fs-core/src/sync.rs`
- `packages/frontend/src/components/SyncDirectoriesDialog.tsx`

**Files to Modify:**

- `crates/fs-core/src/lib.rs`
- `apps/desktop-tauri/src-tauri/src/commands/fs.rs`
- `crates/app-ipc/src/lib.rs`
- `packages/ts-api/src/clients/fs.ts`
- `packages/frontend/src/commands/registryData.ts`

---

## Implementation Order

| Step | Task                           | Dependencies | Priority |
| ---- | ------------------------------ | ------------ | -------- |
| 1    | Task 1: Settings restructure   | None         | High     |
| 2    | Task 2: Customizable shortcuts | Task 1       | High     |
| 3    | Task 3: File type color rules  | Task 1       | High     |
| 4    | Task 4: Layout profiles        | Task 1       | Medium   |
| 5    | Task 5: Per-pane layout        | Task 1       | Medium   |
| 6    | Task 6: Multi-rename tool      | None         | High     |
| 7    | Task 7: Content search         | None         | Medium   |
| 8    | Task 8: Tab sessions           | None         | Medium   |
| 9    | Task 9: Directory hotlist      | None         | Low      |
| 10   | Task 10: File compare          | None         | Medium   |
| 11   | Task 11: Directory sync        | Task 10      | Medium   |

---

## Success Criteria

- Settings dialog has 12+ organized categories with tree navigation
- Users can rebind all keyboard shortcuts with conflict detection
- File type color rules are applied in the file list
- Layout profiles can be saved, loaded, imported, and exported
- Multi-rename tool supports patterns, regex, and live preview
- Content search finds text within files with regex support
- Tab sessions persist across app restarts
- Directory hotlist provides quick access with Ctrl+1..9
- File compare shows side-by-side diffs for text and binary files
- Directory sync offers intelligent synchronization actions

---

## Notes

- All new preferences follow the existing pattern: Rust-side validation, SQLite persistence, TypeScript DTO mirroring
- All new dialogs follow existing patterns: `useDialogEscape`, `useFocusTrap`, `ModalsProvider` state
- All new commands follow existing patterns: `registryData.ts` definition, `dispatch.ts` handler, keyboard shortcut binding
- Import/export features use browser-native file APIs (`URL.createObjectURL`, `<input type="file">`)
