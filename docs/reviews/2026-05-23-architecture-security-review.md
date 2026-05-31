# FileOctopus — Architecture & Security Review

_Date: 2026-05-23 · Refreshed: 2026-05-31 · Scope: full codebase, read-only analysis · Lenses: senior software engineer + security engineer_

## Context

This review covers the FileOctopus Tauri v2 desktop file manager from two lenses — **senior
software engineer** and **security engineer**. Rust owns all privileged filesystem/platform
operations; the React 19 + TS frontend is a UI layer talking to Rust over typed IPC. The IPC
layer is the trust boundary.

Findings are graded. Items marked **[verified]** were confirmed by reading the source directly
(file:line cited). Items marked **[reported]** come from codebase exploration and are credible
but not independently re-read line-by-line. Items marked **[resolved]** were fixed before this
review was merged to `main`.

---

## Overall assessment

The architecture is genuinely good: clean crate layering (`vfs` domain → `fs-core`/providers
→ `app-core` runtime → `app-ipc` DTOs → `ts-api` client), a principled **plan-then-execute**
file-operation pipeline, streaming directory listing over mpsc, a stable error-code
vocabulary mirrored end-to-end, and a strict Tauri CSP + minimal capability allowlist. The
boundary model (ADR-0002 no-FS-plugins, ADR-0003 `local://` everywhere) is sound _as a
design_.

The remaining problems are localized, not systemic: **boundary URIs still allow `..`
segments**, **`Mutex` poisoning** can permanently wedge subsystems, selected mutation paths
have **TOCTOU races**, and one frontend event subscription still has an async cleanup race.
Earlier high-priority concerns around diagnostics export containment and unbounded job
threading have since been addressed.

---

## Security findings (security-engineer lens)

### S1 — `export_diagnostics_bundle` destination containment **[resolved, verified] — formerly High**

Original finding: `export_diagnostics_bundle` accepted a raw IPC string path and wrote directly
to it. Current `main` no longer has that raw write path.

Current state:

- `apps/desktop-tauri/src-tauri/src/commands/diagnostics.rs:40` calls
  `resolve_diagnostics_destination` before `write_diagnostics_bundle`.
- `resolve_diagnostics_destination` requires an absolute local path, rejects `..`, requires a
  `.zip` extension, and checks containment against allowed export roots before `create_dir_all`
  or `File::create`.
- `crates/config/src/lib.rs` now rejects relative `diagnosticsExportPath` values and `..`
  segments, with regression tests for both cases.

Residual note: the API reference intentionally documents diagnostics export as a host-path
exception to the usual `ResourceUri` boundary rule. Keep that exception narrow and tested.

### S2 — Boundary `local://` URIs are not normalized; `..` survives **[verified] — Low/Medium (defense-in-depth)**

`crates/vfs/src/lib.rs:863` (`is_valid_local_uri_body`) only checks non-empty / no-NUL /
leading-`/` (or Windows drive). `to_local_path` (same file) is a bare
`PathBuf::from(self.display_path())` — no canonicalization, no `..` rejection. So
`local:///home/u/../../etc/passwd` parses and resolves at the OS. For a file manager, broad
_read_ navigation is by-design; the concern is that the boundary trusts the renderer wholly
and any future write-capable command inherits this. **Fix:** reject `..` path segments in
`is_valid_local_uri_body` as a cheap, central defense-in-depth guard.

### S3 — Windows `explorer /select` arg building **[verified] — Info (not injection)**

`crates/fs-core/src/external_open.rs:62` uses `format!("/select,{}", path.to_string_lossy())`.
`Command::arg` does **not** invoke a shell, and the path comes from a validated, existing
`ResourceUri`, so this is not command injection — a style nit at most. (The macOS/Linux/
Windows-open paths all use separate args / `-LiteralPath` correctly.) No action required.

### S4 — Items confirmed SAFE **[reported, spot-checked]**

- **SQL injection:** none — `app-core/history.rs` and `config/lib.rs` use `params!` /
  parameterized statements throughout.
- **Command injection:** none — all `external_open` calls pass args via `Command::arg`, no `sh -c`.
- **CSP / capabilities:** strict CSP (`default-src 'self' tauri: ipc: asset:`, no `unsafe-eval`,
  no wildcard); capabilities limited to core/event/autostart/window. No unrestricted FS/shell/HTTP
  plugin (ADR-0002 honored).
- **Zip-slip on extract:** planning phase sanitizes entry paths before execution; the live
  pipeline always plans first. Worth a defense-in-depth re-check in the execute phase, but not
  currently reachable.
- **Logging:** writes to `~/.fileoctopus/logs/` via `tracing` daily rotation; diagnostics redact
  the home dir. No obvious PII leak.

---

## Architecture findings (senior-engineer lens)

### A1 — Bounded operation worker runtime **[resolved, verified] — formerly High**

Original finding: the runtime spawned a fresh OS thread for every file operation. Current
`main` has a bounded worker runtime:

