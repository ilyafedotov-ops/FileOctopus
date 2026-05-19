# Large Directory Performance Protocol

## Hardware Notes

Record operating system, CPU, memory, disk type, and whether the tree is on local disk or network storage.

## Generate Test Trees

```bash
cargo run -p test-support --bin fileoctopus-test-tree -- --root ./tmp/10k --files 10000 --dirs 0
cargo run -p test-support --bin fileoctopus-test-tree -- --root ./tmp/100k --files 100000 --dirs 0
cargo run -p test-support --bin fileoctopus-test-tree -- --root ./tmp/tree --files 10000 --dirs 1000 --max-depth 5
```

Clean a generated tree:

```bash
cargo run -p test-support --bin fileoctopus-test-tree -- --root ./tmp/100k --cleanup
```

## 10k File Test

1. Launch FileOctopus with `pnpm dev`.
2. Navigate one panel to `local://<absolute repo path>/tmp/10k`.
3. Confirm entries appear before the final batch completes.
4. Scroll from top to bottom.
5. Use Arrow Down, Page Down, Home, End, and Enter on a file.

Pass: UI remains responsive, the final loading state clears, and file activation shows a non-crashing placeholder.

## 100k File Test

1. Navigate one panel to `local://<absolute repo path>/tmp/100k`.
2. Confirm the panel starts rendering incrementally.
3. Scroll while loading continues.
4. Sort by Name and Type after loading completes.
5. Apply and clear a text filter.

Pass: the table does not mount 100k rows, scrolling remains responsive, and stale events do not affect the opposite panel.

## Evidence To Capture

- Date, commit, OS, CPU, memory, disk.
- Test tree command used.
- Directory listing start time and final completion time.
- Screenshot or screen recording of the two-panel layout.
- Notes for freezes, delayed first batch, missing final state, or visible errors.

## Latest Local Execution

- Date: 2026-05-19
- Commit: (P2-9 wiring cycle)
- OS: Linux (agent environment)
- Automated coverage (RC sign-off evidence for MVP-PERF-003/004 design):
  - `local_provider::list_streams_without_collecting_all_entries_first` — streaming list does not buffer entire directory before emit
  - `local_provider::list_emits_batches_and_final_completion` — incremental batches + completion
  - `packages/frontend/tests/appShell.test.tsx` — `renders a 100k entry batch without mounting every row` (DOM cap)
  - `fs_core` / `ipc_folder_test` — folder size and metadata paths under load-style fixtures
- Manual UI capture still required for MVP-PERF-001/002 (cold/warm start) and formal 10k/100k scroll recordings on target laptop hardware.
- Previous run (2026-05-14): generator `fileoctopus-test-tree` at `/tmp/fileoctopus-100k`; Vite preview shell smoke at `:1420`.
