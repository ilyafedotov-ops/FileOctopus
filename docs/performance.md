# FileOctopus Performance Baselines

> Last captured: 2026-05-27 14:00 UTC
> Machine: Linux 6.8.0-117-generic, dev build (unoptimized)

## Perf Smoke Test Results

Run:

```bash
pnpm test:perf-smoke
```

### Frontend: 100k Entry Batch Rendering

| Metric                               | Value                |
| ------------------------------------ | -------------------- |
| 100k entry batch render time (jsdom) | ~6.0–6.5s            |
| Virtual row count                    | < 80 `.fo-row` nodes |
| Icons view virtualization            | 2/2 tests pass       |

Baseline: Frontend virtualization renders fewer than 80 `.fo-row` nodes for a 100k-entry injected fixture. The render time is dominated by jsdom overhead; real WebKitGTK rendering is faster.

### Frontend: Icons View Virtualization

| Metric    | Value                              |
| --------- | ---------------------------------- |
| Test file | `iconsVirtualization.test.tsx`     |
| Tests     | 2 pass                             |
| Behavior  | Only visible icons rendered in DOM |

### Backend: Streaming Directory Listing

| Metric   | Value                                               |
| -------- | --------------------------------------------------- |
| Test     | `list_streams_without_collecting_all_entries_first` |
| Duration | ~0.19s                                              |
| Behavior | Streams entries without collecting all first        |

## Large Directory Listing

Run:

```bash
cargo run -p test-support --bin fileoctopus-test-tree -- --root ./tmp/10k --files 10000 --dirs 0
cargo run -p test-support --bin fileoctopus-test-tree -- --root ./tmp/50k --files 50000 --dirs 0
pnpm dev
```

Navigate to `local://<repo>/tmp/10k` and `local://<repo>/tmp/50k`.

Baseline for this Sprint 3 implementation:

- Backend streams directory entries in batches and does not wait for a full directory collection.
- Frontend virtualization renders fewer than 80 `.fo-row` nodes for a 100k-entry injected fixture.
- Known limit: real 50k-directory manual timing depends on disk and should be recorded per machine.

## Large File Operations

Run:

```bash
cargo run -p test-support --bin fileoctopus-test-tree -- --root ./tmp/large-copy --files 1000 --dirs 50 --max-depth 4 --file-size 65536
pnpm rust:test
```

Baseline for this Sprint 3 implementation:

- Copy uses a 64 KiB streaming buffer.
- Progress emits on item completion and roughly every 1 MiB for large files.
- Backend tests verify multiple progress updates for a large fixture and deterministic cancellation.
