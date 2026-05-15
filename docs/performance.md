# FileOctopus Performance Baselines

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
