mod navigation;
mod network;

use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub use navigation::{
    FavoriteEntry, NavigationError, NavigationRepository, RecentBucket, RecentEntry, StarredEntry,
};
pub use network::{
    AuthKind, NetworkError, NetworkProfile, NetworkProfileRepository, NewNetworkProfile,
    UpdateNetworkProfile,
};

pub const SCHEMA_VERSION: u32 = 13;

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
    pub toolbar_entries: String,
    pub pane_mode: String,
    pub pane_direction: String,
    pub job_drawer_behavior: String,
    pub show_advanced_copy_options: bool,
    pub pane_terminal_height_left: f64,
    pub pane_terminal_height_right: f64,
    pub pane_terminal_default_open: bool,
    pub terminal_cd_on_navigate: bool,
    pub confirm_close_pane_with_terminal: bool,
    pub terminal_shell: String,
    pub terminal_args: String,
    pub remember_last_used_panes: bool,
    pub diagnostics_export_path: String,
    pub custom_shortcuts: String,
    pub file_type_color_rules: String,
    pub layout_profiles: String,
    pub column_presets: String,
    pub log_level: String,
    pub experimental_features: bool,
    pub cache_size_limit: u32,
    pub file_operation_threads: u32,
    pub network_connection_timeout: u32,
    pub network_auto_reconnect: bool,
    pub network_default_protocol: String,
    pub network_ssh_key_path: String,
    pub editor_font_family: String,
    pub editor_font_size: u32,
    pub editor_tab_size: u32,
    pub editor_word_wrap: bool,
    pub editor_auto_save: bool,
    pub editor_syntax_highlighting: bool,
    pub editor_line_numbers: bool,
    pub viewer_default_view_mode: String,
    pub viewer_image_zoom: String,
    pub viewer_media_autoplay: bool,
    pub viewer_max_preview_size: u32,
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
            sidebar_visible: false,
            status_bar_visible: true,
            toolbar_visible: true,
            toolbar_entries: String::new(),
            pane_mode: "dual".to_string(),
            pane_direction: "horizontal".to_string(),
            job_drawer_behavior: "manual".to_string(),
            show_advanced_copy_options: false,
            pane_terminal_height_left: 0.35,
            pane_terminal_height_right: 0.35,
            pane_terminal_default_open: false,
            terminal_cd_on_navigate: false,
            confirm_close_pane_with_terminal: true,
            terminal_shell: String::new(),
            terminal_args: String::new(),
            remember_last_used_panes: true,
            diagnostics_export_path: "/tmp/fileoctopus-diagnostics.zip".to_string(),
            custom_shortcuts: String::new(),
            file_type_color_rules: String::new(),
            layout_profiles: String::new(),
            column_presets: String::new(),
            log_level: "warn".to_string(),
            experimental_features: false,
            cache_size_limit: 256,
            file_operation_threads: 4,
            network_connection_timeout: 30,
            network_auto_reconnect: true,
            network_default_protocol: "sftp".to_string(),
            network_ssh_key_path: String::new(),
            editor_font_family: "monospace".to_string(),
            editor_font_size: 14,
            editor_tab_size: 4,
            editor_word_wrap: true,
            editor_auto_save: false,
            editor_syntax_highlighting: true,
            editor_line_numbers: true,
            viewer_default_view_mode: "text".to_string(),
            viewer_image_zoom: "fit".to_string(),
            viewer_media_autoplay: false,
            viewer_max_preview_size: 10,
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

        if user_version < 8 {
            self.backfill_v8_keys(&connection)?;
            connection.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        }

        if user_version < 9 {
            self.backfill_v9_keys(&connection)?;
            connection.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        }

        if user_version < 10 {
            self.backfill_v10_keys(&connection)?;
            connection.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        }

        if user_version < 11 {
            self.backfill_v11_keys(&connection)?;
            connection.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        }

        if user_version < 12 {
            self.backfill_v12_keys(&connection)?;
            connection.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        }

        if user_version < 13 {
            self.backfill_v13_keys(&connection)?;
            connection.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        }

        Ok(())
    }

    fn backfill_v13_keys(&self, connection: &Connection) -> Result<(), PreferencesError> {
        let defaults = UserPreferences::default();
        let now = chrono_lite_now();
        let rows = [("paneDirection", defaults.pane_direction.clone())];

        for (key, value) in rows {
            connection.execute(
                "insert into preferences (key, value, updated_at) values (?1, ?2, ?3)
                 on conflict(key) do nothing",
                params![key, value, now],
            )?;
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

    fn backfill_v8_keys(&self, connection: &Connection) -> Result<(), PreferencesError> {
        let defaults = UserPreferences::default();
        let now = chrono_lite_now();
        let rows = [("toolbarEntries", defaults.toolbar_entries.clone())];

        for (key, value) in rows {
            connection.execute(
                "insert into preferences (key, value, updated_at) values (?1, ?2, ?3)
                 on conflict(key) do nothing",
                params![key, value, now],
            )?;
        }

        Ok(())
    }

    fn backfill_v9_keys(&self, connection: &Connection) -> Result<(), PreferencesError> {
        let defaults = UserPreferences::default();
        let now = chrono_lite_now();
        let rows = [(
            "showAdvancedCopyOptions",
            defaults.show_advanced_copy_options.to_string(),
        )];

        for (key, value) in rows {
            connection.execute(
                "insert into preferences (key, value, updated_at) values (?1, ?2, ?3)
                 on conflict(key) do nothing",
                params![key, value, now],
            )?;
        }

        Ok(())
    }

    fn backfill_v10_keys(&self, connection: &Connection) -> Result<(), PreferencesError> {
        let defaults = UserPreferences::default();
        let now = chrono_lite_now();
        let rows = [
            (
                "paneTerminalHeightLeft",
                defaults.pane_terminal_height_left.to_string(),
            ),
            (
                "paneTerminalHeightRight",
                defaults.pane_terminal_height_right.to_string(),
            ),
            (
                "paneTerminalDefaultOpen",
                defaults.pane_terminal_default_open.to_string(),
            ),
            (
                "terminalCdOnNavigate",
                defaults.terminal_cd_on_navigate.to_string(),
            ),
            (
                "confirmClosePaneWithTerminal",
                defaults.confirm_close_pane_with_terminal.to_string(),
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

    fn backfill_v11_keys(&self, connection: &Connection) -> Result<(), PreferencesError> {
        let defaults = UserPreferences::default();
        let now = chrono_lite_now();
        let rows = [
            ("terminalShell", defaults.terminal_shell.clone()),
            ("terminalArgs", defaults.terminal_args.clone()),
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

    fn backfill_v12_keys(&self, connection: &Connection) -> Result<(), PreferencesError> {
        let defaults = UserPreferences::default();
        let now = chrono_lite_now();
        let rows = [(
            "rememberLastUsedPanes",
            defaults.remember_last_used_panes.to_string(),
        )];

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
            ("toolbarEntries", self.toolbar_entries.clone()),
            ("paneMode", self.pane_mode.clone()),
            ("paneDirection", self.pane_direction.clone()),
            ("jobDrawerBehavior", self.job_drawer_behavior.clone()),
            (
                "showAdvancedCopyOptions",
                self.show_advanced_copy_options.to_string(),
            ),
            (
                "paneTerminalHeightLeft",
                self.pane_terminal_height_left.to_string(),
            ),
            (
                "paneTerminalHeightRight",
                self.pane_terminal_height_right.to_string(),
            ),
            (
                "paneTerminalDefaultOpen",
                self.pane_terminal_default_open.to_string(),
            ),
            (
                "terminalCdOnNavigate",
                self.terminal_cd_on_navigate.to_string(),
            ),
            (
                "confirmClosePaneWithTerminal",
                self.confirm_close_pane_with_terminal.to_string(),
            ),
            ("terminalShell", self.terminal_shell.clone()),
            ("terminalArgs", self.terminal_args.clone()),
            (
                "rememberLastUsedPanes",
                self.remember_last_used_panes.to_string(),
            ),
            (
                "diagnosticsExportPath",
                self.diagnostics_export_path.clone(),
            ),
            ("logLevel", self.log_level.clone()),
            (
                "experimentalFeatures",
                self.experimental_features.to_string(),
            ),
            ("cacheSizeLimit", self.cache_size_limit.to_string()),
            (
                "fileOperationThreads",
                self.file_operation_threads.to_string(),
            ),
            (
                "networkConnectionTimeout",
                self.network_connection_timeout.to_string(),
            ),
            (
                "networkAutoReconnect",
                self.network_auto_reconnect.to_string(),
            ),
            (
                "networkDefaultProtocol",
                self.network_default_protocol.clone(),
            ),
            ("networkSshKeyPath", self.network_ssh_key_path.clone()),
            ("editorFontFamily", self.editor_font_family.clone()),
            ("editorFontSize", self.editor_font_size.to_string()),
            ("editorTabSize", self.editor_tab_size.to_string()),
            ("editorWordWrap", self.editor_word_wrap.to_string()),
            ("editorAutoSave", self.editor_auto_save.to_string()),
            (
                "editorSyntaxHighlighting",
                self.editor_syntax_highlighting.to_string(),
            ),
            ("editorLineNumbers", self.editor_line_numbers.to_string()),
            (
                "viewerDefaultViewMode",
                self.viewer_default_view_mode.clone(),
            ),
            ("viewerImageZoom", self.viewer_image_zoom.clone()),
            (
                "viewerMediaAutoplay",
                self.viewer_media_autoplay.to_string(),
            ),
            (
                "viewerMaxPreviewSize",
                self.viewer_max_preview_size.to_string(),
            ),
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
        "toolbarEntries" => {
            preferences.toolbar_entries = parse_toolbar_entries(value)?;
        }
        "paneMode" => {
            preferences.pane_mode = parse_pane_mode(value)?;
        }
        "paneDirection" => {
            preferences.pane_direction = parse_pane_direction(value)?;
        }
        "jobDrawerBehavior" => {
            preferences.job_drawer_behavior = parse_job_drawer_behavior(value)?;
        }
        "showAdvancedCopyOptions" => {
            preferences.show_advanced_copy_options = parse_bool(value, key)?;
        }
        "paneTerminalHeightLeft" => {
            preferences.pane_terminal_height_left = parse_pane_terminal_height(value)?;
        }
        "paneTerminalHeightRight" => {
            preferences.pane_terminal_height_right = parse_pane_terminal_height(value)?;
        }
        "paneTerminalDefaultOpen" => {
            preferences.pane_terminal_default_open = parse_bool(value, key)?;
        }
        "terminalCdOnNavigate" => {
            preferences.terminal_cd_on_navigate = parse_bool(value, key)?;
        }
        "confirmClosePaneWithTerminal" => {
            preferences.confirm_close_pane_with_terminal = parse_bool(value, key)?;
        }
        "terminalShell" => {
            preferences.terminal_shell = parse_terminal_shell(value)?;
        }
        "terminalArgs" => {
            preferences.terminal_args = parse_terminal_args(value)?;
        }
        "rememberLastUsedPanes" => {
            preferences.remember_last_used_panes = parse_bool(value, key)?;
        }
        "diagnosticsExportPath" => {
            preferences.diagnostics_export_path = parse_diagnostics_export_path(value)?;
        }
        "customShortcuts" => {
            preferences.custom_shortcuts = parse_custom_shortcuts(value)?;
        }
        "fileTypeColorRules" => {
            preferences.file_type_color_rules = parse_file_type_color_rules(value)?;
        }
        "layoutProfiles" => {
            preferences.layout_profiles = parse_layout_profiles(value)?;
        }
        "columnPresets" => {
            preferences.column_presets = parse_column_presets(value)?;
        }
        "logLevel" => {
            preferences.log_level = parse_log_level(value)?;
        }
        "experimentalFeatures" => {
            preferences.experimental_features = parse_bool(value, key)?;
        }
        "cacheSizeLimit" => {
            preferences.cache_size_limit = value
                .parse::<u32>()
                .map_err(|error| invalid_value(key, error.to_string()))?
                .clamp(16, 4096);
        }
        "fileOperationThreads" => {
            preferences.file_operation_threads = value
                .parse::<u32>()
                .map_err(|error| invalid_value(key, error.to_string()))?
                .clamp(1, 32);
        }
        "networkConnectionTimeout" => {
            preferences.network_connection_timeout = value
                .parse::<u32>()
                .map_err(|error| invalid_value(key, error.to_string()))?
                .clamp(5, 300);
        }
        "networkAutoReconnect" => {
            preferences.network_auto_reconnect = parse_bool(value, key)?;
        }
        "networkDefaultProtocol" => {
            preferences.network_default_protocol = parse_network_protocol(value)?;
        }
        "networkSshKeyPath" => {
            preferences.network_ssh_key_path = parse_file_path(value)?;
        }
        "editorFontFamily" => {
            preferences.editor_font_family = parse_terminal_shell(value)?;
        }
        "editorFontSize" => {
            preferences.editor_font_size = value
                .parse::<u32>()
                .map_err(|error| invalid_value(key, error.to_string()))?
                .clamp(8, 72);
        }
        "editorTabSize" => {
            preferences.editor_tab_size = value
                .parse::<u32>()
                .map_err(|error| invalid_value(key, error.to_string()))?
                .clamp(1, 16);
        }
        "editorWordWrap" => {
            preferences.editor_word_wrap = parse_bool(value, key)?;
        }
        "editorAutoSave" => {
            preferences.editor_auto_save = parse_bool(value, key)?;
        }
        "editorSyntaxHighlighting" => {
            preferences.editor_syntax_highlighting = parse_bool(value, key)?;
        }
        "editorLineNumbers" => {
            preferences.editor_line_numbers = parse_bool(value, key)?;
        }
        "viewerDefaultViewMode" => {
            preferences.viewer_default_view_mode = parse_viewer_view_mode(value)?;
        }
        "viewerImageZoom" => {
            preferences.viewer_image_zoom = parse_viewer_zoom(value)?;
        }
        "viewerMediaAutoplay" => {
            preferences.viewer_media_autoplay = parse_bool(value, key)?;
        }
        "viewerMaxPreviewSize" => {
            preferences.viewer_max_preview_size = value
                .parse::<u32>()
                .map_err(|error| invalid_value(key, error.to_string()))?
                .clamp(1, 1024);
        }
        _ => {}
    }

    Ok(())
}

fn parse_diagnostics_export_path(value: &str) -> Result<String, PreferencesError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok("/tmp/fileoctopus-diagnostics.zip".to_string());
    }
    if trimmed.len() > 2048 {
        return Err(invalid_value(
            "diagnosticsExportPath",
            "value is too long".to_string(),
        ));
    }

    let path = Path::new(trimmed);
    if !path.is_absolute() {
        return Err(invalid_value(
            "diagnosticsExportPath",
            "path must be absolute".to_string(),
        ));
    }
    if path
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err(invalid_value(
            "diagnosticsExportPath",
            "path must not contain '..' segments".to_string(),
        ));
    }

    Ok(trimmed.to_string())
}

fn parse_custom_shortcuts(value: &str) -> Result<String, PreferencesError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(String::new());
    }
    if trimmed.len() > 65536 {
        return Err(invalid_value(
            "customShortcuts",
            "value is too long".to_string(),
        ));
    }
    let _: serde_json::Value = serde_json::from_str(trimmed)
        .map_err(|error| invalid_value("customShortcuts", format!("invalid JSON: {}", error)))?;
    Ok(trimmed.to_string())
}

fn parse_file_type_color_rules(value: &str) -> Result<String, PreferencesError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(String::new());
    }
    if trimmed.len() > 65536 {
        return Err(invalid_value(
            "fileTypeColorRules",
            "value is too long".to_string(),
        ));
    }
    let _: serde_json::Value = serde_json::from_str(trimmed)
        .map_err(|error| invalid_value("fileTypeColorRules", format!("invalid JSON: {}", error)))?;
    Ok(trimmed.to_string())
}

