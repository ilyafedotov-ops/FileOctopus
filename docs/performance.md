# FileOctopus Performance

FileOctopus is designed around streamed directory reads, virtualized rendering,
and job-backed filesystem work. Performance-sensitive changes should preserve
these properties:

- directory listings stream in batches instead of collecting the full directory
  before the first UI update
- list and icon views render only visible rows/items for large directories
- copy, move, archive, and metadata jobs emit progress and remain cancellable
- long-running filesystem work stays off the UI thread

## Large Directory Listing

Run:

```bash
cargo run -p test-support --bin fileoctopus-test-tree -- --root ./tmp/10k --files 10000 --dirs 0
cargo run -p test-support --bin fileoctopus-test-tree -- --root ./tmp/50k --files 50000 --dirs 0
pnpm dev
```

Navigate to `local://<repo>/tmp/10k` and `local://<repo>/tmp/50k`.

Expected behavior:

- Backend streams directory entries in batches and does not wait for a full directory collection.
- Frontend virtualization renders fewer than 80 `.fo-row` nodes for a 100k-entry injected fixture.
- Real 50k-directory manual timing depends on disk and should be recorded per machine when benchmarking a release build.

## Large File Operations

Run:

```bash
cargo run -p test-support --bin fileoctopus-test-tree -- --root ./tmp/large-copy --files 1000 --dirs 50 --max-depth 4 --file-size 65536
pnpm rust:test
```

Expected behavior:

- Copy uses a 64 KiB streaming buffer.
- Progress emits on item completion and roughly every 1 MiB for large files.
- Backend tests verify multiple progress updates for a large fixture and deterministic cancellation.

## Automated Coverage

Relevant tests live in the frontend virtualization suites and Rust filesystem
provider tests. Run the full validation bundle before release:

```bash
pnpm rc:validate
```
