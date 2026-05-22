use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use chrono::Utc;
use fs_core::file_ops::{execute_file_operation, plan_file_operation, FileOperationEventSink};
use fs_core::vfs_io::VfsFilesystem;
use jobs::{
    CancellationToken, JobCancelledEvent, JobCompletedEvent, JobEvent, JobFailedEvent, JobId,
    JobProgressEvent, JobSnapshot, JobStartedEvent, JobStatus,
};
use vfs::{
    ConflictPolicy, FileKind, FileOperationError, FileOperationItem, FileOperationKind,
    FileOperationPlan, FileOperationRequest, ResourceUri,
};

use crate::history::{OperationHistoryRecord, OperationHistoryRepository, HISTORY_RETENTION_LIMIT};

#[derive(Clone)]
pub struct OperationRuntime {
    vfs: VfsFilesystem,
    jobs: Arc<Mutex<HashMap<String, JobRuntimeState>>>,
    planned_operations: Arc<Mutex<HashMap<String, FileOperationPlan>>>,
    history: OperationHistoryRepository,
}

impl OperationRuntime {
    pub fn new(vfs: VfsFilesystem, history: OperationHistoryRepository) -> Self {
        Self {
            vfs,
            jobs: Arc::new(Mutex::new(HashMap::new())),
            planned_operations: Arc::new(Mutex::new(HashMap::new())),
            history,
        }
    }

    pub fn plan(
        &self,
        request: FileOperationRequest,
    ) -> Result<FileOperationPlan, FileOperationError> {
        let kind = request.kind;
        let plan = match plan_file_operation(&self.vfs, request) {
            Ok(plan) => plan,
            Err(error) => {
                telemetry::error(&format!(
                    "operation planning failed kind={kind:?} code={}",
                    error.code()
                ));
                return Err(error);
            }
        };

        self.planned_operations
            .lock()
            .map_err(|_| FileOperationError::Internal {
                message: "planned operation registry lock poisoned".to_string(),
            })?
            .insert(plan.operation_id.clone(), plan.clone());

        Ok(plan)
    }

    pub fn start_planned(
        &self,
        operation_id: &str,
        sink: Arc<FileOperationEventSink>,
    ) -> Result<JobSnapshot, FileOperationError> {
        let plan = self
            .planned_operations
            .lock()
            .map_err(|_| FileOperationError::Internal {
                message: "planned operation registry lock poisoned".to_string(),
            })?
            .remove(operation_id)
            .ok_or_else(|| FileOperationError::NotFound {
                uri: operation_id.to_string(),
            })?;

        self.start(plan, sink)
    }

    fn start(
        &self,
        plan: FileOperationPlan,
        sink: Arc<FileOperationEventSink>,
    ) -> Result<JobSnapshot, FileOperationError> {
        self.start_with_executor(plan, sink, execute_file_operation)
    }

    pub fn write_text_file_atomic(
        &self,
        uri: ResourceUri,
        bytes: Vec<u8>,
        sink: Arc<FileOperationEventSink>,
    ) -> Result<JobSnapshot, FileOperationError> {
        self.vfs.validate_uri(&uri)?;
        let byte_size = bytes.len() as u64;
        let plan = FileOperationPlan {
            operation_id: uuid::Uuid::new_v4().to_string(),
            kind: FileOperationKind::WriteTextFile,
            sources: vec![uri.clone()],
            destination: Some(uri.clone()),
            new_name: None,
            conflict_policy: ConflictPolicy::Overwrite,
            items: vec![FileOperationItem {
                source: Some(uri.clone()),
                destination: Some(uri.clone()),
                kind: FileKind::File,
                size: Some(byte_size),
                recursive: false,
            }],
            conflicts: Vec::new(),
            warnings: Vec::new(),
            total_items: 1,
            total_bytes: Some(byte_size),
        };

        self.start_with_executor(
            plan,
            sink,
            move |vfs, plan, job_id, cancel, progress_sink| {
                if cancel.is_cancelled() {
                    return Err(FileOperationError::Cancelled {
                        job_id: Some(job_id.as_str().to_string()),
                    });
                }

                let destination = plan.destination.as_ref().ok_or_else(|| {
                    FileOperationError::InvalidRequest {
                        message: "write text file plan has no destination".to_string(),
                    }
                })?;

                vfs.write_file_atomic(destination, &bytes)?;

                progress_sink(JobEvent::Progress(JobProgressEvent {
                    job_id: job_id.clone(),
                    operation_kind: plan.kind,
                    current_item: Some(destination.display_path()),
                    completed_items: 1,
                    total_items: plan.total_items,
                    completed_bytes: byte_size,
                    total_bytes: plan.total_bytes,
                    updated_at: Utc::now(),
                }));

                Ok(())
            },
        )
    }

    fn start_with_executor<F>(
        &self,
        plan: FileOperationPlan,
        sink: Arc<FileOperationEventSink>,
        executor: F,
    ) -> Result<JobSnapshot, FileOperationError>
    where
        F: FnOnce(
                &VfsFilesystem,
                &FileOperationPlan,
                &JobId,
                &CancellationToken,
                &FileOperationEventSink,
            ) -> Result<(), FileOperationError>
            + Send
            + 'static,
    {
        let job_id = JobId::new(uuid::Uuid::new_v4().to_string());
        let now = Utc::now();
        let operation_kind = plan.kind;
        let total_items = plan.total_items;
        let total_bytes = plan.total_bytes;
        let snapshot = JobSnapshot {
            job_id: job_id.clone(),
            operation_kind,
            status: JobStatus::Queued,
            current_item: None,
            completed_items: 0,
            total_items,
            completed_bytes: 0,
            total_bytes,
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
            operation_kind,
            plan.sources.len(),
            total_items
        ));

        let vfs = self.vfs.clone();
        let jobs = self.jobs.clone();
        let history = self.history.clone();
        let sink_for_thread = sink.clone();
        let thread_job_id = job_id.clone();
        let started = JobEvent::Started(JobStartedEvent {
            job_id: job_id.clone(),
            operation_kind,
            total_items,
            total_bytes,
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
            let result = executor(&vfs, &plan, &thread_job_id, &token, &*progress_sink);

            match result {
                Ok(()) => {
                    let completed_at = Utc::now();
                    telemetry::info(&format!(
                        "operation job completed job_id={} kind={:?}",
                        thread_job_id.as_str(),
                        operation_kind
                    ));
                    update_snapshot_status(&jobs, &thread_job_id, JobStatus::Completed, None, None);
                    history.update_terminal(thread_job_id.as_str(), JobStatus::Completed, None);
                    progress_sink(JobEvent::Completed(JobCompletedEvent {
                        job_id: thread_job_id,
                        operation_kind,
                        completed_items: total_items,
                        completed_bytes: total_bytes.unwrap_or(0),
                        completed_at,
                    }));
                }
                Err(FileOperationError::Cancelled { .. }) => {
                    let cancelled_at = Utc::now();
                    telemetry::info(&format!(
                        "operation job cancelled job_id={} kind={:?}",
                        thread_job_id.as_str(),
                        operation_kind
                    ));
                    update_snapshot_status(&jobs, &thread_job_id, JobStatus::Cancelled, None, None);
                    history.update_terminal(thread_job_id.as_str(), JobStatus::Cancelled, None);
                    progress_sink(JobEvent::Cancelled(JobCancelledEvent {
                        job_id: thread_job_id,
                        operation_kind,
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
                        operation_kind
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
                        operation_kind,
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