fn parse_layout_profiles(value: &str) -> Result<String, PreferencesError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(String::new());
    }
    if trimmed.len() > 65536 {
        return Err(invalid_value(
            "layoutProfiles",
            "value is too long".to_string(),
        ));
    }
    let _: serde_json::Value = serde_json::from_str(trimmed)
        .map_err(|error| invalid_value("layoutProfiles", format!("invalid JSON: {}", error)))?;
    Ok(trimmed.to_string())
}

fn parse_column_presets(value: &str) -> Result<String, PreferencesError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(String::new());
    }
    if trimmed.len() > 65536 {
        return Err(invalid_value(
            "columnPresets",
            "value is too long".to_string(),
        ));
    }
    let _: serde_json::Value = serde_json::from_str(trimmed)
        .map_err(|error| invalid_value("columnPresets", format!("invalid JSON: {}", error)))?;
    Ok(trimmed.to_string())
}

fn parse_log_level(value: &str) -> Result<String, PreferencesError> {
    let valid = ["error", "warn", "info", "debug"];
    let lowered = value.trim().to_lowercase();
    if valid.contains(&lowered.as_str()) {
        Ok(lowered)
    } else {
        Err(invalid_value(
            "logLevel",
            format!("must be one of: {}", valid.join(", ")),
        ))
    }
}

