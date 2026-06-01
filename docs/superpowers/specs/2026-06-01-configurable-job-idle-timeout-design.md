# Configurable job idle-timeout — design

Date: 2026-06-01
Status: approved (design); implementation pending

## Problem & context

FileOctopus's `OperationRuntime` already runs a watchdog (`crates/app-core/src/runtime.rs:523`)
that cancels any `Running` job which emits **no progress** for `idle_timeout` (default **300s**), and
the completion path (`runtime.rs:320`) deliberately surfaces that as a `JobFailed` with
`error_code: "timeout"` rather than a user cancellation. So an idle/no-progress timeout exists and
works end-to-end.

What's missing: the timeout is hardcoded. `RuntimeSettings { worker_count, idle_timeout }` exists but
`OperationRuntime::new` always uses `RuntimeSettings::default()`; it is **not wired to any user
preference**, so users can neither change nor disable the 300s idle timeout.

This feature makes the idle timeout a **user preference that applies live** (no restart), surfaced in
the Settings dialog. A hard total/wall-clock deadline is explicitly **out of scope** (the timeout
remains a no-progress timeout).

## Goals

- A `operation_idle_timeout_secs` user preference (seconds; `0` = disabled), default `300`.
- Changing it takes effect **immediately** on the running watchdog — no app restart.
- Surfaced as a control in the Settings dialog (`SettingsOperations` tab).
- The new field is mirrored across all four IPC layers and validated at the boundary.

## Non-goals

- No hard/absolute wall-clock deadline (only the existing no-progress timeout).
- No per-operation or per-provider timeout overrides; this is a single global setting.

## Design

### 1. `config` crate (`crates/config/src/lib.rs`)

- Add `operation_idle_timeout_secs: u32` to `UserPreferences` (0 = disabled), default `300`. Follow
  the existing numeric-pref pattern (e.g. `network_connection_timeout`, `file_operation_threads`).
- Add schema migration **v14** (`backfill_v14_keys`) that inserts the default `300` for existing DBs;
  bump the schema version constant and the migrate() chain (current latest is v13).
- `PreferencesRepository::set` / value validation: parse as `u32`; accept `0` (disabled) or a value in
  a sane bounded range (proposed `10..=86400`); reject non-numeric / out-of-range with the existing
  `PreferencesError::InvalidValue`. Load/serialize the field in `get_all`/`set` like the other
  numeric keys.

### 2. `app-ipc` (`crates/app-ipc`)

- Add `operation_idle_timeout_secs: u32` to `UserPreferencesDto` (serde `rename_all = "camelCase"` →
  `operationIdleTimeoutSecs`).
- Map it in `impl From<config::UserPreferences> for UserPreferencesDto`.

### 3. `app-core` runtime (`crates/app-core/src/runtime.rs`)

- Hold the live timeout as a shared `Arc<AtomicU64>` (milliseconds; `0` = disabled) on
  `OperationRuntime`, cloned into the watchdog thread.
- Spawn the watchdog **unconditionally** (today it is only spawned when `idle_timeout.is_some()`), and
  have `watchdog_loop` read the atomic each tick:
  - value `0` → skip cancellation (disabled); sleep a fixed fallback poll (e.g. 5s).
  - value `> 0` → existing behavior, using the current value (poll cadence derived from it, clamped as
    today).
- Add `OperationRuntime::set_idle_timeout(&self, secs: Option<u32>)` (None or `Some(0)` → disabled)
  that stores into the atomic.
- `RuntimeSettings.idle_timeout` remains the construction-time seed (used to initialize the atomic).
- At boot (`AppCore::boot_with_paths`), construct the `PreferencesRepository` **before** the
  `OperationRuntime`, read the stored `operation_idle_timeout_secs`, and seed
  `RuntimeSettings.idle_timeout` from it when building the runtime via `with_settings`. (Today the
  runtime is built at `lib.rs:264` and preferences at `:265`; reorder so the value is available.)
  This makes `set_idle_timeout` strictly the live-update path; boot uses the seed.

### 4. Tauri command (`apps/desktop-tauri/src-tauri/src/commands/preferences.rs`)

- In `set_preference`, after the repository write succeeds, if `request.key` is the timeout key, parse
  the new value and call `state.operations().set_idle_timeout(...)` so the change is applied live.

### 5. `ts-api` (`packages/ts-api/src/types.ts`)

- Add `operationIdleTimeoutSecs: number` to the TS `UserPreferencesDto` interface (keep aligned with
  the Rust DTO).

### 6. Frontend Settings UI (`packages/frontend/src/components/settings/SettingsOperations.tsx`)

- Add a labelled seconds input plus an enable/disable affordance (disabled persists `0`), wired via the
  existing `updatePreference("operationIdleTimeoutSecs", String(value))` flow used by the other
  numeric settings in this tab. Mirror the existing control styling/validation in `SettingsOperations`.

## Data flow

User edits the control → `updatePreference("operationIdleTimeoutSecs", value)` → `preferences.set`
IPC → `set_preference` handler writes the pref **and** calls `OperationRuntime::set_idle_timeout` →
watchdog reads the new atomic on its next tick. On boot, the stored preference seeds the atomic.

## Error handling

- Invalid values (non-numeric, out of range) are rejected at `PreferencesRepository::set` with
  `PreferencesError::InvalidValue`, surfaced as a `preferences_error` IpcError; the UI keeps the prior
  value.
- `0` is a valid value meaning "disabled" (no timeout); the watchdog treats it as off.
- A timed-out job continues to fail with `error_code: "timeout"` (unchanged behavior).

## Testing (TDD — write tests first)

1. **`config`**: default is `300`; `set`/`get_all` round-trips a valid value; non-numeric and
   out-of-range are rejected; **a pre-v14 DB migrates and backfills `300`**.
2. **`app-core` (`src/tests.rs`)**: with a short idle timeout, a deliberately stalled job ends in
   `Failed`/`timeout`; `set_idle_timeout` applies **live** — setting a short value times a stalled job
   out, setting `None`/`0` leaves it running (no timeout). Model on the existing watchdog test.
3. **`app-ipc`**: `From<UserPreferences>` maps the field; serde round-trip emits/accepts
   `operationIdleTimeoutSecs`.
4. **Frontend**: a `SettingsOperations` test asserting the control renders the current pref and calls
   `updatePreference` with the new value (matching how sibling numeric settings are tested).

## Boundary invariants

The new DTO field is mirrored across `config::UserPreferences` ↔ `app-ipc::UserPreferencesDto`
(+`From`) ↔ `ts-api` `UserPreferencesDto`, and the new preference key is validated at the IPC boundary
(addressing the review's note on unvalidated `SetPreferenceRequest` for this key).

## Verification

- Rust: `cargo test -p config`, `cargo test -p app-core`, `cargo test -p app-ipc`,
  `cargo check --workspace`, `clippy -D warnings`, `cargo fmt --check`.
- TS/Frontend: `pnpm --filter @fileoctopus/ts-api typecheck`, frontend typecheck + full vitest suite,
  `eslint`.
- Manual (optional): launch the app, change the Settings value, confirm a stalled remote op times out
  at the new interval and that `0` disables it.
