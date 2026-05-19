# Terminal + CLI Feature — Architecture & Security Review

**Date:** 2026-05-19
**Reviewer:** Architecture/security review
**Scope:** New terminal/PTY feature and `fileoctopus-cli` binary on `main`
**Affected components:**

- `crates/terminal-core/` (new)
- `apps/desktop-tauri/src-tauri/src/commands/terminal.rs` (new)
- `crates/platform/src/terminal_external.rs` (new)
- `apps/cli/` (new tests + expanded `main.rs`)
- `crates/app-core/src/lib.rs` (TerminalService wired into `AppState`)
- `crates/app-ipc/src/lib.rs` (new DTOs + error codes)
- `packages/ts-api/src/clients/terminal.ts` (new)
- `packages/frontend/src/terminal/`, `packages/frontend/src/app/providers/TerminalProvider.tsx` (new)
- `apps/desktop-tauri/src-tauri/src/emit.rs` (used by terminal event bridge)

---

## Executive summary

The terminal feature respects the project's trust-boundary invariants (Rust owns the privileged side, TS is a UI shell, `ResourceUri` is validated at every IPC entry, errors flow through the stable `IpcError` catalog). DTO mirroring across `app-ipc`, `commandMap.ts`, and the Tauri handler set is complete.

However, the implementation has **three high-severity defects** that should be fixed before this is exercised at scale:

1. **`TerminalService::kill()` does not actually terminate the child process.** Closing a tab leaks the shell.
2. **Broadcast-channel lag silently halts ALL terminal output** for every session because the event-bridge receiver exits on `RecvError::Lagged`.
3. **Windows external-terminal fallback is vulnerable to command injection** through cmd.exe re-parsing of the `/K` argument.

Plus several medium- and low-severity findings around defense-in-depth (CSP, session-ownership checks, `WebLinksAddon` URL policy) and architectural cleanup.

This review enumerates each finding with code citations, an exploit/impact sketch, and a concrete fix (with code).

---

## Priority table

| ID  | Severity   | Title                                                                | File / line                                               | Fix effort    |
| --- | ---------- | -------------------------------------------------------------------- | --------------------------------------------------------- | ------------- |
| A1  | **High**   | `kill()` doesn't kill the child — process leak                       | `crates/terminal-core/src/service.rs:223-228`             | Small         |
| A2  | **High**   | Broadcast `Lagged` exits the event bridge — total output stall       | `service.rs:86,93` + `commands/terminal.rs:109-137`       | Small-medium  |
| S1  | **High**   | Windows `cmd.exe /K` command injection in external terminal fallback | `crates/platform/src/terminal_external.rs:46-52`          | Small         |
| S2  | Medium     | `csp: null` + raw `webview.eval` payload interpolation is fragile    | `tauri.conf.json:22`, `src-tauri/src/emit.rs:30-56`       | Small         |
| S3  | Medium     | No ownership check on `sessionId` — any IPC caller can drive any PTY | `commands/terminal.rs:62-107`                             | Medium        |
| A3  | Medium     | Pre-subscription output frames silently dropped                      | `service.rs:160-165`                                      | Small         |
| S6  | Low-Medium | `WebLinksAddon` link policy unconstrained                            | `packages/frontend/src/terminal/TerminalView.tsx:41`      | Small         |
| A4  | Low        | CLI README example `pnpm cli -- list .` fails on relative path       | `apps/cli/README.md:14`                                   | Trivial       |
| A5  | Low        | Duplicate global `onExit` subscribers (provider + per-view)          | `TerminalProvider.tsx:151-184` + `TerminalView.tsx:82-89` | Small         |
| S4  | Low        | `SHELL` env trusted blindly                                          | `crates/terminal-core/src/shell.rs:3-8`                   | Trivial (doc) |
| S5  | Low        | No working-directory permission check on spawn                       | `commands/terminal.rs:29-39`                              | Trivial (doc) |
| A6  | Trivial    | CLI uses `rt-multi-thread` for a one-shot binary                     | `apps/cli/Cargo.toml:15`                                  | Trivial       |

