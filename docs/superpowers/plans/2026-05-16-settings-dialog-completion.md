# Settings Dialog Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the highest-value gaps in the SettingsDialog identified by the E2E audit: accent color, font/icon scale, confirm-before-overwrite, sidebar visibility, and start-on-system-startup.

**Architecture:** Five new pure-prefs ride the existing `get_preferences` / `set_preference` IPC commands and the SQLite-backed `PreferencesRepository`. Auto-launch is a separate command pair backed by `tauri-plugin-autostart` (Tauri API is source of truth — not persisted in our DB). UI is plumbed through `data-*` attributes on `document.documentElement` consumed by CSS custom properties.

**Tech Stack:** Rust 2021 (`crates/config`, `crates/app-ipc`, `apps/desktop-tauri/src-tauri`), TypeScript / React 19 (`packages/ts-api`, `packages/ui`, `packages/frontend`), `tauri-plugin-autostart` v2, Vitest, Rust built-in `#[test]` framework.

**Reference spec:** `docs/superpowers/specs/2026-05-16-settings-dialog-completion-design.md`

---

## File map

**Modified:**

- `crates/config/src/lib.rs` — `UserPreferences` struct, defaults, validators, `as_rows`, `apply_value`, `SCHEMA_VERSION`, `backfill_v5_keys`, tests.
- `crates/app-ipc/src/lib.rs` — `UserPreferencesDto` fields, `AutostartStatusDto`, `From<UserPreferences>` impl, tests.
- `apps/desktop-tauri/src-tauri/Cargo.toml` — add `tauri-plugin-autostart` dep.
- `apps/desktop-tauri/src-tauri/src/lib.rs` — register plugin, add `get_autostart` and `set_autostart` commands, register them in `generate_handler!`.
- `packages/ts-api/src/types.ts` — extend `UserPreferencesDto`, add `AutostartStatusDto`.
- `packages/ts-api/src/client.ts` — add `AutostartClient`, register in `FileOctopusClient`, add to `commandMap`.
- `packages/ui/src/tokens.css` — add `--fo-base-font-size`, `--fo-icon-size`, attribute-driven overrides.
- `packages/ui/src/icons.tsx` — change `iconSize` constant to a CSS var string.
- `packages/frontend/src/applyPreferences.ts` — add `applyAccentPreference`, `applyFontScalePreference`, `applyIconScalePreference`, wire into `applyAllPreferences`, apply base font size.
- `packages/frontend/src/components/SettingsDialog.tsx` — expand props, add new controls to all four tabs.
- `packages/frontend/src/components/SettingsDialog.css` (or co-located styles in the existing dialog stylesheet — see Task 12).
- `packages/frontend/src/index.tsx` — fetch autostart on settings-open, serialize toggles, pass new props to `SettingsDialog`, wire `confirmOverwrite` consumer in Copy/Move flow, gate sidebar render on `sidebarVisible`.
- `scripts/sprint-2-manual-qa.sh` (or new `scripts/slice-b-manual-qa.sh`) — manual QA steps.

**Created (tests):**

- `crates/app-ipc/tests/autostart_dto.rs` — serde round-trip for `AutostartStatusDto`.
- `packages/frontend/tests/settingsDialog.test.tsx` — UI behaviour tests.

---

## Task 1: Add new preference fields and defaults

**Files:**

- Modify: `crates/config/src/lib.rs` (lines 26-60)
- Modify: `crates/config/src/lib.rs` (lines 260-286 — `as_rows`)

- [ ] **Step 1: Write the failing test**

Append to the `tests` module in `crates/config/src/lib.rs`:

```rust
    #[test]
    fn defaults_include_new_v5_fields() {
        let defaults = UserPreferences::default();
        assert_eq!(defaults.accent_color, "blue");
        assert_eq!(defaults.font_scale, "medium");
        assert_eq!(defaults.icon_scale, "medium");
        assert!(defaults.confirm_overwrite);
        assert!(defaults.sidebar_visible);
    }

    #[test]
    fn as_rows_serializes_new_fields() {
        let prefs = UserPreferences::default();
        let rows: std::collections::HashMap<&str, String> = prefs.as_rows().into_iter().collect();
        assert_eq!(rows["accentColor"], "blue");
        assert_eq!(rows["fontScale"], "medium");
        assert_eq!(rows["iconScale"], "medium");
        assert_eq!(rows["confirmOverwrite"], "true");
        assert_eq!(rows["sidebarVisible"], "true");
    }
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cargo test -p config -- defaults_include_new_v5_fields as_rows_serializes_new_fields
```

Expected: compile errors on missing fields.

- [ ] **Step 3: Add the fields to the struct**

In `crates/config/src/lib.rs` between lines 26 and 41, extend `UserPreferences`:

```rust
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserPreferences {
    pub theme: String,
    pub density: String,
    pub default_view_mode: String,
    pub show_hidden_files: bool,
    pub sidebar_width: u32,
    pub split_ratio: f64,
    pub activity_panel_visible: bool,
    pub activity_panel_width: u32,
    pub confirm_delete: bool,
    pub confirm_permanent_delete: bool,
    pub use_trash_by_default: bool,
    pub default_conflict_policy: String,
    pub accent_color: String,
    pub font_scale: String,
    pub icon_scale: String,
    pub confirm_overwrite: bool,
    pub sidebar_visible: bool,
}
```

- [ ] **Step 4: Add fields to `Default` impl**

Replace the existing `impl Default for UserPreferences` (lines 43-60) with:

```rust
impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            density: "comfortable".to_string(),
            default_view_mode: "details".to_string(),
            show_hidden_files: false,
            sidebar_width: 240,
            split_ratio: 0.5,
            activity_panel_visible: true,
            activity_panel_width: 288,
            confirm_delete: true,
            confirm_permanent_delete: true,
            use_trash_by_default: true,
            default_conflict_policy: "fail".to_string(),
            accent_color: "blue".to_string(),
            font_scale: "medium".to_string(),
            icon_scale: "medium".to_string(),
            confirm_overwrite: true,
            sidebar_visible: true,
        }
    }
}
```

- [ ] **Step 5: Add fields to `as_rows`**

Replace the existing `impl UserPreferences` block (lines 260-286) with:

```rust
impl UserPreferences {
    fn as_rows(&self) -> Vec<(&str, String)> {
        vec![
            ("theme", self.theme.clone()),
            ("density", self.density.clone()),
            ("defaultViewMode", self.default_view_mode.clone()),
            ("showHiddenFiles", self.show_hidden_files.to_string()),
            ("sidebarWidth", self.sidebar_width.to_string()),
            ("splitRatio", self.split_ratio.to_string()),
            (
                "activityPanelVisible",
                self.activity_panel_visible.to_string(),
            ),
            ("activityPanelWidth", self.activity_panel_width.to_string()),
            ("confirmDelete", self.confirm_delete.to_string()),
            (
                "confirmPermanentDelete",
                self.confirm_permanent_delete.to_string(),
            ),
            ("useTrashByDefault", self.use_trash_by_default.to_string()),
            (
                "defaultConflictPolicy",
                self.default_conflict_policy.clone(),
            ),
            ("accentColor", self.accent_color.clone()),
            ("fontScale", self.font_scale.clone()),
            ("iconScale", self.icon_scale.clone()),
            ("confirmOverwrite", self.confirm_overwrite.to_string()),
            ("sidebarVisible", self.sidebar_visible.to_string()),
        ]
    }
}
```

