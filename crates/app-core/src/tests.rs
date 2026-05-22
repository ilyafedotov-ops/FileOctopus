use std::sync::mpsc;
use std::time::Duration;

use chrono::Utc;
use jobs::JobEvent;
use rusqlite::params;
use vfs::ResourceUri;

use super::*;
use crate::history::SCHEMA_VERSION;

#[test]
fn boot_registers_local_provider() {
    let state = AppCore::boot().unwrap();
    let uri = ResourceUri::parse("local:///Users").unwrap();
    let provider = state.vfs().provider_for(&uri).unwrap();

    assert_eq!(provider.id().as_str(), "local");
}

#[test]
fn boot_does_not_register_sftp_provider_when_network_is_disabled() {
    let previous = std::env::var("FILEOCTOPUS_ENABLE_NETWORK").ok();
    std::env::set_var("FILEOCTOPUS_ENABLE_NETWORK", "0");
    let dir = tempfile::tempdir().unwrap();
    let paths = AppPaths {
        config_dir: dir.path().join("config"),
        data_dir: dir.path().join("data"),
        log_dir: dir.path().join("logs"),
        history_db: dir.path().join("history.sqlite"),
        preferences_db: dir.path().join("preferences.sqlite"),
        navigation_db: dir.path().join("navigation.sqlite"),
        network_db: dir.path().join("network.sqlite"),
    };
    let state = AppCore::boot_with_paths(paths).unwrap();
    let uri = ResourceUri::parse("sftp://550e8400-e29b-41d4-a716-446655440000/").unwrap();
    let error = match state.vfs().provider_for(&uri) {
        Ok(_) => panic!("expected sftp provider to be unavailable when network is disabled"),
        Err(error) => error,
    };

    if let Some(value) = previous {
        std::env::set_var("FILEOCTOPUS_ENABLE_NETWORK", value);
    } else {
        std::env::remove_var("FILEOCTOPUS_ENABLE_NETWORK");
    }

    assert_eq!(error.code(), "unsupported_provider");
}

#[test]
fn operation_history_migration_is_idempotent() {
    let dir = tempfile::tempdir().unwrap();
    let repository = OperationHistoryRepository::new(dir.path().join("history.sqlite")).unwrap();

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
    let repository = OperationHistoryRepository::new(dir.path().join("history.sqlite")).unwrap();
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
    let runtime = OperationRuntime::new(
        fs_core::vfs_io::VfsFilesystem::local_only(),
        OperationHistoryRepository::new(history_path).unwrap(),
    );
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
        .start_planned(
            &plan.operation_id,
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
        fs_core::vfs_io::VfsFilesystem::local_only(),
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
        .start_planned(
            &plan.operation_id,
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
        fs_core::vfs_io::VfsFilesystem::local_only(),
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
        .start_planned(
            &plan.operation_id,
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

#[test]
fn planned_operation_is_removed_after_start() {
    let dir = tempfile::tempdir().unwrap();
    let history_path = dir.path().join("history.sqlite");
    let runtime = OperationRuntime::new(
        fs_core::vfs_io::VfsFilesystem::local_only(),
        OperationHistoryRepository::new(history_path).unwrap(),
    );
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
        .start_planned(
            &plan.operation_id,
            Arc::new(move |event| {
                let _ = sender.send(event);
            }),
        )
        .unwrap();

    loop {
        let event = receiver.recv_timeout(Duration::from_secs(5)).unwrap();

        if matches!(event, JobEvent::Completed(_)) {
            break;
        }
    }

    let error = runtime
        .start_planned(&plan.operation_id, Arc::new(|_| {}))
        .unwrap_err();
    assert_eq!(error.code(), "not_found");
}
