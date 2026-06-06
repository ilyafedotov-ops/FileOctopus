use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Condvar, Mutex,
};
use std::time::Duration;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use vfs::FileOperationKind;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
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
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "jobs/JobStatus.ts"))]
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
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "jobs/JobSnapshot.ts"))]
#[serde(rename_all = "camelCase")]
pub struct JobSnapshot {
    #[cfg_attr(feature = "ts", ts(as = "String"))]
    pub job_id: JobId,
    pub operation_kind: FileOperationKind,
    pub status: JobStatus,
    pub current_item: Option<String>,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub completed_items: u64,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub total_items: u64,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub completed_bytes: u64,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
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
#[serde(rename_all = "camelCase")]
pub struct JobPausedEvent {
    pub job_id: JobId,
    pub operation_kind: FileOperationKind,
    pub paused_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobResumedEvent {
    pub job_id: JobId,
    pub operation_kind: FileOperationKind,
    pub resumed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "event")]
pub enum JobEvent {
    Started(JobStartedEvent),
    Progress(JobProgressEvent),
    Completed(JobCompletedEvent),
    Failed(JobFailedEvent),
    Cancelled(JobCancelledEvent),
    Paused(JobPausedEvent),
    Resumed(JobResumedEvent),
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

#[derive(Default)]
struct PauseInner {
    paused: Mutex<bool>,
    cvar: Condvar,
}

#[derive(Clone, Default)]
pub struct PauseToken {
    inner: Arc<PauseInner>,
}

impl PauseToken {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn pause(&self) {
        *self.inner.paused.lock().expect("pause lock poisoned") = true;
    }

    pub fn resume(&self) {
        let mut paused = self.inner.paused.lock().expect("pause lock poisoned");
        *paused = false;
        self.inner.cvar.notify_all();
    }

    pub fn is_paused(&self) -> bool {
        *self.inner.paused.lock().expect("pause lock poisoned")
    }

    /// Block the calling thread while paused, returning as soon as the job is
    /// resumed (via condvar notification) or cancelled. The bounded wait only
    /// caps how quickly cancellation is observed; resume wakes the waiter
    /// immediately without polling.
    pub fn wait_while_paused(&self, cancel: &CancellationToken) {
        let mut paused = self.inner.paused.lock().expect("pause lock poisoned");
        while *paused && !cancel.is_cancelled() {
            let (next, _timed_out) = self
                .inner
                .cvar
                .wait_timeout(paused, Duration::from_millis(100))
                .expect("pause lock poisoned");
            paused = next;
        }
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

    #[test]
    fn pause_token_tracks_paused_state() {
        let token = PauseToken::new();
        assert!(!token.is_paused());
        token.pause();
        assert!(token.is_paused());
        token.resume();
        assert!(!token.is_paused());
    }

    #[test]
    fn pause_token_wait_exits_on_resume() {
        let token = PauseToken::new();
        let cancel = CancellationToken::new();
        token.pause();

        let token_clone = token.clone();
        let cancel_clone = cancel.clone();
        let handle = std::thread::spawn(move || {
            token_clone.wait_while_paused(&cancel_clone);
        });

        token.resume();
        handle.join().expect("wait should complete");
    }

    #[test]
    fn pause_token_wait_resume_wakes_promptly() {
        let token = PauseToken::new();
        let cancel = CancellationToken::new();
        token.pause();

        let token_clone = token.clone();
        let cancel_clone = cancel.clone();
        let handle = std::thread::spawn(move || {
            token_clone.wait_while_paused(&cancel_clone);
        });

        // Give the waiter time to block on the condvar, then resume and
        // assert it wakes well before the 100ms cancel-poll timeout.
        std::thread::sleep(std::time::Duration::from_millis(10));
        let start = std::time::Instant::now();
        token.resume();
        handle.join().expect("wait should complete on resume");
        assert!(
            start.elapsed() < std::time::Duration::from_millis(80),
            "resume should wake the waiter via notification, not the poll timeout"
        );
    }

    #[test]
    fn pause_token_wait_exits_on_cancel() {
        let token = PauseToken::new();
        let cancel = CancellationToken::new();
        token.pause();

        let token_clone = token.clone();
        let cancel_clone = cancel.clone();
        let handle = std::thread::spawn(move || {
            token_clone.wait_while_paused(&cancel_clone);
        });

        cancel.cancel();
        handle.join().expect("wait should exit on cancel");
    }
}
