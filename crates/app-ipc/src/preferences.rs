use super::*;

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
    pub status_bar_visible: bool,
    pub toolbar_visible: bool,
    #[serde(default)]
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
    #[serde(default)]
    pub custom_shortcuts: String,
    #[serde(default)]
    pub file_type_color_rules: String,
    #[serde(default)]
    pub layout_profiles: String,
    #[serde(default)]
    pub column_presets: String,
    #[serde(default)]
    pub tab_sessions: String,
    #[serde(default)]
    pub hotlist_entries: String,
    #[serde(default)]
    pub log_level: String,
    #[serde(default)]
    pub experimental_features: bool,
    #[serde(default)]
    pub cache_size_limit: u32,
    #[serde(default)]
    pub file_operation_threads: u32,
    #[serde(default = "default_network_timeout")]
    pub network_connection_timeout: u32,
    #[serde(default = "default_true")]
    pub network_auto_reconnect: bool,
    #[serde(default = "default_network_protocol")]
    pub network_default_protocol: String,
    #[serde(default)]
    pub network_ssh_key_path: String,
    #[serde(default = "default_editor_font_family")]
    pub editor_font_family: String,
    #[serde(default = "default_editor_font_size")]
    pub editor_font_size: u32,
    #[serde(default = "default_editor_tab_size")]
    pub editor_tab_size: u32,
    #[serde(default = "default_true")]
    pub editor_word_wrap: bool,
    #[serde(default)]
    pub editor_auto_save: bool,
    #[serde(default = "default_true")]
    pub editor_syntax_highlighting: bool,
    #[serde(default = "default_true")]
    pub editor_line_numbers: bool,
    #[serde(default = "default_viewer_view_mode")]
    pub viewer_default_view_mode: String,
    #[serde(default = "default_viewer_zoom")]
    pub viewer_image_zoom: String,
    #[serde(default)]
    pub viewer_media_autoplay: bool,
    #[serde(default = "default_viewer_max_preview_size")]
    pub viewer_max_preview_size: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutostartStatusDto {
    pub enabled: bool,
    pub supported: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetPreferencesResponse {
    pub preferences: UserPreferencesDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetPreferenceRequest {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetPreferenceResponse {
    pub preferences: UserPreferencesDto,
}
