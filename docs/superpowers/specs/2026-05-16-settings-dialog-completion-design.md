# Settings Dialog Completion — Design

**Date:** 2026-05-16
**Status:** Draft
**Scope:** Slice B of the E2E audit follow-up (slice A was the keyboard-shortcut bug fixes, shipped separately).

## Problem

The audit in `docs/qa/e2e-audit-report.md` found the SettingsDialog is only ~55% implemented. The General tab is a placeholder, and several specified preference fields (accent color, font size, icon size, confirm-before-overwrite, sidebar visibility, start-on-system-startup) are missing. This design closes the highest-value gaps without dragging in adjacent features that require new infrastructure.

## Scope

### In scope

1. **Appearance tab** additions: accent color (8-swatch palette), font size (Small/Medium/Large), icon size (Small/Medium/Large).
2. **Files & Folders tab** addition: confirm-before-overwrite boolean.
3. **Layout tab** addition: sidebar-visibility boolean.
4. **General tab**: replace the placeholder with a single working preference — _Start FileOctopus on system startup_, backed by `tauri-plugin-autostart`.

### Out of scope (deferred to later slices)

- **Remember last used panes / last-path restore** — shipping the toggle without the boot-time restore wiring would create a dead control. Group with last-path restore.
- **Diagnostics export location** — requires a file picker flow.
- **Operations / Shortcuts / Advanced tabs** — reorganization of existing prefs; UX polish slice.
- **Default view mode refinement** — already wired today.

### Non-goals

- No changes to existing prefs' semantics (theme, density, defaultViewMode, showHiddenFiles, confirmDelete, confirmPermanentDelete, useTrashByDefault, defaultConflictPolicy, activityPanelVisible, sidebarWidth, splitRatio, activityPanelWidth).
- No new component primitives in `@fileoctopus/ui`; styling lives in the SettingsDialog CSS scope.

## Architecture

The trust boundary remains the IPC layer. Five of the six new settings are pure persisted preferences and ride the existing `get_preferences` / `set_preference(key, value)` commands. The sixth (auto-launch) introduces a new command pair because the source of truth is the OS via `tauri-plugin-autostart`, not our SQLite DB.

```
SettingsDialog (React)
  ├─ onChange(key, value) ──→ set_preference ──→ PreferencesRepository ──→ SQLite
  └─ onSetAutostart(bool)  ──→ set_autostart  ──→ tauri-plugin-autostart ──→ OS
```

## Backend changes

### `crates/config/src/lib.rs`

Add fields to `UserPreferences`:

| Field               | Type   | Default    | Validator            |
| ------------------- | ------ | ---------- | -------------------- |
| `accent_color`      | String | `"blue"`   | 8-name whitelist     |
| `font_scale`        | String | `"medium"` | `small/medium/large` |
| `icon_scale`        | String | `"medium"` | `small/medium/large` |
| `confirm_overwrite` | bool   | `true`     | `parse_bool`         |
| `sidebar_visible`   | bool   | `true`     | `parse_bool`         |

Accent palette: `blue | indigo | violet | pink | red | orange | amber | green`.

**Migration:** bump `SCHEMA_VERSION` from 4 to 5. Add `backfill_v5_keys` modeled on `backfill_v3_keys` and `backfill_v4_keys` — inserts default rows for the five new keys with `on conflict(key) do nothing`. No data loss; existing rows untouched.

**`apply_value`:** add three new validators (`parse_accent_color`, `parse_scale` shared between font and icon, existing `parse_bool` for the two booleans). Use the existing `invalid_value(key, reason)` for error construction so error codes stay stable.

**`as_rows`:** append the five new key/value pairs in the order matching the field declarations.

### `crates/app-ipc/src/lib.rs`

Mirror the five new fields on `UserPreferencesDto` (camelCase, `#[serde(rename_all = "camelCase")]` already applied). Extend the `From<UserPreferences>` impl with one line per field. Add:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AutostartStatusDto {
    pub enabled: bool,
    pub supported: bool,
}
```

Add a new error code `autostart_unavailable` to the existing `IpcError` mapping for any failure originating from the autostart plugin.

### `apps/desktop-tauri/src-tauri`

`Cargo.toml`: add `tauri-plugin-autostart = "2"`.

`src/lib.rs`:

- Register the plugin in the `tauri::Builder` chain.
- Add two commands:

```rust
#[tauri::command]
async fn get_autostart(app: AppHandle) -> Result<AutostartStatusDto, IpcError>;

