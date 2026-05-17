mod navigation;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub use navigation::{
    FavoriteEntry, NavigationError, NavigationRepository, RecentBucket, RecentEntry, StarredEntry,
};

pub const SCHEMA_VERSION: u32 = 7;

#[derive(Debug, Error)]
pub enum PreferencesError {
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("invalid preference value for `{key}`: {reason}")]
    InvalidValue { key: String, reason: String },
    #[error("unsupported future schema version {0}")]
    UnsupportedSchema(u32),
}

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
    pub status_bar_visible: bool,
    pub toolbar_visible: bool,
    pub pane_mode: String,
    pub job_drawer_behavior: String,
}

impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            density: "comfortable".to_string(),
            default_view_mode: "details".to_string(),
            show_hidden_files: false,
            sidebar_width: 240,
            split_ratio: 0.5,
            activity_panel_visible: false,
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
            status_bar_visible: true,
            toolbar_visible: true,
            pane_mode: "dual".to_string(),
            job_drawer_behavior: "manual".to_string(),
        }
    }
}

#[derive(Clone)]
pub struct PreferencesRepository {
    path: Arc<PathBuf>,
    cache: Arc<Mutex<UserPreferences>>,
}

impl PreferencesRepository {
    pub fn new(path: PathBuf) -> Result<Self, PreferencesError> {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let repository = Self {
            path: Arc::new(path),
            cache: Arc::new(Mutex::new(UserPreferences::default())),
        };

        repository.migrate()?;
        let preferences = repository.read_all_from_db()?;
        *repository
            .cache
            .lock()
            .map_err(|_| PreferencesError::InvalidValue {
                key: "cache".to_string(),
                reason: "lock poisoned".to_string(),
            })? = preferences;

        Ok(repository)
    }

    pub fn get_all(&self) -> Result<UserPreferences, PreferencesError> {
        Ok(self
            .cache
            .lock()
            .map_err(|_| PreferencesError::InvalidValue {
                key: "cache".to_string(),
                reason: "lock poisoned".to_string(),
            })?
            .clone())
    }

    pub fn set(&self, key: &str, value: &str) -> Result<UserPreferences, PreferencesError> {
        let mut preferences = self.get_all()?;
        apply_value(&mut preferences, key, value)?;
        self.persist(&preferences)?;
        Ok(preferences)
    }

    fn migrate(&self) -> Result<(), PreferencesError> {
        let connection = self.connect()?;
        let user_version: u32 =
            connection.query_row("pragma user_version", [], |row| row.get(0))?;

        if user_version > SCHEMA_VERSION {
            return Err(PreferencesError::UnsupportedSchema(user_version));
        }

        connection.execute(
            "create table if not exists preferences (
                key text primary key,
                value text not null,
                updated_at text not null
            )",
            [],
        )?;
        connection.pragma_update(None, "user_version", SCHEMA_VERSION)?;

        if user_version == 0 {
            self.seed_defaults(&connection)?;
        }

        if user_version < 3 {
            self.backfill_v3_keys(&connection)?;
            connection.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        }

        if user_version < 4 {
            self.backfill_v4_keys(&connection)?;
            connection.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        }

        if user_version < 5 {
            self.backfill_v5_keys(&connection)?;
            connection.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        }

        if user_version < 6 {
            self.backfill_v6_keys(&connection)?;
            connection.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        }

        if user_version < 7 {
            self.backfill_v7_keys(&connection)?;
            connection.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        }

