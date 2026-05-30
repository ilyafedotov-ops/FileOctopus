# Settings & Controls Gap Fill Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the gap between the UI design spec and current implementation by adding missing preference fields, wiring the SettingsDialog section navigation, adding missing keyboard shortcuts, and surfacing missing toolbar/context menu actions.

**Architecture:** The preference pipeline flows Rust `config::UserPreferences` -> `app-ipc::UserPreferencesDto` -> `ts-api` types -> `PreferencesClient` -> `SettingsDialog`. Each new preference requires changes across all layers. The SettingsDialog gets section navigation wired via a simple `activeSection` state. Missing shortcuts and toolbar actions are additive.

**Tech Stack:** Rust (serde, rusqlite), TypeScript, React, Tauri v2 IPC

---

## Task 1: Add new preference fields to Rust `config` crate

**Files:**

- Modify: `crates/config/src/lib.rs`

**Step 1: Add new fields to `UserPreferences` struct**

Add these fields to the struct (after `activity_panel_width`):

```rust
pub confirm_delete: bool,
pub confirm_permanent_delete: bool,
pub use_trash_by_default: bool,
pub default_conflict_policy: String,
```

Update `Default` implementation:

```rust
confirm_delete: true,
confirm_permanent_delete: true,
use_trash_by_default: true,
default_conflict_policy: "fail".to_string(),
```

**Step 2: Update `as_rows` to include new fields**

Add to the vec:

```rust
("confirmDelete", self.confirm_delete.to_string()),
("confirmPermanentDelete", self.confirm_permanent_delete.to_string()),
("useTrashByDefault", self.use_trash_by_default.to_string()),
("defaultConflictPolicy", self.default_conflict_policy.clone()),
```

**Step 3: Update `apply_value` to handle new keys**

Add match arms:

```rust
"confirmDelete" => {
    preferences.confirm_delete = parse_bool(value)?;
}
"confirmPermanentDelete" => {
    preferences.confirm_permanent_delete = parse_bool(value)?;
}
"useTrashByDefault" => {
    preferences.use_trash_by_default = parse_bool(value)?;
}
"defaultConflictPolicy" => {
    preferences.default_conflict_policy = parse_conflict_policy(value)?;
}
```

Add the parser function:

```rust
fn parse_conflict_policy(value: &str) -> Result<String, PreferencesError> {
    match value {
        "fail" | "skip" | "overwrite" | "renameNew" | "renameExisting" => Ok(value.to_string()),
        other => Err(invalid_value(
            "defaultConflictPolicy",
            format!("unsupported value `{other}`"),
        )),
    }
}
```

**Step 4: Bump schema version**

Change `SCHEMA_VERSION` from `3` to `4`. Add a `backfill_v4_keys` method that inserts the new keys with defaults (same pattern as `backfill_v3_keys`). Call it from `migrate` when `user_version < 4`.

**Step 5: Run tests**

Run: `cargo test -p fileoctopus-config`
Expected: All tests pass, including new schema migration.

**Step 6: Commit**

```bash
git add crates/config/src/lib.rs
git commit -m "feat(config): add confirm-delete, trash-default, and conflict-policy preferences"
```

---

## Task 2: Mirror new preference fields in IPC DTOs

**Files:**

- Modify: `crates/app-ipc/src/lib.rs`

**Step 1: Add fields to `UserPreferencesDto`**

```rust
pub confirm_delete: bool,
pub confirm_permanent_delete: bool,
pub use_trash_by_default: bool,
pub default_conflict_policy: String,
```

**Step 2: Update `From<config::UserPreferences> for UserPreferencesDto`**

Add mappings:

```rust
confirm_delete: value.confirm_delete,
confirm_permanent_delete: value.confirm_permanent_delete,
use_trash_by_default: value.use_trash_by_default,
default_conflict_policy: value.default_conflict_policy,
```

**Step 3: Run tests**

Run: `cargo test -p fileoctopus-app-ipc`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add crates/app-ipc/src/lib.rs
git commit -m "feat(ipc): mirror new preference fields in UserPreferencesDto"
```

---

## Task 3: Update TypeScript types and API client

**Files:**

- Modify: `packages/ts-api/src/types.ts`
- Modify: `packages/ts-api/src/client.ts`

**Step 1: Add fields to `UserPreferencesDto` in `types.ts`**

Add after `activityPanelWidth`:

```typescript
confirmDelete: boolean;
confirmPermanentDelete: boolean;
useTrashByDefault: boolean;
defaultConflictPolicy: string;
```

**Step 2: Update preview transport defaults in `client.ts`**

In `createPreviewTransport`, update `previewPreferences`:

```typescript
confirmDelete: true,
confirmPermanentDelete: true,
useTrashByDefault: true,
defaultConflictPolicy: "fail",
```

Update `preferenceValue` function to handle the new boolean keys:

```typescript
if (
  key === "showHiddenFiles" ||
  key === "activityPanelVisible" ||
  key === "confirmDelete" ||
  key === "confirmPermanentDelete" ||
  key === "useTrashByDefault"
) {
  return value === "true";
}
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors.

**Step 4: Commit**

```bash
git add packages/ts-api/src/types.ts packages/ts-api/src/client.ts
git commit -m "feat(ts-api): add new preference fields to types and preview transport"
```

---

## Task 4: Wire SettingsDialog section navigation