- [ ] **Step 6: Run tests**

```bash
cargo test -p config -- defaults_include_new_v5_fields as_rows_serializes_new_fields
```

Expected: PASS. (Other config tests likely fail because `apply_value` does not yet accept the new keys — Task 2 fixes that.)

- [ ] **Step 7: Commit**

```bash
git add crates/config/src/lib.rs
git commit -m "feat(config): add accent/scale/overwrite/sidebar preference fields"
```

---

## Task 2: Add validators for the new keys

**Files:**

- Modify: `crates/config/src/lib.rs` (lines 288-395)

- [ ] **Step 1: Write failing tests**

Append to the `tests` module:

```rust
    #[test]
    fn accepts_valid_accent_colors() {
        let dir = tempdir().unwrap();
        let repository =
            PreferencesRepository::new(dir.path().join("preferences.sqlite")).unwrap();
        for name in [
            "blue", "indigo", "violet", "pink", "red", "orange", "amber", "green",
        ] {
            assert!(repository.set("accentColor", name).is_ok(), "accept {name}");
        }
    }

    #[test]
    fn rejects_invalid_accent_color() {
        let dir = tempdir().unwrap();
        let repository =
            PreferencesRepository::new(dir.path().join("preferences.sqlite")).unwrap();
        let err = repository.set("accentColor", "chartreuse").unwrap_err();
        assert!(matches!(err, PreferencesError::InvalidValue { .. }));
    }

    #[test]
    fn accepts_valid_scales() {
        let dir = tempdir().unwrap();
        let repository =
            PreferencesRepository::new(dir.path().join("preferences.sqlite")).unwrap();
        for key in ["fontScale", "iconScale"] {
            for value in ["small", "medium", "large"] {
                assert!(repository.set(key, value).is_ok(), "accept {key}={value}");
            }
        }
    }

    #[test]
    fn rejects_invalid_scale() {
        let dir = tempdir().unwrap();
        let repository =
            PreferencesRepository::new(dir.path().join("preferences.sqlite")).unwrap();
        assert!(matches!(
            repository.set("fontScale", "gigantic").unwrap_err(),
            PreferencesError::InvalidValue { .. }
        ));
    }

    #[test]
    fn round_trips_overwrite_and_sidebar_booleans() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("preferences.sqlite");
        let repository = PreferencesRepository::new(path.clone()).unwrap();
        repository.set("confirmOverwrite", "false").unwrap();
        repository.set("sidebarVisible", "false").unwrap();
        let reloaded = PreferencesRepository::new(path).unwrap().get_all().unwrap();
        assert!(!reloaded.confirm_overwrite);
        assert!(!reloaded.sidebar_visible);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cargo test -p config
```

