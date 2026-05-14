use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use vfs::FileOperationKind;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct JobId(String);

impl JobId {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum JobStatus {
    Queued,
    Running,
    Paused,
    Cancelled,
    Completed,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobSnapshot {
    pub job_id: JobId,
    pub operation_kind: FileOperationKind,
    pub status: JobStatus,
    pub current_item: Option<String>,
    pub completed_items: u64,
    pub total_items: u64,
    pub completed_bytes: u64,
    pub total_bytes: Option<u64>,
    pub error_code: Option<String>,
    pub message: Option<String>,
    pub started_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobStartedEvent {
    pub job_id: JobId,
    pub operation_kind: FileOperationKind,
    pub total_items: u64,
    pub total_bytes: Option<u64>,
    pub started_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobProgressEvent {
    pub job_id: JobId,
    pub operation_kind: FileOperationKind,
    pub current_item: Option<String>,
    pub completed_items: u64,
    pub total_items: u64,
    pub completed_bytes: u64,
    pub total_bytes: Option<u64>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobCompletedEvent {
    pub job_id: JobId,
    pub operation_kind: FileOperationKind,
    pub completed_items: u64,
    pub completed_bytes: u64,
    pub completed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobFailedEvent {
    pub job_id: JobId,
    pub operation_kind: FileOperationKind,
    pub error_code: String,
    pub message: String,
    pub failed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobCancelledEvent {
    pub job_id: JobId,
    pub operation_kind: FileOperationKind,
    pub cancelled_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "event")]
pub enum JobEvent {
    Started(JobStartedEvent),
    Progress(JobProgressEvent),
    Completed(JobCompletedEvent),
    Failed(JobFailedEvent),
    Cancelled(JobCancelledEvent),
}

#[derive(Clone, Default)]
pub struct CancellationToken {
    cancelled: Arc<AtomicBool>,
}

impl CancellationToken {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancellation_token_tracks_cancelled_state() {
        let token = CancellationToken::new();

        assert!(!token.is_cancelled());
        token.cancel();
        assert!(token.is_cancelled());
    }

    #[test]
    fn serializes_job_progress_event() {
        let event = JobEvent::Progress(JobProgressEvent {
            job_id: JobId::new("job-1"),
            operation_kind: FileOperationKind::Copy,
            current_item: Some("a.txt".to_string()),
            completed_items: 1,
            total_items: 2,
            completed_bytes: 10,
            total_bytes: Some(20),
            updated_at: Utc::now(),
        });
        let encoded = serde_json::to_string(&event).unwrap();

        assert!(encoded.contains("job-1"));
        assert!(encoded.contains("progress"));
    }
}
