use std::path::PathBuf;
use std::sync::Arc;

use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

pub const NETWORK_SCHEMA_VERSION: u32 = 1;

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
}

impl AuthKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Password => "password",
            Self::PrivateKey => "privateKey",
        }
    }

    pub fn parse(value: &str) -> Result<Self, NetworkError> {
        match value {
            "password" => Ok(Self::Password),
            "privateKey" => Ok(Self::PrivateKey),
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
                    last_error, created_at, updated_at
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
                    last_error, created_at, updated_at
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
        validate_profile_fields(&profile.scheme, &profile.host, &profile.username)?;
        let connection = self.connect()?;
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let sort_order = connection.query_row(
            "select coalesce(max(sort_order), -1) + 1 from network_profiles",
            [],
            |row| row.get::<_, i64>(0),
        )?;
        connection.execute(
            "insert into network_profiles (
                id, label, scheme, host, port, username, auth_kind, private_key_path,
                default_path, host_key_fingerprint, sort_order, last_connected_at,
                last_error, created_at, updated_at
             ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, null, ?10, null, null, ?11, ?11)",
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
                now,
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
        validate_profile_fields(&existing.scheme, &profile.host, &profile.username)?;
        let connection = self.connect()?;
        let now = Utc::now().to_rfc3339();
        let updated = connection.execute(
            "update network_profiles
             set label = ?2, host = ?3, port = ?4, username = ?5, auth_kind = ?6,
                 private_key_path = ?7, default_path = ?8, updated_at = ?9
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
                now,
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

    fn connect(&self) -> Result<Connection, NetworkError> {
        Connection::open(self.path.as_path()).map_err(NetworkError::from)
    }

    fn migrate(&self) -> Result<(), NetworkError> {
        let connection = self.connect()?;
        let version = connection.pragma_query_value(None, "user_version", |row| row.get(0))?;
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
                    created_at text not null,
                    updated_at text not null
                );",
            )?;
            connection.pragma_update(None, "user_version", NETWORK_SCHEMA_VERSION)?;
        }

        Ok(())
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
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
    })
}

fn validate_profile_fields(scheme: &str, host: &str, username: &str) -> Result<(), NetworkError> {
    if scheme != "sftp" {
        return Err(NetworkError::InvalidValue {
            field: "scheme".to_string(),
            reason: format!("unsupported scheme `{scheme}`"),
        });
    }

    if host.trim().is_empty() {
        return Err(NetworkError::InvalidValue {
            field: "host".to_string(),
            reason: "host is required".to_string(),
        });
    }

    if username.trim().is_empty() {
        return Err(NetworkError::InvalidValue {
            field: "username".to_string(),
            reason: "username is required".to_string(),
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
                },
            )
            .unwrap();

        assert_eq!(updated.label, "Prod");
        assert_eq!(updated.port, 2222);
        repository.delete(&created.id).unwrap();
        assert!(repository.get(&created.id).is_err());
    }
}
