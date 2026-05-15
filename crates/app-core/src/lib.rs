use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use chrono::Utc;
use config::PreferencesRepository;
use fs_core::file_ops::{execute_file_operation, plan_file_operation, FileOperationEventSink};
use fs_core::LocalFsProvider;
use jobs::{
    CancellationToken, JobCancelledEvent, JobCompletedEvent, JobEvent, JobFailedEvent, JobId,
    JobSnapshot, JobStartedEvent, JobStatus,
};
use rusqlite::{params, Connection};
use thiserror::Error;
use vfs::{FileOperationError, FileOperationPlan, FileOperationRequest, VfsRegistry};

const SCHEMA_VERSION: u32 = 1;
const HISTORY_RETENTION_LIMIT: u32 = 500;

#[derive(Debug, Error)]
pub enum AppCoreError {
    #[error("failed to initialize telemetry: {0}")]
    Telemetry(String),
    #[error("failed to initialize VFS: {0}")]
    Vfs(String),
    #[error("failed to initialize operation history: {0}")]
    History(String),
}

#[derive(Clone)]
pub struct AppState {
    vfs: Arc<VfsRegistry>,
    operations: Arc<OperationRuntime>,
    preferences: PreferencesRepository,
    paths: AppPaths,
    startup_recovery_count: usize,
}

impl AppState {
    pub fn vfs(&self) -> Arc<VfsRegistry> {
        self.vfs.clone()
    }

    pub fn operations(&self) -> Arc<OperationRuntime> {
        self.operations.clone()
    }

    pub fn preferences(&self) -> &PreferencesRepository {
        &self.preferences
    }

    pub fn app_data_health(&self) -> AppDataHealth {
        let schema_version = self.operations.schema_version().unwrap_or(0);
        let database_exists = self.paths.history_db.exists();
        let mut missing_directories = Vec::new();

        for (name, path) in [
            ("configDir", &self.paths.config_dir),
            ("dataDir", &self.paths.data_dir),
            ("logDir", &self.paths.log_dir),
        ] {
            if !path.exists() {
                missing_directories.push(name.to_string());
            }
        }

        AppDataHealth {
            config_dir: self.paths.config_dir.to_string_lossy().to_string(),
            data_dir: self.paths.data_dir.to_string_lossy().to_string(),
            log_dir: self.paths.log_dir.to_string_lossy().to_string(),
            database_path: self.paths.history_db.to_string_lossy().to_string(),
            database_exists,
            schema_version,
            missing_directories,
            startup_recovery_count: self.startup_recovery_count,
        }
    }

    pub fn paths(&self) -> &AppPaths {
        &self.paths
    }
}

pub struct AppCore;

impl AppCore {
    pub fn boot() -> Result<Arc<AppState>, AppCoreError> {
        let paths = AppPaths::default();

        Self::boot_with_paths(paths)
    }

    pub fn boot_with_history_path(history_path: PathBuf) -> Result<Arc<AppState>, AppCoreError> {
        let paths = AppPaths {
            history_db: history_path,
            ..AppPaths::default()
        };

        Self::boot_with_paths(paths)
    }