fn parse_network_protocol(value: &str) -> Result<String, PreferencesError> {
    let valid = ["sftp", "smb", "s3", "webdav"];
    let lowered = value.trim().to_lowercase();
    if valid.contains(&lowered.as_str()) {
        Ok(lowered)
    } else {
        Err(invalid_value(
            "networkDefaultProtocol",
            format!("must be one of: {}", valid.join(", ")),
        ))
    }
}

fn parse_file_path(value: &str) -> Result<String, PreferencesError> {
    let trimmed = value.trim();
    if trimmed.len() > 2048 {
        return Err(invalid_value(
            "networkSshKeyPath",
            "value is too long".to_string(),
        ));
    }
    Ok(trimmed.to_string())
}

fn parse_viewer_view_mode(value: &str) -> Result<String, PreferencesError> {
    let valid = ["text", "hex"];
    let lowered = value.trim().to_lowercase();
    if valid.contains(&lowered.as_str()) {
        Ok(lowered)
    } else {
        Err(invalid_value(
            "viewerDefaultViewMode",
            format!("must be one of: {}", valid.join(", ")),
        ))
    }
}

fn parse_viewer_zoom(value: &str) -> Result<String, PreferencesError> {
    let valid = ["fit", "fill", "actual"];
    let lowered = value.trim().to_lowercase();
    if valid.contains(&lowered.as_str()) {
        Ok(lowered)
    } else {
        Err(invalid_value(
            "viewerImageZoom",
            format!("must be one of: {}", valid.join(", ")),
        ))
    }
}