- `crates/app-core/src/runtime.rs:20` documents the fixed worker pool and watchdog.
- `RuntimeSettings.worker_count` caps concurrent operations.
- `OperationRuntime::with_settings` creates a bounded set of worker threads and keeps extra
  jobs queued until a worker starts them.
- The watchdog cancels jobs that stop emitting progress for the configured idle timeout and
  surfaces the result as `timeout`.

Residual note: this is an inactivity timeout rather than a hard wall-clock deadline. That is a
reasonable default for file I/O, where slow but progressing transfers should continue.

### A2 — `Mutex`/`RwLock` poisoning wedges subsystems **[reported]**

`runtime.rs` job table and planned-operations registry, plus the `VfsRegistry` lock, map a
poisoned lock to a hard error. A single panic inside any critical section permanently bricks
that subsystem for the process lifetime. **Fix:** adopt `parking_lot` (no poisoning) or
recover via `into_inner()`. Low effort, removes a class of latent outages.

### A3 — TOCTOU window in move/rename **[reported]**

`fs-core/.../execution.rs` resolves the conflict target, then later `fs::rename`s — a race
where the destination can appear in between. `fs::rename` failing is a partial backstop but
error handling is coarse. **Fix:** re-validate immediately before mutation; prefer atomic
no-clobber rename where the platform supports it.

### A4 — Coarse cancellation; unused `Paused` state **[reported]**

`CancellationToken` is checked at item boundaries, not within large-file copy loops, so cancel
can lag seconds on big files. `JobStatus::Paused` is defined but never transitioned — dead
surface suggesting an unfinished feature. **Fix:** check the token inside chunk loops; either
implement or drop `Paused`.

### A5 — Crash recovery marks but doesn't clean **[reported]**

`mark_interrupted_jobs` (app-core/history.rs) flips crashed jobs to `interrupted` on boot but
leaves orphaned temp files / partial archives behind. **Fix:** GUID-prefix temp artifacts and
sweep them at boot.

### A6 — Frontend effect-cleanup inconsistency **[reported]**

Most IPC event listeners in `useAppInit.ts` use the `disposed`-flag + race-guard pattern
correctly, but the **network status** subscription (~line 583) doesn't — if the effect
unmounts before the subscribe promise resolves, the unsubscribe never fires (listener leak).
**Fix:** standardize the `disposed` guard across all async subscriptions; add a test.

### A7 — Source-export packaging **[reported] — Low**

The original command-map drift concern has been addressed:
`packages/ts-api/tests/catalogs.test.ts` now compares the Tauri `generate_handler!` registry,
`commandMap.ts`, the API reference command count, error codes, warning codes, and event
constants. Remaining low-priority packaging concern: packages still export raw `.ts` source
rather than `dist/`. That is fine for the current monorepo dev loop; revisit before external
package consumption.

### A8 — Owner lookup via `id -nu` subprocess **[reported] — Low**

`fs-core/lib.rs` shells out to `id -nu` per uid (cached per-instance). For large trees with
many owners this spawns many short-lived processes. **Fix:** use `nix`/`libc` directly, or a
global cache.

---

## Suggested remediation order

| #   | Item                                                                   | Status   | Severity | Effort |
| --- | ---------------------------------------------------------------------- | -------- | -------- | ------ |
| 1   | S1 — validate/contain diagnostics export path                          | Resolved | High     | S      |
| 2   | A1 — bound job concurrency + inactivity timeout                        | Resolved | High     | M      |
| 3   | A2 — `parking_lot` to kill poisoning                                   | Open     | Med      | S      |
| 4   | S2 — reject `..` in `is_valid_local_uri_body`                          | Open     | Med      | S      |
| 5   | A3 — close TOCTOU in move/rename                                       | Open     | Med      | M      |
| 6   | A6 — standardize frontend effect cleanup                               | Open     | Med      | S      |
| 7   | A4/A5/A7/A8 — cancellation granularity, orphan sweep, packaging, owner | Open     | Low      | M      |

---

## Verification (for whichever fixes are taken on)

- Rust: `pnpm rust:check && pnpm rust:test && pnpm rust:clippy` (CI does not run these).
- For S1: keep tests asserting `export_diagnostics_bundle` rejects unsafe host paths before
  any `create_dir_all`/`File::create`.
- For S2: unit test `ResourceUri::parse("local:///a/../b")` is rejected.
- For A1: keep runtime tests that K simultaneous operations never exceed the worker cap and
  that stalled jobs time out.
- TS: `pnpm typecheck && pnpm lint && pnpm test`; add a listener-teardown test for A6.

---

## Tasks

Each task is self-contained: files, steps, and acceptance criteria. Severity/effort carried
from the remediation table. Check boxes track progress.

### TASK-1 · S1 — Contain the diagnostics export path · High · ~S · Done

**Original problem:** `export_diagnostics_bundle` wrote a user-supplied raw string path
without containment; the `diagnosticsExportPath` preference was weakly validated.

**Files**

