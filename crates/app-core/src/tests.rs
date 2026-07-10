use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use fs_core::LocalFsProvider;
use jobs::{JobEvent, JobStatus};
use rusqlite::params;
use vfs::{ResourceUri, VfsRegistry};

use super::*;
use crate::history::SCHEMA_VERSION;
use crate::runtime::RuntimeSettings;

fn local_vfs() -> fs_core::vfs_io::VfsFilesystem {
    let registry = Arc::new(VfsRegistry::new());
    registry.register(Arc::new(LocalFsProvider::new())).unwrap();
    fs_core::vfs_io::VfsFilesystem::local_only(registry)
}

fn noop_plan() -> vfs::FileOperationPlan {
    vfs::FileOperationPlan {
        operation_id: uuid::Uuid::new_v4().to_string(),
        kind: vfs::FileOperationKind::Copy,
        sources: Vec::new(),
        destination: None,
        new_name: None,
        conflict_policy: vfs::ConflictPolicy::Fail,
        items: Vec::new(),
        conflicts: Vec::new(),
        warnings: Vec::new(),
        total_items: 0,
        total_bytes: None,
    }
}

#[test]
fn concurrency_is_bounded_by_worker_count() {
    let dir = tempfile::tempdir().unwrap();
    let runtime = OperationRuntime::with_settings(
        local_vfs(),
        OperationHistoryRepository::new(dir.path().join("history.sqlite")).unwrap(),
        RuntimeSettings {
            worker_count: 2,
            idle_timeout: None,
        },
    );

    let active = Arc::new(AtomicUsize::new(0));
    let max_seen = Arc::new(AtomicUsize::new(0));
    let (sender, receiver) = mpsc::channel();

    for _ in 0..6 {
        let active = active.clone();
        let max_seen = max_seen.clone();
        let sink_sender = sender.clone();
        runtime
            .start_with_executor(
                noop_plan(),
                Arc::new(move |event| {
                    let _ = sink_sender.send(event);
                }),
                move |_vfs, _plan, _job, _cancel, _pause, _progress| {
                    let current = active.fetch_add(1, Ordering::SeqCst) + 1;
                    max_seen.fetch_max(current, Ordering::SeqCst);
                    std::thread::sleep(Duration::from_millis(80));
                    active.fetch_sub(1, Ordering::SeqCst);
                    Ok(())
                },
            )
            .unwrap();
    }

    let mut completed = 0;
    while completed < 6 {
        let event = receiver.recv_timeout(Duration::from_secs(10)).unwrap();
        if matches!(event, JobEvent::Completed(_)) {
            completed += 1;
        }
    }

    let peak = max_seen.load(Ordering::SeqCst);
    assert!(peak <= 2, "peak concurrency {peak} exceeded worker cap 2");
}

#[test]
fn operation_admission_rejects_work_above_the_runtime_limit() {
    let dir = tempfile::tempdir().unwrap();
    let runtime = OperationRuntime::with_settings(
        local_vfs(),
        OperationHistoryRepository::new(dir.path().join("history.sqlite")).unwrap(),
        RuntimeSettings {
            worker_count: 1,
            idle_timeout: None,
        },
    );
    let release = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let (sender, receiver) = mpsc::channel();

    for _ in 0..crate::runtime::ACTIVE_OPERATION_LIMIT {
        let release = release.clone();
        let sender = sender.clone();
        runtime
            .start_with_executor(
                noop_plan(),
                Arc::new(move |event| {
                    let _ = sender.send(event);
                }),
                move |_vfs, _plan, _job, _cancel, _pause, _progress| {
                    while !release.load(Ordering::SeqCst) {
                        std::thread::sleep(Duration::from_millis(5));
                    }
                    Ok(())
                },
            )
            .unwrap();
    }

    let error = runtime
        .start_with_executor(
            noop_plan(),
            Arc::new(|_| {}),
            |_vfs, _plan, _job, _cancel, _pause, _progress| Ok(()),
        )
        .unwrap_err();
    assert_eq!(error.code(), "resource_limit_exceeded");

    release.store(true, Ordering::SeqCst);
    let mut completed = 0;
    while completed < crate::runtime::ACTIVE_OPERATION_LIMIT {
        if matches!(
            receiver.recv_timeout(Duration::from_secs(10)).unwrap(),
            JobEvent::Completed(_)
        ) {
            completed += 1;
        }
    }
}