Expected: the new tests fail (`apply_value` doesn't accept the new keys, so set returns Ok but value is not stored — or test asserts trip).

- [ ] **Step 3: Extend `apply_value` with new keys**

In `crates/config/src/lib.rs`, locate `fn apply_value` (starts at line 288) and add new match arms before the catch-all `_ => {}`. Replace the function's body so the inner match looks like:

```rust
    match key {
        "theme" => {
            preferences.theme = parse_theme(value)?;
        }
        "density" => {
            preferences.density = parse_density(value)?;
        }
        "defaultViewMode" => {
            preferences.default_view_mode = parse_view_mode(value)?;
        }
        "showHiddenFiles" => {
            preferences.show_hidden_files = parse_bool(value, key)?;
        }
        "sidebarWidth" => {
            preferences.sidebar_width = value
                .parse::<u32>()
                .map_err(|error| invalid_value(key, error.to_string()))?
                .clamp(160, 480);
        }
        "splitRatio" => {
            preferences.split_ratio = value
                .parse::<f64>()
                .map_err(|error| invalid_value(key, error.to_string()))?
                .clamp(0.2, 0.8);
        }
        "activityPanelVisible" => {
            preferences.activity_panel_visible = parse_bool(value, key)?;
        }
        "activityPanelWidth" => {
            preferences.activity_panel_width = value
                .parse::<u32>()
                .map_err(|error| invalid_value(key, error.to_string()))?
                .clamp(200, 480);
        }
        "confirmDelete" => {
            preferences.confirm_delete = parse_bool(value, key)?;
        }
        "confirmPermanentDelete" => {
            preferences.confirm_permanent_delete = parse_bool(value, key)?;
        }
        "useTrashByDefault" => {
            preferences.use_trash_by_default = parse_bool(value, key)?;
        }
        "defaultConflictPolicy" => {
            preferences.default_conflict_policy = parse_conflict_policy(value)?;
        }
        "accentColor" => {
            preferences.accent_color = parse_accent_color(value)?;
        }
        "fontScale" => {
            preferences.font_scale = parse_scale("fontScale", value)?;
        }
        "iconScale" => {
            preferences.icon_scale = parse_scale("iconScale", value)?;
        }
        "confirmOverwrite" => {
            preferences.confirm_overwrite = parse_bool(value, key)?;
        }
        "sidebarVisible" => {
            preferences.sidebar_visible = parse_bool(value, key)?;
        }
        _ => {}
    }
```

Note: `parse_bool` now takes the key name so error messages report the correct key. Add new helpers below the existing parsers, and modify `parse_bool` to accept a key argument. Replace the existing `parse_bool` (lines 385-394) and append the new parsers:

```rust
fn parse_bool(value: &str, key: &str) -> Result<bool, PreferencesError> {
    match value {
        "true" | "1" => Ok(true),
        "false" | "0" => Ok(false),
        other => Err(invalid_value(key, format!("unsupported value `{other}`"))),
    }
}

fn parse_accent_color(value: &str) -> Result<String, PreferencesError> {
    match value {
        "blue" | "indigo" | "violet" | "pink" | "red" | "orange" | "amber" | "green" => {
            Ok(value.to_string())
        }
        other => Err(invalid_value(
            "accentColor",
            format!("unsupported value `{other}`"),
        )),
    }
}

fn parse_scale(key: &'static str, value: &str) -> Result<String, PreferencesError> {
    match value {
        "small" | "medium" | "large" => Ok(value.to_string()),
        other => Err(invalid_value(key, format!("unsupported value `{other}`"))),
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cargo test -p config
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add crates/config/src/lib.rs
git commit -m "feat(config): validate accent/scale/overwrite/sidebar pref keys"
```

---

## Task 3: Bump schema to v5 with backfill

**Files:**

- Modify: `crates/config/src/lib.rs` (lines 14, 110-198)

- [ ] **Step 1: Write failing migration test**

Append to the `tests` module:

```rust
    #[test]
    fn migrates_v4_database_to_v5_with_new_defaults() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("preferences.sqlite");

        // Simulate a v4 DB: open, set pragma user_version=4, seed only legacy keys.
        {
            let connection = Connection::open(&path).unwrap();
            connection
                .execute(
                    "create table if not exists preferences (
                        key text primary key,
                        value text not null,
                        updated_at text not null
                    )",
                    [],
                )
                .unwrap();
            connection
                .execute(
                    "insert into preferences (key, value, updated_at) values
                        ('theme', 'dark', '0'),
                        ('density', 'compact', '0')",
                    [],
                )
                .unwrap();
            connection.pragma_update(None, "user_version", 4u32).unwrap();
        }

        // Open via repository; migration should run.
        let repository = PreferencesRepository::new(path.clone()).unwrap();
        let prefs = repository.get_all().unwrap();

        // Existing values preserved.
        assert_eq!(prefs.theme, "dark");
        assert_eq!(prefs.density, "compact");
        // New v5 defaults applied.
        assert_eq!(prefs.accent_color, "blue");
        assert_eq!(prefs.font_scale, "medium");
        assert_eq!(prefs.icon_scale, "medium");
        assert!(prefs.confirm_overwrite);
        assert!(prefs.sidebar_visible);

        // user_version is now 5.
        let connection = Connection::open(&path).unwrap();
        let version: u32 = connection
            .query_row("pragma user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 5);
    }
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cargo test -p config -- migrates_v4_database_to_v5_with_new_defaults
```

Expected: FAIL — schema is still v4.

- [ ] **Step 3: Bump SCHEMA_VERSION**

Change line 14 of `crates/config/src/lib.rs`:

```rust
pub const SCHEMA_VERSION: u32 = 5;
```

- [ ] **Step 4: Add v5 backfill**

In `fn migrate` (around lines 110-144), insert a v5 backfill branch after the v4 branch:

```rust
        if user_version < 5 {
            self.backfill_v5_keys(&connection)?;
            connection.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        }
```

Then add the `backfill_v5_keys` method below `backfill_v4_keys`:

```rust
    fn backfill_v5_keys(&self, connection: &Connection) -> Result<(), PreferencesError> {
        let defaults = UserPreferences::default();
        let now = chrono_lite_now();
        let rows = [
            ("accentColor", defaults.accent_color.clone()),
            ("fontScale", defaults.font_scale.clone()),
            ("iconScale", defaults.icon_scale.clone()),
            ("confirmOverwrite", defaults.confirm_overwrite.to_string()),
            ("sidebarVisible", defaults.sidebar_visible.to_string()),
        ];

        for (key, value) in rows {
            connection.execute(
                "insert into preferences (key, value, updated_at) values (?1, ?2, ?3)
                 on conflict(key) do nothing",
                params![key, value, now],
            )?;
        }

        Ok(())
    }
```

- [ ] **Step 5: Run all config tests**

```bash
cargo test -p config
```

Expected: PASS. The existing `persists_and_validates_preferences` and `rejects_invalid_theme` still pass; new migration test passes.

- [ ] **Step 6: Workspace check**

```bash
cargo check --workspace
```

Expected: clean compile (Tasks 4-21 layer on top; this task leaves the workspace buildable).

- [ ] **Step 7: Commit**

```bash
git add crates/config/src/lib.rs
git commit -m "feat(config): bump prefs schema to v5 with backfill"
```

---

## Task 4: Extend IPC DTOs

**Files:**

- Modify: `crates/app-ipc/src/lib.rs` (lines 33-45, 620-635)
- Create: `crates/app-ipc/tests/autostart_dto.rs`

- [ ] **Step 1: Write failing DTO test**

Create `crates/app-ipc/tests/autostart_dto.rs`:

```rust
use app_ipc::{AutostartStatusDto, UserPreferencesDto};

#[test]
fn autostart_dto_round_trip() {
    let value = AutostartStatusDto {
        enabled: true,
        supported: true,
    };
    let json = serde_json::to_string(&value).unwrap();
    assert!(json.contains("\"enabled\":true"));
    assert!(json.contains("\"supported\":true"));
    let restored: AutostartStatusDto = serde_json::from_str(&json).unwrap();
    assert_eq!(restored, value);
}

#[test]
fn preferences_dto_includes_new_fields() {
    let json = r#"{
        "theme":"system","density":"comfortable","defaultViewMode":"details",
        "showHiddenFiles":false,"sidebarWidth":240,"splitRatio":0.5,
        "activityPanelVisible":true,"activityPanelWidth":288,
        "confirmDelete":true,"confirmPermanentDelete":true,
        "useTrashByDefault":true,"defaultConflictPolicy":"fail",
        "accentColor":"violet","fontScale":"large","iconScale":"small",
        "confirmOverwrite":false,"sidebarVisible":true
    }"#;
    let dto: UserPreferencesDto = serde_json::from_str(json).unwrap();
    assert_eq!(dto.accent_color, "violet");
    assert_eq!(dto.font_scale, "large");
    assert_eq!(dto.icon_scale, "small");
    assert!(!dto.confirm_overwrite);
    assert!(dto.sidebar_visible);
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cargo test -p app-ipc --test autostart_dto
```

Expected: FAIL — `AutostartStatusDto` and new fields don't exist.

- [ ] **Step 3: Add `AutostartStatusDto`**

In `crates/app-ipc/src/lib.rs`, after the `UserPreferencesDto` struct definition (around line 45), add:

```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutostartStatusDto {
    pub enabled: bool,
    pub supported: bool,
}
```

- [ ] **Step 4: Extend `UserPreferencesDto`**

Locate `pub struct UserPreferencesDto` (around line 33) and append five fields. Match the field order in `UserPreferences`:

```rust
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserPreferencesDto {
    pub theme: String,
    pub density: String,
    pub default_view_mode: String,
    pub show_hidden_files: bool,
    pub sidebar_width: u32,
    pub split_ratio: f64,
    pub activity_panel_visible: bool,
    pub activity_panel_width: u32,
    pub confirm_delete: bool,
    pub confirm_permanent_delete: bool,
    pub use_trash_by_default: bool,
    pub default_conflict_policy: String,
    pub accent_color: String,
    pub font_scale: String,
    pub icon_scale: String,
    pub confirm_overwrite: bool,
    pub sidebar_visible: bool,
}
```

- [ ] **Step 5: Extend `From<UserPreferences>` impl**

Locate `impl From<config::UserPreferences> for UserPreferencesDto` (around line 620). Replace its body so it maps all 17 fields:

```rust
impl From<config::UserPreferences> for UserPreferencesDto {
    fn from(value: config::UserPreferences) -> Self {
        Self {
            theme: value.theme,
            density: value.density,
            default_view_mode: value.default_view_mode,
            show_hidden_files: value.show_hidden_files,
            sidebar_width: value.sidebar_width,
            split_ratio: value.split_ratio,
            activity_panel_visible: value.activity_panel_visible,
            activity_panel_width: value.activity_panel_width,
            confirm_delete: value.confirm_delete,
            confirm_permanent_delete: value.confirm_permanent_delete,
            use_trash_by_default: value.use_trash_by_default,
            default_conflict_policy: value.default_conflict_policy,
            accent_color: value.accent_color,
            font_scale: value.font_scale,
            icon_scale: value.icon_scale,
            confirm_overwrite: value.confirm_overwrite,
            sidebar_visible: value.sidebar_visible,
        }
    }
}
```

- [ ] **Step 6: Run tests**

```bash
cargo test -p app-ipc
```

Expected: PASS, including the new `autostart_dto` tests.

- [ ] **Step 7: Commit**

```bash
git add crates/app-ipc/src/lib.rs crates/app-ipc/tests/autostart_dto.rs
git commit -m "feat(ipc): add AutostartStatusDto and extend UserPreferencesDto"
```

---

## Task 5: ts-api types and client wiring

**Files:**

- Modify: `packages/ts-api/src/types.ts`
- Modify: `packages/ts-api/src/client.ts`

- [ ] **Step 1: Extend `UserPreferencesDto` in types.ts**

Find the existing `UserPreferencesDto` type in `packages/ts-api/src/types.ts` (use `grep -n "UserPreferencesDto" packages/ts-api/src/types.ts`). Append five fields matching the Rust DTO:

```ts
export interface UserPreferencesDto {
  theme: string;
  density: string;
  defaultViewMode: string;
  showHiddenFiles: boolean;
  sidebarWidth: number;
  splitRatio: number;
  activityPanelVisible: boolean;
  activityPanelWidth: number;
  confirmDelete: boolean;
  confirmPermanentDelete: boolean;
  useTrashByDefault: boolean;
  defaultConflictPolicy: string;
  accentColor: string;
  fontScale: string;
  iconScale: string;
  confirmOverwrite: boolean;
  sidebarVisible: boolean;
}
```

- [ ] **Step 2: Add `AutostartStatusDto`**

Append to `packages/ts-api/src/types.ts`:

```ts
export interface AutostartStatusDto {
  enabled: boolean;
  supported: boolean;
}
```

- [ ] **Step 3: Update `commandMap` in client.ts**

In `packages/ts-api/src/client.ts`, locate the `commandMap` object (lines 76-116). Add after `"preferences.set"`:

```ts
  "autostart.get": "get_autostart",
  "autostart.set": "set_autostart",
```

- [ ] **Step 4: Add `AutostartClient`**

In `packages/ts-api/src/client.ts`, near the other `*Client` classes (after `PreferencesClient` around line 300), add:

```ts
export class AutostartClient {
  constructor(private readonly transport: IpcTransport) {}

  async get(): Promise<AutostartStatusDto> {
    try {
      return await this.transport.invoke<AutostartStatusDto>("autostart.get");
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async set(enabled: boolean): Promise<AutostartStatusDto> {
    try {
      return await this.transport.invoke<AutostartStatusDto>("autostart.set", {
        enabled,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }
}
```

Then in `FileOctopusClient` (lines 118-140), declare and instantiate the new client:

```ts
export class FileOctopusClient {
  readonly fs: FsClient;
  readonly fileOperations: FileOperationsClient;
  readonly jobs: JobsClient;
  readonly operationHistory: OperationHistoryClient;
  readonly diagnostics: DiagnosticsClient;
  readonly preferences: PreferencesClient;
  readonly navigation: NavigationClient;
  readonly autostart: AutostartClient;

  constructor(private readonly transport: IpcTransport) {
    this.fs = new FsClient(transport);
    this.fileOperations = new FileOperationsClient(transport);
    this.jobs = new JobsClient(transport);
    this.operationHistory = new OperationHistoryClient(transport);
    this.diagnostics = new DiagnosticsClient(transport);
    this.preferences = new PreferencesClient(transport);
    this.navigation = new NavigationClient(transport);
    this.autostart = new AutostartClient(transport);
  }
  // ...existing methods...
}
```

Also add `AutostartStatusDto` to the existing top-of-file import from `./types`.

- [ ] **Step 5: Update preview transport defaults**

In `client.ts`, locate `previewPreferences` (around line 661 — `let previewPreferences: UserPreferencesDto = {`). Append the five new defaults so the preview transport keeps compiling:

```ts
let previewPreferences: UserPreferencesDto = {
  theme: "system",
  density: "comfortable",
  defaultViewMode: "details",
  showHiddenFiles: false,
  sidebarWidth: 240,
  splitRatio: 0.5,
  activityPanelVisible: true,
  activityPanelWidth: 288,
  confirmDelete: true,
  confirmPermanentDelete: true,
  useTrashByDefault: true,
  defaultConflictPolicy: "fail",
  accentColor: "blue",
  fontScale: "medium",
  iconScale: "medium",
  confirmOverwrite: true,
  sidebarVisible: true,
};
```

Also, in `createPreviewTransport`, add a stub for the new commands. Find the existing `switch (command)` branches and add:

```ts
        case "autostart.get":
        case "autostart.set":
          return Promise.resolve({ enabled: false, supported: false });
```

Place these alongside the existing `preferences.get` / `preferences.set` cases.

- [ ] **Step 6: Run typecheck**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add packages/ts-api/src/types.ts packages/ts-api/src/client.ts
git commit -m "feat(ts-api): autostart client and extended preferences DTO"
```

---

## Task 6: CSS tokens and icon size

**Files:**

- Modify: `packages/ui/src/tokens.css`
- Modify: `packages/ui/src/icons.tsx` (line 29)

- [ ] **Step 1: Add base tokens**

In `packages/ui/src/tokens.css`, inside the `:root` block (lines 1-48), add after `--fo-row-height`:

```css
--fo-base-font-size: 14px;
--fo-icon-size: 16px;
```

- [ ] **Step 2: Add attribute-driven overrides**

At the end of the same file (after the closing `}` of `:root`), append:

```css
:root[data-font-scale="small"] {
  --fo-base-font-size: 13px;
}
:root[data-font-scale="large"] {
  --fo-base-font-size: 16px;
}
:root[data-icon-scale="small"] {
  --fo-icon-size: 14px;
}
:root[data-icon-scale="large"] {
  --fo-icon-size: 20px;
}

