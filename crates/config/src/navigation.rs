use std::path::PathBuf;
use std::sync::Arc;

use chrono::{DateTime, Datelike, Local, TimeZone, Utc};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const NAV_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Error)]
pub enum NavigationError {
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("invalid navigation value for `{field}`: {reason}")]
    InvalidValue { field: String, reason: String },
    #[error("unsupported future schema version {0}")]
    UnsupportedSchema(u32),
    #[error("favorite not found")]
    FavoriteNotFound,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FavoriteEntry {
    pub id: u64,
    pub uri: String,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentEntry {
    pub uri: String,
    pub label: String,
    pub visited_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StarredEntry {
    pub uri: String,
    pub label: String,
    pub starred_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RecentBucket {
    Today,
    ThisWeek,
}

impl RecentBucket {
    pub fn parse(value: &str) -> Result<Self, NavigationError> {
        match value {
            "today" => Ok(Self::Today),
            "thisWeek" => Ok(Self::ThisWeek),
            other => Err(NavigationError::InvalidValue {
                field: "bucket".to_string(),
                reason: format!("unsupported value `{other}`"),
            }),
        }
    }
}

#[derive(Clone)]
pub struct NavigationRepository {
    path: Arc<PathBuf>,
}

impl NavigationRepository {
    pub fn new(path: PathBuf) -> Result<Self, NavigationError> {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let repository = Self {
            path: Arc::new(path),
        };
        repository.migrate()?;
        Ok(repository)
    }

    pub fn record_visit(&self, uri: &str, label: &str) -> Result<(), NavigationError> {
        let connection = self.connect()?;
        let now = Utc::now().to_rfc3339();
        connection.execute(
            "insert into nav_history (uri, label, visited_at) values (?1, ?2, ?3)
             on conflict(uri) do update set label = excluded.label, visited_at = excluded.visited_at",
            params![uri, label, now],
        )?;
        let _ = connection.execute(
            "delete from nav_history where rowid not in (
                select rowid from nav_history order by visited_at desc limit 200
            )",
            [],
        );
        Ok(())
    }

    pub fn list_favorites(&self) -> Result<Vec<FavoriteEntry>, NavigationError> {
        let connection = self.connect()?;
        let mut statement = connection
            .prepare("select id, uri, label from favorites order by sort_order asc, label asc")?;
        let rows = statement.query_map([], |row| {
            Ok(FavoriteEntry {
                id: row.get::<_, i64>(0)? as u64,
                uri: row.get(1)?,
                label: row.get(2)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(NavigationError::from)
    }

    pub fn add_favorite(&self, uri: &str, label: &str) -> Result<FavoriteEntry, NavigationError> {
        let connection = self.connect()?;
        let now = Utc::now().to_rfc3339();
        connection.execute(
            "insert into favorites (uri, label, sort_order, created_at) values (?1, ?2, 0, ?3)
             on conflict(uri) do update set label = excluded.label",
            params![uri, label, now],
        )?;
        connection
            .query_row(
                "select id, uri, label from favorites where uri = ?1",
                params![uri],
                |row| {
                    Ok(FavoriteEntry {
                        id: row.get::<_, i64>(0)? as u64,
                        uri: row.get(1)?,
                        label: row.get(2)?,
                    })
                },
            )
            .map_err(NavigationError::from)
    }

    pub fn remove_favorite(&self, id: u64) -> Result<(), NavigationError> {
        let connection = self.connect()?;
        let deleted = connection.execute("delete from favorites where id = ?1", params![id])?;
        if deleted == 0 {
            return Err(NavigationError::FavoriteNotFound);
        }
        Ok(())
    }

    pub fn rename_favorite(&self, id: u64, label: &str) -> Result<FavoriteEntry, NavigationError> {
        let connection = self.connect()?;
        let updated = connection.execute(
            "update favorites set label = ?1 where id = ?2",
            params![label, id],
        )?;
        if updated == 0 {
            return Err(NavigationError::FavoriteNotFound);
        }
        connection
            .query_row(
                "select id, uri, label from favorites where id = ?1",
                params![id],
                |row| {
                    Ok(FavoriteEntry {
                        id: row.get::<_, i64>(0)? as u64,
                        uri: row.get(1)?,
                        label: row.get(2)?,
                    })
                },
            )
            .map_err(NavigationError::from)
    }

    pub fn clear_recent(&self) -> Result<(), NavigationError> {
        let connection = self.connect()?;
        connection
            .execute("delete from nav_history", [])
            .map_err(NavigationError::from)?;
        Ok(())
    }

    pub fn remove_recent(&self, uri: &str) -> Result<(), NavigationError> {
        let connection = self.connect()?;
        connection
            .execute("delete from nav_history where uri = ?1", params![uri])
            .map_err(NavigationError::from)?;
        Ok(())
    }

    pub fn list_recent(&self, bucket: RecentBucket) -> Result<Vec<RecentEntry>, NavigationError> {
        let connection = self.connect()?;
        let cutoff = recent_cutoff(bucket)?.to_rfc3339();
        let mut statement = connection.prepare(
            "select uri, label, visited_at from nav_history
             where visited_at >= ?1
             order by visited_at desc
             limit 50",
        )?;
        let rows = statement.query_map(params![cutoff], |row| {
            Ok(RecentEntry {
                uri: row.get(0)?,
                label: row.get(1)?,
                visited_at: row.get(2)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(NavigationError::from)
    }

    pub fn list_starred(&self) -> Result<Vec<StarredEntry>, NavigationError> {
        let connection = self.connect()?;
        let mut statement = connection.prepare(
            "select uri, label, starred_at from starred order by starred_at desc limit 100",
        )?;
        let rows = statement.query_map([], |row| {
            Ok(StarredEntry {
                uri: row.get(0)?,
                label: row.get(1)?,
                starred_at: row.get(2)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(NavigationError::from)
    }

    pub fn toggle_starred(&self, uri: &str, label: &str) -> Result<bool, NavigationError> {
        let connection = self.connect()?;
        let exists: i64 = connection.query_row(
            "select count(*) from starred where uri = ?1",
            params![uri],
            |row| row.get(0),
        )?;

        if exists > 0 {
            connection.execute("delete from starred where uri = ?1", params![uri])?;
            Ok(false)
        } else {
            let now = Utc::now().to_rfc3339();
            connection.execute(
                "insert into starred (uri, label, starred_at) values (?1, ?2, ?3)",
                params![uri, label, now],
            )?;
            Ok(true)
        }
    }

    pub fn is_starred(&self, uri: &str) -> Result<bool, NavigationError> {
        let connection = self.connect()?;
        let exists: i64 = connection.query_row(
            "select count(*) from starred where uri = ?1",
            params![uri],
            |row| row.get(0),
        )?;
        Ok(exists > 0)
    }

    fn migrate(&self) -> Result<(), NavigationError> {
        let connection = self.connect()?;
        let user_version: u32 =
            connection.query_row("pragma user_version", [], |row| row.get(0))?;

        if user_version > NAV_SCHEMA_VERSION {
            return Err(NavigationError::UnsupportedSchema(user_version));
        }

        if user_version == 0 {
            connection.execute_batch(
                "create table favorites (
                    id integer primary key autoincrement,
                    uri text not null unique,
                    label text not null,
                    sort_order integer not null default 0,
                    created_at text not null
                );
                create table nav_history (
                    uri text primary key,
                    label text not null,
                    visited_at text not null
                );
                create index nav_history_visited_at on nav_history(visited_at desc);
                create table starred (
                    uri text primary key,
                    label text not null,
                    starred_at text not null
                );",
            )?;
            connection.pragma_update(None, "user_version", NAV_SCHEMA_VERSION)?;
        }

        Ok(())
    }

    fn connect(&self) -> Result<Connection, NavigationError> {
        Connection::open(&*self.path).map_err(NavigationError::from)
    }
}

fn recent_cutoff(bucket: RecentBucket) -> Result<DateTime<Utc>, NavigationError> {
    let local_now = Local::now();
    let cutoff_date = match bucket {
        RecentBucket::Today => local_now.date_naive(),
        RecentBucket::ThisWeek => {
            let weekday = local_now.weekday().num_days_from_monday();
            local_now.date_naive() - chrono::Duration::days(weekday as i64)
        }
    };
    let cutoff_naive =
        cutoff_date
            .and_hms_opt(0, 0, 0)
            .ok_or_else(|| NavigationError::InvalidValue {
                field: "bucket".to_string(),
                reason: "failed to compute start of day".to_string(),
            })?;

    Local
        .from_local_datetime(&cutoff_naive)
        .single()
        .map(|value| value.with_timezone(&Utc))
        .ok_or_else(|| NavigationError::InvalidValue {
            field: "bucket".to_string(),
            reason: "failed to convert cutoff to UTC".to_string(),
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn favorites_and_recent_work() {
        let dir = tempdir().unwrap();
        let repository = NavigationRepository::new(dir.path().join("navigation.sqlite")).unwrap();

        repository
            .record_visit("local:///Users/test", "test")
            .unwrap();
        let favorite = repository
            .add_favorite("local:///Users/test/Fav", "Fav")
            .unwrap();
        assert_eq!(favorite.label, "Fav");

        let recent = repository.list_recent(RecentBucket::Today).unwrap();
        assert_eq!(recent.len(), 1);

        assert!(repository
            .toggle_starred("local:///Users/test", "test")
            .unwrap());
        assert_eq!(repository.list_starred().unwrap().len(), 1);
        assert!(!repository
            .toggle_starred("local:///Users/test", "test")
            .unwrap());

        repository.remove_favorite(favorite.id).unwrap();
        assert!(repository.list_favorites().unwrap().is_empty());
    }
}