#[test]
fn pause_and_resume_are_lock_safe_idempotent_and_emit_transitions() {
    let dir = tempfile::tempdir().unwrap();
    let runtime = OperationRuntime::with_settings(
        local_vfs(),
        OperationHistoryRepository::new(dir.path().join("history.sqlite")).unwrap(),
        RuntimeSettings {
            worker_count: 1,
            idle_timeout: None,
        },
    );
    let (event_sender, event_receiver) = mpsc::channel();
    let (ready_sender, ready_receiver) = mpsc::channel();
    let (wait_sender, wait_receiver) = mpsc::channel();
    let (passed_sender, passed_receiver) = mpsc::channel();
    let (finish_sender, finish_receiver) = mpsc::channel();

    let job = runtime
        .start_with_executor(
            noop_plan(),
            Arc::new(move |event| {
                let _ = event_sender.send(event);
            }),
            move |_vfs, _plan, _job, cancel, pause, _progress| {
                ready_sender.send(()).unwrap();
                wait_receiver.recv_timeout(Duration::from_secs(5)).unwrap();
                pause.wait_while_paused(cancel);
                passed_sender.send(()).unwrap();
                finish_receiver
                    .recv_timeout(Duration::from_secs(5))
                    .unwrap();
                Ok(())
            },
        )
        .unwrap();

    ready_receiver.recv_timeout(Duration::from_secs(5)).unwrap();
    assert!(matches!(
        event_receiver.recv_timeout(Duration::from_secs(1)).unwrap(),
        JobEvent::Started(_)
    ));

    let unchanged = runtime.resume_job(job.job_id.as_str()).unwrap();
    assert_eq!(unchanged.status, JobStatus::Running);
    assert!(event_receiver
        .recv_timeout(Duration::from_millis(100))
        .is_err());

    let runtime_for_pause = runtime.clone();
    let pause_job_id = job.job_id.as_str().to_string();
    let (pause_sender, pause_receiver) = mpsc::channel();
    let pause_thread = std::thread::spawn(move || {
        pause_sender
            .send(runtime_for_pause.pause_job(&pause_job_id))
            .unwrap();
    });
    let paused = pause_receiver
        .recv_timeout(Duration::from_secs(1))
        .expect("pause transition deadlocked")
        .unwrap();
    pause_thread.join().unwrap();

    assert_eq!(paused.status, JobStatus::Paused);
    assert_eq!(
        runtime.status(job.job_id.as_str()).unwrap().status,
        JobStatus::Paused
    );
    match event_receiver.recv_timeout(Duration::from_secs(1)).unwrap() {
        JobEvent::Paused(event) => {
            assert_eq!(event.job_id, job.job_id);
            assert_eq!(event.paused_at, paused.updated_at);
        }
        other => panic!("expected Paused event, got {other:?}"),
    }

    let paused_again = runtime.pause_job(job.job_id.as_str()).unwrap();
    assert_eq!(paused_again.updated_at, paused.updated_at);
    assert!(event_receiver
        .recv_timeout(Duration::from_millis(100))
        .is_err());

    wait_sender.send(()).unwrap();
    assert!(passed_receiver
        .recv_timeout(Duration::from_millis(150))
        .is_err());

    let runtime_for_resume = runtime.clone();
    let resume_job_id = job.job_id.as_str().to_string();
    let (resume_sender, resume_receiver) = mpsc::channel();
    let resume_thread = std::thread::spawn(move || {
        resume_sender
            .send(runtime_for_resume.resume_job(&resume_job_id))
            .unwrap();
    });
    let resumed = resume_receiver
        .recv_timeout(Duration::from_secs(1))
        .expect("resume transition deadlocked")
        .unwrap();
    resume_thread.join().unwrap();

    assert_eq!(resumed.status, JobStatus::Running);
    match event_receiver.recv_timeout(Duration::from_secs(1)).unwrap() {
        JobEvent::Resumed(event) => {
            assert_eq!(event.job_id, job.job_id);
            assert_eq!(event.resumed_at, resumed.updated_at);
        }
        other => panic!("expected Resumed event, got {other:?}"),
    }
    passed_receiver
        .recv_timeout(Duration::from_secs(1))
        .unwrap();

    let resumed_again = runtime.resume_job(job.job_id.as_str()).unwrap();
    assert_eq!(resumed_again.updated_at, resumed.updated_at);
    assert!(event_receiver
        .recv_timeout(Duration::from_millis(100))
        .is_err());

    finish_sender.send(()).unwrap();
    assert!(matches!(
        event_receiver.recv_timeout(Duration::from_secs(1)).unwrap(),
        JobEvent::Completed(_)
    ));
    assert_eq!(
        runtime.pause_job(job.job_id.as_str()).unwrap_err().code(),
        "invalid_request"
    );
    assert_eq!(
        runtime.resume_job(job.job_id.as_str()).unwrap_err().code(),
        "invalid_request"
    );
}