:root[data-accent="indigo"] {
  --fo-accent: #5b6cff;
  --fo-accent-soft: #e9ecff;
}
:root[data-accent="violet"] {
  --fo-accent: #8b5cf6;
  --fo-accent-soft: #f0e8ff;
}
:root[data-accent="pink"] {
  --fo-accent: #ec4899;
  --fo-accent-soft: #fde6f1;
}
:root[data-accent="red"] {
  --fo-accent: #dc2626;
  --fo-accent-soft: #fce4e4;
}
:root[data-accent="orange"] {
  --fo-accent: #ea580c;
  --fo-accent-soft: #ffe8d6;
}
:root[data-accent="amber"] {
  --fo-accent: #d97706;
  --fo-accent-soft: #fff0d1;
}
:root[data-accent="green"] {
  --fo-accent: #16a34a;
  --fo-accent-soft: #dcf3e2;
}
```

(`data-accent="blue"` is the default; no override row.)

- [ ] **Step 3: Apply base font size to root**

In `packages/ui/src/tokens.css`, locate where the root font size is defined (search for `font-size`). If not present in tokens.css, add to the top of the `:root` block:

```css
font-size: var(--fo-base-font-size);
```

(If a `:root` font-size rule already exists in a separate file, edit that one instead — search with `grep -rn 'font-size' packages/ui/src/`.)

- [ ] **Step 4: Change icon size constant**

In `packages/ui/src/icons.tsx` line 29:

```ts
export const iconSize: string | number = "var(--fo-icon-size)";
```

(The type widening from `number` to `string | number` documents the migration. Lucide's `LucideProps['size']` accepts both.)

- [ ] **Step 5: Build the UI package**

```bash
pnpm --filter @fileoctopus/ui build
```

Expected: clean build.

- [ ] **Step 6: Run typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/tokens.css packages/ui/src/icons.tsx
git commit -m "feat(ui): CSS tokens for accent/font/icon scale; var-driven icon size"
```

---

