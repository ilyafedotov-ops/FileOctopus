# Sprint 1 Demo Scenario

## Setup

```bash
pnpm install
cargo run -p test-support --bin fileoctopus-test-tree -- --root ./tmp/100k --files 100000 --dirs 10 --max-depth 2
pnpm dev
```

## Flow

1. Launch FileOctopus.
2. Confirm two panels are visible and the left panel is active.
3. Navigate the left panel to `local:///Users/ilya`.
4. Navigate the right panel to the generated `tmp/100k` directory using its absolute `local://` URI.
5. Confirm entries appear incrementally while loading continues.
6. Scroll through the large directory and confirm the table remains virtualized.
7. Use Arrow Down, Page Down, Home, End, and Tab.
8. Open a generated subdirectory with Enter or double-click.
9. Enter an invalid path and confirm a panel-level error appears without blanking the app.

## Expected Outcomes

- Both panels keep independent URI, entries, selection, loading, and error state.
- Final directory batch clears loading state.
- Stale batches from a previous session are ignored.
- File activation shows a placeholder error instead of crashing.
- Invalid path errors stay inside the target panel.