#[test]
fn job_exceeding_idle_timeout_fails_with_timeout() {
    let dir = tempfile::tempdir().unwrap();
    let runtime = OperationRuntime::with_settings(
        local_vfs(),
        OperationHistoryRepository::new(dir.path().join("history.sqlite")).unwrap(),
        RuntimeSettings {
            worker_count: 2,
            idle_timeout: Some(Duration::from_millis(150)),
        },
    );
    let (sender, receiver) = mpsc::channel();

    runtime
        .start_with_executor(
            noop_plan(),
            Arc::new(move |event| {
                let _ = sender.send(event);
            }),
            move |_vfs, _plan, job, cancel, _pause, _progress| {
                // Stuck job: emits no progress, waits to be cancelled by the watchdog.
                for _ in 0..200 {
                    if cancel.is_cancelled() {
                        return Err(vfs::FileOperationError::Cancelled {
                            job_id: Some(job.as_str().to_string()),
                        });
                    }
                    std::thread::sleep(Duration::from_millis(20));
                }
                Ok(())
            },
        )
        .unwrap();

    let terminal = loop {
        let event = receiver.recv_timeout(Duration::from_secs(5)).unwrap();
        if matches!(
            event,
            JobEvent::Failed(_) | JobEvent::Completed(_) | JobEvent::Cancelled(_)
        ) {
            break event;
        }
    };

    match terminal {
        JobEvent::Failed(failed) => assert_eq!(failed.error_code, "timeout"),
        other => panic!("expected Failed(timeout), got {other:?}"),
    }

    let history = runtime.recent_history(10);
    assert_eq!(history[0].status, "failed");
    assert_eq!(history[0].error_code.as_deref(), Some("timeout"));
}

#[test]
fn user_cancelled_idle_job_stays_cancelled_after_timeout_window() {
    let dir = tempfile::tempdir().unwrap();
    let runtime = OperationRuntime::with_settings(
        local_vfs(),
        OperationHistoryRepository::new(dir.path().join("history.sqlite")).unwrap(),
        RuntimeSettings {
            worker_count: 1,
            idle_timeout: Some(Duration::from_millis(100)),
        },
    );
    let (sender, receiver) = mpsc::channel();
    let runtime_for_sink = runtime.clone();

    runtime
        .start_with_executor(
            noop_plan(),
            Arc::new(move |event| {
                if let JobEvent::Started(started) = &event {
                    std::thread::sleep(Duration::from_millis(500));
                    runtime_for_sink.cancel(started.job_id.as_str()).unwrap();
                }
                let _ = sender.send(event);
            }),
            move |_vfs, _plan, job, cancel, _pause, _progress| loop {
                if cancel.is_cancelled() {
                    std::thread::sleep(Duration::from_millis(250));
                    return Err(vfs::FileOperationError::Cancelled {
                        job_id: Some(job.as_str().to_string()),
                    });
                }
                std::thread::sleep(Duration::from_millis(20));
            },
        )
        .unwrap();

    let terminal = loop {
        let event = receiver.recv_timeout(Duration::from_secs(5)).unwrap();
        if matches!(
            event,
            JobEvent::Failed(_) | JobEvent::Completed(_) | JobEvent::Cancelled(_)
        ) {
            break event;
        }
    };

    match terminal {
        JobEvent::Cancelled(_) => {}
        other => panic!("expected Cancelled after user cancel, got {other:?}"),
    }

    let history = runtime.recent_history(10);
    assert_eq!(history[0].status, "cancelled");
    assert_eq!(history[0].error_code, None);
}

