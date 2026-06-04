use std::path::PathBuf;
use std::sync::Arc;

use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

pub const TERMINAL_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Error)]
pub enum TerminalProfileError {
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("invalid terminal profile value for `{field}`: {reason}")]
    InvalidValue { field: String, reason: String },
    #[error("unsupported future schema version {0}")]
    UnsupportedSchema(u32),
    #[error("terminal profile not found")]
    ProfileNotFound,
    #[error("cannot delete the default terminal profile")]
    CannotDeleteDefault,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TerminalProfileScope {
    Local,
    Ssh,
}

impl TerminalProfileScope {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Local => "local",
            Self::Ssh => "ssh",
        }
    }

    pub fn parse(value: &str) -> Result<Self, TerminalProfileError> {
        match value {
            "local" => Ok(Self::Local),
            "ssh" => Ok(Self::Ssh),
            other => Err(TerminalProfileError::InvalidValue {
                field: "scope".to_string(),
                reason: format!("unsupported value `{other}`"),
            }),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalProfile {
    pub id: String,
    pub name: String,
    pub scope: TerminalProfileScope,
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
pub struct NewTerminalProfile {
    pub name: String,
    pub scope: TerminalProfileScope,
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
pub struct UpdateTerminalProfile {
    pub name: String,
    pub scope: TerminalProfileScope,
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

impl Default for NewTerminalProfile {
    fn default() -> Self {
        Self {
            name: "Default".to_string(),
            scope: TerminalProfileScope::Local,
            shell: String::new(),
            args: String::new(),
            env: String::new(),
            working_directory_mode: "currentPane".to_string(),
            custom_cwd_uri: String::new(),
            network_profile_id: None,
            remote_cwd: String::new(),
            initial_command: String::new(),
            font_family: "monospace".to_string(),
            font_size: 13,
            line_height: 1.2,
            cursor_style: "block".to_string(),
            cursor_blink: true,
            scrollback: 5000,
            theme_id: "system".to_string(),
            theme_overrides: String::new(),
            copy_on_select: false,
            right_click_action: "contextMenu".to_string(),
            paste_confirmation: true,
            link_handling: "openExternal".to_string(),
        }
    }
}

impl From<TerminalProfile> for UpdateTerminalProfile {
    fn from(profile: TerminalProfile) -> Self {
        Self {
            name: profile.name,
            scope: profile.scope,
            shell: profile.shell,
            args: profile.args,
            env: profile.env,
            working_directory_mode: profile.working_directory_mode,
            custom_cwd_uri: profile.custom_cwd_uri,
            network_profile_id: profile.network_profile_id,
            remote_cwd: profile.remote_cwd,
            initial_command: profile.initial_command,
            font_family: profile.font_family,
            font_size: profile.font_size,
            line_height: profile.line_height,
            cursor_style: profile.cursor_style,
            cursor_blink: profile.cursor_blink,
            scrollback: profile.scrollback,
            theme_id: profile.theme_id,
            theme_overrides: profile.theme_overrides,
            copy_on_select: profile.copy_on_select,
            right_click_action: profile.right_click_action,
            paste_confirmation: profile.paste_confirmation,
            link_handling: profile.link_handling,
        }
    }
}

#[derive(Clone)]
pub struct TerminalProfileRepository {
    path: Arc<PathBuf>,
}

impl TerminalProfileRepository {
    pub fn new(path: PathBuf) -> Result<Self, TerminalProfileError> {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let repository = Self {
            path: Arc::new(path),
        };
        repository.migrate()?;
        Ok(repository)
    }

    pub fn list(&self) -> Result<Vec<TerminalProfile>, TerminalProfileError> {
        let connection = self.connect()?;
        let mut statement = connection.prepare(
            "select id, name, scope, shell, args, env, working_directory_mode,
                    custom_cwd_uri, network_profile_id, remote_cwd, initial_command,
                    font_family, font_size, line_height, cursor_style, cursor_blink,
                    scrollback, theme_id, theme_overrides, copy_on_select,
                    right_click_action, paste_confirmation, link_handling,
                    sort_order, is_default, created_at, updated_at
             from terminal_profiles
             order by sort_order asc, name asc",
        )?;
        let rows = statement.query_map([], map_terminal_profile_row)?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(TerminalProfileError::from)
    }

    pub fn get(&self, id: &str) -> Result<TerminalProfile, TerminalProfileError> {
        let connection = self.connect()?;
        let mut statement = connection.prepare(
            "select id, name, scope, shell, args, env, working_directory_mode,
                    custom_cwd_uri, network_profile_id, remote_cwd, initial_command,
                    font_family, font_size, line_height, cursor_style, cursor_blink,
                    scrollback, theme_id, theme_overrides, copy_on_select,
                    right_click_action, paste_confirmation, link_handling,
                    sort_order, is_default, created_at, updated_at
             from terminal_profiles
             where id = ?1",
        )?;
        let mut rows = statement.query(params![id])?;
        if let Some(row) = rows.next()? {
            return Ok(map_terminal_profile_row(row)?);
        }
        Err(TerminalProfileError::ProfileNotFound)
    }

    pub fn default_profile(&self) -> Result<TerminalProfile, TerminalProfileError> {
        let connection = self.connect()?;
        let mut statement = connection.prepare(
            "select id, name, scope, shell, args, env, working_directory_mode,
                    custom_cwd_uri, network_profile_id, remote_cwd, initial_command,
                    font_family, font_size, line_height, cursor_style, cursor_blink,
                    scrollback, theme_id, theme_overrides, copy_on_select,
                    right_click_action, paste_confirmation, link_handling,
                    sort_order, is_default, created_at, updated_at
             from terminal_profiles
             where is_default = 1
             order by sort_order asc
             limit 1",
        )?;
        let mut rows = statement.query([])?;
        if let Some(row) = rows.next()? {
            return Ok(map_terminal_profile_row(row)?);
        }
        Err(TerminalProfileError::ProfileNotFound)
    }

    pub fn add(
        &self,
        profile: NewTerminalProfile,
    ) -> Result<TerminalProfile, TerminalProfileError> {
        validate_profile(
            &profile.name,
            profile.font_size,
            profile.line_height,
            profile.scrollback,
        )?;
        let connection = self.connect()?;
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let sort_order = connection.query_row(
            "select coalesce(max(sort_order), -1) + 1 from terminal_profiles",
            [],
            |row| row.get::<_, i64>(0),
        )?;
        connection.execute(
            "insert into terminal_profiles (
                id, name, scope, shell, args, env, working_directory_mode,
                custom_cwd_uri, network_profile_id, remote_cwd, initial_command,
                font_family, font_size, line_height, cursor_style, cursor_blink,
                scrollback, theme_id, theme_overrides, copy_on_select,
                right_click_action, paste_confirmation, link_handling,
                sort_order, is_default, created_at, updated_at
             ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13,
                       ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, 0, ?25, ?25)",
            params![
                id,
                profile.name.trim(),
                profile.scope.as_str(),
                profile.shell.trim(),
                normalize_lines(&profile.args),
                normalize_lines(&profile.env),
                profile.working_directory_mode.trim(),
                profile.custom_cwd_uri.trim(),
                profile.network_profile_id,
                profile.remote_cwd.trim(),
                profile.initial_command,
                profile.font_family.trim(),
                profile.font_size,
                profile.line_height,
                profile.cursor_style.trim(),
                i64::from(profile.cursor_blink),
                profile.scrollback,
                profile.theme_id.trim(),
                profile.theme_overrides,
                i64::from(profile.copy_on_select),
                profile.right_click_action.trim(),
                i64::from(profile.paste_confirmation),
                profile.link_handling.trim(),
                sort_order,
                now,
            ],
        )?;
        self.get(&id)
    }

    pub fn update(
        &self,
        id: &str,
        profile: UpdateTerminalProfile,
    ) -> Result<TerminalProfile, TerminalProfileError> {
        validate_profile(
            &profile.name,
            profile.font_size,
            profile.line_height,
            profile.scrollback,
        )?;
        let connection = self.connect()?;
        let now = Utc::now().to_rfc3339();
        let updated = connection.execute(
            "update terminal_profiles
             set name = ?2, scope = ?3, shell = ?4, args = ?5, env = ?6,
                 working_directory_mode = ?7, custom_cwd_uri = ?8,
                 network_profile_id = ?9, remote_cwd = ?10, initial_command = ?11,
                 font_family = ?12, font_size = ?13, line_height = ?14,
                 cursor_style = ?15, cursor_blink = ?16, scrollback = ?17,
                 theme_id = ?18, theme_overrides = ?19, copy_on_select = ?20,
                 right_click_action = ?21, paste_confirmation = ?22,
                 link_handling = ?23, updated_at = ?24
             where id = ?1",
            params![
                id,
                profile.name.trim(),
                profile.scope.as_str(),
                profile.shell.trim(),
                normalize_lines(&profile.args),
                normalize_lines(&profile.env),
                profile.working_directory_mode.trim(),
                profile.custom_cwd_uri.trim(),
                profile.network_profile_id,
                profile.remote_cwd.trim(),
                profile.initial_command,
                profile.font_family.trim(),
                profile.font_size,
                profile.line_height,
                profile.cursor_style.trim(),
                i64::from(profile.cursor_blink),
                profile.scrollback,
                profile.theme_id.trim(),
                profile.theme_overrides,
                i64::from(profile.copy_on_select),
                profile.right_click_action.trim(),
                i64::from(profile.paste_confirmation),
                profile.link_handling.trim(),
                now,
            ],
        )?;
        if updated == 0 {
            return Err(TerminalProfileError::ProfileNotFound);
        }
        self.get(id)
    }

    pub fn set_default(&self, id: &str) -> Result<TerminalProfile, TerminalProfileError> {
        let connection = self.connect()?;
        let tx = connection.unchecked_transaction()?;
        let exists: bool = tx
            .query_row(
                "select exists(select 1 from terminal_profiles where id = ?1)",
                params![id],
                |row| row.get(0),
            )
            .map_err(TerminalProfileError::from)?;
        if !exists {
            return Err(TerminalProfileError::ProfileNotFound);
        }
        let now = Utc::now().to_rfc3339();
        tx.execute("update terminal_profiles set is_default = 0", [])?;
        tx.execute(
            "update terminal_profiles set is_default = 1, updated_at = ?2 where id = ?1",
            params![id, now],
        )?;
        tx.commit()?;
        self.get(id)
    }

    pub fn delete(&self, id: &str) -> Result<(), TerminalProfileError> {
        let profile = self.get(id)?;
        if profile.is_default {
            return Err(TerminalProfileError::CannotDeleteDefault);
        }
        let connection = self.connect()?;
        let deleted =
            connection.execute("delete from terminal_profiles where id = ?1", params![id])?;
        if deleted == 0 {
            return Err(TerminalProfileError::ProfileNotFound);
        }
        Ok(())
    }

    fn migrate(&self) -> Result<(), TerminalProfileError> {
        let connection = self.connect()?;
        let user_version: u32 =
            connection.query_row("pragma user_version", [], |row| row.get(0))?;
        if user_version > TERMINAL_SCHEMA_VERSION {
            return Err(TerminalProfileError::UnsupportedSchema(user_version));
        }
        connection.execute(
            "create table if not exists terminal_profiles (
                id text primary key,
                name text not null,
                scope text not null,
                shell text not null,
                args text not null,
                env text not null,
                working_directory_mode text not null,
                custom_cwd_uri text not null,
                network_profile_id text,
                remote_cwd text not null,
                initial_command text not null,
                font_family text not null,
                font_size integer not null,
                line_height real not null,
                cursor_style text not null,
                cursor_blink integer not null,
                scrollback integer not null,
                theme_id text not null,
                theme_overrides text not null,
                copy_on_select integer not null,
                right_click_action text not null,
                paste_confirmation integer not null,
                link_handling text not null,
                sort_order integer not null,
                is_default integer not null,
                created_at text not null,
                updated_at text not null
            )",
            [],
        )?;
        connection.pragma_update(None, "user_version", TERMINAL_SCHEMA_VERSION)?;
        let count: i64 =
            connection.query_row("select count(*) from terminal_profiles", [], |row| {
                row.get(0)
            })?;
        if count == 0 {
            self.seed_default(&connection)?;
        }
        Ok(())
    }

    fn seed_default(&self, connection: &Connection) -> Result<(), TerminalProfileError> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let profile = NewTerminalProfile::default();
        connection.execute(
            "insert into terminal_profiles (
                id, name, scope, shell, args, env, working_directory_mode,
                custom_cwd_uri, network_profile_id, remote_cwd, initial_command,
                font_family, font_size, line_height, cursor_style, cursor_blink,
                scrollback, theme_id, theme_overrides, copy_on_select,
                right_click_action, paste_confirmation, link_handling,
                sort_order, is_default, created_at, updated_at
             ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, null, ?9, ?10, ?11, ?12,
                       ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, 0, 1, ?23, ?23)",
            params![
                id,
                profile.name,
                profile.scope.as_str(),
                profile.shell,
                profile.args,
                profile.env,
                profile.working_directory_mode,
                profile.custom_cwd_uri,
                profile.remote_cwd,
                profile.initial_command,
                profile.font_family,
                profile.font_size,
                profile.line_height,
                profile.cursor_style,
                i64::from(profile.cursor_blink),
                profile.scrollback,
                profile.theme_id,
                profile.theme_overrides,
                i64::from(profile.copy_on_select),
                profile.right_click_action,
                i64::from(profile.paste_confirmation),
                profile.link_handling,
                now,
            ],
        )?;
        Ok(())
    }

    fn connect(&self) -> Result<Connection, TerminalProfileError> {
        Connection::open(self.path.as_ref()).map_err(TerminalProfileError::from)
    }
}

fn map_terminal_profile_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<TerminalProfile> {
    let scope: String = row.get(2)?;
    Ok(TerminalProfile {
        id: row.get(0)?,
        name: row.get(1)?,
        scope: TerminalProfileScope::parse(&scope).map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(
                2,
                rusqlite::types::Type::Text,
                Box::new(error),
            )
        })?,
        shell: row.get(3)?,
        args: row.get(4)?,
        env: row.get(5)?,
        working_directory_mode: row.get(6)?,
        custom_cwd_uri: row.get(7)?,
        network_profile_id: row.get(8)?,
        remote_cwd: row.get(9)?,
        initial_command: row.get(10)?,
        font_family: row.get(11)?,
        font_size: row.get(12)?,
        line_height: row.get(13)?,
        cursor_style: row.get(14)?,
        cursor_blink: row.get::<_, i64>(15)? != 0,
        scrollback: row.get(16)?,
        theme_id: row.get(17)?,
        theme_overrides: row.get(18)?,
        copy_on_select: row.get::<_, i64>(19)? != 0,
        right_click_action: row.get(20)?,
        paste_confirmation: row.get::<_, i64>(21)? != 0,
        link_handling: row.get(22)?,
        sort_order: row.get(23)?,
        is_default: row.get::<_, i64>(24)? != 0,
        created_at: row.get(25)?,
        updated_at: row.get(26)?,
    })
}

fn validate_profile(
    name: &str,
    font_size: u32,
    line_height: f64,
    scrollback: u32,
) -> Result<(), TerminalProfileError> {
    if name.trim().is_empty() {
        return Err(TerminalProfileError::InvalidValue {
            field: "name".to_string(),
            reason: "must not be empty".to_string(),
        });
    }
    if !(8..=32).contains(&font_size) {
        return Err(TerminalProfileError::InvalidValue {
            field: "fontSize".to_string(),
            reason: "must be between 8 and 32".to_string(),
        });
    }
    if !(1.0..=2.0).contains(&line_height) {
        return Err(TerminalProfileError::InvalidValue {
            field: "lineHeight".to_string(),
            reason: "must be between 1.0 and 2.0".to_string(),
        });
    }
    if !(100..=100_000).contains(&scrollback) {
        return Err(TerminalProfileError::InvalidValue {
            field: "scrollback".to_string(),
            reason: "must be between 100 and 100000".to_string(),
        });
    }
    Ok(())
}

fn normalize_lines(value: &str) -> String {
    value
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}
