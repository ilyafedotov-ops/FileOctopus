# Tauri WebDriver E2E tests

Real end-to-end tests that run against the built Tauri binary (WebKitGTK
WebView on Linux) via `tauri-driver`. Complements the Playwright tests in
`e2e/` which exercise the React UI against Vite preview only.

## Prerequisites

Linux only (Tauri WebDriver does not currently target macOS):

```bash
sudo apt-get install -y webkit2gtk-driver           # provides WebKitWebDriver
cargo install tauri-driver --locked                 # WebDriver proxy
pnpm install                                        # installs @wdio/* deps
```

## Build the binary once

```bash
cargo build --manifest-path apps/desktop-tauri/src-tauri/Cargo.toml
```

The wdio config picks up `target/debug/fileoctopus-desktop` automatically.
Override the path with `TAURI_BIN=…`.

## Run

```bash
# Headed (needs $DISPLAY)
pnpm test:e2e:tauri

# Headless via Xvfb
DISPLAY=:99 pnpm test:e2e:tauri    # Xvfb must already be running on :99
```

Env vars:

- `TAURI_BIN` — path to a pre-built Tauri binary (defaults to debug build).
- `TAURI_DRIVER_PORT` — port for tauri-driver intermediary (default 4444).
- `TAURI_NATIVE_DRIVER` — path to `WebKitWebDriver` (default
  `/usr/bin/WebKitWebDriver`).
- `TAURI_DRIVER_VERBOSE=1` — echo tauri-driver stdout/stderr for debugging.
- `WDIO_LOG_LEVEL=info|debug|trace|warn|error` — wdio runner log level.

## Known upstream issue

`tauri-driver` 2.0.6 + WebKitGTK 4.1 (Ubuntu 24.04 default) currently
hangs during `POST /session` and the request times out with
`hyper::Error(IncompleteMessage)` on the proxy side. The native
`WebKitWebDriver` responds to `GET /status` normally, but session
creation through tauri-driver does not complete. This blocks running
the WDIO suite end-to-end on Linux.

Symptoms checked:

- `WebKitWebDriver --port=N` standalone → `{"ready":true}` on `/status` ✓
- `tauri-driver --port=M --native-driver=...` → `/status` proxies ✓
- `POST /session` with `tauri:options.application` → 30s+ timeout ✗
- Tauri binary launches cleanly under Xvfb (`DISPLAY=:99`) when invoked
  directly — the WebView itself isn't broken, just the WebDriver bridge.

When upstream lands a fix this setup should run as-is. Until then,
prefer the Playwright suite under `e2e/` for browser-level coverage and
treat this folder as the reserved slot for real WebView automation.

References:

- https://github.com/tauri-apps/tauri/issues — search "tauri-driver linux"
- https://v2.tauri.app/develop/tests/webdriver/