#[test]
fn late_user_cancel_after_watchdog_timeout_stays_timeout() {
    let dir = tempfile::tempdir().unwrap();
    let runtime = OperationRuntime::with_settings(
        local_vfs(),
        OperationHistoryRepository::new(dir.path().join("history.sqlite")).unwrap(),
        RuntimeSettings {
            worker_count: 1,
            idle_timeout: Some(Duration::from_millis(100)),
        },
    );
    let (event_sender, event_receiver) = mpsc::channel();
    let (watchdog_sender, watchdog_receiver) = mpsc::channel();
    let (release_sender, release_receiver) = mpsc::channel();

    let job = runtime
        .start_with_executor(
            noop_plan(),
            Arc::new(move |event| {
                let _ = event_sender.send(event);
            }),
            move |_vfs, _plan, job, cancel, _pause, _progress| loop {
                if cancel.is_cancelled() {
                    let _ = watchdog_sender.send(());
                    release_receiver
                        .recv_timeout(Duration::from_secs(5))
                        .unwrap();
                    return Err(vfs::FileOperationError::Cancelled {
                        job_id: Some(job.as_str().to_string()),
                    });
                }
                std::thread::sleep(Duration::from_millis(20));
            },
        )
        .unwrap();

    watchdog_receiver
        .recv_timeout(Duration::from_secs(5))
        .unwrap();
    runtime.cancel(job.job_id.as_str()).unwrap();
    release_sender.send(()).unwrap();

    let terminal = loop {
        let event = event_receiver.recv_timeout(Duration::from_secs(5)).unwrap();
        if matches!(
            event,
            JobEvent::Failed(_) | JobEvent::Completed(_) | JobEvent::Cancelled(_)
        ) {
            break event;
        }
    };

    match terminal {
        JobEvent::Failed(failed) => assert_eq!(failed.error_code, "timeout"),
        other => panic!("expected Failed(timeout), got {other:?}"),
    }

    let history = runtime.recent_history(10);
    assert_eq!(history[0].status, "failed");
    assert_eq!(history[0].error_code.as_deref(), Some("timeout"));
}

#[test]
fn set_idle_timeout_enables_watchdog_live() {
    let dir = tempfile::tempdir().unwrap();
    let runtime = OperationRuntime::with_settings(
        local_vfs(),
        OperationHistoryRepository::new(dir.path().join("history.sqlite")).unwrap(),
        RuntimeSettings {
            worker_count: 2,
            idle_timeout: None,
        },
    );
    runtime.set_idle_timeout(Some(Duration::from_millis(150)));

    let (sender, receiver) = mpsc::channel();
    runtime
        .start_with_executor(
            noop_plan(),
            Arc::new(move |event| {
                let _ = sender.send(event);
            }),
            move |_vfs, _plan, job, cancel, _pause, _progress| {
                for _ in 0..200 {
                    if cancel.is_cancelled() {
                        return Err(vfs::FileOperationError::Cancelled {
                            job_id: Some(job.as_str().to_string()),
                        });
                    }
                    std::thread::sleep(Duration::from_millis(20));
                }
                Ok(())
            },
        )
        .unwrap();

    let terminal = loop {
        let event = receiver.recv_timeout(Duration::from_secs(5)).unwrap();
        if matches!(
            event,
            JobEvent::Failed(_) | JobEvent::Completed(_) | JobEvent::Cancelled(_)
        ) {
            break event;
        }
    };
    match terminal {
        JobEvent::Failed(failed) => assert_eq!(failed.error_code, "timeout"),
        other => panic!("expected Failed(timeout) after live enable, got {other:?}"),
    }
}

#[test]
fn set_idle_timeout_none_disables_watchdog_live() {
    let dir = tempfile::tempdir().unwrap();
    let runtime = OperationRuntime::with_settings(
        local_vfs(),
        OperationHistoryRepository::new(dir.path().join("history.sqlite")).unwrap(),
        RuntimeSettings {
            worker_count: 2,
            idle_timeout: Some(Duration::from_millis(150)),
        },
    );
    runtime.set_idle_timeout(None);

    let (sender, receiver) = mpsc::channel();
    runtime
        .start_with_executor(
            noop_plan(),
            Arc::new(move |event| {
                let _ = sender.send(event);
            }),
            move |_vfs, _plan, _job, _cancel, _pause, _progress| {
                std::thread::sleep(Duration::from_millis(400));
                Ok(())
            },
        )
        .unwrap();

    let terminal = loop {
        let event = receiver.recv_timeout(Duration::from_secs(5)).unwrap();
        if matches!(
            event,
            JobEvent::Failed(_) | JobEvent::Completed(_) | JobEvent::Cancelled(_)
        ) {
            break event;
        }
    };
    assert!(
        matches!(terminal, JobEvent::Completed(_)),
        "watchdog disabled live: job should complete, got {terminal:?}"
    );
}