## Task 7: applyPreferences additions

**Files:**

- Modify: `packages/frontend/src/applyPreferences.ts`

- [ ] **Step 1: Add accent / scale appliers**

In `packages/frontend/src/applyPreferences.ts`, after the existing `applyDensityPreference` (line 21), add:

```ts
export type AccentPreference =
  | "blue"
  | "indigo"
  | "violet"
  | "pink"
  | "red"
  | "orange"
  | "amber"
  | "green";
export type ScalePreference = "small" | "medium" | "large";

const ACCENT_VALUES: ReadonlyArray<AccentPreference> = [
  "blue",
  "indigo",
  "violet",
  "pink",
  "red",
  "orange",
  "amber",
  "green",
];
const SCALE_VALUES: ReadonlyArray<ScalePreference> = [
  "small",
  "medium",
  "large",
];

export function applyAccentPreference(value: string): AccentPreference {
  const resolved = (ACCENT_VALUES as ReadonlyArray<string>).includes(value)
    ? (value as AccentPreference)
    : "blue";
  document.documentElement.dataset.accent = resolved;
  return resolved;
}

export function applyFontScalePreference(value: string): ScalePreference {
  const resolved = (SCALE_VALUES as ReadonlyArray<string>).includes(value)
    ? (value as ScalePreference)
    : "medium";
  document.documentElement.dataset.fontScale = resolved;
  return resolved;
}

export function applyIconScalePreference(value: string): ScalePreference {
  const resolved = (SCALE_VALUES as ReadonlyArray<string>).includes(value)
    ? (value as ScalePreference)
    : "medium";
  document.documentElement.dataset.iconScale = resolved;
  return resolved;
}
```

- [ ] **Step 2: Wire into `applyAllPreferences`**

Replace the existing `applyAllPreferences` (lines 66-70) with:

```ts
export function applyAllPreferences(preferences: UserPreferencesDto) {
  applyThemePreference(preferences.theme);
  applyDensityPreference(preferences.density);
  applyAccentPreference(preferences.accentColor);
  applyFontScalePreference(preferences.fontScale);
  applyIconScalePreference(preferences.iconScale);
  applyLayoutPreferences(preferences);
}
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/applyPreferences.ts
git commit -m "feat(frontend): apply accent/font/icon scale prefs to root"
```

---

## Task 8: SettingsDialog — Appearance tab additions

**Files:**

- Modify: `packages/frontend/src/components/SettingsDialog.tsx`

- [ ] **Step 1: Extend props type to accept accent/scale prefs**

The `preferences` prop already carries the new fields after Task 5. Inside the `appearance` section of `SettingsDialog.tsx` (lines 99-127), append three new control groups after the Density `<label>`:

```tsx
                <label className="fo-settings-field">
                  <span>Accent color</span>
                  <div
                    className="fo-settings-swatches"
                    role="radiogroup"
                    aria-label="Accent color"
                  >
                    {(
                      [
                        "blue",
                        "indigo",
                        "violet",
                        "pink",
                        "red",
                        "orange",
                        "amber",
                        "green",
                      ] as const
                    ).map((name) => (
                      <button
                        key={name}
                        type="button"
                        role="radio"
                        aria-checked={preferences.accentColor === name}
                        className={
                          preferences.accentColor === name
                            ? "fo-settings-swatch fo-settings-swatch--active"
                            : "fo-settings-swatch"
                        }
                        data-accent={name}
                        aria-label={`Accent ${name}`}
                        onClick={() => onChange("accentColor", name)}
                      />
                    ))}
                  </div>
                </label>
                <label className="fo-settings-field">
                  <span>Font size</span>
                  <div
                    className="fo-ui-segmented"
                    role="radiogroup"
                    aria-label="Font size"
                  >
                    {(["small", "medium", "large"] as const).map((scale) => (
                      <button
                        key={scale}
                        type="button"
                        role="radio"
                        aria-checked={preferences.fontScale === scale}
                        className={
                          preferences.fontScale === scale
                            ? "fo-ui-segmented-item fo-ui-segmented-item--active"
                            : "fo-ui-segmented-item"
                        }
                        onClick={() => onChange("fontScale", scale)}
                      >
                        {scale[0].toUpperCase() + scale.slice(1)}
                      </button>
                    ))}
                  </div>
                </label>
                <label className="fo-settings-field">
                  <span>Icon size</span>
                  <div
                    className="fo-ui-segmented"
                    role="radiogroup"
                    aria-label="Icon size"
                  >
                    {(["small", "medium", "large"] as const).map((scale) => (
                      <button
                        key={scale}
                        type="button"
                        role="radio"
                        aria-checked={preferences.iconScale === scale}
                        className={
                          preferences.iconScale === scale
                            ? "fo-ui-segmented-item fo-ui-segmented-item--active"
                            : "fo-ui-segmented-item"
                        }
                        onClick={() => onChange("iconScale", scale)}
                      >
                        {scale[0].toUpperCase() + scale.slice(1)}
                      </button>
                    ))}
                  </div>
                </label>
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/components/SettingsDialog.tsx
git commit -m "feat(frontend): accent/font/icon scale controls in Settings"
```

---

## Task 9: Swatch styles

**Files:**

- Modify: `packages/frontend/src/components/SettingsDialog.css` (or wherever `.fo-settings-section` is defined — search to confirm)

- [ ] **Step 1: Find the existing settings stylesheet**

```bash
grep -rn 'fo-settings-section\|fo-settings-field' packages/frontend/src/
```

Open the file that defines those classes (likely `packages/frontend/src/styles/*.css` or a co-located css file).

- [ ] **Step 2: Append swatch styles**

Append to that stylesheet:

```css
.fo-settings-swatches {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.fo-settings-swatch {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid var(--fo-control-border);
  background-color: #3578ff;
  cursor: pointer;
  padding: 0;
  transition: box-shadow 120ms ease;
}

.fo-settings-swatch[data-accent="indigo"] {
  background-color: #5b6cff;
}
.fo-settings-swatch[data-accent="violet"] {
  background-color: #8b5cf6;
}
.fo-settings-swatch[data-accent="pink"] {
  background-color: #ec4899;
}
.fo-settings-swatch[data-accent="red"] {
  background-color: #dc2626;
}
.fo-settings-swatch[data-accent="orange"] {
  background-color: #ea580c;
}
.fo-settings-swatch[data-accent="amber"] {
  background-color: #d97706;
}
.fo-settings-swatch[data-accent="green"] {
  background-color: #16a34a;
}

.fo-settings-swatch--active {
  box-shadow: 0 0 0 2px var(--fo-focus);
}

.fo-settings-swatch:focus-visible {
  outline: 2px solid var(--fo-focus);
  outline-offset: 2px;
}
```

- [ ] **Step 3: Run typecheck and format check**

```bash
pnpm typecheck && pnpm format:check
```

Expected: clean. If prettier complains, run `pnpm exec prettier --write` on the changed file.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/components/SettingsDialog.css   # adjust path if different
git commit -m "feat(frontend): swatch styles for accent picker"
```

---

## Task 10: SettingsDialog — Files & Folders confirm-overwrite + Layout sidebar visible

**Files:**

- Modify: `packages/frontend/src/components/SettingsDialog.tsx`

- [ ] **Step 1: Add confirm-overwrite switch**

In the `files` section of `SettingsDialog.tsx` (lines 128-213), insert after the existing `confirmPermanentDelete` `<label>`:

```tsx
<label className="fo-settings-switch">
  <input
    type="checkbox"
    checked={preferences.confirmOverwrite}
    onChange={(event) =>
      onChange("confirmOverwrite", event.target.checked ? "true" : "false")
    }
  />
  <span>Confirm before overwrite</span>