    pub fn boot_with_paths(paths: AppPaths) -> Result<Arc<AppState>, AppCoreError> {
        telemetry::init().map_err(|error| AppCoreError::Telemetry(error.to_string()))?;
        paths
            .ensure_directories()
            .map_err(|error| AppCoreError::History(error.to_string()))?;

        let vfs = Arc::new(VfsRegistry::new());

        vfs.register(Arc::new(LocalFsProvider::new()))
            .map_err(|error| AppCoreError::Vfs(error.to_string()))?;
        let history = OperationHistoryRepository::new(paths.history_db.clone())
            .map_err(|error| AppCoreError::History(error.to_string()))?;
        let startup_recovery_count = history
            .mark_interrupted_jobs()
            .map_err(|error| AppCoreError::History(error.to_string()))?;
        let operations = Arc::new(OperationRuntime::new(history));
        let preferences = PreferencesRepository::new(paths.preferences_db.clone())
            .map_err(|error| AppCoreError::History(error.to_string()))?;

        telemetry::info("FileOctopus app core booted");

        Ok(Arc::new(AppState {
            vfs,
            operations,
            preferences,
            paths,
            startup_recovery_count,
        }))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppPaths {
    pub config_dir: PathBuf,
    pub data_dir: PathBuf,
    pub log_dir: PathBuf,
    pub history_db: PathBuf,
    pub preferences_db: PathBuf,
}

impl AppPaths {
    pub fn ensure_directories(&self) -> std::io::Result<()> {
        std::fs::create_dir_all(&self.config_dir)?;
        std::fs::create_dir_all(&self.data_dir)?;
        std::fs::create_dir_all(&self.log_dir)?;

        if let Some(parent) = self.history_db.parent() {
            std::fs::create_dir_all(parent)?;
        }

        if let Some(parent) = self.preferences_db.parent() {
            std::fs::create_dir_all(parent)?;
        }

        Ok(())
    }
}

impl Default for AppPaths {
    fn default() -> Self {
        let root = fileoctopus_home();

        Self {
            config_dir: root.join("config"),
            data_dir: root.clone(),
            log_dir: telemetry::default_log_dir(),
            history_db: root.join("operation-history.sqlite"),
            preferences_db: root.join("preferences.sqlite"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppDataHealth {
    pub config_dir: String,
    pub data_dir: String,
    pub log_dir: String,
    pub database_path: String,
    pub database_exists: bool,
    pub schema_version: u32,
    pub missing_directories: Vec<String>,
    pub startup_recovery_count: usize,
}

#[derive(Clone)]
pub struct OperationRuntime {
    jobs: Arc<Mutex<HashMap<String, JobRuntimeState>>>,
    history: OperationHistoryRepository,
}

impl OperationRuntime {
    pub fn new(history: OperationHistoryRepository) -> Self {
        Self {
            jobs: Arc::new(Mutex::new(HashMap::new())),
            history,
        }
    }

    pub fn plan(
        &self,
        request: FileOperationRequest,
    ) -> Result<FileOperationPlan, FileOperationError> {
        let kind = request.kind;
        let result = plan_file_operation(request);

        if let Err(error) = &result {
            telemetry::error(&format!(
                "operation planning failed kind={kind:?} code={}",
                error.code()
            ));
        }

        result
    }

    pub fn start(
        &self,
        plan: FileOperationPlan,
        sink: Arc<FileOperationEventSink>,
    ) -> Result<JobSnapshot, FileOperationError> {
        let job_id = JobId::new(uuid::Uuid::new_v4().to_string());
        let now = Utc::now();
        let snapshot = JobSnapshot {
            job_id: job_id.clone(),
            operation_kind: plan.kind,
            status: JobStatus::Queued,
            current_item: None,
            completed_items: 0,
            total_items: plan.total_items,
            completed_bytes: 0,
            total_bytes: plan.total_bytes,
            error_code: None,
            message: None,
            started_at: now,
            updated_at: now,
        };
        let token = CancellationToken::new();
        let state = JobRuntimeState {
            snapshot: snapshot.clone(),
            cancel: token.clone(),
        };

        self.jobs
            .lock()
            .map_err(|_| FileOperationError::Internal {
                message: "job registry lock poisoned".to_string(),
            })?
            .insert(job_id.as_str().to_string(), state);
        self.history.insert_started(&plan, &snapshot);
        telemetry::info(&format!(
            "operation job started job_id={} kind={:?} source_count={} total_items={}",
            job_id.as_str(),
            plan.kind,
            plan.sources.len(),
            plan.total_items
        ));

        let jobs = self.jobs.clone();
        let history = self.history.clone();
        let sink_for_thread = sink.clone();
        let thread_job_id = job_id.clone();
        let started = JobEvent::Started(JobStartedEvent {
            job_id: job_id.clone(),
            operation_kind: plan.kind,
            total_items: plan.total_items,
            total_bytes: plan.total_bytes,
            started_at: now,
        });

        sink(started);
        update_snapshot_status(&jobs, &job_id, JobStatus::Running, None, None);

        std::thread::spawn(move || {
            let progress_jobs = jobs.clone();
            let progress_sink = move |event: JobEvent| {
                if let JobEvent::Progress(progress) = &event {
                    update_snapshot_progress(&progress_jobs, progress);
                }

                sink_for_thread(event);
            };
            let progress_sink = Arc::new(progress_sink) as Arc<FileOperationEventSink>;
            let result = execute_file_operation(&plan, &thread_job_id, &token, &*progress_sink);

            match result {
                Ok(()) => {
                    let completed_at = Utc::now();
                    telemetry::info(&format!(
                        "operation job completed job_id={} kind={:?}",
                        thread_job_id.as_str(),
                        plan.kind
                    ));
                    update_snapshot_status(&jobs, &thread_job_id, JobStatus::Completed, None, None);
                    history.update_terminal(thread_job_id.as_str(), JobStatus::Completed, None);
                    progress_sink(JobEvent::Completed(JobCompletedEvent {
                        job_id: thread_job_id,
                        operation_kind: plan.kind,
                        completed_items: plan.total_items,
                        completed_bytes: plan.total_bytes.unwrap_or(0),
                        completed_at,
                    }));
                }
                Err(FileOperationError::Cancelled { .. }) => {
                    let cancelled_at = Utc::now();
                    telemetry::info(&format!(
                        "operation job cancelled job_id={} kind={:?}",
                        thread_job_id.as_str(),
                        plan.kind
                    ));
                    update_snapshot_status(&jobs, &thread_job_id, JobStatus::Cancelled, None, None);
                    history.update_terminal(thread_job_id.as_str(), JobStatus::Cancelled, None);
                    progress_sink(JobEvent::Cancelled(JobCancelledEvent {
                        job_id: thread_job_id,
                        operation_kind: plan.kind,
                        cancelled_at,
                    }));
                }
                Err(error) => {
                    let failed_at = Utc::now();
                    let code = error.code().to_string();
                    let message = error.user_message();
                    telemetry::error(&format!(
                        "operation job failed job_id={} kind={:?} code={code}",
                        thread_job_id.as_str(),
                        plan.kind
                    ));

                    update_snapshot_status(
                        &jobs,
                        &thread_job_id,
                        JobStatus::Failed,
                        Some(code.clone()),
                        Some(message.clone()),
                    );
                    history.update_terminal(thread_job_id.as_str(), JobStatus::Failed, Some(&code));
                    progress_sink(JobEvent::Failed(JobFailedEvent {
                        job_id: thread_job_id,
                        operation_kind: plan.kind,
                        error_code: code,
                        message,
                        failed_at,
                    }));
                }
            }
        });

        Ok(snapshot)
    }

    pub fn cancel(&self, job_id: &str) -> Result<JobSnapshot, FileOperationError> {
        let jobs = self.jobs.lock().map_err(|_| FileOperationError::Internal {
            message: "job registry lock poisoned".to_string(),
        })?;
        let state = jobs
            .get(job_id)
            .ok_or_else(|| FileOperationError::NotFound {
                uri: job_id.to_string(),
            })?;

        state.cancel.cancel();
        telemetry::info(&format!(
            "operation job cancellation requested job_id={job_id}"
        ));

        Ok(state.snapshot.clone())
    }

    pub fn status(&self, job_id: &str) -> Result<JobSnapshot, FileOperationError> {
        let jobs = self.jobs.lock().map_err(|_| FileOperationError::Internal {
            message: "job registry lock poisoned".to_string(),
        })?;

        jobs.get(job_id)
            .map(|state| state.snapshot.clone())
            .ok_or_else(|| FileOperationError::NotFound {
                uri: job_id.to_string(),
            })
    }

    pub fn recent_history(&self, limit: u32) -> Vec<OperationHistoryRecord> {
        self.history.list_recent(limit).unwrap_or_default()
    }

    pub fn clear_terminal_history(&self) -> Result<usize, String> {
        self.history
            .clear_terminal_history()
            .map_err(|error| error.to_string())
    }

    pub fn cleanup_history(&self) -> Result<usize, String> {
        self.history
            .cleanup_terminal_history(HISTORY_RETENTION_LIMIT)
            .map_err(|error| error.to_string())
    }

    pub fn schema_version(&self) -> rusqlite::Result<u32> {
        self.history.schema_version()
    }
}

#[derive(Clone)]
struct JobRuntimeState {
    snapshot: JobSnapshot,
    cancel: CancellationToken,
}

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

    fn insert_started(&self, plan: &FileOperationPlan, snapshot: &JobSnapshot) {
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

    fn update_terminal(&self, job_id: &str, status: JobStatus, error_code: Option<&str>) {
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

    fn connect(&self) -> rusqlite::Result<Connection> {
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

fn update_snapshot_progress(
    jobs: &Arc<Mutex<HashMap<String, JobRuntimeState>>>,
    progress: &jobs::JobProgressEvent,
) {
    if let Ok(mut jobs) = jobs.lock() {
        if let Some(state) = jobs.get_mut(progress.job_id.as_str()) {
            state.snapshot.current_item = progress.current_item.clone();
            state.snapshot.completed_items = progress.completed_items;
            state.snapshot.completed_bytes = progress.completed_bytes;
            state.snapshot.updated_at = progress.updated_at;
        }
    }
}

fn update_snapshot_status(
    jobs: &Arc<Mutex<HashMap<String, JobRuntimeState>>>,
    job_id: &JobId,
    status: JobStatus,
    error_code: Option<String>,
    message: Option<String>,
) {
    if let Ok(mut jobs) = jobs.lock() {
        if let Some(state) = jobs.get_mut(job_id.as_str()) {
            state.snapshot.status = status;
            state.snapshot.error_code = error_code;
            state.snapshot.message = message;
            state.snapshot.updated_at = Utc::now();
        }
    }
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

fn fileoctopus_home() -> PathBuf {
    home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".fileoctopus")
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::Duration;
    use vfs::ResourceUri;

    #[test]
    fn boot_registers_local_provider() {
        let state = AppCore::boot().unwrap();
        let uri = ResourceUri::parse("local:///Users").unwrap();
        let provider = state.vfs().provider_for(&uri).unwrap();

        assert_eq!(provider.id().as_str(), "local");
    }

    #[test]
    fn operation_history_migration_is_idempotent() {
        let dir = tempfile::tempdir().unwrap();
        let repository =
            OperationHistoryRepository::new(dir.path().join("history.sqlite")).unwrap();

        repository.migrate().unwrap();
        repository.migrate().unwrap();

        assert!(repository.list_recent(10).unwrap().is_empty());
        assert_eq!(repository.schema_version().unwrap(), SCHEMA_VERSION);
    }

    #[test]
    fn startup_marks_previously_running_jobs_as_interrupted() {
        let dir = tempfile::tempdir().unwrap();
        let history_path = dir.path().join("history.sqlite");
        let repository = OperationHistoryRepository::new(history_path.clone()).unwrap();
        let connection = repository.connect().unwrap();

        connection
            .execute(
                "insert into operation_history (
                    job_id, operation_kind, source_count, status, started_at
                ) values ('job-running', 'Copy', 1, 'running', ?1)",
                [Utc::now().to_rfc3339()],
            )
            .unwrap();

        drop(connection);
        let state = AppCore::boot_with_history_path(history_path).unwrap();
        let history = state.operations().recent_history(10);

        assert_eq!(state.app_data_health().startup_recovery_count, 1);
        assert_eq!(history[0].status, "interrupted");
        assert_eq!(history[0].error_code.as_deref(), Some("interrupted"));
    }

    #[test]
    fn history_cleanup_keeps_active_jobs() {
        let dir = tempfile::tempdir().unwrap();
        let repository =
            OperationHistoryRepository::new(dir.path().join("history.sqlite")).unwrap();
        let connection = repository.connect().unwrap();

        for index in 0..3 {
            connection
                .execute(
                    "insert into operation_history (
                        job_id, operation_kind, source_count, status, started_at, completed_at
                    ) values (?1, 'Copy', 1, 'completed', ?2, ?2)",
                    params![
                        format!("done-{index}"),
                        format!("2026-01-01T00:00:0{index}Z")
                    ],
                )
                .unwrap();
        }

        connection
            .execute(
                "insert into operation_history (
                    job_id, operation_kind, source_count, status, started_at
                ) values ('active', 'Copy', 1, 'running', '2026-01-01T00:00:09Z')",
                [],
            )
            .unwrap();

        drop(connection);
        let deleted = repository.cleanup_terminal_history(1).unwrap();
        let records = repository.list_recent(10).unwrap();

        assert_eq!(deleted, 2);
        assert!(records.iter().any(|record| record.job_id == "active"));
        assert_eq!(
            records
                .iter()
                .filter(|record| record.status == "completed")
                .count(),
            1
        );
    }

    #[test]
    fn successful_operation_is_persisted_as_completed() {
        let dir = tempfile::tempdir().unwrap();
        let history_path = dir.path().join("history.sqlite");
        let runtime = OperationRuntime::new(OperationHistoryRepository::new(history_path).unwrap());
        let source = dir.path().join("source.txt");
        let destination = dir.path().join("dest");
        let (sender, receiver) = mpsc::channel();

        std::fs::write(&source, b"content").unwrap();
        std::fs::create_dir(&destination).unwrap();

        let plan = runtime
            .plan(vfs::FileOperationRequest {
                kind: vfs::FileOperationKind::Copy,
                sources: vec![ResourceUri::from_local_path(&source).unwrap()],
                destination: Some(ResourceUri::from_local_path(&destination).unwrap()),
                new_name: None,
                conflict_policy: vfs::ConflictPolicy::Fail,
            })
            .unwrap();
        runtime
            .start(
                plan,
                Arc::new(move |event| {
                    let _ = sender.send(event);
                }),
            )
            .unwrap();

        let mut events = Vec::new();
        let terminal = loop {
            let event = receiver.recv_timeout(Duration::from_secs(5)).unwrap();
            let is_terminal = matches!(event, JobEvent::Completed(_));

            events.push(event.clone());
            if is_terminal {
                break event;
            }
        };

        assert!(matches!(terminal, JobEvent::Completed(_)));
        assert_eq!(
            events
                .iter()
                .filter(|event| matches!(event, JobEvent::Started(_)))
                .count(),
            1
        );
        assert_eq!(
            events
                .iter()
                .filter(|event| {
                    matches!(
                        event,
                        JobEvent::Completed(_) | JobEvent::Failed(_) | JobEvent::Cancelled(_)
                    )
                })
                .count(),
            1
        );
        let history = runtime.recent_history(10);
        assert_eq!(history[0].status, "completed");
    }

    #[test]
    fn failed_operation_is_persisted_as_failed() {
        let dir = tempfile::tempdir().unwrap();
        let runtime = OperationRuntime::new(
            OperationHistoryRepository::new(dir.path().join("history.sqlite")).unwrap(),
        );
        let source = dir.path().join("source.txt");
        let destination = dir.path().join("dest");
        let (sender, receiver) = mpsc::channel();

        std::fs::write(&source, b"content").unwrap();
        std::fs::create_dir(&destination).unwrap();
        std::fs::write(destination.join("source.txt"), b"existing").unwrap();

        let plan = runtime
            .plan(vfs::FileOperationRequest {
                kind: vfs::FileOperationKind::Copy,
                sources: vec![ResourceUri::from_local_path(&source).unwrap()],
                destination: Some(ResourceUri::from_local_path(&destination).unwrap()),
                new_name: None,
                conflict_policy: vfs::ConflictPolicy::Fail,
            })
            .unwrap();
        runtime
            .start(
                plan,
                Arc::new(move |event| {
                    let _ = sender.send(event);
                }),
            )
            .unwrap();

        loop {
            let event = receiver.recv_timeout(Duration::from_secs(5)).unwrap();

            if matches!(event, JobEvent::Failed(_)) {
                break;
            }
        }

        let history = runtime.recent_history(10);
        assert_eq!(history[0].status, "failed");
        assert_eq!(
            history[0].error_code.as_deref(),
            Some("destination_conflict")
        );
    }

    #[test]
    fn cancelled_operation_is_persisted_as_cancelled() {
        let dir = tempfile::tempdir().unwrap();
        let runtime = OperationRuntime::new(
            OperationHistoryRepository::new(dir.path().join("history.sqlite")).unwrap(),
        );
        let source = dir.path().join("large.bin");
        let destination = dir.path().join("dest");
        let (sender, receiver) = mpsc::channel();

        std::fs::write(&source, vec![5_u8; 4 * 1024 * 1024]).unwrap();
        std::fs::create_dir(&destination).unwrap();

        let plan = runtime
            .plan(vfs::FileOperationRequest {
                kind: vfs::FileOperationKind::Copy,
                sources: vec![ResourceUri::from_local_path(&source).unwrap()],
                destination: Some(ResourceUri::from_local_path(&destination).unwrap()),
                new_name: None,
                conflict_policy: vfs::ConflictPolicy::Fail,
            })
            .unwrap();
        let runtime_for_sink = runtime.clone();
        let job = runtime
            .start(
                plan,
                Arc::new(move |event| {
                    if let JobEvent::Progress(progress) = &event {
                        let _ = runtime_for_sink.cancel(progress.job_id.as_str());
                    }

                    let _ = sender.send(event);
                }),
            )
            .unwrap();

        let _ = runtime.cancel(job.job_id.as_str());

        loop {
            let event = receiver.recv_timeout(Duration::from_secs(5)).unwrap();

            if matches!(event, JobEvent::Cancelled(_)) {
                break;
            }
        }

        let history = runtime.recent_history(10);
        assert_eq!(history[0].status, "cancelled");
    }
}
