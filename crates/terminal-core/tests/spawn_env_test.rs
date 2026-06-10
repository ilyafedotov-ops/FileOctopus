use std::sync::mpsc::Receiver;
use std::sync::Arc;
use std::time::{Duration, Instant};

use terminal_core::{SpawnTerminalRequest, TerminalEvent, TerminalService};

const TEST_OWNER: &str = "main";

fn spawn_and_capture(
    service: &Arc<TerminalService>,
    rx: &Receiver<TerminalEvent>,
    env: Vec<(String, String)>,
) -> String {
    let id = service
        .spawn(SpawnTerminalRequest {
            cwd: std::env::temp_dir(),
            cwd_uri: None,
            cols: 80,
            rows: 24,
            shell: Some("/bin/sh".to_string()),
            args: Some(vec![
                "-c".to_string(),
                "printf 'TERM=[%s] COLORTERM=[%s]' \"$TERM\" \"$COLORTERM\"".to_string(),
            ]),
            env,
            terminal_profile_id: None,
            title: None,
            owner: TEST_OWNER.to_string(),
        })
        .expect("spawn");

    let mut bytes = Vec::new();
    let deadline = Instant::now() + Duration::from_secs(10);
    while Instant::now() < deadline {
        match rx.recv_timeout(Duration::from_millis(250)) {
            Ok(TerminalEvent::Output {
                id: event_id, data, ..
            }) if event_id == id => {
                bytes.extend(data);
            }
            Ok(TerminalEvent::Exit { id: event_id, .. }) if event_id == id => break,
            Ok(_) => {}
            Err(_) => {}
        }
    }
    let _ = service.kill(id, TEST_OWNER);
    String::from_utf8_lossy(&bytes).into_owned()
}

#[test]
fn local_spawn_provides_xterm_environment() {
    std::env::remove_var("TERM");
    std::env::remove_var("COLORTERM");

    let service = Arc::new(TerminalService::new());
    let rx = service.take_event_receiver().expect("event receiver");

    let output = spawn_and_capture(&service, &rx, Vec::new());
    assert!(
        output.contains("TERM=[xterm-256color]"),
        "shell should see the embedded terminal's TERM, got: {output:?}"
    );
    assert!(
        output.contains("COLORTERM=[truecolor]"),
        "shell should see COLORTERM=truecolor, got: {output:?}"
    );

    let output = spawn_and_capture(
        &service,
        &rx,
        vec![("TERM".to_string(), "vt100".to_string())],
    );
    assert!(
        output.contains("TERM=[vt100]"),
        "explicit TERM from the request must win over the default, got: {output:?}"
    );
}