</label>
```

- [ ] **Step 2: Add sidebar-visible switch**

In the `layout` section (lines 214-231), insert above the existing `activityPanelVisible` `<label>`:

```tsx
<label className="fo-settings-switch">
  <input
    type="checkbox"
    checked={preferences.sidebarVisible}
    onChange={(event) =>
      onChange("sidebarVisible", event.target.checked ? "true" : "false")
    }
  />
  <span>Show sidebar</span>
</label>
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/components/SettingsDialog.tsx
git commit -m "feat(frontend): confirm-overwrite and sidebar-visible switches"
```

---

## Task 11: `confirmOverwrite` consumer in Copy/Move flow

**Files:**

- Modify: `packages/frontend/src/index.tsx` (around the `reviewCopyMoveDialog` function — search with `grep -n reviewCopyMoveDialog packages/frontend/src/index.tsx`)

- [ ] **Step 1: Identify the existing flow**

Read the section of `packages/frontend/src/index.tsx` that handles copy/move planning and starting. Identify where, after a successful `plan_file_operation`, the code transitions from "plan reviewed" to "calling `start_file_operation`". The relevant dialog state is `dialog.type === "copyMove"`.

- [ ] **Step 2: Add the confirm-overwrite gate**

When the user advances from the plan-summary step toward `start_file_operation`, gate on:

```
preferences.confirmOverwrite === true
  AND plan.conflicts.length > 0      // at least one name collision detected
  AND chosenConflictPolicy === "overwrite"
```

If gated, set the dialog state to a transient "confirmOverwrite" sub-step that renders a short confirmation panel:

```tsx
{
  dialog.type === "copyMove" && dialog.step === "confirm-overwrite" ? (
    <section className="fo-dialog-section">
      <h3>Confirm overwrite</h3>
      <p>
        The conflict policy is set to overwrite. Files at the destination with
        the same name will be replaced. Continue?
      </p>
      <div className="fo-dialog-actions">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setDialog({ ...dialog, step: "review" })}
        >
          Back
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={() => void startCopyMoveDialog(dialog)}
        >
          Overwrite
        </Button>
      </div>
    </section>
  ) : null;
}
```

Concretely, the smallest viable change set:

1. Extend the `copyMove` dialog state shape with a `step: "review" | "confirm-overwrite"` discriminator (default `"review"`).
2. In the existing "Start" button handler, branch: if the gate triggers, dispatch `setDialog({ ...current, step: "confirm-overwrite" })`. Else, call `startCopyMoveDialog` directly.
3. Render the new sub-step block.

Place these changes in the same module/file as the existing review step. Keep `startCopyMoveDialog` unchanged — it just runs unconditionally once we land in `confirm-overwrite`'s Confirm button.

- [ ] **Step 3: Verify behavior in dev**

```bash
pnpm dev
```

Manual: with `confirmOverwrite=true`, attempt a copy to a destination with no name collisions but with conflict policy "overwrite" — the confirm step should appear. With `confirmOverwrite=false`, it should not.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/index.tsx
git commit -m "feat(frontend): consume confirmOverwrite pref in Copy/Move flow"
```

---

## Task 12: `sidebarVisible` consumer in layout

**Files:**

- Modify: `packages/frontend/src/index.tsx` (sidebar render block around line 1627)

- [ ] **Step 1: Find the sidebar render site**

```bash
grep -n '<Sidebar\|SidebarResizer' packages/frontend/src/index.tsx
```

The relevant block is roughly lines 1627-1675.

- [ ] **Step 2: Gate the sidebar and its resizer on `preferences.sidebarVisible`**

Wrap the existing `<Sidebar … />` and `<SidebarResizer … />` JSX in a conditional. The simplest pattern, matching how other layout-conditional blocks render in this file:

```tsx
{
  preferences.sidebarVisible ? (
    <>
      <Sidebar
      /* ...existing props... */
      />
      <SidebarResizer
        onSidebarResize={(width) => {
          /* ...existing handler... */
          void updatePreference("sidebarWidth", String(width));
        }}
        /* ...existing props... */
      />
    </>
  ) : null;
}
```

- [ ] **Step 3: Collapse the grid column when hidden**

In `applyPreferences.ts` `applyLayoutPreferences` (line 33-46), make the sidebar width override conditional. Replace:

```ts
root.style.setProperty("--fo-sidebar-width", `${preferences.sidebarWidth}px`);
```

with:

```ts
root.style.setProperty(
  "--fo-sidebar-width",
  preferences.sidebarVisible ? `${preferences.sidebarWidth}px` : "0px",
);
```

- [ ] **Step 4: Run dev server and verify**

```bash
pnpm dev
```

Toggle "Show sidebar" off and on. Expected: sidebar disappears and reappears; layout shifts cleanly without a 0-width drag handle.

- [ ] **Step 5: Run typecheck**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/index.tsx packages/frontend/src/applyPreferences.ts
git commit -m "feat(frontend): hide sidebar when sidebarVisible is false"
```

---

## Task 13: Add `tauri-plugin-autostart` dependency and register

**Files:**

- Modify: `apps/desktop-tauri/src-tauri/Cargo.toml`
- Modify: `apps/desktop-tauri/src-tauri/src/lib.rs` (the `pub fn run()` builder around line 1004)
- Modify: `apps/desktop-tauri/src-tauri/capabilities/default.json` (if Tauri v2 capability files are present — verify with `ls apps/desktop-tauri/src-tauri/capabilities/`)

- [ ] **Step 1: Add the dependency**

In `apps/desktop-tauri/src-tauri/Cargo.toml`, in the `[dependencies]` section:

```toml
tauri-plugin-autostart = "2"
```

- [ ] **Step 2: Register the plugin**

In `apps/desktop-tauri/src-tauri/src/lib.rs`, modify the `tauri::Builder` chain (line 1004) to add the plugin before `.manage(...)`:

```rust
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(app_state)
        // ...existing chain...
```

- [ ] **Step 3: Update capability allowlist (if applicable)**

```bash
ls apps/desktop-tauri/src-tauri/capabilities/
```

If `default.json` (or similar) lists permissions for plugins, add `"autostart:default"` to the `permissions` array. If no capability files exist, skip this step.

- [ ] **Step 4: Build to verify the dependency resolves**

```bash
cargo check --workspace
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-tauri/src-tauri/Cargo.toml apps/desktop-tauri/src-tauri/Cargo.lock apps/desktop-tauri/src-tauri/src/lib.rs apps/desktop-tauri/src-tauri/capabilities/
git commit -m "chore(desktop): add tauri-plugin-autostart dependency"
```

---

## Task 14: `get_autostart` / `set_autostart` Tauri commands

**Files:**

- Modify: `apps/desktop-tauri/src-tauri/src/lib.rs`

- [ ] **Step 1: Add the use statements**

At the top of `apps/desktop-tauri/src-tauri/src/lib.rs`, add (with the other `use` statements):

```rust
use app_ipc::AutostartStatusDto;
use tauri_plugin_autostart::ManagerExt;
```

(`ManagerExt` exposes `app.autolaunch()` on `AppHandle`.)

- [ ] **Step 2: Add the commands**

After the existing `set_preference` command (around line 299), append:

```rust
#[tauri::command]
async fn get_autostart(app: tauri::AppHandle) -> Result<AutostartStatusDto, IpcError> {
    let manager = app.autolaunch();
    match manager.is_enabled() {
        Ok(enabled) => Ok(AutostartStatusDto {
            enabled,
            supported: true,
        }),
        Err(error) => {
            telemetry::error!(error = %error, "autostart_unavailable");
            Ok(AutostartStatusDto {
                enabled: false,
                supported: false,
            })
        }
    }
}

