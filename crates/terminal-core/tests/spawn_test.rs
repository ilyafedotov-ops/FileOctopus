use std::sync::{Arc, Mutex};
use std::time::Duration;

use terminal_core::{
    SpawnTerminalRequest, TerminalError, TerminalErrorCode, TerminalEvent, TerminalService,
    TerminalSize,
};

const TEST_OWNER: &str = "main";

#[test]
#[ignore = "requires a working PTY and interactive shell"]
fn spawn_shell_emits_output() {
    let service = Arc::new(TerminalService::new());
    let rx = service.take_event_receiver().expect("event receiver");
    let cwd = std::env::current_dir().expect("cwd");
    let id = service
        .spawn(SpawnTerminalRequest {
            cwd,
            cols: 80,
            rows: 24,
            shell: Some("/bin/sh".to_string()),
            args: Some(Vec::new()),
            owner: TEST_OWNER.to_string(),
        })
        .expect("spawn");

    let captured = Arc::new(Mutex::new(Vec::new()));
    let captured_clone = captured.clone();
    let service_clone = service.clone();
    std::thread::spawn(move || {
        while let Ok(event) = rx.recv() {
            match event {
                TerminalEvent::Output {
                    id: event_id, data, ..
                } if event_id == id => {
                    captured_clone.lock().unwrap().extend(data);
                }
                TerminalEvent::Exit { id: event_id, .. } if event_id == id => break,
                _ => {}
            }
        }
        let _ = service_clone.kill(id, TEST_OWNER);
    });

    std::thread::sleep(Duration::from_millis(100));
    service
        .write(id, TEST_OWNER, b"echo terminal-core-test\n")
        .expect("write");

    std::thread::sleep(Duration::from_millis(500));
    let bytes = captured.lock().unwrap().clone();
    let output = String::from_utf8_lossy(&bytes);
    assert!(output.contains("terminal-core-test"));

    service.kill(id, TEST_OWNER).expect("kill");
}

#[test]
#[ignore = "requires a working PTY and interactive shell"]
fn kill_actually_terminates_child() {
    let service = Arc::new(TerminalService::new());
    let _rx = service.take_event_receiver().expect("event receiver");
    let cwd = std::env::current_dir().expect("cwd");
    let id = service
        .spawn(SpawnTerminalRequest {
            cwd,
            cols: 80,
            rows: 24,
            shell: Some("/bin/sh".to_string()),
            args: Some(Vec::new()),
            owner: TEST_OWNER.to_string(),
        })
        .expect("spawn");

    std::thread::sleep(Duration::from_millis(100));
    service.write(id, TEST_OWNER, b"sleep 60\n").expect("write");
    std::thread::sleep(Duration::from_millis(100));
    service.kill(id, TEST_OWNER).expect("kill");
    assert!(!service.contains(id));
}

#[test]
fn resize_rejects_zero_dimensions() {
    let service = TerminalService::new();
    let _rx = service.take_event_receiver();
    let cwd = std::env::temp_dir();
    let id = service
        .spawn(SpawnTerminalRequest {
            cwd,
            cols: 80,
            rows: 24,
            shell: None,
            args: None,
            owner: TEST_OWNER.to_string(),
        })
        .expect("spawn");
    let result = service.resize(id, TEST_OWNER, TerminalSize { cols: 0, rows: 10 });
    assert!(result.is_err());
    let _ = service.kill(id, TEST_OWNER);
}

#[test]
fn write_rejects_wrong_owner() {
    let service = TerminalService::new();
    let _rx = service.take_event_receiver();
    let cwd = std::env::temp_dir();
    let id = service
        .spawn(SpawnTerminalRequest {
            cwd,
            cols: 80,
            rows: 24,
            shell: None,
            args: None,
            owner: TEST_OWNER.to_string(),
        })
        .expect("spawn");
    let result = service.write(id, "other-window", b"x");
    assert!(result.is_err());
    let _ = service.kill(id, TEST_OWNER);
}

#[test]
fn authentication_failed_has_distinct_error_code() {
    let error = TerminalError::authentication_failed("bad credentials");
    assert_eq!(error.code, TerminalErrorCode::AuthenticationFailed);
    assert_eq!(error.code.as_str(), "authentication_failed");
}