#[test]
fn boot_registers_local_provider() {
    let state = AppCore::boot().unwrap();
    let uri = ResourceUri::parse("local:///Users").unwrap();
    let provider = state.vfs().provider_for(&uri).unwrap();

    assert_eq!(provider.id().as_str(), "local");
}

#[test]
fn boot_configures_operation_idle_timeout_from_preferences() {
    let dir = tempfile::tempdir().unwrap();
    let paths = AppPaths {
        config_dir: dir.path().join("config"),
        data_dir: dir.path().join("data"),
        log_dir: dir.path().join("logs"),
        history_db: dir.path().join("history.sqlite"),
        preferences_db: dir.path().join("preferences.sqlite"),
        navigation_db: dir.path().join("navigation.sqlite"),
        network_db: dir.path().join("network.sqlite"),
        terminal_db: dir.path().join("terminal.sqlite"),
    };
    let preferences = config::PreferencesRepository::new(paths.preferences_db.clone()).unwrap();
    preferences.set("operationIdleTimeoutSecs", "120").unwrap();

    let state = AppCore::boot_with_paths(paths).unwrap();

    assert_eq!(
        state.operations().idle_timeout(),
        Some(Duration::from_secs(120))
    );
}

#[test]
fn boot_does_not_register_smb_provider_when_network_is_enabled() {
    let _env_guard = crate::ENV_LOCK.lock().unwrap();
    let previous = std::env::var("FILEOCTOPUS_ENABLE_NETWORK").ok();
    std::env::set_var("FILEOCTOPUS_ENABLE_NETWORK", "1");
    let dir = tempfile::tempdir().unwrap();
    let paths = AppPaths {
        config_dir: dir.path().join("config"),
        data_dir: dir.path().join("data"),
        log_dir: dir.path().join("logs"),
        history_db: dir.path().join("history.sqlite"),
        preferences_db: dir.path().join("preferences.sqlite"),
        navigation_db: dir.path().join("navigation.sqlite"),
        network_db: dir.path().join("network.sqlite"),
        terminal_db: dir.path().join("terminal.sqlite"),
    };
    let state = AppCore::boot_with_paths(paths).unwrap();
    let uri = ResourceUri::parse("smb://550e8400-e29b-41d4-a716-446655440000/share").unwrap();
    let error = match state.vfs().provider_for(&uri) {
        Ok(_) => panic!("expected unsafe smb provider to remain unavailable"),
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
fn boot_registers_s3_provider_when_network_is_enabled() {
    let _env_guard = crate::ENV_LOCK.lock().unwrap();
    let previous = std::env::var("FILEOCTOPUS_ENABLE_NETWORK").ok();
    std::env::set_var("FILEOCTOPUS_ENABLE_NETWORK", "1");
    let dir = tempfile::tempdir().unwrap();
    let paths = AppPaths {
        config_dir: dir.path().join("config"),
        data_dir: dir.path().join("data"),
        log_dir: dir.path().join("logs"),
        history_db: dir.path().join("history.sqlite"),
        preferences_db: dir.path().join("preferences.sqlite"),
        navigation_db: dir.path().join("navigation.sqlite"),
        network_db: dir.path().join("network.sqlite"),
        terminal_db: dir.path().join("terminal.sqlite"),
    };
    let state = AppCore::boot_with_paths(paths).unwrap();
    let uri = ResourceUri::parse("s3://550e8400-e29b-41d4-a716-446655440000/bucket").unwrap();
    let provider = state.vfs().provider_for(&uri).unwrap();

    if let Some(value) = previous {
        std::env::set_var("FILEOCTOPUS_ENABLE_NETWORK", value);
    } else {
        std::env::remove_var("FILEOCTOPUS_ENABLE_NETWORK");
    }

    assert_eq!(provider.id().as_str(), "s3");
}

#[test]
fn boot_registers_each_cataloged_network_provider_when_network_is_enabled() {
    let _env_guard = crate::ENV_LOCK.lock().unwrap();
    let previous = std::env::var("FILEOCTOPUS_ENABLE_NETWORK").ok();
    std::env::set_var("FILEOCTOPUS_ENABLE_NETWORK", "1");
    let dir = tempfile::tempdir().unwrap();
    let paths = AppPaths {
        config_dir: dir.path().join("config"),
        data_dir: dir.path().join("data"),
        log_dir: dir.path().join("logs"),
        history_db: dir.path().join("history.sqlite"),
        preferences_db: dir.path().join("preferences.sqlite"),
        navigation_db: dir.path().join("navigation.sqlite"),
        network_db: dir.path().join("network.sqlite"),
        terminal_db: dir.path().join("terminal.sqlite"),
    };
    let state = AppCore::boot_with_paths(paths).unwrap();

    for scheme in crate::network_provider_schemes() {
        let uri = ResourceUri::parse(&format!(
            "{}://550e8400-e29b-41d4-a716-446655440000/",
            scheme
        ))
        .unwrap();
        let provider = state.vfs().provider_for(&uri).unwrap();
        assert_eq!(provider.id().as_str(), scheme);
    }

    if let Some(value) = previous {
        std::env::set_var("FILEOCTOPUS_ENABLE_NETWORK", value);
    } else {
        std::env::remove_var("FILEOCTOPUS_ENABLE_NETWORK");
    }
}

#[test]
fn boot_does_not_register_sftp_provider_when_network_is_disabled() {
    let _env_guard = crate::ENV_LOCK.lock().unwrap();
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
        terminal_db: dir.path().join("terminal.sqlite"),
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
fn boot_does_not_register_smb_provider_when_network_is_disabled() {
    let _env_guard = crate::ENV_LOCK.lock().unwrap();
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
        terminal_db: dir.path().join("terminal.sqlite"),
    };
    let state = AppCore::boot_with_paths(paths).unwrap();
    let uri = ResourceUri::parse("smb://550e8400-e29b-41d4-a716-446655440000/share").unwrap();
    let error = match state.vfs().provider_for(&uri) {
        Ok(_) => panic!("expected smb provider to be unavailable when network is disabled"),
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
fn boot_does_not_register_s3_provider_when_network_is_disabled() {
    let _env_guard = crate::ENV_LOCK.lock().unwrap();
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
        terminal_db: dir.path().join("terminal.sqlite"),
    };
    let state = AppCore::boot_with_paths(paths).unwrap();
    let uri = ResourceUri::parse("s3://550e8400-e29b-41d4-a716-446655440000/bucket").unwrap();
    let error = match state.vfs().provider_for(&uri) {
        Ok(_) => panic!("expected s3 provider to be unavailable when network is disabled"),
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
        local_vfs(),
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
            batch_renames: Vec::new(),
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
fn cancelled_operation_is_persisted_as_cancelled() {
    let dir = tempfile::tempdir().unwrap();
    let runtime = OperationRuntime::new(
        local_vfs(),
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
            batch_renames: Vec::new(),
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
fn write_text_file_is_persisted_as_completed_operation() {
    let dir = tempfile::tempdir().unwrap();
    let runtime = OperationRuntime::new(
        local_vfs(),
        OperationHistoryRepository::new(dir.path().join("history.sqlite")).unwrap(),
    );
    let destination = dir.path().join("note.txt");
    let destination_uri = ResourceUri::from_local_path(&destination).unwrap();
    let (sender, receiver) = mpsc::channel();

    runtime
        .write_text_file_atomic(
            destination_uri.clone(),
            b"saved content".to_vec(),
            Arc::new(move |event| {
                let _ = sender.send(event);
            }),
        )
        .unwrap();

    let mut saw_progress = false;
    loop {
        let event = receiver.recv_timeout(Duration::from_secs(5)).unwrap();

        match event {
            JobEvent::Progress(progress) => {
                saw_progress = true;
                assert_eq!(
                    progress.operation_kind,
                    vfs::FileOperationKind::WriteTextFile
                );
                assert_eq!(progress.completed_items, 1);
                assert_eq!(progress.completed_bytes, 13);
            }
            JobEvent::Completed(completed) => {
                assert_eq!(
                    completed.operation_kind,
                    vfs::FileOperationKind::WriteTextFile
                );
                break;
            }
            _ => {}
        }
    }

    assert!(saw_progress);
    assert_eq!(
        std::fs::read_to_string(&destination).unwrap(),
        "saved content"
    );
    let history = runtime.recent_history(10);
    assert_eq!(history[0].operation_kind, "WriteTextFile");
    assert_eq!(history[0].status, "completed");
    assert_eq!(
        history[0].representative_source_path.as_deref(),
        Some(destination_uri.display_path().as_str())
    );
}

#[test]
fn planned_operation_is_removed_after_start() {
    let dir = tempfile::tempdir().unwrap();
    let history_path = dir.path().join("history.sqlite");
    let runtime = OperationRuntime::new(
        local_vfs(),
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
            batch_renames: Vec::new(),
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
