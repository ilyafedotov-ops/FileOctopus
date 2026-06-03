use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use app_ipc::IpcError;
use chrono::Utc;
use jobs::{CancellationToken, JobEvent, JobId, JobProgressEvent, JobSnapshot, JobStatus};
use tauri::AppHandle;
use vfs::{FileOperationError, FileOperationKind, ListCancellation};

use crate::emit::emit_job;

const METADATA_JOB_TERMINAL_RETENTION_MAX: usize = 64;

#[derive(Default)]
pub(crate) struct WatchState {
    pub(crate) current: Mutex<Option<WatchRuntime>>,
}

/// Tracks whether the single backend log-stream forwarding task has been
/// spawned. Streaming itself is toggled via `telemetry::set_streaming`; this
/// guard only ensures we never spawn more than one forwarder.
#[derive(Default)]
pub(crate) struct LogStreamState {
    pub(crate) task_started: std::sync::atomic::AtomicBool,
}

pub(crate) struct WatchRuntime {
    pub(crate) stop: Arc<std::sync::atomic::AtomicBool>,
    pub(crate) handle: std::thread::JoinHandle<()>,
}

#[derive(Clone, Default)]
pub(crate) struct MetadataJobState {
    pub(crate) jobs: Arc<Mutex<HashMap<String, MetadataJobRuntime>>>,
}

pub(crate) struct MetadataJobRuntime {
    pub(crate) snapshot: JobSnapshot,
    pub(crate) cancel: CancellationToken,
}

#[derive(Clone, Default)]
pub(crate) struct ListingRegistry {
    pub(crate) tokens: Arc<Mutex<HashMap<String, ListCancellation>>>,
}

impl ListingRegistry {
    pub(crate) fn register(&self, panel_key: &str) -> ListCancellation {
        let token = ListCancellation::new();
        let mut tokens = self.tokens.lock().expect("listing registry lock poisoned");

        if let Some(previous) = tokens.remove(panel_key) {
            previous.cancel();
        }

        tokens.insert(panel_key.to_string(), token.clone());
        token
    }

    pub(crate) fn remove(&self, panel_key: &str) {
        if let Ok(mut tokens) = self.tokens.lock() {
            tokens.remove(panel_key);
        }
    }
}

pub(crate) fn start_metadata_job(
    state: &MetadataJobState,
    kind: FileOperationKind,
) -> Result<JobSnapshot, IpcError> {
    let job_id = JobId::new(uuid::Uuid::new_v4().to_string());
    let now = Utc::now();
    let snapshot = JobSnapshot {
        job_id: job_id.clone(),
        operation_kind: kind,
        status: JobStatus::Queued,
        current_item: None,
        completed_items: 0,
        total_items: 0,
        completed_bytes: 0,
        total_bytes: None,
        error_code: None,
        message: None,
        started_at: now,
        updated_at: now,
    };
    let runtime = MetadataJobRuntime {
        snapshot: snapshot.clone(),
        cancel: CancellationToken::new(),
    };

    state
        .jobs
        .lock()
        .map_err(|_| IpcError::internal("metadata job state lock poisoned"))?
        .insert(job_id.as_str().to_string(), runtime);

    Ok(snapshot)
}

pub(crate) fn metadata_job_token(
    state: &MetadataJobState,
    job_id: &str,
) -> Result<CancellationToken, IpcError> {
    state
        .jobs
        .lock()
        .map_err(|_| IpcError::internal("metadata job state lock poisoned"))?
        .get(job_id)
        .map(|runtime| runtime.cancel.clone())
        .ok_or_else(|| {
            IpcError::from(FileOperationError::NotFound {
                uri: job_id.to_string(),
            })
        })
}

pub(crate) fn metadata_job_snapshot(
    state: &MetadataJobState,
    job_id: &str,
) -> Result<Option<JobSnapshot>, IpcError> {
    Ok(state
        .jobs
        .lock()
        .map_err(|_| IpcError::internal("metadata job state lock poisoned"))?
        .get(job_id)
        .map(|runtime| runtime.snapshot.clone()))
}