#[tauri::command]
async fn set_autostart(
    app: tauri::AppHandle,
    enabled: bool,
) -> Result<AutostartStatusDto, IpcError> {
    let manager = app.autolaunch();
    let result = if enabled {
        manager.enable()
    } else {
        manager.disable()
    };

    match result {
        Ok(()) => match manager.is_enabled() {
            Ok(state) => Ok(AutostartStatusDto {
                enabled: state,
                supported: true,
            }),
            Err(error) => Err(IpcError {
                code: "autostart_unavailable".to_string(),
                message: error.to_string(),
            }),
        },
        Err(error) => Err(IpcError {
            code: "autostart_unavailable".to_string(),
            message: error.to_string(),
        }),
    }
}
```

- [ ] **Step 3: Register the commands in `generate_handler!`**

In the `tauri::generate_handler![…]` block (line 1013), add `get_autostart` and `set_autostart` after `export_diagnostics_bundle`:

```rust
        .invoke_handler(tauri::generate_handler![
            // ...existing entries...
            export_diagnostics_bundle,
            get_autostart,
            set_autostart
        ])
```

- [ ] **Step 4: Build**

```bash
cargo check --workspace
```

Expected: clean. If `telemetry::error!` doesn't accept the structured form, fall back to `telemetry::error!("autostart_unavailable: {error}");` — check the existing macro signatures in `crates/telemetry/src/lib.rs`.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-tauri/src-tauri/src/lib.rs
git commit -m "feat(desktop): get_autostart and set_autostart commands"
```

---

## Task 15: SettingsDialog General tab — autostart UI and parent wiring

**Files:**

- Modify: `packages/frontend/src/components/SettingsDialog.tsx`
- Modify: `packages/frontend/src/index.tsx` (lines 1849-1856, settings-open effect)

- [ ] **Step 1: Extend `SettingsDialogProps`**

In `packages/frontend/src/components/SettingsDialog.tsx`, replace the `SettingsDialogProps` interface (lines 8-13):

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

Add the `AutostartStatusDto` import at the top:

```ts
import type {
  AutostartStatusDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
```

Update the component signature:

```ts
export function SettingsDialog({
  open,
  preferences,
  autostart,
  onClose,
  onChange,
  onSetAutostart,
}: SettingsDialogProps) {
```

- [ ] **Step 2: Replace the General tab placeholder**

Replace the `general` section (lines 93-98) with:

```tsx
{
  activeSection === "general" && (
    <section className="fo-settings-section">
      <h3>General</h3>
      <label className="fo-settings-switch">
        <input
          type="checkbox"
          checked={autostart?.enabled === true}
          disabled={!autostart || autostart.supported === false}
          onChange={(event) => void onSetAutostart(event.target.checked)}
        />
        <span>Start FileOctopus on system startup</span>
      </label>
      {autostart && autostart.supported === false ? (
        <p className="fo-settings-hint">Not supported on this platform.</p>
      ) : null}
      {autostart === null ? (
        <p className="fo-settings-hint">Couldn’t read system startup state.</p>
      ) : null}
      <p className="fo-settings-hint">
        More general preferences will appear here.
      </p>
    </section>
  );
}
```

Add a minimal `.fo-settings-hint` style if it doesn't exist (search with `grep -rn fo-settings-hint packages/frontend/src/`). If absent, append to the settings stylesheet:

```css
.fo-settings-hint {
  margin: 4px 0 0;
  color: var(--fo-muted-text);
  font-size: 12px;
}
```

- [ ] **Step 3: Wire parent state and fetch logic**

In `packages/frontend/src/index.tsx`, near the existing settings state (line 205):

```ts
const [settingsOpen, setSettingsOpen] = useState(false);
const [autostart, setAutostart] = useState<AutostartStatusDto | null>(null);
const autostartInflight = useRef<Promise<unknown> | null>(null);
```

Add the import alongside the existing ts-api type imports:

```ts
import type { AutostartStatusDto } from "@fileoctopus/ts-api";
```

Also `import { useRef } from "react"` if it isn't already imported at the top.

- [ ] **Step 4: Fetch autostart when settings open**

Add a `useEffect`:

```ts
useEffect(() => {
  if (!settingsOpen) return;
  let cancelled = false;
  void client.autostart
    .get()
    .then((status) => {
      if (!cancelled) setAutostart(status);
    })
    .catch(() => {
      if (!cancelled) setAutostart(null);
    });
  return () => {
    cancelled = true;
  };
}, [settingsOpen, client]);
```

- [ ] **Step 5: Add `handleSetAutostart` with serialization**

Add as a sibling of `updatePreference`:

```ts
async function handleSetAutostart(enabled: boolean): Promise<void> {
  if (autostartInflight.current) {
    await autostartInflight.current;
    return;
  }
  const previous = autostart;
  const optimistic: AutostartStatusDto = {
    enabled,
    supported: previous?.supported ?? true,
  };
  setAutostart(optimistic);
  const promise = client.autostart
    .set(enabled)
    .then((status) => {
      setAutostart(status);
    })
    .catch((error) => {
      setAutostart(previous);
      pushToast({
        tone: "error",
        title: "Couldn’t change startup setting",
        detail: normalizeIpcError(error).message,
      });
    })
    .finally(() => {
      autostartInflight.current = null;
    });
  autostartInflight.current = promise;
  await promise;
}
```

(Replace `pushToast` / `normalizeIpcError` with the existing helpers in this file. If `pushToast` is not the actual API name, use whatever the existing `toast`/`setToasts` flow is — search with `grep -n setToasts packages/frontend/src/index.tsx`.)

- [ ] **Step 6: Pass new props to `SettingsDialog`**

Replace the `<SettingsDialog>` invocation (lines 1849-1856):

```tsx
{
  preferences ? (
    <SettingsDialog
      open={settingsOpen}
      preferences={preferences}
      autostart={autostart}
      onClose={() => setSettingsOpen(false)}
      onChange={(key, value) => void updatePreference(key, value)}
      onSetAutostart={handleSetAutostart}
    />
  ) : null;
}
```

- [ ] **Step 7: Run typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: clean.

- [ ] **Step 8: Run dev and verify the toggle works**

```bash
pnpm dev
```

Open Settings → General. Toggle the switch; observe the OS-level autostart entry (Linux: `~/.config/autostart/FileOctopus.desktop`; macOS: Login Items). Toggle off; observe removal.

- [ ] **Step 9: Commit**

```bash
git add packages/frontend/src/components/SettingsDialog.tsx packages/frontend/src/index.tsx
git commit -m "feat(frontend): General-tab autostart toggle"
```

