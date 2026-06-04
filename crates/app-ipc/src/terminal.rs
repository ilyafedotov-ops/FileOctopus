use super::*;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenTerminalRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenTerminalResponse {
    pub success: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSpawnRequest {
    #[serde(default)]
    pub uri: Option<String>,
    #[serde(default)]
    pub profile_id: Option<String>,
    #[serde(default)]
    pub terminal_profile_id: Option<String>,
    pub cols: u16,
    pub rows: u16,
    #[serde(default)]
    pub shell: Option<String>,
    #[serde(default)]
    pub args: Option<Vec<String>>,
    #[serde(default)]
    pub env: Option<Vec<TerminalEnvVarDto>>,
    #[serde(default)]
    pub initial_command: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSpawnResponse {
    pub session_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalWriteRequest {
    pub session_id: String,
    pub data: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalResizeRequest {
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalKillRequest {
    pub session_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalOkResponse {
    pub success: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalEnvVarDto {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalOutputEventDto {
    pub session_id: String,
    pub data: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalExitEventDto {
    pub session_id: String,
    pub exit_code: Option<i32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TerminalProfileScopeDto {
    Local,
    Ssh,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalProfileInputDto {
    pub name: String,
    pub scope: TerminalProfileScopeDto,
    pub shell: String,
    pub args: String,
    pub env: String,
    pub working_directory_mode: String,
    pub custom_cwd_uri: String,
    pub network_profile_id: Option<String>,
    pub remote_cwd: String,
    pub initial_command: String,
    pub font_family: String,
    pub font_size: u32,
    pub line_height: f64,
    pub cursor_style: String,
    pub cursor_blink: bool,
    pub scrollback: u32,
    pub theme_id: String,
    pub theme_overrides: String,
    pub copy_on_select: bool,
    pub right_click_action: String,
    pub paste_confirmation: bool,
    pub link_handling: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalProfileDto {
    pub id: String,
    pub name: String,
    pub scope: TerminalProfileScopeDto,
    pub shell: String,
    pub args: String,
    pub env: String,
    pub working_directory_mode: String,
    pub custom_cwd_uri: String,
    pub network_profile_id: Option<String>,
    pub remote_cwd: String,
    pub initial_command: String,
    pub font_family: String,
    pub font_size: u32,
    pub line_height: f64,
    pub cursor_style: String,
    pub cursor_blink: bool,
    pub scrollback: u32,
    pub theme_id: String,
    pub theme_overrides: String,
    pub copy_on_select: bool,
    pub right_click_action: String,
    pub paste_confirmation: bool,
    pub link_handling: String,
    pub sort_order: i64,
    pub is_default: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalProfilesListResponse {
    pub profiles: Vec<TerminalProfileDto>,
    pub default_profile_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalProfileResponse {
    pub profile: TerminalProfileDto,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalProfileAddRequest {
    pub profile: TerminalProfileInputDto,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalProfileUpdateRequest {
    pub id: String,
    pub profile: TerminalProfileInputDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalProfileActionRequest {
    pub id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalCapabilitiesResponse {
    pub default_shell: String,
    pub default_args: Vec<String>,
    pub discovered_shells: Vec<String>,
    pub supports_ssh: bool,
    pub cursor_styles: Vec<String>,
    pub theme_ids: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TerminalSessionStatusDto {
    Starting,
    Running,
    Exited,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSessionDto {
    pub session_id: String,
    pub status: TerminalSessionStatusDto,
    pub title: String,
    pub cwd_uri: Option<String>,
    pub terminal_profile_id: Option<String>,
    pub transport: String,
    pub cols: u16,
    pub rows: u16,
    pub exit_code: Option<i32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSessionsListResponse {
    pub sessions: Vec<TerminalSessionDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSendTextRequest {
    pub session_id: String,
    pub text: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalRunCommandRequest {
    pub session_id: String,
    pub command: String,
    pub append_newline: bool,
    pub focus: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSpawnAndRunRequest {
    pub uri: Option<String>,
    pub profile_id: Option<String>,
    pub terminal_profile_id: Option<String>,
    pub cols: u16,
    pub rows: u16,
    pub command: String,
    pub title: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSessionEventDto {
    pub kind: String,
    pub session_id: String,
    pub status: TerminalSessionStatusDto,
    pub title: String,
    pub cwd_uri: Option<String>,
    pub terminal_profile_id: Option<String>,
    pub transport: String,
    pub cols: u16,
    pub rows: u16,
    pub exit_code: Option<i32>,
}