- `apps/desktop-tauri/src-tauri/src/commands/diagnostics.rs` (`export_diagnostics_bundle`, `write_diagnostics_bundle`)
- `crates/config/src/lib.rs` (`parse_diagnostics_export_path`, ~704)
- `crates/app-ipc/src/lib.rs` (`ExportDiagnosticsBundleRequest` — confirm shape)

**Steps**

- [x] Validate the command destination before writing. Current implementation accepts the
      documented host-path exception but normalizes through `ResourceUri::from_local_path`, rejects
      `..`, requires `.zip`, and checks allowed roots.
- [x] Add a containment check before `create_dir_all` / `File::create`.
- [x] Harden `parse_diagnostics_export_path`: reject relative paths and `..`; keep the length cap.

**Acceptance**

- [x] Preference tests reject relative and traversal paths.
- [x] A valid in-container path still produces the bundle.
- [ ] Full `pnpm rust:clippy` remains recommended before release.

### TASK-2 · A1 — Bound job concurrency + inactivity timeout · High · ~M · Done

**Original problem:** the runtime spawned one unbounded `std::thread` per job; there was no
cap or timeout.

**Files**

- `crates/app-core/src/runtime.rs` (job spawn path, ~150-300)
- `crates/jobs/src/lib.rs` (if a deadline field is added to job state)

**Steps**

- [x] Introduce a bounded worker mechanism.
- [x] Queue overflow behavior: jobs beyond the cap wait as `Queued`.
- [x] Add watchdog-based inactivity timeout; on expiry, cancel via the existing
      `CancellationToken` and emit a timeout failure.
- [x] Ensure snapshot/history transitions remain correct when a job waits then runs.

**Acceptance**

- [x] Runtime tests cover bounded queue behavior and timeout transitions.
- [ ] Keep full Rust regression checks in release validation.

### TASK-3 · A2 — Eliminate lock poisoning · Med · ~S

**Files**

- `crates/app-core/src/runtime.rs` (job table, planned-operations registry)
- `crates/vfs/src/lib.rs` (`VfsRegistry` lock)

**Steps**

- [ ] Replace `std::sync::Mutex`/`RwLock` on these hot structures with `parking_lot` equivalents (no poisoning), OR recover via `PoisonError::into_inner()`.
- [ ] Remove the now-dead "lock poisoned" error branches / `Internal` mappings.

**Acceptance**

- [ ] `pnpm rust:check && rust:test && rust:clippy` clean; no behavior change in non-panic paths.

### TASK-4 · S2 — Reject `..` at the local-URI boundary · Med · ~S

**Files**

- `crates/vfs/src/lib.rs` (`is_valid_local_uri_body`, ~849)

**Steps**

- [ ] In `is_valid_local_uri_body`, reject any path containing a `..` segment (split on `/`, check for `..`).
- [ ] Confirm no legitimate caller relies on `..` in a `local://` URI (grep usages).

**Acceptance**

- [ ] Unit test: `ResourceUri::parse("local:///a/../b")` returns `Err`.
- [ ] Existing URI parse tests still pass.

### TASK-5 · A3 — Close the move/rename TOCTOU window · Med · ~M

**Files**

- `crates/fs-core/src/file_ops/execution.rs` (move/rename path)

**Steps**

- [ ] Re-validate the destination immediately before `fs::rename`.
- [ ] Where the platform supports it, prefer an atomic no-clobber rename; otherwise tighten the existing-destination error handling so the conflict policy is honored.

**Acceptance**

- [ ] Test simulating a destination created between plan and execute resolves per the conflict policy (Fail/Skip/Overwrite/Rename), no silent clobber.

### TASK-6 · A6 — Standardize frontend effect cleanup · Med · ~S

**Files**

- `packages/frontend/src/hooks/useAppInit.ts` (network-status subscription, ~535; audit all async listeners)

**Steps**

- [ ] Apply the `disposed`-flag + race-guard pattern (already used by the directory/job listeners) to the network-status subscription and any other unguarded async subscribe.
- [ ] Add a regression test for subscribe-then-immediate-unmount (unsubscribe must fire).

**Acceptance**

- [ ] `pnpm --filter @fileoctopus/frontend test` includes the teardown test and passes.
- [ ] `pnpm typecheck && pnpm lint` clean.

### TASK-7 · Low-priority cleanup batch · Low · ~M

- [ ] **A4** — check `CancellationToken` inside large-file copy chunk loops; implement or remove `JobStatus::Paused`.
- [ ] **A5** — GUID-prefix temp artifacts; sweep orphans at boot alongside `mark_interrupted_jobs`.
- [x] **A7 command map** — catalog tests assert `commandMap` matches registered Tauri handlers.
- [ ] **A7 packaging** — consider `dist/` packaging before external consumption.
- [ ] **A8** — replace `id -nu` subprocess owner lookup with `nix`/`libc` or a global cache.

**Acceptance**

- [ ] Each sub-item independently lands with its own test or justification; full Rust + TS check suites green.