---

## Task 16: Frontend Vitest coverage

**Files:**

- Create: `packages/frontend/tests/settingsDialog.test.tsx`

- [ ] **Step 1: Write the tests**

Create `packages/frontend/tests/settingsDialog.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AutostartStatusDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import { SettingsDialog } from "../src/components/SettingsDialog";

function makePreferences(
  overrides: Partial<UserPreferencesDto> = {},
): UserPreferencesDto {
  return {
    theme: "system",
    density: "comfortable",
    defaultViewMode: "details",
    showHiddenFiles: false,
    sidebarWidth: 240,
    splitRatio: 0.5,
    activityPanelVisible: true,
    activityPanelWidth: 288,
    confirmDelete: true,
    confirmPermanentDelete: true,
    useTrashByDefault: true,
    defaultConflictPolicy: "fail",
    accentColor: "blue",
    fontScale: "medium",
    iconScale: "medium",
    confirmOverwrite: true,
    sidebarVisible: true,
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("SettingsDialog", () => {
  it("fires onChange for accent color selection", () => {
    const onChange = vi.fn();
    render(
      <SettingsDialog
        open
        preferences={makePreferences()}
        autostart={null}
        onClose={() => {}}
        onChange={onChange}
        onSetAutostart={async () => {}}
      />,
    );
    // Switch to Appearance.
    fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    fireEvent.click(screen.getByRole("radio", { name: "Accent violet" }));
    expect(onChange).toHaveBeenCalledWith("accentColor", "violet");
  });

  it("fires onChange for font scale segmented buttons", () => {
    const onChange = vi.fn();
    render(
      <SettingsDialog
        open
        preferences={makePreferences()}
        autostart={null}
        onClose={() => {}}
        onChange={onChange}
        onSetAutostart={async () => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    const fontGroup = screen.getByRole("radiogroup", { name: "Font size" });
    fireEvent.click(within(fontGroup).getByText("Large"));
    expect(onChange).toHaveBeenCalledWith("fontScale", "large");
  });

  it("fires onChange for confirmOverwrite", () => {
    const onChange = vi.fn();
    render(
      <SettingsDialog
        open
        preferences={makePreferences()}
        autostart={null}
        onClose={() => {}}
        onChange={onChange}
        onSetAutostart={async () => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Files & Folders" }));
    fireEvent.click(screen.getByLabelText("Confirm before overwrite"));
    expect(onChange).toHaveBeenCalledWith("confirmOverwrite", "false");
  });

  it("fires onChange for sidebarVisible", () => {
    const onChange = vi.fn();
    render(
      <SettingsDialog
        open
        preferences={makePreferences()}
        autostart={null}
        onClose={() => {}}
        onChange={onChange}
        onSetAutostart={async () => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    fireEvent.click(screen.getByLabelText("Show sidebar"));
    expect(onChange).toHaveBeenCalledWith("sidebarVisible", "false");
  });

  it("disables autostart switch when platform is unsupported", () => {
    const unsupported: AutostartStatusDto = {
      enabled: false,
      supported: false,
    };
    render(
      <SettingsDialog
        open
        preferences={makePreferences()}
        autostart={unsupported}
        onClose={() => {}}
        onChange={() => {}}
        onSetAutostart={async () => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "General" }));
    const toggle = screen.getByLabelText("Start FileOctopus on system startup");
    expect(toggle).toBeDisabled();
    expect(screen.getByText("Not supported on this platform.")).toBeVisible();
  });

  it("calls onSetAutostart when the user toggles the General switch", async () => {
    const onSetAutostart = vi.fn().mockResolvedValue(undefined);
    render(
      <SettingsDialog
        open
        preferences={makePreferences()}
        autostart={{ enabled: false, supported: true }}
        onClose={() => {}}
        onChange={() => {}}
        onSetAutostart={onSetAutostart}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "General" }));
    fireEvent.click(
      screen.getByLabelText("Start FileOctopus on system startup"),
    );
    expect(onSetAutostart).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
pnpm --filter @fileoctopus/frontend test -- settingsDialog
```

Expected: PASS. If any assertion fails because the JSX renders subtly differently, adjust the role/name queries — do not weaken the test (e.g., always assert via accessible roles, not class names).

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/tests/settingsDialog.test.tsx
git commit -m "test(frontend): cover new SettingsDialog controls"
```

---

## Task 17: Manual QA script update

**Files:**

- Create: `scripts/slice-b-manual-qa.sh` (or append to `scripts/sprint-2-manual-qa.sh` — check which is more consistent with the repo's pattern)

- [ ] **Step 1: Inspect existing manual QA pattern**

```bash
cat scripts/sprint-2-manual-qa.sh | head -40
```

- [ ] **Step 2: Add steps**

Create `scripts/slice-b-manual-qa.sh` with the same `#!/usr/bin/env bash` / `set -euo pipefail` header used in `sprint-2-manual-qa.sh`, then append:

```bash
#!/usr/bin/env bash
set -euo pipefail

cat <<'EOF'
Slice B manual QA — Settings dialog completion

Steps:
  1. Launch FileOctopus (pnpm dev).
  2. Open Settings (Ctrl+,).
  3. Appearance tab:
       - Click each accent swatch. The selected swatch shows a ring; toolbar
         buttons and badges recolor.
       - Switch Font size between Small / Medium / Large. UI text resizes.
       - Switch Icon size between Small / Medium / Large. Sidebar/toolbar
         icons resize.
  4. Files & Folders tab:
       - Toggle "Confirm before overwrite" off. Start a copy with conflict
         policy "Overwrite" to a destination with no name collisions; verify
         the confirm step is skipped. Toggle on; verify the confirm step
         appears.
  5. Layout tab:
       - Toggle "Show sidebar" off. Sidebar disappears, grid expands.
       - Toggle on. Sidebar restored at the previous width.
  6. General tab:
       - Toggle "Start FileOctopus on system startup" on.
         Linux: verify `~/.config/autostart/FileOctopus.desktop` exists.
         macOS: verify Login Items entry.
         Windows: verify HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run.
       - Toggle off; verify the entry is removed.
       - On an unsupported platform, the switch should be disabled with the
         hint "Not supported on this platform."
  7. Restart the app; all toggles and selections persist (except the
     OS-level autostart, which lives in OS storage).
EOF
```

`chmod +x scripts/slice-b-manual-qa.sh`.

- [ ] **Step 3: Commit**

```bash
git add scripts/slice-b-manual-qa.sh
git commit -m "docs(qa): manual checklist for slice B settings work"
```

---

## Task 18: Final verification

- [ ] **Step 1: Run full CI gate locally**

```bash
pnpm typecheck && pnpm lint && pnpm format:check && \
  pnpm rust:check && pnpm rust:test && pnpm rust:fmt && pnpm rust:clippy
```

Expected: all pass.

- [ ] **Step 2: Run frontend Vitest**

```bash
pnpm test
```

Expected: all pass.

- [ ] **Step 3: Smoke-test in the dev app**

```bash
pnpm dev
```

Walk through `scripts/slice-b-manual-qa.sh`.

- [ ] **Step 4: Note any deviations**

If any step required deviation from the plan (e.g., a parser signature differed in the existing code), file a follow-up TODO in the PR description, not in code.