#[tauri::command]
async fn set_autostart(app: AppHandle, enabled: bool) -> Result<AutostartStatusDto, IpcError>;
```

Both call `app.autolaunch()` and surface `supported = false` on `Unsupported` / similar errors rather than failing the whole call. Wire them into `tauri::generate_handler!`.

### `packages/ts-api/src/`

- `types.ts`: extend `UserPreferencesDto` with the five new fields; add `AutostartStatusDto`.
- `client.ts`: add `autostart: { get(): Promise<AutostartStatusDto>; set(enabled: boolean): Promise<AutostartStatusDto> }` on `FileOctopusClient`.
- `commandMap`: `autostart.get` → `get_autostart`, `autostart.set` → `set_autostart`.

## Frontend changes

### `packages/ui/src/tokens.css`

Add two base tokens plus attribute-driven overrides on `:root`. Attribute naming matches the existing `data-theme` / `data-density` convention (no `fo-` prefix):

```css
:root {
  --fo-base-font-size: 14px;
  --fo-icon-size: 16px;
}
[data-font-scale="small"] {
  --fo-base-font-size: 13px;
}
[data-font-scale="large"] {
  --fo-base-font-size: 16px;
}
[data-icon-scale="small"] {
  --fo-icon-size: 14px;
}
[data-icon-scale="large"] {
  --fo-icon-size: 20px;
}