        Ok(())
    }

    fn backfill_v3_keys(&self, connection: &Connection) -> Result<(), PreferencesError> {
        let defaults = UserPreferences::default();
        let now = chrono_lite_now();
        let rows = [
            (
                "activityPanelVisible",
                defaults.activity_panel_visible.to_string(),
            ),
            (
                "activityPanelWidth",
                defaults.activity_panel_width.to_string(),
            ),
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

    fn backfill_v4_keys(&self, connection: &Connection) -> Result<(), PreferencesError> {
        let defaults = UserPreferences::default();
        let now = chrono_lite_now();
        let rows = [
            ("confirmDelete", defaults.confirm_delete.to_string()),
            (
                "confirmPermanentDelete",
                defaults.confirm_permanent_delete.to_string(),
            ),
            (
                "useTrashByDefault",
                defaults.use_trash_by_default.to_string(),
            ),
            (
                "defaultConflictPolicy",
                defaults.default_conflict_policy.to_string(),
            ),
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

    fn backfill_v6_keys(&self, connection: &Connection) -> Result<(), PreferencesError> {
        let defaults = UserPreferences::default();
        let now = chrono_lite_now();
        let rows = [
            ("paneMode", defaults.pane_mode.clone()),
            ("jobDrawerBehavior", defaults.job_drawer_behavior.clone()),
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

    fn backfill_v7_keys(&self, connection: &Connection) -> Result<(), PreferencesError> {
        let defaults = UserPreferences::default();
        let now = chrono_lite_now();
        let rows = [
            ("statusBarVisible", defaults.status_bar_visible.to_string()),
            ("toolbarVisible", defaults.toolbar_visible.to_string()),
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

    fn seed_defaults(&self, connection: &Connection) -> Result<(), PreferencesError> {
        let defaults = UserPreferences::default();
        let now = chrono_lite_now();

        for (key, value) in defaults.as_rows() {
            connection.execute(
                "insert into preferences (key, value, updated_at) values (?1, ?2, ?3)
                 on conflict(key) do nothing",
                params![key, value, now],
            )?;
        }

        Ok(())
    }

    fn read_all_from_db(&self) -> Result<UserPreferences, PreferencesError> {
        let connection = self.connect()?;
        let mut preferences = UserPreferences::default();
        let mut statement = connection.prepare("select key, value from preferences")?;
        let rows = statement.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;

        for row in rows {
            let (key, value) = row?;
            apply_value(&mut preferences, &key, &value)?;
        }

        Ok(preferences)
    }

    fn persist(&self, preferences: &UserPreferences) -> Result<(), PreferencesError> {
        let connection = self.connect()?;
        let now = chrono_lite_now();

        for (key, value) in preferences.as_rows() {
            connection.execute(
                "insert into preferences (key, value, updated_at) values (?1, ?2, ?3)
                 on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at",
                params![key, value, now],
            )?;
        }

        *self
            .cache
            .lock()
            .map_err(|_| PreferencesError::InvalidValue {
                key: "cache".to_string(),
                reason: "lock poisoned".to_string(),
            })? = preferences.clone();

        Ok(())
    }

    fn connect(&self) -> Result<Connection, PreferencesError> {
        Connection::open(&*self.path).map_err(PreferencesError::from)
    }
}

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
            ("statusBarVisible", self.status_bar_visible.to_string()),
            ("toolbarVisible", self.toolbar_visible.to_string()),
            ("paneMode", self.pane_mode.clone()),
            ("jobDrawerBehavior", self.job_drawer_behavior.clone()),
        ]
    }
}

fn apply_value(
    preferences: &mut UserPreferences,
    key: &str,
    value: &str,
) -> Result<(), PreferencesError> {
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
        "statusBarVisible" => {
            preferences.status_bar_visible = parse_bool(value, key)?;
        }
        "toolbarVisible" => {
            preferences.toolbar_visible = parse_bool(value, key)?;
        }
        "paneMode" => {
            preferences.pane_mode = parse_pane_mode(value)?;
        }
        "jobDrawerBehavior" => {
            preferences.job_drawer_behavior = parse_job_drawer_behavior(value)?;
        }
        _ => {}
    }

    Ok(())
}

fn parse_theme(value: &str) -> Result<String, PreferencesError> {
    match value {
        "system" | "light" | "dark" => Ok(value.to_string()),
        other => Err(invalid_value(
            "theme",
            format!("unsupported value `{other}`"),
        )),
    }
}

fn parse_density(value: &str) -> Result<String, PreferencesError> {
    match value {
        "compact" | "comfortable" | "spacious" => Ok(value.to_string()),
        other => Err(invalid_value(
            "density",
            format!("unsupported value `{other}`"),
        )),
    }
}

fn parse_view_mode(value: &str) -> Result<String, PreferencesError> {
    match value {
        "details" | "list" | "icons" | "columns" => Ok(value.to_string()),
        other => Err(invalid_value(
            "defaultViewMode",
            format!("unsupported value `{other}`"),
        )),
    }
}

fn parse_conflict_policy(value: &str) -> Result<String, PreferencesError> {
    match value {
        "fail" | "skip" | "overwrite" | "renameNew" | "renameExisting" => Ok(value.to_string()),
        other => Err(invalid_value(
            "defaultConflictPolicy",
            format!("unsupported value `{other}`"),
        )),
    }
}

fn parse_pane_mode(value: &str) -> Result<String, PreferencesError> {
    match value {
        "dual" | "single" => Ok(value.to_string()),
        other => Err(invalid_value(
            "paneMode",
            format!("unsupported value `{other}`"),
        )),
    }
}

fn parse_job_drawer_behavior(value: &str) -> Result<String, PreferencesError> {
    match value {
        "manual" | "openOnError" | "openOnStart" => Ok(value.to_string()),
        other => Err(invalid_value(
            "jobDrawerBehavior",
            format!("unsupported value `{other}`"),
        )),
    }
}

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

fn invalid_value(key: &str, reason: String) -> PreferencesError {
    PreferencesError::InvalidValue {
        key: key.to_string(),
        reason,
    }
}

fn chrono_lite_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs())
        .unwrap_or(0);

    seconds.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn persists_and_validates_preferences() {
        let dir = tempdir().unwrap();
        let repository = PreferencesRepository::new(dir.path().join("preferences.sqlite")).unwrap();

        let updated = repository.set("theme", "dark").unwrap();
        assert_eq!(updated.theme, "dark");

        let reloaded = PreferencesRepository::new(dir.path().join("preferences.sqlite"))
            .unwrap()
            .get_all()
            .unwrap();
        assert_eq!(reloaded.theme, "dark");
    }

    #[test]
    fn rejects_invalid_theme() {
        let dir = tempdir().unwrap();
        let repository = PreferencesRepository::new(dir.path().join("preferences.sqlite")).unwrap();

        let error = repository.set("theme", "neon").unwrap_err();
        assert!(matches!(error, PreferencesError::InvalidValue { .. }));
    }

    #[test]
    fn defaults_include_new_ui_fields() {
        let defaults = UserPreferences::default();
        assert_eq!(defaults.accent_color, "blue");
        assert_eq!(defaults.font_scale, "medium");
        assert_eq!(defaults.icon_scale, "medium");
        assert!(defaults.confirm_overwrite);
        assert!(defaults.sidebar_visible);
        assert!(defaults.status_bar_visible);
        assert!(defaults.toolbar_visible);
        assert_eq!(defaults.pane_mode, "dual");
        assert_eq!(defaults.job_drawer_behavior, "manual");
        assert!(!defaults.activity_panel_visible);
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
        assert_eq!(rows["statusBarVisible"], "true");
        assert_eq!(rows["toolbarVisible"], "true");
        assert_eq!(rows["paneMode"], "dual");
        assert_eq!(rows["jobDrawerBehavior"], "manual");
    }

    #[test]
    fn accepts_valid_accent_colors() {
        let dir = tempdir().unwrap();
        let repository = PreferencesRepository::new(dir.path().join("preferences.sqlite")).unwrap();
        for name in [
            "blue", "indigo", "violet", "pink", "red", "orange", "amber", "green",
        ] {
            assert!(repository.set("accentColor", name).is_ok(), "accept {name}");
        }
    }

    #[test]
    fn rejects_invalid_accent_color() {
        let dir = tempdir().unwrap();
        let repository = PreferencesRepository::new(dir.path().join("preferences.sqlite")).unwrap();
        let err = repository.set("accentColor", "chartreuse").unwrap_err();
        assert!(matches!(err, PreferencesError::InvalidValue { .. }));
    }

    #[test]
    fn accepts_valid_scales() {
        let dir = tempdir().unwrap();
        let repository = PreferencesRepository::new(dir.path().join("preferences.sqlite")).unwrap();
        for key in ["fontScale", "iconScale"] {
            for value in ["small", "medium", "large"] {
                assert!(repository.set(key, value).is_ok(), "accept {key}={value}");
            }
        }
    }

    #[test]
    fn rejects_invalid_scale() {
        let dir = tempdir().unwrap();
        let repository = PreferencesRepository::new(dir.path().join("preferences.sqlite")).unwrap();
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

    #[test]
    fn round_trips_layout_behavior_preferences() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("preferences.sqlite");
        let repository = PreferencesRepository::new(path.clone()).unwrap();
        repository.set("paneMode", "single").unwrap();
        repository.set("jobDrawerBehavior", "openOnError").unwrap();
        let reloaded = PreferencesRepository::new(path).unwrap().get_all().unwrap();
        assert_eq!(reloaded.pane_mode, "single");
        assert_eq!(reloaded.job_drawer_behavior, "openOnError");
    }

    #[test]
    fn migrates_v4_database_to_current_schema_with_new_defaults() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("preferences.sqlite");

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
            connection
                .pragma_update(None, "user_version", 4u32)
                .unwrap();
        }

        let repository = PreferencesRepository::new(path.clone()).unwrap();
        let prefs = repository.get_all().unwrap();

        assert_eq!(prefs.theme, "dark");
        assert_eq!(prefs.density, "compact");
        assert_eq!(prefs.accent_color, "blue");
        assert_eq!(prefs.font_scale, "medium");
        assert_eq!(prefs.icon_scale, "medium");
        assert!(prefs.confirm_overwrite);
        assert!(prefs.sidebar_visible);
        assert_eq!(prefs.pane_mode, "dual");
        assert_eq!(prefs.job_drawer_behavior, "manual");

        let connection = Connection::open(&path).unwrap();
        let version: u32 = connection
            .query_row("pragma user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, SCHEMA_VERSION);
    }

    #[test]
    fn round_trips_chrome_visibility_preferences() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("preferences.sqlite");
        let repository = PreferencesRepository::new(path.clone()).unwrap();
        repository.set("statusBarVisible", "false").unwrap();
        repository.set("toolbarVisible", "false").unwrap();
        let reloaded = PreferencesRepository::new(path).unwrap().get_all().unwrap();
        assert!(!reloaded.status_bar_visible);
        assert!(!reloaded.toolbar_visible);
    }

    #[test]
    fn migrates_v6_database_to_current_schema_with_chrome_defaults() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("preferences.sqlite");

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
                        ('paneMode', 'single', '0')",
                    [],
                )
                .unwrap();
            connection
                .pragma_update(None, "user_version", 6u32)
                .unwrap();
        }

        let repository = PreferencesRepository::new(path.clone()).unwrap();
        let prefs = repository.get_all().unwrap();

        assert_eq!(prefs.theme, "dark");
        assert_eq!(prefs.pane_mode, "single");
        assert!(prefs.status_bar_visible);
        assert!(prefs.toolbar_visible);

        let connection = Connection::open(&path).unwrap();
        let version: u32 = connection
            .query_row("pragma user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, SCHEMA_VERSION);
    }
}