---

## What's working well (worth keeping)

- **Trust-boundary discipline.** `terminal-core` has no Tauri or IPC dependency; it's a leaf domain crate. The Tauri handler layer converts URIs via `ResourceUri::parse` → `to_local_path()` and validates `is_dir()` before touching `portable-pty`.
- **DTOs mirror across the boundary.** `TerminalSpawnRequest`/`Response`, `TerminalWriteRequest`, `TerminalResizeRequest`, `TerminalKillRequest`, `TerminalOutputEventDto`, `TerminalExitEventDto` are defined once in `crates/app-ipc` with `#[serde(rename_all = "camelCase")]` and mirrored verbatim in `packages/ts-api/src/types.ts`. `commandMap.ts` translates the dotted IPC names. Error codes are appended to the catalog and pass the `unique codes` test.
- **Binary-safe transport.** Both write and output paths base64-encode the byte stream — the TextEncoder→btoa pattern in `TerminalView.tsx:60-65` is the canonical way to send arbitrary bytes through JSON.
- **Embedded vs. external terminal split.** The PTY path is _local-only_ — `TerminalProvider.openEmbeddedTerminal` rejects remote URIs at the UI layer (`isRemoteUri(uri)`), and `local_directory()` re-validates server-side. The remote case routes through the external-terminal helper instead.
- **CLI blast radius is small.** `apps/cli` only depends on `vfs`, `fs-core::LocalFsProvider`, and `app-ipc` types. It uses `provider.list` / `provider.stat` directly and exposes only read-only subcommands (`list`, `stat`, `version`). It deliberately does not touch `app-core::OperationRuntime`, so the CLI cannot launch mutating file jobs.

---

## High-severity findings

### A1 — `TerminalService::kill()` does not terminate the child

**Where:** `crates/terminal-core/src/service.rs:223-228`

```rust
pub fn kill(&self, id: TerminalId) -> Result<(), TerminalError> {
    if self.sessions.remove(&id).is_none() {
        return Err(TerminalError::not_found());
    }
    Ok(())
}
```

**Why it's broken.** `kill()` only removes the `SessionState` from the `DashMap`. The shell process was moved into the reader thread at `service.rs:127` (`let mut child = slave.spawn_command(command)…`) and the thread holds a _cloned_ reader (`master.try_clone_reader()`, line 132). Dropping the `master` does not close the cloned reader's underlying file descriptor on most platforms, and even if it did, the child process is independent of the master file descriptor.

Result: the shell continues running until it exits on its own (Ctrl-D, `exit`, OS reaping). For users who close a tab while a long-running command (e.g., `tail -f`, `pytest`, `cargo build`) is in flight, the process leaks.

**Fix.** Keep the child handle in `SessionState` and call `kill()` on it from `kill()`. Skeleton:

```rust
struct SessionState {
    writer: Arc<SessionWriter>,
    master: Mutex<Option<Box<dyn portable_pty::MasterPty + Send>>>,
    child: Mutex<Option<Box<dyn portable_pty::Child + Send + Sync>>>, // ADD
}

// In spawn(), instead of moving `child` into the thread, hold an Arc<Mutex<>>:
let child = Arc::new(Mutex::new(Some(child)));
let child_for_thread = child.clone();

self.sessions.insert(id, SessionState {
    writer: session_writer.clone(),
    master: Mutex::new(Some(master)),
    child: Mutex::new(None), // populated below
});

// Reader thread waits via the same Arc:
std::thread::spawn(move || {
    // ... existing read loop ...
    let exit_code = child_for_thread
        .lock()
        .ok()
        .and_then(|mut guard| guard.as_mut().map(|c| c.wait().ok().map(|s| s.exit_code() as i32)))
        .flatten();
    // ... emit Exit ...
});

// kill():
pub fn kill(&self, id: TerminalId) -> Result<(), TerminalError> {
    let session = self.sessions.remove(&id).ok_or_else(TerminalError::not_found)?;
    if let Ok(mut guard) = session.1.child.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
        }
    }
    Ok(())
}
```

