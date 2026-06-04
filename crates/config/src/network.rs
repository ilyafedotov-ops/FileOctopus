use std::path::PathBuf;
use std::sync::Arc;

use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

pub const NETWORK_SCHEMA_VERSION: u32 = 3;

#[derive(Debug, Error)]
pub enum NetworkError {
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("invalid network value for `{field}`: {reason}")]
    InvalidValue { field: String, reason: String },
    #[error("unsupported future schema version {0}")]
    UnsupportedSchema(u32),
    #[error("network profile not found")]
    ProfileNotFound,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AuthKind {
    Password,
    PrivateKey,
    AccessKey,
    OAuth,
}

impl AuthKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Password => "password",
            Self::PrivateKey => "privateKey",
            Self::AccessKey => "accessKey",
            Self::OAuth => "oauth",
        }
    }

    pub fn parse(value: &str) -> Result<Self, NetworkError> {
        match value {
            "password" => Ok(Self::Password),
            "privateKey" => Ok(Self::PrivateKey),
            "accessKey" => Ok(Self::AccessKey),
            "oauth" => Ok(Self::OAuth),
            other => Err(NetworkError::InvalidValue {
                field: "authKind".to_string(),
                reason: format!("unsupported value `{other}`"),
            }),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfile {
    pub id: String,
    pub label: String,
    pub scheme: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_kind: AuthKind,
    pub private_key_path: Option<String>,
    pub default_path: String,
    pub host_key_fingerprint: Option<String>,
    pub sort_order: i64,
    pub last_connected_at: Option<String>,
    pub last_error: Option<String>,
    pub has_stored_secret: bool,
    pub options: NetworkProtocolOptions,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewNetworkProfile {
    pub label: String,
    pub scheme: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_kind: AuthKind,
    pub private_key_path: Option<String>,
    pub default_path: String,
    #[serde(default)]
    pub options: NetworkProtocolOptions,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNetworkProfile {
    pub label: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_kind: AuthKind,
    pub private_key_path: Option<String>,
    pub default_path: String,
    #[serde(default)]
    pub options: NetworkProtocolOptions,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProtocolOptions {
    #[serde(default)]
    pub ssh: SshProtocolOptions,
    #[serde(default)]
    pub smb: SmbProtocolOptions,
    #[serde(default)]
    pub s3: S3ProtocolOptions,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SshProtocolOptions {
    pub use_agent: Option<bool>,
    pub ssh_config_host: Option<String>,
    pub proxy_jump: Option<String>,
    pub proxy_command: Option<String>,
    pub keepalive_secs: Option<u32>,
    pub compression: Option<bool>,
    pub address_family: Option<String>,
    pub terminal_initial_command: Option<String>,
    #[serde(default)]
    pub terminal_env: Vec<NetworkEnvVar>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SmbProtocolOptions {
    pub workgroup: Option<String>,
    pub min_protocol: Option<String>,
    pub signing_mode: Option<String>,
    pub share_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct S3ProtocolOptions {
    pub region: Option<String>,
    pub use_tls: Option<bool>,
    pub path_style: Option<bool>,
    pub root_prefix: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkEnvVar {
    pub name: String,
    pub value: String,
}

#[derive(Clone)]
pub struct NetworkProfileRepository {
    path: Arc<PathBuf>,
}

impl NetworkProfileRepository {
    pub fn new(path: PathBuf) -> Result<Self, NetworkError> {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let repository = Self {
            path: Arc::new(path),
        };
        repository.migrate()?;
        Ok(repository)
    }

    pub fn list(&self) -> Result<Vec<NetworkProfile>, NetworkError> {
        let connection = self.connect()?;
        let mut statement = connection.prepare(
            "select id, label, scheme, host, port, username, auth_kind, private_key_path,
                    default_path, host_key_fingerprint, sort_order, last_connected_at,
                    last_error, has_stored_secret, created_at, updated_at, options_json
             from network_profiles
             order by sort_order asc, label asc",
        )?;
        let rows = statement.query_map([], map_profile_row)?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(NetworkError::from)
    }

    pub fn get(&self, id: &str) -> Result<NetworkProfile, NetworkError> {
        let connection = self.connect()?;
        let mut statement = connection.prepare(
            "select id, label, scheme, host, port, username, auth_kind, private_key_path,
                    default_path, host_key_fingerprint, sort_order, last_connected_at,
                    last_error, has_stored_secret, created_at, updated_at, options_json
             from network_profiles
             where id = ?1",
        )?;
        let mut rows = statement.query(params![id])?;
        if let Some(row) = rows.next()? {
            return Ok(map_profile_row(row)?);
        }

        Err(NetworkError::ProfileNotFound)
    }

    pub fn add(&self, profile: NewNetworkProfile) -> Result<NetworkProfile, NetworkError> {
        validate_profile_fields(
            &profile.scheme,
            &profile.host,
            &profile.username,
            profile.port,
        )?;
        let connection = self.connect()?;
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let sort_order = connection.query_row(
            "select coalesce(max(sort_order), -1) + 1 from network_profiles",
            [],
            |row| row.get::<_, i64>(0),
        )?;
        let has_stored_secret = profile.auth_kind == AuthKind::PrivateKey
            && profile
                .private_key_path
                .as_ref()
                .is_some_and(|path| !path.is_empty());
        let options_json = encode_options(&profile.options)?;
        connection.execute(
            "insert into network_profiles (
                id, label, scheme, host, port, username, auth_kind, private_key_path,
                default_path, host_key_fingerprint, sort_order, last_connected_at,
                last_error, has_stored_secret, created_at, updated_at, options_json
             ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, null, ?10, null, null, ?11, ?12, ?12, ?13)",
            params![
                id,
                profile.label,
                profile.scheme,
                profile.host,
                profile.port,
                profile.username,
                profile.auth_kind.as_str(),
                profile.private_key_path,
                profile.default_path,
                sort_order,
                i64::from(has_stored_secret),
                now,
                options_json,
            ],
        )?;

        self.get(&id)
    }

    pub fn update(
        &self,
        id: &str,
        profile: UpdateNetworkProfile,
    ) -> Result<NetworkProfile, NetworkError> {
        let existing = self.get(id)?;
        validate_profile_fields(
            &existing.scheme,
            &profile.host,
            &profile.username,
            profile.port,
        )?;
        let connection = self.connect()?;
        let now = Utc::now().to_rfc3339();
        let has_stored_secret = stored_secret_flag_for_profile(
            existing.auth_kind,
            profile.auth_kind,
            existing.has_stored_secret,
            profile.private_key_path.as_deref(),
        );
        let options_json = encode_options(&profile.options)?;
        let updated = connection.execute(
            "update network_profiles
             set label = ?2, host = ?3, port = ?4, username = ?5, auth_kind = ?6,
                 private_key_path = ?7, default_path = ?8, has_stored_secret = ?9,
                 updated_at = ?10, options_json = ?11
             where id = ?1",
            params![
                id,
                profile.label,
                profile.host,
                profile.port,
                profile.username,
                profile.auth_kind.as_str(),
                profile.private_key_path,
                profile.default_path,
                i64::from(has_stored_secret),
                now,
                options_json,
            ],
        )?;

        if updated == 0 {
            return Err(NetworkError::ProfileNotFound);
        }

        self.get(id)
    }

    pub fn delete(&self, id: &str) -> Result<(), NetworkError> {
        let connection = self.connect()?;
        let deleted =
            connection.execute("delete from network_profiles where id = ?1", params![id])?;
        if deleted == 0 {
            return Err(NetworkError::ProfileNotFound);
        }
        Ok(())
    }

    pub fn set_connection_state(
        &self,
        id: &str,
        connected: bool,
        error: Option<&str>,
    ) -> Result<(), NetworkError> {
        let connection = self.connect()?;
        let now = Utc::now().to_rfc3339();
        let updated = if connected {
            connection.execute(
                "update network_profiles
                 set last_connected_at = ?2, last_error = null, updated_at = ?2
                 where id = ?1",
                params![id, now],
            )?
        } else {
            connection.execute(
                "update network_profiles
                 set last_error = ?2, updated_at = ?3
                 where id = ?1",
                params![id, error, now],
            )?
        };

        if updated == 0 {
            return Err(NetworkError::ProfileNotFound);
        }
        Ok(())
    }

    pub fn set_host_key_fingerprint(
        &self,
        id: &str,
        fingerprint: &str,
    ) -> Result<(), NetworkError> {
        let connection = self.connect()?;
        let now = Utc::now().to_rfc3339();
        let updated = connection.execute(
            "update network_profiles
             set host_key_fingerprint = ?2, updated_at = ?3
             where id = ?1",
            params![id, fingerprint, now],
        )?;
        if updated == 0 {
            return Err(NetworkError::ProfileNotFound);
        }
        Ok(())
    }

    pub fn set_has_stored_secret(
        &self,
        id: &str,
        has_stored_secret: bool,
    ) -> Result<(), NetworkError> {
        let connection = self.connect()?;
        let now = Utc::now().to_rfc3339();
        let updated = connection.execute(
            "update network_profiles
             set has_stored_secret = ?2, updated_at = ?3
             where id = ?1",
            params![id, i64::from(has_stored_secret), now],
        )?;
        if updated == 0 {
            return Err(NetworkError::ProfileNotFound);
        }
        Ok(())
    }

    pub fn clear_has_stored_secret(&self, id: &str) -> Result<(), NetworkError> {
        self.set_has_stored_secret(id, false)
    }

    pub fn clear_host_key_fingerprint(&self, id: &str) -> Result<(), NetworkError> {
        let connection = self.connect()?;
        let now = Utc::now().to_rfc3339();
        let updated = connection.execute(
            "update network_profiles
             set host_key_fingerprint = null, updated_at = ?2
             where id = ?1",
            params![id, now],
        )?;
        if updated == 0 {
            return Err(NetworkError::ProfileNotFound);
        }
        Ok(())
    }

    fn connect(&self) -> Result<Connection, NetworkError> {
        Connection::open(self.path.as_path()).map_err(NetworkError::from)
    }

    fn migrate(&self) -> Result<(), NetworkError> {
        let connection = self.connect()?;
        let mut version: u32 =
            connection.pragma_query_value(None, "user_version", |row| row.get(0))?;
        if version > NETWORK_SCHEMA_VERSION {
            return Err(NetworkError::UnsupportedSchema(version));
        }

        if version == 0 {
            connection.execute_batch(
                "create table network_profiles (
                    id text primary key,
                    label text not null,
                    scheme text not null,
                    host text not null,
                    port integer not null,
                    username text not null,
                    auth_kind text not null,
                    private_key_path text,
                    default_path text not null,
                    host_key_fingerprint text,
                    sort_order integer not null default 0,
                    last_connected_at text,
                    last_error text,
                    has_stored_secret integer not null default 0,
                    created_at text not null,
                    updated_at text not null,
                    options_json text not null default '{}'
                );",
            )?;
            connection.pragma_update(None, "user_version", NETWORK_SCHEMA_VERSION)?;
            version = NETWORK_SCHEMA_VERSION;
        }

        if version == 1 {
            connection.execute_batch(
                "alter table network_profiles
                 add column has_stored_secret integer not null default 0;
                 update network_profiles
                 set has_stored_secret = 1
                 where auth_kind = 'password';
                 update network_profiles
                 set has_stored_secret = 1
                 where auth_kind = 'privateKey'
                   and private_key_path is not null
                   and trim(private_key_path) != '';",
            )?;
            connection.pragma_update(None, "user_version", 2u32)?;
            version = 2;
        }

        if version == 2 {
            connection.execute_batch(
                "alter table network_profiles
                 add column options_json text not null default '{}';",
            )?;
            connection.pragma_update(None, "user_version", NETWORK_SCHEMA_VERSION)?;
        }

        Ok(())
    }
}

fn encode_options(options: &NetworkProtocolOptions) -> Result<String, NetworkError> {
    serde_json::to_string(options).map_err(|error| NetworkError::InvalidValue {
        field: "options".to_string(),
        reason: error.to_string(),
    })
}

fn decode_options(value: String) -> Result<NetworkProtocolOptions, rusqlite::Error> {
    if value.trim().is_empty() {
        return Ok(NetworkProtocolOptions::default());
    }
    serde_json::from_str(&value).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(16, rusqlite::types::Type::Text, Box::new(error))
    })
}

fn stored_secret_flag_for_profile(
    previous_auth_kind: AuthKind,
    next_auth_kind: AuthKind,
    previous_has_stored_secret: bool,
    private_key_path: Option<&str>,
) -> bool {
    match next_auth_kind {
        AuthKind::Password => {
            if previous_auth_kind == AuthKind::Password {
                previous_has_stored_secret
            } else {
                false
            }
        }
        AuthKind::PrivateKey => private_key_path.is_some_and(|path| !path.trim().is_empty()),
        AuthKind::AccessKey => false,
        AuthKind::OAuth => false,
    }
}

fn map_profile_row(row: &rusqlite::Row<'_>) -> Result<NetworkProfile, rusqlite::Error> {
    let auth_kind = AuthKind::parse(&row.get::<_, String>(6)?).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(6, rusqlite::types::Type::Text, Box::new(error))
    })?;

    Ok(NetworkProfile {
        id: row.get(0)?,
        label: row.get(1)?,
        scheme: row.get(2)?,
        host: row.get(3)?,
        port: row.get::<_, i64>(4)? as u16,
        username: row.get(5)?,
        auth_kind,
        private_key_path: row.get(7)?,
        default_path: row.get(8)?,
        host_key_fingerprint: row.get(9)?,
        sort_order: row.get(10)?,
        last_connected_at: row.get(11)?,
        last_error: row.get(12)?,
        has_stored_secret: row.get::<_, i64>(13)? != 0,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
        options: decode_options(row.get(16)?)?,
    })
}

fn validate_profile_fields(
    scheme: &str,
    host: &str,
    username: &str,
    port: u16,
) -> Result<(), NetworkError> {
    if !matches!(scheme, "sftp" | "ssh" | "smb" | "s3" | "webdav") {
        return Err(NetworkError::InvalidValue {
            field: "scheme".to_string(),
            reason: format!("unsupported scheme `{scheme}`"),
        });
    }

    let trimmed_host = host.trim();
    if trimmed_host.is_empty() {
        return Err(NetworkError::InvalidValue {
            field: "host".to_string(),
            reason: "host is required".to_string(),
        });
    }
    if trimmed_host != host || host.chars().any(|ch| ch.is_whitespace() || ch.is_control()) {
        return Err(NetworkError::InvalidValue {
            field: "host".to_string(),
            reason: "host must not contain whitespace or control characters".to_string(),
        });
    }

    if username.trim().is_empty() {
        return Err(NetworkError::InvalidValue {
            field: "username".to_string(),
            reason: "username is required".to_string(),
        });
    }

    if port == 0 {
        return Err(NetworkError::InvalidValue {
            field: "port".to_string(),
            reason: "port must be in range 1..=65535".to_string(),
        });
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn sample_profile() -> NewNetworkProfile {
        NewNetworkProfile {
            label: "Dev Server".to_string(),
            scheme: "sftp".to_string(),
            host: "example.com".to_string(),
            port: 22,
            username: "deploy".to_string(),
            auth_kind: AuthKind::Password,
            private_key_path: None,
            default_path: "/home/deploy".to_string(),
            options: NetworkProtocolOptions::default(),
        }
    }

    #[test]
    fn creates_and_lists_profiles() {
        let dir = tempdir().unwrap();
        let repository = NetworkProfileRepository::new(dir.path().join("network.sqlite")).unwrap();
        let created = repository.add(sample_profile()).unwrap();

        let profiles = repository.list().unwrap();
        assert_eq!(profiles.len(), 1);
        assert_eq!(profiles[0].id, created.id);
        assert_eq!(profiles[0].label, "Dev Server");
    }

    #[test]
    fn updates_and_deletes_profiles() {
        let dir = tempdir().unwrap();
        let repository = NetworkProfileRepository::new(dir.path().join("network.sqlite")).unwrap();
        let created = repository.add(sample_profile()).unwrap();
        let updated = repository
            .update(
                &created.id,
                UpdateNetworkProfile {
                    label: "Prod".to_string(),
                    host: "prod.example.com".to_string(),
                    port: 2222,
                    username: "deploy".to_string(),
                    auth_kind: AuthKind::Password,
                    private_key_path: None,
                    default_path: "/".to_string(),
                    options: NetworkProtocolOptions::default(),
                },
            )
            .unwrap();

        assert_eq!(updated.label, "Prod");
        assert_eq!(updated.port, 2222);
        repository.delete(&created.id).unwrap();
        assert!(repository.get(&created.id).is_err());
    }

    #[test]
    fn clears_host_key_fingerprint() {
        let dir = tempdir().unwrap();
        let repository = NetworkProfileRepository::new(dir.path().join("network.sqlite")).unwrap();
        let created = repository.add(sample_profile()).unwrap();
        repository
            .set_host_key_fingerprint(&created.id, "SHA256:abc")
            .unwrap();
        assert_eq!(
            repository
                .get(&created.id)
                .unwrap()
                .host_key_fingerprint
                .as_deref(),
            Some("SHA256:abc"),
        );

        repository.clear_host_key_fingerprint(&created.id).unwrap();
        assert_eq!(
            repository.get(&created.id).unwrap().host_key_fingerprint,
            None,
        );
    }

    #[test]
    fn rejects_unsupported_scheme() {
        let dir = tempdir().unwrap();
        let repository = NetworkProfileRepository::new(dir.path().join("network.sqlite")).unwrap();
        let mut new = sample_profile();
        new.scheme = "ftp".to_string();
        let error = repository.add(new).unwrap_err();
        assert!(matches!(error, NetworkError::InvalidValue { ref field, .. } if field == "scheme"));
    }

    #[test]
    fn accepts_ssh_terminal_only_profiles() {
        let dir = tempdir().unwrap();
        let repository = NetworkProfileRepository::new(dir.path().join("network.sqlite")).unwrap();
        let mut new = sample_profile();
        new.scheme = "ssh".to_string();
        new.default_path = "".to_string();

        let profile = repository.add(new).unwrap();

        assert_eq!(profile.scheme, "ssh");
        assert_eq!(profile.default_path, "");
    }

    #[test]
    fn rejects_port_zero() {
        let dir = tempdir().unwrap();
        let repository = NetworkProfileRepository::new(dir.path().join("network.sqlite")).unwrap();
        let mut new = sample_profile();
        new.port = 0;
        let error = repository.add(new).unwrap_err();
        assert!(matches!(error, NetworkError::InvalidValue { ref field, .. } if field == "port"));
    }

    #[test]
    fn rejects_host_with_whitespace() {
        let dir = tempdir().unwrap();
        let repository = NetworkProfileRepository::new(dir.path().join("network.sqlite")).unwrap();
        let mut new = sample_profile();
        new.host = "bad host".to_string();
        let error = repository.add(new).unwrap_err();
        assert!(matches!(error, NetworkError::InvalidValue { ref field, .. } if field == "host"));
    }

    #[test]
    fn rejects_host_with_control_char() {
        let dir = tempdir().unwrap();
        let repository = NetworkProfileRepository::new(dir.path().join("network.sqlite")).unwrap();
        let mut new = sample_profile();
        new.host = "bad\u{0001}host".to_string();
        let error = repository.add(new).unwrap_err();
        assert!(matches!(error, NetworkError::InvalidValue { ref field, .. } if field == "host"));
    }

    #[test]
    fn accepts_webdav_scheme() {
        let dir = tempdir().unwrap();
        let repository = NetworkProfileRepository::new(dir.path().join("network.sqlite")).unwrap();
        let mut new = sample_profile();
        new.scheme = "webdav".to_string();
        new.port = 443;
        new.default_path = "/remote.php/dav/files/user".to_string();

        let profile = repository.add(new).unwrap();

        assert_eq!(profile.scheme, "webdav");
        assert_eq!(profile.port, 443);
        assert_eq!(profile.default_path, "/remote.php/dav/files/user");
    }

    #[test]
    fn accepts_smb_and_s3_schemes() {
        let dir = tempdir().unwrap();
        let repository = NetworkProfileRepository::new(dir.path().join("network.sqlite")).unwrap();

        for scheme in ["smb", "s3"] {
            let mut new = sample_profile();
            new.scheme = scheme.to_string();
            new.label = format!("{scheme} test");
            let profile = repository.add(new).unwrap();
            assert_eq!(profile.scheme, scheme);
        }
    }

    #[test]
    fn persists_protocol_options() {
        let dir = tempdir().unwrap();
        let repository = NetworkProfileRepository::new(dir.path().join("network.sqlite")).unwrap();
        let mut new = sample_profile();
        new.options.ssh.use_agent = Some(true);
        new.options.ssh.keepalive_secs = Some(45);
        new.options.ssh.proxy_jump = Some("bastion.example.com".to_string());

        let created = repository.add(new).unwrap();

        assert_eq!(created.options.ssh.use_agent, Some(true));
        assert_eq!(created.options.ssh.keepalive_secs, Some(45));
        assert_eq!(
            repository.get(&created.id).unwrap().options.ssh.proxy_jump,
            Some("bastion.example.com".to_string())
        );
    }

    #[test]
    fn rejects_webdav_previously_unsupported_alias() {
        // Make sure that arbitrary look-alike schemes still fail even though
        // webdav is now allowed — guards against accidental shadowing.
        let dir = tempdir().unwrap();
        let repository = NetworkProfileRepository::new(dir.path().join("network.sqlite")).unwrap();
        let mut new = sample_profile();
        new.scheme = "WEBDAV".to_string();
        let error = repository.add(new).unwrap_err();
        assert!(matches!(error, NetworkError::InvalidValue { ref field, .. } if field == "scheme"));
    }
}
