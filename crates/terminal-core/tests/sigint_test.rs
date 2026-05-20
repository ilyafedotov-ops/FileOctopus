use std::sync::mpsc::Receiver;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use terminal_core::{SpawnTerminalRequest, TerminalEvent, TerminalService};

const TEST_OWNER: &str = "main";
const ETX: &[u8] = &[0x03];

fn drain_into(rx: &Receiver<TerminalEvent>, captured: &Mutex<Vec<u8>>, max_wait: Duration) {
    let start = Instant::now();
    while start.elapsed() < max_wait {
        match rx.recv_timeout(Duration::from_millis(50)) {
            Ok(TerminalEvent::Output { data, .. }) => {
                captured.lock().unwrap().extend(&data);
            }
            Ok(TerminalEvent::Exit { .. }) => return,
            Err(_) => {}
        }
    }
}

fn wait_for(
    rx: &Receiver<TerminalEvent>,
    captured: &Mutex<Vec<u8>>,
    timeout: Duration,
    needle: &str,
) -> bool {
    let deadline = Instant::now() + timeout;
    loop {
        {
            let snap = captured.lock().unwrap();
            if String::from_utf8_lossy(&snap).contains(needle) {
                return true;
            }
        }
        let now = Instant::now();
        if now >= deadline {
            return false;
        }
        match rx.recv_timeout(deadline - now) {
            Ok(TerminalEvent::Output { data, .. }) => {
                captured.lock().unwrap().extend(&data);
            }
            Ok(TerminalEvent::Exit { .. }) => return false,
            Err(_) => return false,
        }
    }
}

#[test]
#[ignore = "spawns a real shell; run with `cargo test -p terminal-core --test sigint_test -- --ignored`"]
fn ctrl_c_interrupts_foreground_command() {
    let service = Arc::new(TerminalService::new());
    let rx = service.take_event_receiver().expect("event receiver");
    let cwd = std::env::temp_dir();
    let id = service
        .spawn(SpawnTerminalRequest {
            cwd,
            cols: 80,
            rows: 24,
            shell: Some("/bin/sh".to_string()),
            args: Some(vec!["-i".to_string()]),
            owner: TEST_OWNER.to_string(),
        })
        .expect("spawn");

    let captured: Arc<Mutex<Vec<u8>>> = Arc::new(Mutex::new(Vec::new()));

    // Drain initial shell banner / prompt.
    drain_into(&rx, &captured, Duration::from_millis(300));

    // Trick: build markers from concatenation so the shell prints them assembled,
    // but the literal command text doesn't contain them as substrings.
    // Command (echoed) contains: B"E"FORE, A"F"TER — the printed output contains BEFORE_OUT, AFTER_OUT.
    service
        .write(
            id,
            TEST_OWNER,
            b"printf 'BEFORE'; printf '_'; printf 'OUT\\n'; sleep 30; printf 'AFTER'; printf '_'; printf 'OUT\\n'\n",
        )
        .expect("write sleep");

    let saw_before = wait_for(&rx, &captured, Duration::from_secs(3), "BEFORE_OUT");
    assert!(
        saw_before,
        "expected to see BEFORE_OUT; got: {:?}",
        String::from_utf8_lossy(&captured.lock().unwrap())
    );

    // Snapshot length BEFORE sending Ctrl+C — we want to check whether AFTER_OUT appears
    // AFTER we send the interrupt.
    let pre_ctrl_c_len = captured.lock().unwrap().len();

    // Send Ctrl+C — this is what the IPC `terminal_write` would do with a single 0x03 byte.
    service.write(id, TEST_OWNER, ETX).expect("write ctrl-c");

    // AFTER_OUT should NOT show up within 3 seconds if the interrupt worked.
    let saw_after = wait_for(&rx, &captured, Duration::from_secs(3), "AFTER_OUT");
    let after_len = captured.lock().unwrap().len();
    assert!(
        !saw_after,
        "AFTER_OUT appeared within 3s — Ctrl+C did NOT interrupt the sleep.\n  pre_ctrl_c_len={} post_len={}\n  captured={:?}",
        pre_ctrl_c_len,
        after_len,
        String::from_utf8_lossy(&captured.lock().unwrap())
    );

    // Confirm shell is still alive.
    service
        .write(id, TEST_OWNER, b"printf 'AL'; printf 'IVE_OUT\\n'\n")
        .expect("write alive");
    let saw_alive = wait_for(&rx, &captured, Duration::from_secs(3), "ALIVE_OUT");
    assert!(
        saw_alive,
        "shell did not respond after Ctrl+C; captured={:?}",
        String::from_utf8_lossy(&captured.lock().unwrap())
    );

    let _ = service.kill(id, TEST_OWNER);
}