`portable_pty::Child` exposes `kill()` and is `Send + Sync` on the platforms this app targets. On Unix the kill arrives as SIGHUP/SIGKILL depending on the platform's `Child::kill` implementation — sufficient to reap interactive shells.

**Test.** Spawn a session, write `sleep 100\n`, call `kill()`, then `child.wait()` (in the reader thread) should return promptly. Verify the process is gone via `kill -0 <pid>`.

---

### A2 — Broadcast lag exits the event bridge, halting all PTY output

**Where:** `crates/terminal-core/src/service.rs:86, 93` + `apps/desktop-tauri/src-tauri/src/commands/terminal.rs:109-137`

```rust
// service.rs
let (events, _) = broadcast::channel(256);
// ...
pub fn subscribe(&self) -> broadcast::Receiver<TerminalEvent> {
    self.events.subscribe()
}
```

```rust
// commands/terminal.rs
pub fn start_terminal_event_bridge(app: AppHandle, state: Arc<AppState>) {
    let mut rx = state.terminals().subscribe();
    tauri::async_runtime::spawn(async move {
        while let Ok(event) = rx.recv().await {
            // ... emit_with_eval ...
        }
    });
}
```

**Why it's broken.** `broadcast::Receiver::recv` returns `Err(RecvError::Lagged(n))` when the consumer can't keep up with the 256-frame ring buffer. The `while let Ok(...)` exits the loop on `Lagged` — and from that point forward, **no terminal output from any session reaches the webview**, until app restart.

With 16 KB chunks and the relatively expensive `emit_with_eval` path (JSON-encode + `app.emit` + `webview.eval` of a synthesized JS snippet), a busy command like `cat large.log` or `find / -type f` can saturate the channel.

Severity is High because:

- It's a "the terminal silently stops working" failure that's hard to attribute to a specific input.
- A user who sees only partial output may make decisions based on truncated data (e.g., `aws sts get-caller-identity`, `git log`).
- The failure is sticky for the rest of the process lifetime.

**Fix (minimal).** Handle `Lagged` explicitly and continue:

```rust
use tokio::sync::broadcast::error::RecvError;

tauri::async_runtime::spawn(async move {
    loop {
        match rx.recv().await {
            Ok(event) => { /* existing branches */ }
            Err(RecvError::Lagged(skipped)) => {
                telemetry::error(&format!(
                    "terminal event bridge lagged, dropped {skipped} frames"
                ));
                // Optionally inject a banner into each active session here:
                // emit a synthetic Output event with red-text "[terminal lagged]".
                continue;
            }
            Err(RecvError::Closed) => break,
        }
    }
});
```

**Fix (preferred).** Replace the global broadcast with per-session `mpsc::Sender`. Architecturally cleaner — each tab gets its own backpressure-aware channel and there's no cross-session fan-out. Sketch:

```rust
// In SessionState:
output_tx: mpsc::Sender<TerminalEvent>,

// In TerminalService:
sessions: DashMap<TerminalId, SessionState>,
new_session_tx: mpsc::Sender<(TerminalId, mpsc::Receiver<TerminalEvent>)>,

// Bridge subscribes to `new_session_tx` and spawns a per-session forwarder.
```