pub(crate) fn cancel_metadata_job(
    state: &MetadataJobState,
    job_id: &str,
) -> Result<Option<JobSnapshot>, IpcError> {
    let mut jobs = state
        .jobs
        .lock()
        .map_err(|_| IpcError::internal("metadata job state lock poisoned"))?;
    let Some(runtime) = jobs.get_mut(job_id) else {
        return Ok(None);
    };

    runtime.cancel.cancel();
    runtime.snapshot.status = JobStatus::Cancelled;
    runtime.snapshot.updated_at = Utc::now();
    let snapshot = runtime.snapshot.clone();
    prune_terminal_metadata_jobs(&mut jobs);

    Ok(Some(snapshot))
}

pub(crate) fn set_metadata_job_status(
    jobs: &Arc<Mutex<HashMap<String, MetadataJobRuntime>>>,
    job_id: &str,
    status: JobStatus,
    code: Option<String>,
    message: Option<String>,
) {
    if let Ok(mut jobs) = jobs.lock() {
        if let Some(runtime) = jobs.get_mut(job_id) {
            runtime.snapshot.status = status;
            runtime.snapshot.error_code = code;
            runtime.snapshot.message = message;
            runtime.snapshot.updated_at = Utc::now();
        }
        prune_terminal_metadata_jobs(&mut jobs);
    }
}

fn prune_terminal_metadata_jobs(jobs: &mut HashMap<String, MetadataJobRuntime>) {
    let terminal_count = jobs
        .values()
        .filter(|runtime| is_terminal_status(runtime.snapshot.status))
        .count();
    if terminal_count <= METADATA_JOB_TERMINAL_RETENTION_MAX {
        return;
    }

    let remove_count = terminal_count - METADATA_JOB_TERMINAL_RETENTION_MAX;
    let mut terminal_jobs: Vec<(String, chrono::DateTime<Utc>)> = jobs
        .iter()
        .filter(|(_, runtime)| is_terminal_status(runtime.snapshot.status))
        .map(|(job_id, runtime)| (job_id.clone(), runtime.snapshot.updated_at))
        .collect();
    terminal_jobs.sort_by_key(|(_, updated_at)| *updated_at);

    for (job_id, _) in terminal_jobs.into_iter().take(remove_count) {
        jobs.remove(&job_id);
    }
}

fn is_terminal_status(status: JobStatus) -> bool {
    matches!(
        status,
        JobStatus::Cancelled | JobStatus::Completed | JobStatus::Failed
    )
}

pub(crate) fn update_metadata_job_progress(
    jobs: &Arc<Mutex<HashMap<String, MetadataJobRuntime>>>,
    app: &AppHandle,
    job_id: &JobId,
    kind: FileOperationKind,
    current_item: String,
    completed_items: u64,
    completed_bytes: u64,
) {
    let updated_at = Utc::now();

    if let Ok(mut jobs) = jobs.lock() {
        if let Some(runtime) = jobs.get_mut(job_id.as_str()) {
            runtime.snapshot.current_item = Some(current_item.clone());
            runtime.snapshot.completed_items = completed_items;
            runtime.snapshot.completed_bytes = completed_bytes;
            runtime.snapshot.updated_at = updated_at;
        }
    }

    emit_job(
        app,
        JobEvent::Progress(JobProgressEvent {
            job_id: job_id.clone(),
            operation_kind: kind,
            current_item: Some(current_item),
            completed_items,
            total_items: 0,
            completed_bytes,
            total_bytes: None,
            updated_at,
        }),
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn metadata_jobs_prune_old_terminal_snapshots() {
        let state = MetadataJobState::default();

        for _ in 0..80 {
            let snapshot = start_metadata_job(&state, FileOperationKind::FolderSize).unwrap();
            set_metadata_job_status(
                &state.jobs,
                snapshot.job_id.as_str(),
                JobStatus::Completed,
                None,
                None,
            );
        }

        let job_count = state.jobs.lock().unwrap().len();
        assert!(
            job_count <= 64,
            "metadata jobs should retain a bounded number of terminal snapshots, got {job_count}"
        );
    }
}
