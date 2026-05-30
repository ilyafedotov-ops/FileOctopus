# `test-support` — Performance fixture generator

`crates/test-support` exists for one purpose: materializing large directory trees on disk so the Sprint 1 performance protocol can measure list/stat/operation throughput against realistic data. It is a leaf crate — no other workspace crate depends on it. Its functionality is consumed via the `fileoctopus-test-tree` binary.

- Source: `crates/test-support/src/lib.rs`, `crates/test-support/src/bin/fileoctopus-test-tree.rs`
- Depends on: standard library only (no `tokio`, no `serde`).
- Used by: the perf protocol in `docs/testing/large-directory-performance.md`, the Sprint 1 demo (`docs/archive/sprint-1-demo.md`), and integration tests in `crates/test-support/tests/test_tree.rs`.

## API

```rust
pub struct TestTreeOptions {
    pub root: PathBuf,
    pub files: usize,
    pub dirs: usize,
    pub max_depth: usize,
    pub file_size: usize,
    pub cleanup: bool,
}

impl TestTreeOptions {
    pub fn new(root: PathBuf) -> Self; // zeros for all counters, cleanup = false
}

pub fn generate_test_tree(options: &TestTreeOptions) -> io::Result<TestTreeSummary>;

pub struct TestTreeSummary {
    pub root: PathBuf,
    pub files_created: usize,
    pub dirs_created: usize,
    pub cleaned: bool,
}
```

Behaviour:

- **Cleanup mode** (`cleanup = true`): if the root exists, `fs::remove_dir_all` it; return a `cleaned: true` summary with zero counters. Used to reset a fixture between runs.
- **Generation mode**: ensure the root exists, build `dirs` subdirectories (depth interleaved by `max_depth`), then create `files` zero-filled files distributed round-robin across the root and the subdirectories. `file_size` bytes per file (0 means create empty files).

The directory-layout generator (`create_dirs`) picks the depth for each subdirectory as `(index % max_depth) + 1`, so `--max-depth 3 --dirs 9` produces a mix of depth-1, depth-2, and depth-3 paths.

## Binary: `fileoctopus-test-tree`

`src/bin/fileoctopus-test-tree.rs` is a hand-rolled CLI (no `clap`) that maps directly onto `TestTreeOptions`:

```
fileoctopus-test-tree --root <path>
                      [--files n]
                      [--dirs n]
                      [--max-depth n]
                      [--file-size n]
                      [--cleanup]
```

- `--root` is required.
- `--files`, `--dirs`, `--max-depth`, `--file-size` take non-negative integers. `--max-depth` is clamped to `>= 1`.
- `--cleanup` recursively deletes `--root` and ignores the other counters.
- Exit codes: `0` on success, `1` on I/O failure, `2` on argument errors. Errors are printed to stderr with the usage string.

Standard invocations from the perf protocol (`docs/testing/large-directory-performance.md`):

```bash
# 10k flat directory
cargo run -p test-support --bin fileoctopus-test-tree -- \
    --root ./tmp/10k --files 10000 --dirs 0

# 100k flat directory
cargo run -p test-support --bin fileoctopus-test-tree -- \
    --root ./tmp/100k --files 100000 --dirs 0

# Cleanup
cargo run -p test-support --bin fileoctopus-test-tree -- \
    --root ./tmp/100k --cleanup
```

## Implementation notes

- File contents are written from a 8 KiB stack-allocated zero buffer (`CHUNK`) chunked to `file_size`. The data is intentionally non-compressible-but-trivial — we are measuring directory traversal and IO, not content semantics.
- The CLI does not pretty-print progress; it prints a single summary line on success. Wrap it in `time` if you want wall-clock timing.
- `fs::create_dir_all` is used everywhere so calling the tool against a partially-populated root is idempotent until you hit the file-conflict ceiling.

## Conventions

- **Disposable output.** The generator targets paths inside `./tmp` by convention. Don't point `--root` at real user data — there is no safety check, and `--cleanup` will recursively delete whatever is there.
- **Single producer.** The CLI is synchronous; two concurrent runs against the same root will race on the same `file-NNNNNN.bin` names.
- **Keep the API dependency-free.** Anything more elaborate (manifest emission, JSON output, randomized content) goes here, not into a new crate.

## Tests

`crates/test-support/tests/test_tree.rs` covers generation, cleanup, and the `max_depth` distribution. Run with `cargo test -p test-support`.