**Files:**

- Modify: `packages/frontend/src/components/SettingsDialog.tsx`

**Step 1: Add active section state and make nav items interactive**

Add `useState` for `activeSection` with values `"general" | "appearance" | "files" | "layout"`. Convert the `<span>` nav items to buttons with `onClick` that set `activeSection`. Apply `fo-settings-nav-active` class to the active one.

**Step 2: Conditionally render sections based on `activeSection`**

Map sections:

- **General** — empty placeholder for now (future: startup behavior, diagnostics location)
- **Appearance** — Theme, Density
- **Files & Folders** — Default view, Show hidden files, Confirm delete, Confirm permanent delete, Use trash by default, Default conflict policy
- **Layout** — Show activity panel

Move the existing sections to render only when their section is active. Add the new preference controls (checkboxes + select for conflict policy).

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors.

**Step 4: Commit**

```bash
git add packages/frontend/src/components/SettingsDialog.tsx
git commit -m "feat(ui): wire settings dialog section navigation and add missing preference controls"
```

---

## Task 5: Add missing keyboard shortcuts (Preferences + Shortcuts help)

**Files:**

- Modify: `packages/frontend/src/shortcuts.ts`
- Modify: `packages/frontend/src/index.tsx` (the `handleShellKeyDown` function)

**Step 1: Add shortcut entries**

Add to `shortcutEntries` array:

```typescript
{
  id: "preferences",
  label: "Open Preferences",
  mac: "⌘,",
  windowsLinux: "Ctrl+,",
  category: "Navigation",
},
{
  id: "shortcuts-help",
  label: "Keyboard shortcuts",
  mac: "⌘/",
  windowsLinux: "Ctrl+/",
  category: "Navigation",
},
{
  id: "delete-permanent",
  label: "Delete permanently",
  mac: "⇧Delete",
  windowsLinux: "Shift+Delete",
  category: "File operations",
},
```

**Step 2: Wire `Cmd/Ctrl+,` to open settings and `Cmd/Ctrl+/` to open shortcuts**

In `handleShellKeyDown` in `index.tsx`, add handling for these key combinations. They should call the existing `setSettingsOpen(true)` and `setShortcutsOpen(true)` callbacks.

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors.

**Step 4: Commit**

```bash
git add packages/frontend/src/shortcuts.ts packages/frontend/src/index.tsx
git commit -m "feat: add preferences (Cmd+,) and shortcuts-help (Cmd+/) keyboard shortcuts"
```

---

## Task 6: Add "Select All" and "Show Hidden" toolbar overflow items

**Files:**

- Modify: `packages/frontend/src/pane/OperationToolbar.tsx`

**Step 1: Add missing overflow items**

Add `Select All` action to overflow menu (after the Properties item, before the Hidden toggle):

```typescript
{
  id: "select-all",
  label: "Select All",
  icon: Icons.file(),
  shortcut: "Cmd+A",
  separatorBefore: true,
  onSelect: onSelectAll,
},
```

Add `onSelectAll` prop to `OperationToolbarProps`.

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors.

**Step 3: Commit**

```bash
git add packages/frontend/src/pane/OperationToolbar.tsx
git commit -m "feat(toolbar): add select-all to overflow menu"
```

---

## Task 7: Add "Show Hidden" and "Select All" to context menu

**Files:**

- Modify: `packages/frontend/src/components/ContextMenu.tsx`

**Step 1: Add Show Hidden toggle**

Add after the "Refresh" menu item. Requires a new prop `showHidden: boolean` and `onToggleHidden: (panelId: PanelId) => void`. The label should be `showHidden ? "Hide Hidden Files" : "Show Hidden Files"`.

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors.

**Step 3: Commit**

```bash
git add packages/frontend/src/components/ContextMenu.tsx
git commit -m "feat(context-menu): add show-hidden toggle"
```

---

## Task 8: Apply new preferences in `applyPreferences.ts`

**Files:**

- Modify: `packages/frontend/src/applyPreferences.ts`

**Step 1: No code changes needed for new preferences**

The new preferences (`confirmDelete`, `confirmPermanentDelete`, `useTrashByDefault`, `defaultConflictPolicy`) are behavioral preferences consumed by the operation dialog logic, not CSS/layout preferences. They will be read from the preferences state where needed.

**No commit needed — this task is documentation-only.**

---

## Task 9: Run full verification

**Step 1: Run Rust checks**

Run: `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test --workspace`
Expected: All pass.

**Step 2: Run TS checks**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: All pass.

**Step 3: Final commit (if any fixups needed)**

---

## Summary of Changes

| Layer            | New Fields                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| Rust `config`    | `confirm_delete`, `confirm_permanent_delete`, `use_trash_by_default`, `default_conflict_policy` |
| Rust `app-ipc`   | Mirrors of above in `UserPreferencesDto`                                                        |
| TS types         | Same 4 fields in `UserPreferencesDto`                                                           |
| TS client        | Preview transport defaults + `preferenceValue` handling                                         |
| SettingsDialog   | Section navigation (4 tabs), new checkboxes + conflict policy select                            |
| Shortcuts        | `Cmd/Ctrl+,` (preferences), `Cmd/Ctrl+/` (shortcuts help)                                       |
| Toolbar overflow | Select All action                                                                               |
| Context menu     | Show Hidden toggle                                                                              |