This removes the implicit O(N²) routing (every receiver sees every other session's bytes and filters in JS at `TerminalView.tsx:71-77`), and the channel-full case becomes session-local.

Either fix works, but if A2 isn't paired with A3 (next finding), short bursts at spawn time still get lost.

---

### S1 — Windows external-terminal fallback: command injection

**Where:** `crates/platform/src/terminal_external.rs:46-52`

```rust
#[cfg(target_os = "windows")]
{
    if Command::new("wt.exe")
        .args(["-d", &path.to_string_lossy()])
        .spawn()
        .is_ok()
    {
        return Ok(());
    }
    if Command::new("cmd.exe")
        .args(["/K", &format!("cd /d {}", path.display())])
        .spawn()
        .is_ok()
    {
        return Ok(());
    }
```

**Why it's broken.** `cmd.exe /K <string>` runs `<string>` as a command line — and _cmd re-parses_ that string, expanding shell metacharacters (`&`, `|`, `<`, `>`, `^`, `%VAR%`, etc.). If the user clicks "Open in terminal" on a folder named `foo & calc.exe`, the executed command becomes:

```
cd /d C:\Users\…\foo & calc.exe
```

…which runs `calc.exe`. Same applies to `& powershell -enc <base64>`, `& curl ... | iex`, etc. The user does not need to type anything — clicking the menu item is sufficient.

The `wt.exe` path is safe (Windows Terminal receives `-d` and the path as separate argv entries), but if Windows Terminal isn't installed (Windows 10 default, Windows Server, sandboxed environments), the cmd fallback fires.

**Exploit prerequisite.** Local attacker can create a directory with metacharacters in its name and trick the user into "Open in terminal" — or a malicious archive extracted into the user's tree creates the directory automatically. The user does not need elevated privileges, but the spawned process runs at the user's privilege level.

**Fix (option 1, simplest).** Reject any path containing cmd.exe metacharacters before falling back to `cmd.exe`:

```rust
fn cmd_path_is_safe(path: &Path) -> bool {
    let s = path.to_string_lossy();
    !s.chars().any(|c| matches!(c, '&' | '|' | '<' | '>' | '^' | '"' | '%' | '\n' | '\r'))
}

// In the fallback:
if !cmd_path_is_safe(path) {
    return Err(ExternalTerminalError(
        "directory name contains characters not safe for cmd.exe; install Windows Terminal".to_string(),
    ));
}
if Command::new("cmd.exe")
    .args(["/K", &format!("cd /d \"{}\"", path.display())])
    .spawn()
    .is_ok()
{
    return Ok(());
}
```

Note the addition of double-quotes around the path. Even with metacharacters filtered, quoting protects against spaces.

**Fix (option 2, preferred).** Use `start` builtin via `cmd.exe /D /C`, which handles quoted paths better, _and_ still validate the path:

```rust
Command::new("cmd.exe")
    .args(["/D", "/C", "start", "", "/D", &path.to_string_lossy(), "cmd.exe"])
```

The first empty string is the optional window title (required because `start` treats the first quoted arg as a title).

**Fix (option 3, cleanest).** Skip cmd.exe entirely. Use `ShellExecuteW` from `windows-rs` with `lpDirectory` set to the path — no shell parsing, no metacharacter risk:

```rust
use windows::core::*;
use windows::Win32::UI::Shell::ShellExecuteW;
use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

let path_w: Vec<u16> = path.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
let cmd_w: Vec<u16> = "cmd.exe\0".encode_utf16().collect();
let op_w: Vec<u16> = "open\0".encode_utf16().collect();

unsafe {
    let result = ShellExecuteW(
        None,
        PCWSTR(op_w.as_ptr()),
        PCWSTR(cmd_w.as_ptr()),
        PCWSTR::null(),
        PCWSTR(path_w.as_ptr()),
        SW_SHOWNORMAL,
    );
    // result.0 > 32 means success per ShellExecute docs
}
```

**Test.** Add a Windows-targeted unit test with a path like `C:\\tmp\\foo & echo INJECTED > C:\\tmp\\proof.txt` and confirm the fallback returns an error rather than executing.

---

## Medium-severity findings

### S2 — `csp: null` plus raw payload interpolation into `webview.eval()`

**Where:** `apps/desktop-tauri/src-tauri/tauri.conf.json:22`, `src-tauri/src/emit.rs:30-56`

```rust
// emit.rs
let json = serde_json::to_string(&payload).ok()?;
// ...
let js = format!(
    r#"(function() {{
    try {{
        var payload = {json};
        var name = '{event_lit}';
        // ...
    }} catch (_) {{}}
}})();"#
);
webview.eval(&js)
```

**Why it matters today.** For terminal events specifically this is currently safe:

- `session_id` is a UUID, not user-controlled.
- `data` is base64 (`[A-Za-z0-9+/=]`), which cannot embed `</script>`, `"`, `\`, or the ` `/` ` line separators that terminate strings in pre-ES2019 JS.

**Why it's fragile.** The eval path is used for _every_ event (jobs, network status, folder size, recursive search, etc.). Two of these (`fileOperation:job:*` and `fs:recursiveSearch:*`) carry path strings under user control, and serde*json escapes them. If a future change adds a `String` field that is \_not* base64, an attacker who controls a filename gets a JS-injection primitive only one byte-class change away.

Compounding factor: `tauri.conf.json:22` is `"csp": null` — fully permissive. That's a pre-existing choice but it amplifies the impact of any future eval-injection.

**Fix (defense in depth, layered).**

1. **Use `JSON.parse` inside the eval'd snippet.** This neutralizes ` `/` ` and ensures the eval'd payload cannot be re-interpreted as code:

   ```rust
   let safe = serde_json::to_string(&json).unwrap(); // double-encoded: string of JSON
   let js = format!(r#"(function() {{
       try {{
           var payload = JSON.parse({safe});
           // ...
       }} catch (_) {{}}
   }})();"#);
   ```

   `safe` is now a JS string literal (correctly escaped), and `JSON.parse` parses the inner JSON. The eval can't execute arbitrary JS even if `data` contained `</script>` or ` `.

2. **Set a CSP.** Even a permissive one helps:

   ```json
   "csp": "default-src 'self' tauri: ipc: 'unsafe-eval'; img-src 'self' data: tauri:; style-src 'self' 'unsafe-inline'; script-src 'self'"
   ```

   `'unsafe-eval'` is still needed for `webview.eval()` to work, but you block remote script sources. Better: remove the `webview.eval()` fallback if Tauri's native `app.emit()` works on your target platforms — comment at `emit.rs:5-11` says it's a WebKitGTK workaround, so this might be Linux-only.

3. **For terminal events specifically**, consider an alternate IPC path that doesn't go through `emit_with_eval`. Terminal output is the highest-bandwidth event in the system; using the slower fallback for every byte is wasteful and concentrates risk.

---

### S3 — No ownership check on `sessionId`

**Where:** `apps/desktop-tauri/src-tauri/src/commands/terminal.rs:62-107`

```rust
pub async fn terminal_write(
    request: TerminalWriteRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<TerminalOkResponse, IpcError> {
    let id = parse_session_id(&request.session_id)?;
    let data = BASE64.decode(&request.data)?;
    state.terminals().write(id, &data).map_err(terminal_ipc_error)?;
    Ok(TerminalOkResponse { success: true })
}
```

**Why it's a risk.** A UUID v4 is unguessable, so the `sessionId` acts as a capability token. This is acceptable in a single-window, single-user desktop app, but:

- Any frontend code (including a future plugin, an embedded WebView, or a successful XSS payload — which is more reachable today because of S2/CSP=null) can listen for `terminal:output` events to harvest all live session IDs, then send arbitrary bytes to any session via `terminal_write`.
- There is no enforcement that the _spawning_ window is also the _writing_ window. A second Tauri window (if you ever add one) would have free access to the first window's terminals.

**Fix.** Track an owning `webview_label` per session and reject IPC calls coming from a different label.

```rust
// In TerminalService.spawn(), accept owner:
pub fn spawn(&self, request: SpawnTerminalRequest, owner: String) -> Result<TerminalId, TerminalError>

// Store owner in SessionState; check on write/resize/kill:
fn ensure_owner(&self, id: TerminalId, caller: &str) -> Result<(), TerminalError> {
    let session = self.sessions.get(&id).ok_or_else(TerminalError::not_found)?;
    if session.owner != caller {
        return Err(TerminalError::not_found()); // intentionally indistinguishable
    }
    Ok(())
}

// In the Tauri command, pull the webview label from the Window argument:
pub async fn terminal_write(
    request: TerminalWriteRequest,
    window: tauri::Window,
    state: State<'_, Arc<AppState>>,
) -> Result<TerminalOkResponse, IpcError> {
    let owner = window.label().to_string();
    // ... use owner ...
}
```

Bridge filtering: in `start_terminal_event_bridge`, only emit `TERMINAL_*` events to the owning webview using `app.emit_to(&owner, ...)` instead of `app.emit(...)`.

---

### A3 — Pre-subscription output frames are silently lost

**Where:** `crates/terminal-core/src/service.rs:160-165`

```rust
std::thread::spawn(move || {
    let mut buffer = [0u8; OUTPUT_CHUNK_BYTES];
    loop {
        match reader.read(&mut buffer) {
            Ok(0) => break,
            Ok(count) => {
                let _ = events.send(TerminalEvent::Output { /* ... */ });
            }
            // ...
        }
    }
```

**Why it's broken.** `broadcast::Sender::send` returns `Err(SendError)` when there are no subscribers. The `let _ = ...` swallows it. There's no race protection between `spawn()` and `start_terminal_event_bridge()` — the bridge starts in `lib.rs:32` _after_ `AppCore::boot()`, but the boot itself creates `TerminalService` with no subscriber. As long as `spawn()` is not called before `start_terminal_event_bridge()`, this is fine.

However, even after the bridge attaches, there's a smaller window: between `spawn_command(command)` (line 128) and the bridge actually polling `rx.recv()`. Login shells print a banner immediately. If the broadcast ring already has 256 frames buffered from another active session, the new banner could be elided.

**Fix (small).** Detach the bridge subscription _before_ the first session can be spawned, and stash subscribed-but-not-yet-emitted bytes in a per-session prelude buffer that's flushed when the bridge attaches.

**Fix (larger, preferred).** Move to per-session `mpsc` channels (see A2). Each session owns its own channel; pre-subscription buffering is local; no other session is affected.

---

### S6 — `WebLinksAddon` link policy is the default

**Where:** `packages/frontend/src/terminal/TerminalView.tsx:41`

```ts
terminal.loadAddon(new WebLinksAddon());
```

**Why it matters.** `WebLinksAddon` makes URLs in shell output clickable. The default link handler calls `window.open(url)`. xterm.js's URL parser does block `javascript:` and `data:` URLs, but it _does_ allow `file://`, `http://`, `https://`, `ftp://`. In a Tauri webview, `window.open('file:///etc/passwd')` may succeed depending on the platform and Tauri's WebView2/WKWebView config.

A malicious tool can print `file:///path/to/sensitive` into your terminal, the user clicks it, and the file opens in the WebView (or external browser).

**Fix.** Pass an explicit handler that gates schemes:

```ts
const SAFE_SCHEMES = new Set(["http:", "https:"]);

terminal.loadAddon(
  new WebLinksAddon((event, uri) => {
    try {
      const url = new URL(uri);
      if (!SAFE_SCHEMES.has(url.protocol)) {
        return;
      }
      // Route through Tauri's opener so user policy applies
      void client.fs.openDefault({ uri }); // or window.open(uri)
    } catch {
      /* invalid URL — ignore */
    }
  }),
);
```

---

## Low-severity findings

### A4 — CLI README example is broken

**Where:** `apps/cli/README.md:14`

The README shows `pnpm cli -- list .`. But `apps/cli/src/main.rs:93-95` does:

```rust
fn uri_from_path(path: PathBuf) -> Result<ResourceUri, CliError> {
    ResourceUri::from_local_path(&path).map_err(|error| CliError::user(error.to_string()))
}
```

Per ADR-0003 and the CLAUDE.md invariant, `ResourceUri::from_local_path` rejects relative paths. The example fails immediately.

**Fix.** Canonicalize in `uri_from_path`:

```rust
fn uri_from_path(path: PathBuf) -> Result<ResourceUri, CliError> {
    let abs = std::fs::canonicalize(&path)
        .map_err(|error| CliError::user(format!("cannot resolve {}: {error}", path.display())))?;
    ResourceUri::from_local_path(&abs).map_err(|error| CliError::user(error.to_string()))
}
```

This matches user expectation (`list .` works) and preserves the absolute-only invariant inside `ResourceUri`.

---

### A5 — Duplicate global `onExit` subscribers

**Where:** `packages/frontend/src/app/providers/TerminalProvider.tsx:151-184` (provider-level) and `packages/frontend/src/terminal/TerminalView.tsx:82-89` (per-view).

Both subscribe to `terminal:exit`. The reducer is idempotent for `setSessionExited`, so today it just runs twice. But with N open terminal tabs you have N + 1 receivers all filtering by `sessionId`, and the `onExit` callback in `TerminalView.tsx:86` runs `onExit(event.exitCode)` even when `event.sessionId !== sessionId` is false (so the prop chain runs the parent's exit handler from the per-view subscription too).

**Fix.** Subscribe once at the provider level. Maintain a `Map<sessionId, (exitCode) => void>` for per-view handlers; the provider's single listener routes events to the right handler:

```ts
// In TerminalProvider:
const viewHandlers = useRef(new Map<string, (code?: number | null) => void>());

const registerViewExitHandler = useCallback(
  (sessionId: string, handler: (code?: number | null) => void) => {
    viewHandlers.current.set(sessionId, handler);
    return () => {
      viewHandlers.current.delete(sessionId);
    };
  },
  [],
);

// In the existing onExit listener, after dispatching to reducer:
const handler = viewHandlers.current.get(event.sessionId);
handler?.(event.exitCode);

// Expose registerViewExitHandler in context; TerminalView uses it instead of client.terminal.onExit.
```

Same pattern for `onOutput`.

---

### S4 — `SHELL` env is trusted blindly

**Where:** `crates/terminal-core/src/shell.rs:3-8`

```rust
pub fn default_shell() -> String {
    if let Ok(shell) = std::env::var("SHELL") {
        if !shell.is_empty() {
            return shell;
        }
    }
    // ... fallbacks ...
}
```

**Risk.** If `SHELL` is `/tmp/evil`, every embedded terminal launches `evil`. This matches the OS convention and is generally acceptable, but a privilege-escalation chain that controls user env (a malicious dotfile or config import) gets persistent embedded-shell hijack.

**Fix (lightweight).** Document the assumption in a `// SAFETY:` comment. Optional defense:

```rust
pub fn default_shell() -> String {
    if let Ok(shell) = std::env::var("SHELL") {
        let path = std::path::Path::new(&shell);
        if path.is_absolute() && path.exists() && !shell.starts_with("/tmp/") {
            return shell;
        }
    }
    // fallbacks...
}
```

---

### S5 — No working-directory permission check

**Where:** `apps/desktop-tauri/src-tauri/src/commands/terminal.rs:29-39`

```rust
fn local_directory(uri_str: &str) -> Result<std::path::PathBuf, IpcError> {
    let uri = ResourceUri::parse(uri_str).map_err(IpcError::from)?;
    let path = uri.to_local_path().map_err(IpcError::from)?;
    if !path.is_dir() {
        return Err(IpcError::new(error_codes::NOT_FOUND, /* ... */));
    }
    Ok(path)
}
```

A frontend-controlled spawn can root a shell at `/Library/Keychains`, `/private/etc`, etc. The shell runs as the user, so this isn't a privilege escalation, but it widens the reachable attack surface from JS context.

**Fix (advisory).** Either:

- Document the threat model (current user privilege, no sandbox), or
- Reject paths under known macOS-protected locations (TCC-restricted folders) to surface a clearer error.

---

### A6 — CLI uses `rt-multi-thread`

**Where:** `apps/cli/Cargo.toml:15`

```toml
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
```

For a one-shot CLI that does a single `list` or `stat`, the current-thread runtime starts faster and uses less memory. Not a defect, just a minor cost.

**Fix.**

```toml
tokio = { version = "1", features = ["macros", "rt"] }
```

And in `main.rs`:

```rust
#[tokio::main(flavor = "current_thread")]
async fn main() -> ExitCode { /* ... */ }
```

---

## Recommended test additions

These tests would lock in the fixes above and prevent regressions:

1. **`crates/terminal-core/tests/spawn_test.rs`** — Add:
   - `kill_actually_terminates_child` (verifies A1 fix). Spawn `sleep 60`, kill, then assert `child.wait()` returns within 1s.
   - `bridge_survives_lagged_consumer` (verifies A2 fix). Spawn a session that writes >256 chunks while a slow consumer is connected; assert subsequent sessions still receive output.
   - `pre_subscription_buffer_preserves_banner` (verifies A3 fix).

2. **`crates/platform/tests/`** — Add (Windows-targeted):
   - `cmd_fallback_rejects_metacharacters` (verifies S1 fix). Try paths containing `&`, `|`, `^`, `>`, `<`, `%`; expect `Err`.

3. **`apps/desktop-tauri/src-tauri/src/commands/terminal.rs`** — Add a unit test for `local_directory()` that rejects non-`local://` schemes (regression guard).

4. **`apps/cli/tests/cli_smoke.rs`** — Add:
   - `list_relative_path_works` (verifies A4 fix). `cargo run -p fileoctopus-cli -- list .` in a temp dir; expect exit 0.

5. **`packages/frontend/tests/`** — Add:
   - `terminalSlice.test.ts` already exists; add a test that closing the active tab when 3 tabs are open picks the previous as active.

---

## Suggested fix order

If applied as separate commits/PRs, in this order:

1. **A1, A2, S1** — high-severity, small diffs, no architectural change. One PR each.
2. **A4, A6** — trivial cleanup. One PR together.
3. **A3, A5** — refactor to per-session channels and centralized subscription. One PR. This also makes A2's lag handling cleaner.
4. **S6** — link policy gate. One PR.
5. **S2** — `JSON.parse` wrapper in `emit_with_eval` + CSP tightening. One PR.
6. **S3** — webview ownership tracking. One PR, requires touching all four terminal commands plus the bridge.
7. **S4, S5** — documentation comments + optional hardening. One PR.

---

## Glossary of code locations referenced

| Symbol                                  | File:line                                                       |
| --------------------------------------- | --------------------------------------------------------------- |
| `TerminalService::spawn`                | `crates/terminal-core/src/service.rs:97-179`                    |
| `TerminalService::write`                | `crates/terminal-core/src/service.rs:181-198`                   |
| `TerminalService::kill`                 | `crates/terminal-core/src/service.rs:223-228`                   |
| `TerminalService::subscribe`            | `crates/terminal-core/src/service.rs:93-95`                     |
| `default_shell`                         | `crates/terminal-core/src/shell.rs:3-34`                        |
| `terminal_spawn` (Tauri)                | `apps/desktop-tauri/src-tauri/src/commands/terminal.rs:42-59`   |
| `terminal_write` (Tauri)                | `apps/desktop-tauri/src-tauri/src/commands/terminal.rs:62-75`   |
| `terminal_resize` (Tauri)               | `apps/desktop-tauri/src-tauri/src/commands/terminal.rs:78-94`   |
| `terminal_kill` (Tauri)                 | `apps/desktop-tauri/src-tauri/src/commands/terminal.rs:97-107`  |
| `start_terminal_event_bridge`           | `apps/desktop-tauri/src-tauri/src/commands/terminal.rs:109-137` |
| `local_directory` (guard)               | `apps/desktop-tauri/src-tauri/src/commands/terminal.rs:29-39`   |
| `open_external_terminal` (Windows)      | `crates/platform/src/terminal_external.rs:37-55`                |
| `emit_with_eval`                        | `apps/desktop-tauri/src-tauri/src/emit.rs:12-62`                |
| `TerminalView` (xterm host)             | `packages/frontend/src/terminal/TerminalView.tsx`               |
| `TerminalProvider`                      | `packages/frontend/src/app/providers/TerminalProvider.tsx`      |
| `TerminalClient` (TS)                   | `packages/ts-api/src/clients/terminal.ts`                       |
| `uri_from_path` (CLI)                   | `apps/cli/src/main.rs:93-95`                                    |
| `AppCore::boot` (wires TerminalService) | `crates/app-core/src/lib.rs:130-183`                            |