fn parse_terminal_shell(value: &str) -> Result<String, PreferencesError> {
    let trimmed = value.trim();
    if trimmed.len() > 512 {
        return Err(invalid_value(
            "terminalShell",
            "value is too long".to_string(),
        ));
    }
    Ok(trimmed.to_string())
}

fn parse_terminal_args(value: &str) -> Result<String, PreferencesError> {
    if value.len() > 2048 {
        return Err(invalid_value(
            "terminalArgs",
            "value is too long".to_string(),
        ));
    }
    Ok(value
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n"))
}

fn parse_pane_terminal_height(value: &str) -> Result<f64, PreferencesError> {
    let parsed = value
        .parse::<f64>()
        .map_err(|error| invalid_value("paneTerminalHeight", error.to_string()))?;
    Ok(parsed.clamp(0.15, 0.85))
}

fn parse_toolbar_entries(value: &str) -> Result<String, PreferencesError> {
    if value.is_empty() {
        return Ok(String::new());
    }

    serde_json::from_str::<Vec<serde_json::Value>>(value)
        .map_err(|error| invalid_value("toolbarEntries", format!("invalid JSON array: {error}")))?;

    Ok(value.to_string())
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

fn parse_pane_direction(value: &str) -> Result<String, PreferencesError> {
    match value {
        "horizontal" | "vertical" => Ok(value.to_string()),
        other => Err(invalid_value(
            "paneDirection",
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
        assert!(!defaults.sidebar_visible);
        assert!(defaults.status_bar_visible);
        assert!(defaults.toolbar_visible);
        assert_eq!(defaults.pane_mode, "dual");
        assert_eq!(defaults.job_drawer_behavior, "manual");
        assert!(!defaults.activity_panel_visible);
        assert!(!defaults.show_advanced_copy_options);
    }

    #[test]
    fn as_rows_serializes_new_fields() {
        let prefs = UserPreferences::default();
        let rows: std::collections::HashMap<&str, String> = prefs.as_rows().into_iter().collect();
        assert_eq!(rows["accentColor"], "blue");
        assert_eq!(rows["fontScale"], "medium");
        assert_eq!(rows["iconScale"], "medium");
        assert_eq!(rows["confirmOverwrite"], "true");
        assert_eq!(rows["sidebarVisible"], "false");
        assert_eq!(rows["statusBarVisible"], "true");
        assert_eq!(rows["toolbarVisible"], "true");
        assert_eq!(rows["toolbarEntries"], "");
        assert_eq!(rows["paneMode"], "dual");
        assert_eq!(rows["jobDrawerBehavior"], "manual");
        assert_eq!(rows["showAdvancedCopyOptions"], "false");
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
        repository.set("showAdvancedCopyOptions", "true").unwrap();
        let reloaded = PreferencesRepository::new(path).unwrap().get_all().unwrap();
        assert!(!reloaded.confirm_overwrite);
        assert!(!reloaded.sidebar_visible);
        assert!(reloaded.show_advanced_copy_options);
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
        assert!(!prefs.sidebar_visible);
        assert_eq!(prefs.pane_mode, "dual");
        assert_eq!(prefs.job_drawer_behavior, "manual");
        assert!(!prefs.show_advanced_copy_options);

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
    fn round_trips_terminal_preferences() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("preferences.sqlite");
        let repository = PreferencesRepository::new(path.clone()).unwrap();
        repository.set("paneTerminalHeightLeft", "0.42").unwrap();
        repository.set("paneTerminalHeightRight", "0.38").unwrap();
        repository.set("paneTerminalDefaultOpen", "true").unwrap();
        repository.set("terminalCdOnNavigate", "true").unwrap();
        repository
            .set("confirmClosePaneWithTerminal", "false")
            .unwrap();
        repository.set("terminalShell", " /bin/zsh ").unwrap();
        repository
            .set("terminalArgs", " -l \n  \n --interactive ")
            .unwrap();
        let reloaded = PreferencesRepository::new(path).unwrap().get_all().unwrap();
        assert!((reloaded.pane_terminal_height_left - 0.42).abs() < f64::EPSILON);
        assert!((reloaded.pane_terminal_height_right - 0.38).abs() < f64::EPSILON);
        assert!(reloaded.pane_terminal_default_open);
        assert!(reloaded.terminal_cd_on_navigate);
        assert!(!reloaded.confirm_close_pane_with_terminal);
        assert_eq!(reloaded.terminal_shell, "/bin/zsh");
        assert_eq!(reloaded.terminal_args, "-l\n--interactive");
    }

    #[test]
    fn round_trips_and_validates_diagnostics_export_path() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("preferences.sqlite");
        let repository = PreferencesRepository::new(path.clone()).unwrap();
        repository
            .set(
                "diagnosticsExportPath",
                " /home/user/fileoctopus-diagnostics.zip ",
            )
            .unwrap();

        let reloaded = PreferencesRepository::new(path).unwrap().get_all().unwrap();
        assert_eq!(
            reloaded.diagnostics_export_path,
            "/home/user/fileoctopus-diagnostics.zip"
        );

        let updated = repository.set("diagnosticsExportPath", "   ").unwrap();
        assert_eq!(
            updated.diagnostics_export_path,
            "/tmp/fileoctopus-diagnostics.zip"
        );

        let too_long = "a".repeat(2049);
        let error = repository
            .set("diagnosticsExportPath", too_long.as_str())
            .unwrap_err();
        assert!(matches!(error, PreferencesError::InvalidValue { .. }));
    }

    #[test]
    fn rejects_unsafe_diagnostics_export_path() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("preferences.sqlite");
        let repository = PreferencesRepository::new(path).unwrap();

        let relative = repository
            .set("diagnosticsExportPath", "relative/diagnostics.zip")
            .unwrap_err();
        assert!(matches!(relative, PreferencesError::InvalidValue { .. }));

        let traversal = repository
            .set("diagnosticsExportPath", "/tmp/../etc/diagnostics.zip")
            .unwrap_err();
        assert!(matches!(traversal, PreferencesError::InvalidValue { .. }));
    }

    #[test]
    fn round_trips_toolbar_entries() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("preferences.sqlite");
        let repository = PreferencesRepository::new(path.clone()).unwrap();
        let entries = r#"[{"kind":"command","commandId":"op.copy"}]"#;
        repository.set("toolbarEntries", entries).unwrap();
        let reloaded = PreferencesRepository::new(path).unwrap().get_all().unwrap();
        assert_eq!(reloaded.toolbar_entries, entries);
    }

    #[test]
    fn rejects_invalid_toolbar_entries() {
        let dir = tempdir().unwrap();
        let repository = PreferencesRepository::new(dir.path().join("preferences.sqlite")).unwrap();
        let error = repository.set("toolbarEntries", "not-json").unwrap_err();
        assert!(matches!(error, PreferencesError::InvalidValue { .. }));
    }

    #[test]
    fn migrates_v7_database_to_current_schema_with_toolbar_entries_default() {
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
                        ('toolbarVisible', 'true', '0')",
                    [],
                )
                .unwrap();
            connection
                .pragma_update(None, "user_version", 7u32)
                .unwrap();
        }

        let repository = PreferencesRepository::new(path.clone()).unwrap();
        let prefs = repository.get_all().unwrap();

        assert_eq!(prefs.theme, "dark");
        assert!(prefs.toolbar_visible);
        assert_eq!(prefs.toolbar_entries, "");
        assert!(!prefs.show_advanced_copy_options);

        let connection = Connection::open(&path).unwrap();
        let version: u32 = connection
            .query_row("pragma user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, SCHEMA_VERSION);
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
