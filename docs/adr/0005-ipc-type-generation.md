# ADR 0005: Generate IPC TypeScript types from Rust with ts-rs

## Status

Proposed

## Context

The IPC contract is mirrored by hand across four locations: 92 `#[tauri::command]`
handlers, 177 DTO structs in `crates/app-ipc`, the 1,397-line hand-written
`packages/ts-api/src/types.ts`, and the 93-entry `commandMap.ts`. Repository
guidance in `AGENTS.md` records the update checklist, but the underlying
requirement is still enforced by reviewer discipline. Because `FileEntryDto` has
114 TypeScript
consumers across ~30 frontend modules, a missed field rename drifts silently — TS
still compiles, serde still deserializes, and a capability flag reads `undefined`.

This ADR records the spike comparing the two candidate generators and selects one.

Relevant facts about the DTO surface, established during the spike:

- The serde surface is uniform and simple: 183 `rename_all = "camelCase"`, 37
  `#[serde(default)]`, a few `default = "fn"`. **No** `flatten`, `untagged`,
  `tag`, `skip`, `rename`, or `with` — none of the cases that break codegen.
- ~30 fields reference foreign-crate types (`config::*`, `plugin_core::*`,
  `vfs::*`, `jobs::*`, `git_intel::*`). Any generator must derive its export
  trait on those foreign types, spreading the derive across the workspace.
- The current TS representation maps `DateTime<Utc>` → `string`, `Option<T>` →
  `T?: T | null`, and enums → string-literal unions.

### Spike results

Both candidates were evaluated; ts-rs was run empirically on a copy of
`FileEntryDto` + `FileKind` in an isolated crate (`ts-rs` v12 with the
`serde-compat` and `chrono-impl` features). Generated output vs. the
hand-written target:

| Aspect                    | Hand-written                 | ts-rs generated              | Result                                   |
| ------------------------- | ---------------------------- | ---------------------------- | ---------------------------------------- |
| `FileKind` enum           | string-literal union         | identical                    | exact                                    |
| camelCase keys            | `isHidden`, `providerId`     | identical                    | serde-compat honors `rename_all`         |
| `DateTime<Utc>`           | `string \| null`             | `string \| null`             | `chrono-impl` works                      |
| `#[serde(default)]` field | `targetUri?: string \| null` | `targetUri?: string \| null` | exact, with `#[ts(optional = nullable)]` |
| `Option<T>` (no default)  | `extension?: string \| null` | `extension: string \| null`  | needs `#[ts(optional)]` to add `?`       |
| `u64`                     | `size?: number \| null`      | `size: bigint \| null`       | **divergence — see Consequences**        |

Two frictions surfaced, both solvable:

1. **`u64`/`i64` → `bigint`, not `number`.** ts-rs is arguably more correct (a
   `u64` exceeds JS `number` precision above 2^53), which means the current
   `number` typing is a latent precision bug. Adopting ts-rs forces a deliberate
   per-field choice: `#[ts(type = "number")]` to preserve today's behavior, or
   migrate consumers to `bigint`.
2. **`Option<T>` renders as `T | null` (required key) by default.** Matching the
   current optional `?:` needs `#[ts(optional = nullable)]` on the 37
   `#[serde(default)]` fields. The spike confirmed the annotation reproduces the
   exact current output.

## Decision

Adopt **ts-rs** (v12, `serde-compat` + `chrono-impl`) to generate the IPC
TypeScript types from the `app-ipc` DTOs.

- Derive `TS` alongside `Serialize`/`Deserialize` on the 177 DTOs and on the ~30
  referenced foreign types in `config`/`plugin-core`/`vfs`/`jobs`/`git-intel`.
- Export to a generated module that `packages/ts-api/src/types.ts` re-exports, so
  the `@fileoctopus/ts-api` public surface is unchanged (per the boundary
  conventions).
- Generation runs via `cargo test` (ts-rs exports on test run); the output is
  checked in. A CI guard regenerates and runs `git diff --exit-code` to fail on
  staleness (FIX-1.5).
- The per-domain clients (`FsClient`, etc.) and `commandMap.ts` stay as they are.
  For FIX-1.4, add a Rust test asserting every registered `#[tauri::command]` has
  a `commandMap` entry and vice versa — validation rather than generation.

## Consequences

- **Drift becomes a compile/CI failure instead of a silent runtime bug.** This is
  the entire point of FIX-1.
- **~1,400 lines of hand-maintained `types.ts` are deleted** and replaced by
  generated output.
- **The `bigint` decision must be made explicitly.** Recommended: annotate
  numeric fields with `#[ts(type = "number")]` initially to keep behavior
  identical, and track the genuine precision concern (sizes/timestamps that can
  exceed 2^53) as a separate, deliberate migration — not bundled into FIX-1.
- **`#[ts(optional = nullable)]` is needed on `#[serde(default)]` fields** to
  preserve the current optional shape. This is mechanical and reviewable.
- **The derive spreads into five non-IPC crates.** Acceptable: `TS` is a
  zero-cost marker derive gated behind the dependency; it does not change runtime
  behavior. An alternative (local newtype wrappers in `app-ipc`) was considered
  and rejected as more code for less fidelity.
- **CI must gain a Rust-enabled job** for the staleness guard, since today JS CI
  does not run Rust. This is a small, contained addition.

## Alternatives

### tauri-specta (v2) — rejected for this scope, revisit later

tauri-specta generates **both** types and a typed `commands` object from
`#[tauri::command]` + `#[specta::specta]` handlers, which would address FIX-1.3
and FIX-1.4 together and is the more ambitious end state. Rejected for FIX-1
because:

- It is at **2.0.0-rc.21** — a release candidate, not a stable release — which is
  a poor fit for a production desktop app's most load-bearing contract.
- Its generated `commands` object would **replace** the hand-written per-domain
  clients, forcing a rewrite of the entire `ts-api` client layer and annotation
  of all 92 handlers. That blast radius far exceeds FIX-1's "reduce drift risk
  with minimal disruption" intent.
- It couples codegen to the app/debug build rather than a standalone step.

It remains the strongest candidate for a future, larger initiative (a fully typed
command layer) once it reaches a stable release. ts-rs does not preclude that
move — types generated by ts-rs can be retired if tauri-specta is later adopted.

### Status quo (hand-maintained mirror) — rejected

Continues to rely on reviewer discipline for the codebase's highest-blast-radius
contract; the review identified this as the top architectural risk.
