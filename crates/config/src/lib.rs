mod navigation;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub use navigation::{
    FavoriteEntry, NavigationError, NavigationRepository, RecentBucket, RecentEntry, StarredEntry,
};

pub const SCHEMA_VERSION: u32 = 3;

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
            activity_panel_visible: true,
            activity_panel_width: 288,
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

        Ok(())
    }

    fn backfill_v3_keys(&self, connection: &Connection) -> Result<(), PreferencesError> {
        let defaults = UserPreferences::default();
        let now = chrono_lite_now();
        let rows = [
            ("activityPanelVisible", defaults.activity_panel_visible.to_string()),
            ("activityPanelWidth", defaults.activity_panel_width.to_string()),
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
            preferences.show_hidden_files = parse_bool(value)?;
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
            preferences.activity_panel_visible = parse_bool(value)?;
        }
        "activityPanelWidth" => {
            preferences.activity_panel_width = value
                .parse::<u32>()
                .map_err(|error| invalid_value(key, error.to_string()))?
                .clamp(200, 480);
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

fn parse_bool(value: &str) -> Result<bool, PreferencesError> {
    match value {
        "true" | "1" => Ok(true),
        "false" | "0" => Ok(false),
        other => Err(invalid_value(
            "showHiddenFiles",
            format!("unsupported value `{other}`"),
        )),
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
}