[data-accent="indigo"] {
  --fo-accent: #5b6cff;
  --fo-accent-soft: #e9ecff;
}
[data-accent="violet"] {
  --fo-accent: #8b5cf6;
  --fo-accent-soft: #f0e8ff;
}
[data-accent="pink"] {
  --fo-accent: #ec4899;
  --fo-accent-soft: #fde6f1;
}
[data-accent="red"] {
  --fo-accent: #dc2626;
  --fo-accent-soft: #fce4e4;
}
[data-accent="orange"] {
  --fo-accent: #ea580c;
  --fo-accent-soft: #ffe8d6;
}
[data-accent="amber"] {
  --fo-accent: #d97706;
  --fo-accent-soft: #fff0d1;
}
[data-accent="green"] {
  --fo-accent: #16a34a;
  --fo-accent-soft: #dcf3e2;
}
```

"blue" is the existing default; no override row.

### `packages/ui/src/icons.tsx`

Replace `export const iconSize = 16` with `export const iconSize = "var(--fo-icon-size)"`. Lucide accepts string sizes; SVG renders accept CSS var values.

### Preference effect (`packages/frontend/src/applyPreferences.ts`)

Add `applyAccentPreference`, `applyFontScalePreference`, `applyIconScalePreference` alongside the existing `applyThemePreference` / `applyDensityPreference`, and include them in `applyAllPreferences`. Each maps the pref string to a validated value (defaulting to "blue" / "medium" on unknown input) and sets the corresponding `data-*` attribute on `document.documentElement`:

```ts
document.documentElement.dataset.accent = preferences.accentColor;
document.documentElement.dataset.fontScale = preferences.fontScale;
document.documentElement.dataset.iconScale = preferences.iconScale;
```

Add `font-size: var(--fo-base-font-size)` on `:root` (or `.fo-shell`).

### `packages/frontend/src/components/SettingsDialog.tsx`

Props expand to:

```ts
interface SettingsDialogProps {
  open: boolean;
  preferences: UserPreferencesDto;
  autostart: AutostartStatusDto | null;
  onClose: () => void;
  onChange: (key: string, value: string) => void;
  onSetAutostart: (enabled: boolean) => Promise<void>;
}
```

**General tab** — replaces placeholder:

- Single switch "Start FileOctopus on system startup". Disabled with tooltip when `autostart.supported === false` or when `autostart === null` due to fetch failure.
- Below it: "More general preferences will appear here." (single sentence, acknowledges deferred work without lying).

**Appearance tab** — append after Density:

- Accent color: row of 8 swatch buttons (`button` with `aria-pressed`), 24×24 circles filled with the palette color. Selected swatch shows a 2px ring in `--fo-focus`.
- Font size: segmented control with three buttons (Small / Medium / Large).
- Icon size: same segmented pattern.

**Files & Folders tab** — append:

- Switch "Confirm before overwrite".

**Layout tab** — append above "Show activity panel":

- Switch "Show sidebar".

### `packages/frontend/src/index.tsx`

- Add `autostart` state (`useState<AutostartStatusDto | null>(null)`). Lazy-fetch via `client.autostart.get()` the first time `setSettingsOpen(true)` runs (`useEffect` keyed on settings-open). Don't fetch on app boot.
- Provide `onSetAutostart` callback; serializes calls via a `useRef<Promise<void> | null>` to ignore mashed toggles.
- **`confirmOverwrite` consumer**: in the existing Copy/Move plan flow, when the plan reports zero conflicts AND `preferences.confirmOverwrite === true` AND `preferences.defaultConflictPolicy === "overwrite"`, insert a one-step "Confirm overwrite" prompt before calling `start_file_operation`. This is the only behavior change wired in slice B; all other new prefs are render-time only.
- **`sidebarVisible` consumer**: gate rendering of the sidebar column and `SidebarResizer` on `preferences.sidebarVisible`. When false, collapse the grid column to 0 and don't mount the resizer. No new keyboard shortcut — user reopens via Settings.

### CSS — settings-internal styles

One new class scoped to the settings dialog:

- `.fo-settings-swatches` — flex row of 24×24 circles with selected ring (added to the existing settings stylesheet, not the UI package).

The segmented controls (font size, icon size) reuse the existing `SegmentedControl` primitive exported from `@fileoctopus/ui` (already styled as `.fo-ui-segmented`). No new component primitive is needed.

## Error handling

- **Pref writes:** existing path. Invalid values surface as `IpcError { code: "invalid_value" }`; toast + revert control to prior value (no new code).
- **`set_autostart` failure:** toast with the IPC message; revert toggle to the value from the most recent `get_autostart`.
- **`get_autostart` failure on dialog open:** General tab renders with the toggle disabled and a tooltip "Couldn't read system startup state." Other tabs unaffected.

## Edge cases

- **First-run after upgrade (v4→v5):** migration backfills defaults; existing values preserved. Covered by a migration test.
- **Sidebar collapsed to 0 width:** `SidebarResizer` not mounted, so no 0-width drag handle.
- **Icon size change with large folder rendered:** virtualized rows recompute from CSS; no cache invalidation needed.
- **Accent ring contrast in dark mode:** ring uses `--fo-focus`, theme-aware. Manual QA verifies red/amber swatches in dark mode.
- **Autostart toggle race:** ref-based serialization rejects concurrent calls.

## Testing

### Rust

- `crates/config`:
  - `parse_accent_color` accepts each of the 8 palette names, rejects unknown.
  - `parse_scale` accepts `small/medium/large`, rejects unknown.
  - v4→v5 migration: open a v4 DB fixture, instantiate `PreferencesRepository`, assert all 5 new keys present at default values and existing rows untouched.
- `crates/app-ipc`: serde round-trip test for `AutostartStatusDto` and the extended `UserPreferencesDto`.

### Frontend (Vitest)

- `SettingsDialog` test file:
  - Renders each tab; new controls present.
  - `onChange` fires for accentColor / fontScale / iconScale / confirmOverwrite / sidebarVisible.
  - General tab toggle disabled when `autostart.supported === false`.
  - Mashed autostart toggle calls `onSetAutostart` only once until the in-flight promise resolves.

### Manual QA

Append a section to `scripts/sprint-2-manual-qa.sh` (or create a `sprint-b-manual-qa.sh`):

1. Toggle each new pref, restart app, confirm persistence.
2. Toggle autostart, verify OS-level state (Linux: presence of `~/.config/autostart/FileOctopus.desktop`; macOS: Login Items entry).
3. Visual: each accent swatch correctly recolors selected toolbar buttons and badges. Each font/icon scale visibly changes the UI.

### CI gates

All must pass: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm rust:check`, `pnpm rust:test`, `pnpm rust:fmt`, `pnpm rust:clippy`.

## Risks and mitigations

- **`tauri-plugin-autostart` platform parity:** Linux/macOS/Windows have different mechanisms (XDG `.desktop` file, Login Items, registry). Mitigation: `supported` flag on `AutostartStatusDto`; UI gracefully disables.
- **Icon size as string breaks a downstream consumer:** Lucide accepts string sizes including CSS vars; verified by reading `lucide-react` types. Any custom SVG consumer would fail typecheck and surface immediately.
- **Migration backfill on a corrupted v4 DB:** `on conflict(key) do nothing` is idempotent; if existing rows are malformed, `apply_value` rejects them on next boot — recoverable by user editing or DB reset.

## Implementation order

Recommended (each step verifiable independently):

1. Backend pref fields + migration + validators + tests.
2. IPC DTO extension + ts-api types/client wiring.
3. CSS tokens + icon-size const change.
4. SettingsDialog UI for the five pure prefs (no auto-launch yet).
5. `confirmOverwrite` consumer in Copy/Move flow.
6. `sidebarVisible` consumer in layout.
7. `tauri-plugin-autostart` integration: Cargo dep, plugin register, `get_autostart`/`set_autostart` commands, ts-api wiring.
8. General-tab UI for autostart.
9. Manual QA script update.
