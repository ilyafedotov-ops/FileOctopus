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

- Date: 2026-05-14
- Generator: `cargo run -p test-support --bin fileoctopus-test-tree -- --root /tmp/fileoctopus-100k --files 100000 --dirs 0`
- Cleanup: `cargo run -p test-support --bin fileoctopus-test-tree -- --root /tmp/fileoctopus-100k --cleanup`
- Automated coverage: Rust listing streams a 10k directory without waiting for completion; frontend smoke test injects 100k entries and asserts fewer than 80 DOM rows.
- UI smoke: Vite preview at `http://localhost:1420/` rendered the two-panel shell with path bars, filters, table headers, and no browser-preview IPC error leakage.
