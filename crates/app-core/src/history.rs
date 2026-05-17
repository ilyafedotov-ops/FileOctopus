use std::path::PathBuf;
use std::sync::Arc;

use chrono::Utc;
use jobs::{JobSnapshot, JobStatus};
use rusqlite::{params, Connection};
use vfs::FileOperationPlan;

pub(crate) const SCHEMA_VERSION: u32 = 1;
pub(crate) const HISTORY_RETENTION_LIMIT: u32 = 500;

#[derive(Clone)]
pub struct OperationHistoryRepository {
    path: Arc<PathBuf>,
}

impl OperationHistoryRepository {
    pub fn new(path: PathBuf) -> rusqlite::Result<Self> {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let repository = Self {
            path: Arc::new(path),
        };

        repository.migrate()?;

        Ok(repository)
    }

    pub fn migrate(&self) -> rusqlite::Result<()> {
        let connection = self.connect()?;
        let user_version: u32 =
            connection.query_row("pragma user_version", [], |row| row.get(0))?;

        if user_version > SCHEMA_VERSION {
            return Err(rusqlite::Error::InvalidParameterName(format!(
                "unsupported future schema version {user_version}"
            )));
        }

        connection.execute(
            "create table if not exists schema_meta (
                key text primary key,
                value text not null
            )",
            [],
        )?;
        connection.execute(
            "create table if not exists operation_history (
                job_id text primary key,
                operation_kind text not null,
                source_count integer not null,
                representative_source_path text,
                destination_path text,
                status text not null,
                started_at text not null,
                completed_at text,
                error_code text
            )",
            [],
        )?;
        connection.execute(
            "insert into schema_meta (key, value) values ('schema_version', ?1)
             on conflict(key) do update set value = excluded.value",
            [SCHEMA_VERSION.to_string()],
        )?;
        connection.pragma_update(None, "user_version", SCHEMA_VERSION)?;

        Ok(())
    }

    pub fn schema_version(&self) -> rusqlite::Result<u32> {
        let connection = self.connect()?;
        let value: String = connection
            .query_row(
                "select value from schema_meta where key = 'schema_version'",
                [],
                |row| row.get(0),
            )
            .or_else(|_| {
                connection.query_row("pragma user_version", [], |row| {
                    let version: u32 = row.get(0)?;
                    Ok(version.to_string())
                })
            })?;

        Ok(value.parse().unwrap_or(0))
    }

    pub fn mark_interrupted_jobs(&self) -> rusqlite::Result<usize> {
        let connection = self.connect()?;

        connection.execute(
            "update operation_history
             set status = 'interrupted',
                 completed_at = ?1,
                 error_code = 'interrupted'
             where status in ('queued', 'running', 'cancelling')",
            [Utc::now().to_rfc3339()],
        )
    }

    pub(crate) fn insert_started(&self, plan: &FileOperationPlan, snapshot: &JobSnapshot) {
        if let Err(error) = self.try_insert_started(plan, snapshot) {
            telemetry::error(&format!("failed to persist operation start: {error}"));
        }
    }

    fn try_insert_started(
        &self,
        plan: &FileOperationPlan,
        snapshot: &JobSnapshot,
    ) -> rusqlite::Result<()> {
        let connection = self.connect()?;

        connection.execute(
            "insert or replace into operation_history (
                job_id, operation_kind, source_count, representative_source_path,
                destination_path, status, started_at, completed_at, error_code
            ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, null, null)",
            params![
                snapshot.job_id.as_str(),
                format!("{:?}", plan.kind),
                plan.sources.len() as i64,
                plan.sources.first().map(|uri| uri.display_path()),
                plan.destination.as_ref().map(|uri| uri.display_path()),
                "running",
                snapshot.started_at.to_rfc3339(),
            ],
        )?;

        Ok(())
    }

    pub(crate) fn update_terminal(
        &self,
        job_id: &str,
        status: JobStatus,
        error_code: Option<&str>,
    ) {
        if let Err(error) = self.try_update_terminal(job_id, status, error_code) {
            telemetry::error(&format!(
                "failed to persist operation terminal state: {error}"
            ));
        }
    }

    fn try_update_terminal(
        &self,
        job_id: &str,
        status: JobStatus,
        error_code: Option<&str>,
    ) -> rusqlite::Result<()> {
        let connection = self.connect()?;

        connection.execute(
            "update operation_history
             set status = ?2, completed_at = ?3, error_code = ?4
             where job_id = ?1",
            params![
                job_id,
                status_string(status),
                Utc::now().to_rfc3339(),
                error_code,
            ],
        )?;

        Ok(())
    }

    pub fn list_recent(&self, limit: u32) -> rusqlite::Result<Vec<OperationHistoryRecord>> {
        let connection = self.connect()?;
        let mut statement = connection.prepare(
            "select job_id, operation_kind, source_count, representative_source_path,
                    destination_path, status, started_at, completed_at, error_code
             from operation_history
             order by started_at desc
             limit ?1",
        )?;
        let records = statement
            .query_map([limit.clamp(1, 100)], |row| {
                Ok(OperationHistoryRecord {
                    job_id: row.get(0)?,
                    operation_kind: row.get(1)?,
                    source_count: row.get::<_, i64>(2)? as u64,
                    representative_source_path: row.get(3)?,
                    destination_path: row.get(4)?,
                    status: row.get(5)?,
                    started_at: row.get(6)?,
                    completed_at: row.get(7)?,
                    error_code: row.get(8)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(records)
    }

    pub fn cleanup_terminal_history(&self, retain_count: u32) -> rusqlite::Result<usize> {
        let connection = self.connect()?;

        connection.execute(
            "delete from operation_history
             where status not in ('queued', 'running', 'cancelling')
               and job_id not in (
                   select job_id from operation_history
                   where status not in ('queued', 'running', 'cancelling')
                   order by started_at desc
                   limit ?1
               )",
            [retain_count.max(1)],
        )
    }

    pub fn clear_terminal_history(&self) -> rusqlite::Result<usize> {
        let connection = self.connect()?;

        connection.execute(
            "delete from operation_history
             where status not in ('queued', 'running', 'cancelling')",
            [],
        )
    }

    pub(crate) fn connect(&self) -> rusqlite::Result<Connection> {
        Connection::open(&*self.path)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OperationHistoryRecord {
    pub job_id: String,
    pub operation_kind: String,
    pub source_count: u64,
    pub representative_source_path: Option<String>,
    pub destination_path: Option<String>,
    pub status: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub error_code: Option<String>,
}

fn status_string(status: JobStatus) -> &'static str {
    match status {
        JobStatus::Queued => "queued",
        JobStatus::Running => "running",
        JobStatus::Paused => "paused",
        JobStatus::Cancelled => "cancelled",
        JobStatus::Completed => "completed",
        JobStatus::Failed => "failed",
    }
}
