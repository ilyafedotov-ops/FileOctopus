# VfsProvider Write Methods Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move single-URI write operations (mkdir, create file, rename, remove, copy, read prefix) from the `VfsFilesystem` scheme-dispatch facade onto the `VfsProvider` trait so the trait surface is honest, capability metadata is meaningful, and new remote providers plug in without editing `crates/fs-core/src/vfs_io.rs`.

**Architecture:** Extend the `VfsProvider` async trait with write methods that default to `VfsError::UnsupportedOperation`. Implement them on `LocalFsProvider` (against `std::fs`) and `SftpProvider` (delegating to existing blocking helpers in `crates/provider-sftp/src/ops.rs` via `tokio::task::spawn_blocking`). Shrink `VfsFilesystem` so its single-URI methods (`mkdir`, `rename`, `remove`, `create_empty_file`, `read_file_prefix`, same-provider `copy_file` and same-provider `rename`) become thin `registry.provider_for(uri)?` calls. Keep cross-scheme `copy_file` and cross-scheme `move` as orchestration in `VfsFilesystem` — those compose two providers and don't belong on either trait impl.

**Tech Stack:** Rust 2021, `async-trait`, `tokio::task::spawn_blocking`, existing `provider-sftp::ops` blocking helpers, `ssh2`, `vfs::VfsError`, `tempfile` for tests.

**Out of scope:**

- Editor `read_file_range` / `write_file_atomic` (local-only by current design — keep as-is on `VfsFilesystem` until a separate plan extends them).
- Tar archive support (separate plan).
- Trash for remote (`UnsupportedTrash` stays; trash is a local-OS concept).
- Symlink copy (`UnsupportedSymlink` stays).
- New providers (SMB, WebDAV) — this plan only adds the trait surface they would use.

---

## Stage 1: Extend `VfsProvider` trait with write methods

### Task 1.1: Add `create_directory` to the trait with `Unsupported` default

**Files:**

- Modify: `crates/vfs/src/lib.rs:554-566` (trait definition) and the in-file mock provider tests
- Modify: `crates/vfs/src/lib.rs` (add `UnsupportedOperation` variant to `VfsError` if not already present)

- [ ] **Step 1: Confirm `VfsError` has `UnsupportedOperation`**

Run:

```bash
grep -n "UnsupportedOperation\|Unsupported" crates/vfs/src/lib.rs | head -20
```

Expected: at least one matching variant. If not present, add this variant to the enum:

```rust
UnsupportedOperation {
    scheme: String,
    operation: &'static str,
},
```

And give it a stable error code in the `impl VfsError { fn code(&self) -> &'static str }` body: `"unsupported_operation"`.

- [ ] **Step 2: Write a failing test for the default trait impl**

Append to the in-file `#[cfg(test)] mod tests` block (the same one that already has `provider_trait_supports_async_stat_and_streamed_list`):

```rust
#[tokio::test]
async fn provider_create_directory_defaults_to_unsupported() {
    struct StubProvider;

    #[async_trait::async_trait]
    impl VfsProvider for StubProvider {
        fn id(&self) -> ProviderId { ProviderId::new("stub") }
        fn schemes(&self) -> &'static [&'static str] { &["stub"] }
        fn capabilities(&self) -> ProviderCapabilities { ProviderCapabilities::read_only() }
        async fn stat(&self, _uri: &ResourceUri) -> Result<FileEntry, VfsError> {
            Err(VfsError::internal("unused"))
        }
        async fn list(&self, _uri: &ResourceUri, _options: ListOptions, _sink: DirectorySink) -> Result<(), VfsError> {
            Err(VfsError::internal("unused"))
        }
    }

    let provider = StubProvider;
    let uri = ResourceUri::parse("stub://example/x").unwrap();
    let result = provider.create_directory(&uri).await;
    let error = result.expect_err("default impl should return UnsupportedOperation");
    assert_eq!(error.code(), "unsupported_operation");
}
```

- [ ] **Step 3: Run the test and verify it fails**

```bash
cargo test -p vfs provider_create_directory_defaults_to_unsupported
```

Expected: FAIL (`no method named create_directory`).

- [ ] **Step 4: Add `create_directory` to the `VfsProvider` trait with a default**

In `crates/vfs/src/lib.rs`, inside the `pub trait VfsProvider` block (after `list`), append:

```rust
async fn create_directory(&self, uri: &ResourceUri) -> Result<(), VfsError> {
    let _ = uri;
    Err(VfsError::UnsupportedOperation {
        scheme: self
            .schemes()
            .first()
            .copied()
            .unwrap_or("unknown")
            .to_string(),
        operation: "create_directory",
    })
}
```

- [ ] **Step 5: Run the test and verify it passes**

```bash
cargo test -p vfs provider_create_directory_defaults_to_unsupported
```

Expected: PASS.

- [ ] **Step 6: Run the full crate tests**

```bash
cargo test -p vfs
cargo clippy -p vfs --all-targets -- -D warnings
```

Expected: PASS, no warnings.

- [ ] **Step 7: Commit**

```bash
git add crates/vfs/src/lib.rs
git commit -m "feat(vfs): add create_directory to VfsProvider trait with Unsupported default"
```

### Task 1.2: Add `create_file`, `rename`, `remove`, `copy_file`, `read_file_prefix` to the trait

These are mechanically the same as Task 1.1: write a failing default-impl test, add the trait method, verify, commit. Group them in one commit because the pattern is identical.

**Files:**

- Modify: `crates/vfs/src/lib.rs` (trait block, tests block)

- [ ] **Step 1: Write five tests, one per new method**

Append to the in-file `#[cfg(test)] mod tests` block (reuse the `StubProvider` from Task 1.1; declare it once at module scope if helpful):

```rust
#[tokio::test]
async fn provider_create_file_defaults_to_unsupported() {
    let uri = ResourceUri::parse("stub://example/x").unwrap();
    let provider = StubProvider;
    assert_eq!(
        provider.create_file(&uri).await.unwrap_err().code(),
        "unsupported_operation",
    );
}

#[tokio::test]
async fn provider_rename_defaults_to_unsupported() {
    let from = ResourceUri::parse("stub://example/a").unwrap();
    let to = ResourceUri::parse("stub://example/b").unwrap();
    let provider = StubProvider;
    assert_eq!(
        provider.rename(&from, &to).await.unwrap_err().code(),
        "unsupported_operation",
    );
}

#[tokio::test]
async fn provider_remove_defaults_to_unsupported() {
    let uri = ResourceUri::parse("stub://example/x").unwrap();
    let provider = StubProvider;
    assert_eq!(
        provider.remove(&uri, false).await.unwrap_err().code(),
        "unsupported_operation",
    );
}

#[tokio::test]
async fn provider_copy_file_defaults_to_unsupported() {
    let from = ResourceUri::parse("stub://example/a").unwrap();
    let to = ResourceUri::parse("stub://example/b").unwrap();
    let provider = StubProvider;
    let result = provider.copy_file(&from, &to, Box::new(|_| {})).await;
    assert_eq!(result.unwrap_err().code(), "unsupported_operation");
}

#[tokio::test]
async fn provider_read_file_prefix_defaults_to_unsupported() {
    let uri = ResourceUri::parse("stub://example/x").unwrap();
    let provider = StubProvider;
    assert_eq!(
        provider.read_file_prefix(&uri, 64).await.unwrap_err().code(),
        "unsupported_operation",
    );
}
```

- [ ] **Step 2: Run, verify they fail**

```bash
cargo test -p vfs provider_ --no-run 2>&1 | head
cargo test -p vfs provider_
```

Expected: FAIL (methods don't exist).

- [ ] **Step 3: Add the five new methods to the trait**

In `crates/vfs/src/lib.rs`, in the `pub trait VfsProvider` block (after `create_directory`):

```rust
async fn create_file(&self, uri: &ResourceUri) -> Result<(), VfsError> {
    let _ = uri;
    Err(self.unsupported("create_file"))
}

async fn rename(&self, from: &ResourceUri, to: &ResourceUri) -> Result<(), VfsError> {
    let _ = (from, to);
    Err(self.unsupported("rename"))
}

async fn remove(&self, uri: &ResourceUri, recursive: bool) -> Result<(), VfsError> {
    let _ = (uri, recursive);
    Err(self.unsupported("remove"))
}

async fn copy_file(
    &self,
    source: &ResourceUri,
    destination: &ResourceUri,
    on_progress: Box<dyn FnMut(u64) + Send>,
) -> Result<u64, VfsError> {
    let _ = (source, destination, on_progress);
    Err(self.unsupported("copy_file"))
}

async fn read_file_prefix(
    &self,
    uri: &ResourceUri,
    max_bytes: u64,
) -> Result<Vec<u8>, VfsError> {
    let _ = (uri, max_bytes);
    Err(self.unsupported("read_file_prefix"))
}
```

Add a small default helper on the trait (or as a free function) so the `unsupported(...)` shorthand works:

```rust
fn unsupported(&self, operation: &'static str) -> VfsError {
    VfsError::UnsupportedOperation {
        scheme: self
            .schemes()
            .first()
            .copied()
            .unwrap_or("unknown")
            .to_string(),
        operation,
    }
}
```

Adjust the existing `create_directory` default impl from Task 1.1 to call `self.unsupported("create_directory")` for consistency.

- [ ] **Step 4: Run, verify they pass**

```bash
cargo test -p vfs
cargo clippy -p vfs --all-targets -- -D warnings
```

Expected: PASS, no warnings.

- [ ] **Step 5: Commit**

```bash
git add crates/vfs/src/lib.rs
git commit -m "feat(vfs): add write methods (create_file/rename/remove/copy_file/read_file_prefix) to VfsProvider trait"
```

---

## Stage 2: `LocalFsProvider` write implementations

The current `LocalFsProvider` is in `crates/fs-core/src/lib.rs` and returns `read_only` capabilities. Each task here implements one trait method plus tests against a `tempfile::TempDir`. After each task, the corresponding branch in `crates/fs-core/src/vfs_io.rs` becomes redundant (we'll remove those in Stage 4).

**Files (shared across Stage 2):**

- Modify: `crates/fs-core/src/lib.rs` (the `impl VfsProvider for LocalFsProvider` block; capabilities)
- Modify: `crates/fs-core/tests/local_fs_provider.rs` (create if it doesn't exist; one suite per method)

### Task 2.1: Implement `create_directory` and `create_file` on `LocalFsProvider`

- [ ] **Step 1: Create or extend the test module**

Create `crates/fs-core/tests/local_fs_provider.rs` if absent. Otherwise append to it:

```rust
use fs_core::LocalFsProvider;
use tempfile::TempDir;
use vfs::{ResourceUri, VfsProvider};

fn uri_in(temp: &TempDir, name: &str) -> ResourceUri {
    ResourceUri::from_local_path(temp.path().join(name)).unwrap()
}

#[tokio::test]
async fn create_directory_creates_a_local_directory() {
    let temp = TempDir::new().unwrap();
    let target = uri_in(&temp, "new-folder");

    LocalFsProvider::new().create_directory(&target).await.unwrap();

    assert!(target.to_local_path().unwrap().is_dir());
}

#[tokio::test]
async fn create_file_creates_an_empty_local_file() {
    let temp = TempDir::new().unwrap();
    let target = uri_in(&temp, "new-file.txt");

    LocalFsProvider::new().create_file(&target).await.unwrap();

    let path = target.to_local_path().unwrap();
    assert!(path.is_file());
    assert_eq!(std::fs::metadata(&path).unwrap().len(), 0);
}
```

- [ ] **Step 2: Run, verify failures**

```bash
cargo test -p fs-core --test local_fs_provider
```

Expected: FAIL (`LocalFsProvider::create_directory` and `create_file` not implemented yet — they fall through to the trait default returning `UnsupportedOperation`).

- [ ] **Step 3: Implement the methods**

In `crates/fs-core/src/lib.rs`, inside `impl VfsProvider for LocalFsProvider`, add:

```rust
async fn create_directory(&self, uri: &ResourceUri) -> Result<(), VfsError> {
    let path = uri.to_local_path()?;
    tokio::task::spawn_blocking(move || std::fs::create_dir_all(&path))
        .await
        .map_err(|error| VfsError::internal(&error.to_string()))?
        .map_err(|error| map_local_io(uri, error))
}

async fn create_file(&self, uri: &ResourceUri) -> Result<(), VfsError> {
    let path = uri.to_local_path()?;
    tokio::task::spawn_blocking(move || {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::File::create(&path).map(|_| ())
    })
    .await
    .map_err(|error| VfsError::internal(&error.to_string()))?
    .map_err(|error| map_local_io(uri, error))
}
```

If `map_local_io(&ResourceUri, std::io::Error) -> VfsError` doesn't already exist on `LocalFsProvider`, copy it from the equivalent helper in `crates/fs-core/src/vfs_io.rs` and adapt it to return `VfsError` (instead of `FileOperationError`).

- [ ] **Step 4: Run, verify they pass**

```bash
cargo test -p fs-core --test local_fs_provider
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/fs-core/src/lib.rs crates/fs-core/tests/local_fs_provider.rs
git commit -m "feat(fs-core): implement create_directory and create_file on LocalFsProvider"
```

### Task 2.2: Implement `rename` and `remove` on `LocalFsProvider`

- [ ] **Step 1: Add tests**

Append to `crates/fs-core/tests/local_fs_provider.rs`:

```rust
#[tokio::test]
async fn rename_moves_a_file_in_place() {
    let temp = TempDir::new().unwrap();
    let from = uri_in(&temp, "a.txt");
    std::fs::write(from.to_local_path().unwrap(), b"hello").unwrap();
    let to = uri_in(&temp, "b.txt");

    LocalFsProvider::new().rename(&from, &to).await.unwrap();

    assert!(!from.to_local_path().unwrap().exists());
    assert_eq!(std::fs::read(to.to_local_path().unwrap()).unwrap(), b"hello");
}

#[tokio::test]
async fn remove_deletes_a_file() {
    let temp = TempDir::new().unwrap();
    let target = uri_in(&temp, "doomed.txt");
    std::fs::write(target.to_local_path().unwrap(), b"x").unwrap();

    LocalFsProvider::new().remove(&target, false).await.unwrap();

    assert!(!target.to_local_path().unwrap().exists());
}

#[tokio::test]
async fn remove_recursive_deletes_a_tree() {
    let temp = TempDir::new().unwrap();
    let root = uri_in(&temp, "tree");
    let path = root.to_local_path().unwrap();
    std::fs::create_dir_all(path.join("nested")).unwrap();
    std::fs::write(path.join("nested/a.txt"), b"x").unwrap();

    LocalFsProvider::new().remove(&root, true).await.unwrap();

    assert!(!path.exists());
}
```

- [ ] **Step 2: Run, verify failures**

```bash
cargo test -p fs-core --test local_fs_provider rename_ remove_
```

Expected: FAIL.

- [ ] **Step 3: Implement the methods**

In `impl VfsProvider for LocalFsProvider`:

```rust
async fn rename(&self, from: &ResourceUri, to: &ResourceUri) -> Result<(), VfsError> {
    let from_path = from.to_local_path()?;
    let to_path = to.to_local_path()?;
    let uri = from.clone();
    tokio::task::spawn_blocking(move || std::fs::rename(&from_path, &to_path))
        .await
        .map_err(|error| VfsError::internal(&error.to_string()))?
        .map_err(|error| map_local_io(&uri, error))
}

async fn remove(&self, uri: &ResourceUri, recursive: bool) -> Result<(), VfsError> {
    let path = uri.to_local_path()?;
    let uri_clone = uri.clone();
    tokio::task::spawn_blocking(move || {
        let metadata = std::fs::symlink_metadata(&path)?;
        if metadata.is_dir() {
            if recursive {
                std::fs::remove_dir_all(&path)
            } else {
                std::fs::remove_dir(&path)
            }
        } else {
            std::fs::remove_file(&path)
        }
    })
    .await
    .map_err(|error| VfsError::internal(&error.to_string()))?
    .map_err(|error| map_local_io(&uri_clone, error))
}
```

- [ ] **Step 4: Run, verify they pass**

```bash
cargo test -p fs-core --test local_fs_provider
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/fs-core/src/lib.rs crates/fs-core/tests/local_fs_provider.rs
git commit -m "feat(fs-core): implement rename and remove on LocalFsProvider"
```

### Task 2.3: Implement `copy_file` and `read_file_prefix` on `LocalFsProvider`

- [ ] **Step 1: Add tests**

Append:

```rust
#[tokio::test]
async fn copy_file_streams_local_bytes() {
    let temp = TempDir::new().unwrap();
    let source = uri_in(&temp, "src.bin");
    let destination = uri_in(&temp, "dst.bin");
    let bytes = vec![7_u8; 200_000]; // > 64 KB to exercise streaming
    std::fs::write(source.to_local_path().unwrap(), &bytes).unwrap();

    let mut last = 0_u64;
    let observed = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));
    let observed_clone = observed.clone();
    let total = LocalFsProvider::new()
        .copy_file(&source, &destination, Box::new(move |bytes_so_far| {
            observed_clone.store(bytes_so_far, std::sync::atomic::Ordering::SeqCst);
            last = bytes_so_far;
        }))
        .await
        .unwrap();

    assert_eq!(total, bytes.len() as u64);
    assert_eq!(observed.load(std::sync::atomic::Ordering::SeqCst), bytes.len() as u64);
    assert_eq!(std::fs::read(destination.to_local_path().unwrap()).unwrap(), bytes);
}

#[tokio::test]
async fn read_file_prefix_returns_first_n_bytes() {
    let temp = TempDir::new().unwrap();
    let target = uri_in(&temp, "data.txt");
    std::fs::write(target.to_local_path().unwrap(), b"abcdefghij").unwrap();

    let prefix = LocalFsProvider::new()
        .read_file_prefix(&target, 4)
        .await
        .unwrap();

    assert_eq!(prefix, b"abcd");
}
```

- [ ] **Step 2: Run, verify failures**

```bash
cargo test -p fs-core --test local_fs_provider copy_file_ read_file_prefix_
```

Expected: FAIL.

- [ ] **Step 3: Implement the methods**

```rust
async fn copy_file(
    &self,
    source: &ResourceUri,
    destination: &ResourceUri,
    mut on_progress: Box<dyn FnMut(u64) + Send>,
) -> Result<u64, VfsError> {
    use std::io::{Read, Write};

    const CHUNK: usize = 64 * 1024;
    let from = source.to_local_path()?;
    let to = destination.to_local_path()?;
    let src_uri = source.clone();

    tokio::task::spawn_blocking(move || -> Result<u64, std::io::Error> {
        if let Some(parent) = to.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut reader = std::fs::File::open(&from)?;
        let mut writer = std::fs::File::create(&to)?;
        let mut buffer = vec![0_u8; CHUNK];
        let mut total = 0_u64;
        loop {
            let read = reader.read(&mut buffer)?;
            if read == 0 {
                break;
            }
            writer.write_all(&buffer[..read])?;
            total += read as u64;
            on_progress(total);
        }
        writer.flush()?;
        Ok(total)
    })
    .await
    .map_err(|error| VfsError::internal(&error.to_string()))?
    .map_err(|error| map_local_io(&src_uri, error))
}

async fn read_file_prefix(
    &self,
    uri: &ResourceUri,
    max_bytes: u64,
) -> Result<Vec<u8>, VfsError> {
    use std::io::Read;
    let path = uri.to_local_path()?;
    let uri_clone = uri.clone();
    tokio::task::spawn_blocking(move || -> Result<Vec<u8>, std::io::Error> {
        let mut file = std::fs::File::open(&path)?;
        let mut buffer = vec![0_u8; max_bytes as usize];
        let read = file.read(&mut buffer)?;
        buffer.truncate(read);
        Ok(buffer)
    })
    .await
    .map_err(|error| VfsError::internal(&error.to_string()))?
    .map_err(|error| map_local_io(&uri_clone, error))
}
```

- [ ] **Step 4: Update `LocalFsProvider::capabilities`**

In `crates/fs-core/src/lib.rs`, change:

```rust
fn capabilities(&self) -> ProviderCapabilities {
    ProviderCapabilities::read_only()
}
```

to:

```rust
fn capabilities(&self) -> ProviderCapabilities {
    ProviderCapabilities::read_write()
}
```

- [ ] **Step 5: Run all fs-core tests**

```bash
cargo test -p fs-core
cargo clippy -p fs-core --all-targets -- -D warnings
```

Expected: PASS, no warnings.

- [ ] **Step 6: Commit**

```bash
git add crates/fs-core/src/lib.rs crates/fs-core/tests/local_fs_provider.rs
git commit -m "feat(fs-core): implement copy_file and read_file_prefix on LocalFsProvider; declare read_write capabilities"
```

---

## Stage 3: `SftpProvider` write implementations

Each method delegates to the existing blocking helpers in `crates/provider-sftp/src/ops.rs` via `tokio::task::spawn_blocking`. Test approach: extend the existing `crates/provider-sftp/tests/` suite with mock-session tests where feasible. Where the existing test harness can't drive a real SFTP server, add a `#[ignore]` integration test that real-server smoke uses (or skip — the local provider tests give us coverage of the trait surface).

**Files (shared across Stage 3):**

- Modify: `crates/provider-sftp/src/provider.rs` (impl block)
- Modify: `crates/provider-sftp/tests/provider_writes.rs` (create)

### Task 3.1: Implement `create_directory`, `create_file`, `rename`, `remove` on `SftpProvider`

- [ ] **Step 1: Build a small mock-session fixture**

Look at the existing harness used by `crates/provider-sftp/tests/fingerprint.rs` and `crates/provider-sftp/tests/capabilities.rs`. If a usable mock session exists, reuse it. Otherwise, write a thin in-memory `SftpSession` substitute that records calls; if the `SftpSession` type is `ssh2`-bound and not stubbable, gate provider-impl tests behind `#[ignore]` and verify via the `LocalFsProvider` path only.

Decide which path applies and document in this task before writing code.

- [ ] **Step 2: Write tests**

In `crates/provider-sftp/tests/provider_writes.rs` (created if absent), assert that calling each new write method on `SftpProvider` round-trips into the corresponding `ops::*_blocking` helper. Concretely, if a mock session is feasible:

```rust
// See Step 1 for the mock plumbing.
#[tokio::test]
async fn create_directory_calls_mkdir_blocking() {
    // … construct provider with a stub session manager …
    provider.create_directory(&uri).await.unwrap();
    assert_eq!(mock.mkdir_calls.lock().unwrap().len(), 1);
}
```

If a mock isn't feasible, gate each test with `#[ignore]` and document in the file that real-server smoke covers behavior.

- [ ] **Step 3: Implement methods**

In `crates/provider-sftp/src/provider.rs`, inside `impl VfsProvider for SftpProvider`:

```rust
async fn create_directory(&self, uri: &ResourceUri) -> Result<(), VfsError> {
    let session = self.session_for(uri).await?;
    let remote_path = uri.remote_path().unwrap_or_else(|| "/".to_string());
    let uri_clone = uri.clone();
    tokio::task::spawn_blocking(move || {
        provider_sftp::mkdir_blocking(&session, &uri_clone, &remote_path)
    })
    .await
    .map_err(|error| VfsError::internal(&error.to_string()))?
}

async fn create_file(&self, uri: &ResourceUri) -> Result<(), VfsError> {
    let session = self.session_for(uri).await?;
    let remote_path = uri.remote_path().unwrap_or_else(|| "/".to_string());
    let uri_clone = uri.clone();
    tokio::task::spawn_blocking(move || {
        provider_sftp::create_empty_file_blocking(&session, &uri_clone, &remote_path)
    })
    .await
    .map_err(|error| VfsError::internal(&error.to_string()))?
}

async fn rename(&self, from: &ResourceUri, to: &ResourceUri) -> Result<(), VfsError> {
    let from_authority = from
        .remote_authority()
        .ok_or_else(|| VfsError::internal("rename: from has no profile"))?;
    let to_authority = to
        .remote_authority()
        .ok_or_else(|| VfsError::internal("rename: to has no profile"))?;
    if from_authority != to_authority {
        return Err(VfsError::UnsupportedOperation {
            scheme: "sftp".to_string(),
            operation: "rename across profiles",
        });
    }
    let session = self.session_for(from).await?;
    let from_path = from
        .remote_path()
        .ok_or_else(|| VfsError::internal("rename: from has no path"))?;
    let to_path = to
        .remote_path()
        .ok_or_else(|| VfsError::internal("rename: to has no path"))?;
    let from_clone = from.clone();
    tokio::task::spawn_blocking(move || {
        provider_sftp::rename_blocking(&session, &from_clone, &from_path, &to_path)
    })
    .await
    .map_err(|error| VfsError::internal(&error.to_string()))?
}

async fn remove(&self, uri: &ResourceUri, recursive: bool) -> Result<(), VfsError> {
    let session = self.session_for(uri).await?;
    let remote_path = uri
        .remote_path()
        .ok_or_else(|| VfsError::internal("remove: missing path"))?;
    let uri_clone = uri.clone();

    let entry = self.stat(uri).await?;
    match (entry.kind, recursive) {
        (vfs::FileKind::Directory, true) => {
            // Recursively delete children using existing helper. The helper in
            // ops.rs is fs-core-side today; either move it here or inline an
            // equivalent traversal using list_directory_blocking + remove_*_blocking.
            tokio::task::spawn_blocking(move || sftp_remove_tree(&session, &uri_clone, &remote_path))
                .await
                .map_err(|error| VfsError::internal(&error.to_string()))?
        }
        (vfs::FileKind::Directory, false) => {
            tokio::task::spawn_blocking(move || {
                provider_sftp::remove_dir_blocking(&session, &uri_clone, &remote_path)
            })
            .await
            .map_err(|error| VfsError::internal(&error.to_string()))?
        }
        _ => {
            tokio::task::spawn_blocking(move || {
                provider_sftp::remove_file_blocking(&session, &uri_clone, &remote_path)
            })
            .await
            .map_err(|error| VfsError::internal(&error.to_string()))?
        }
    }
}
```

`sftp_remove_tree` is a helper that walks via `list_directory_blocking` and calls `remove_file_blocking` / `remove_dir_blocking`. The matching free function exists today in `fs-core/src/vfs_io.rs::remove_sftp_tree` — copy it into `provider-sftp/src/ops.rs` (or a sibling module) and export it. Update `vfs_io.rs` to import the shared version in Stage 4.

`session_for(uri)` is a small private helper that downcasts the `RemoteSession` to an `SftpSession`. The existing `SftpProvider::stat` already does the equivalent — refactor it out so the new write methods can reuse it.

- [ ] **Step 4: Run tests**

```bash
cargo test -p provider-sftp
cargo clippy -p provider-sftp --all-targets -- -D warnings
```

Expected: PASS, no warnings.

- [ ] **Step 5: Commit**

```bash
git add crates/provider-sftp/src/provider.rs crates/provider-sftp/src/ops.rs crates/provider-sftp/tests/provider_writes.rs
git commit -m "feat(provider-sftp): implement create_directory/create_file/rename/remove on VfsProvider trait"
```

### Task 3.2: Implement `copy_file` (same-provider) and `read_file_prefix` on `SftpProvider`

- [ ] **Step 1: Add tests**

Append to `crates/provider-sftp/tests/provider_writes.rs`:

```rust
#[tokio::test]
async fn read_file_prefix_returns_remote_bytes() {
    // … fixture …
    let result = provider.read_file_prefix(&uri, 8).await.unwrap();
    assert_eq!(result, b"hello wo");
}

#[tokio::test]
async fn copy_file_within_same_profile_streams() {
    // … fixture …
    let total = provider
        .copy_file(&source, &destination, Box::new(|_| {}))
        .await
        .unwrap();
    assert_eq!(total, expected_size);
}
```

- [ ] **Step 2: Implement the methods**

```rust
async fn read_file_prefix(
    &self,
    uri: &ResourceUri,
    max_bytes: u64,
) -> Result<Vec<u8>, VfsError> {
    let session = self.session_for(uri).await?;
    let remote_path = uri
        .remote_path()
        .ok_or_else(|| VfsError::internal("read_file_prefix: missing path"))?;
    let uri_clone = uri.clone();
    tokio::task::spawn_blocking(move || {
        provider_sftp::read_file_prefix_blocking(&session, &uri_clone, &remote_path, max_bytes)
    })
    .await
    .map_err(|error| VfsError::internal(&error.to_string()))?
}

async fn copy_file(
    &self,
    source: &ResourceUri,
    destination: &ResourceUri,
    mut on_progress: Box<dyn FnMut(u64) + Send>,
) -> Result<u64, VfsError> {
    let source_authority = source
        .remote_authority()
        .ok_or_else(|| VfsError::internal("copy_file: source has no profile"))?;
    let dest_authority = destination
        .remote_authority()
        .ok_or_else(|| VfsError::internal("copy_file: destination has no profile"))?;
    if source_authority != dest_authority {
        return Err(VfsError::UnsupportedOperation {
            scheme: "sftp".to_string(),
            operation: "copy_file across profiles",
        });
    }
    let session = self.session_for(source).await?;
    let source_path = source.remote_path().unwrap_or_default();
    let dest_path = destination.remote_path().unwrap_or_default();
    let source_clone = source.clone();
    let destination_clone = destination.clone();
    tokio::task::spawn_blocking(move || {
        // Stream source -> destination via the same session, reusing the
        // open/read/create/write pattern from vfs_io.rs sftp-to-sftp branch.
        sftp_copy_within_session(
            &session,
            &source_clone,
            &source_path,
            &destination_clone,
            &dest_path,
            &mut on_progress,
        )
    })
    .await
    .map_err(|error| VfsError::internal(&error.to_string()))?
}
```

`sftp_copy_within_session` is the inline body of `VfsFilesystem::copy_file`'s `("sftp", "sftp")` branch, moved into `provider-sftp/src/ops.rs` and exported. The signature mirrors the other `*_blocking` helpers.

- [ ] **Step 3: Run tests**

```bash
cargo test -p provider-sftp
cargo clippy -p provider-sftp --all-targets -- -D warnings
```

Expected: PASS, no warnings.

- [ ] **Step 4: Commit**

```bash
git add crates/provider-sftp/src/provider.rs crates/provider-sftp/src/ops.rs crates/provider-sftp/tests/provider_writes.rs
git commit -m "feat(provider-sftp): implement copy_file (same-profile) and read_file_prefix on VfsProvider trait"
```

---

## Stage 4: Slim `VfsFilesystem` to a facade

Now that both providers expose writes, `vfs_io.rs` should only own:

1. Single-URI methods → resolve provider via the registry and forward.
2. Cross-scheme `copy_file` orchestration (open source via one provider's read, write to destination via the other provider — `read_file_prefix` is not the right primitive for streaming, so use a per-chunk read/write loop that calls the provider's `read_file_range`-like helper or the existing local-side `File`/SFTP-side `open` directly).

Editor `read_file_range` / `write_file_atomic` stay on `VfsFilesystem` as local-only helpers until a separate plan extends them.

**Files:**

- Modify: `crates/fs-core/src/vfs_io.rs`
- Modify: `crates/fs-core/Cargo.toml` (likely add a dependency on `vfs::VfsRegistry` if not already imported — `VfsFilesystem` will need an `Arc<VfsRegistry>` to dispatch).

### Task 4.1: Make `VfsFilesystem` hold a `VfsRegistry` and delegate single-URI writes

- [ ] **Step 1: Update `VfsFilesystem` to hold the registry**

In `crates/fs-core/src/vfs_io.rs`:

```rust
#[derive(Clone)]
pub struct VfsFilesystem {
    sessions: Option<Arc<ConnectionSessionManager>>,
    registry: Arc<vfs::VfsRegistry>,
}

impl VfsFilesystem {
    pub fn local_only(registry: Arc<vfs::VfsRegistry>) -> Self {
        Self { sessions: None, registry }
    }

    pub fn with_sessions(
        sessions: Arc<ConnectionSessionManager>,
        registry: Arc<vfs::VfsRegistry>,
    ) -> Self {
        Self { sessions: Some(sessions), registry }
    }
}
```

Update every caller of `VfsFilesystem::with_sessions` / `local_only` (search the workspace) to pass the registry. The main caller is `crates/app-core/src/lib.rs:170`; pass `Arc::clone(&app_state.vfs_registry)`.

- [ ] **Step 2: Rewrite `mkdir`, `create_empty_file`, `rename`, `remove`, `read_file_prefix` to delegate**

Each becomes:

```rust
pub fn mkdir(&self, uri: &ResourceUri) -> Result<(), FileOperationError> {
    let provider = self
        .registry
        .provider_for(uri)
        .map_err(FileOperationError::from)?;
    block_on_session(async move { provider.create_directory(uri).await }).map_err(Into::into)
}
```

Pattern repeats for `create_empty_file → create_file`, `remove`, `read_file_prefix`. Same-scheme `rename` delegates to `provider.rename`. The cross-scheme `rename(sftp_a → sftp_b)` falls back to `self.copy_file(...)? + self.remove(...)?` (already the existing behavior).

- [ ] **Step 3: Rewrite `copy_file` for same-scheme via trait, keep cross-scheme orchestration in place**

```rust
pub fn copy_file(
    &self,
    source: &ResourceUri,
    destination: &ResourceUri,
    on_progress: impl FnMut(u64) + Send + 'static,
) -> Result<u64, FileOperationError> {
    if source.scheme() == destination.scheme() {
        let provider = self
            .registry
            .provider_for(source)
            .map_err(FileOperationError::from)?;
        let source = source.clone();
        let destination = destination.clone();
        return block_on_session(async move {
            provider
                .copy_file(&source, &destination, Box::new(on_progress))
                .await
        })
        .map_err(Into::into);
    }

    // Cross-scheme orchestration: read source bytes through one provider,
    // write through the other. Reuse the existing local↔sftp / sftp↔local
    // branches; they're orchestration, not per-scheme primitives.
    self.copy_file_cross_scheme(source, destination, on_progress)
}
```

`copy_file_cross_scheme` is the existing `("local", "sftp")` and `("sftp", "local")` branches extracted into a private method.

- [ ] **Step 4: Delete now-redundant per-scheme branches**

Inside `mkdir`, `create_empty_file`, `rename`, `remove`, `read_file_prefix`, and single-scheme `copy_file`, delete the `if uri.scheme() == "local"` / `if uri.scheme() == "sftp"` branches that called `std::fs` or `provider_sftp::*_blocking` directly. They're now provider responsibilities.

`stat_kind`, `file_size`, `exists`, `read_file_range`, `write_file_atomic` may still need scheme branches today — leave them alone (they're out of scope or local-only).

- [ ] **Step 5: Run the full Rust test matrix**

```bash
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --all -- --check
```

Expected: PASS. The integration tests in `crates/fs-core/tests/` and `apps/desktop-tauri/src-tauri/tests/` should all still pass — they exercise `VfsFilesystem` through `OperationRuntime`, and the trait-routed implementations preserve behavior.

- [ ] **Step 6: Commit**

```bash
git add crates/fs-core/src/vfs_io.rs crates/fs-core/src/lib.rs crates/app-core/src/lib.rs
git commit -m "refactor(fs-core): route VfsFilesystem single-URI writes through VfsProvider trait"
```

### Task 4.2: Remove the transitional comment from `vfs_io.rs`

- [ ] **Step 1: Remove the comment**

Open `crates/fs-core/src/vfs_io.rs` and delete the module-level comment block added during Phase 1 that says "VfsFilesystem is the transitional VFS-aware I/O facade …". Replace it with a one-line doc comment describing the post-refactor responsibility:

```rust
//! `VfsFilesystem` orchestrates cross-scheme file operations and exposes
//! single-URI write helpers as thin facades over `VfsProvider` trait methods.
//! Per-scheme write logic lives on `LocalFsProvider` and `SftpProvider`.
```

- [ ] **Step 2: Run `cargo fmt` and re-verify**

```bash
cargo fmt --all
cargo check --workspace
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add crates/fs-core/src/vfs_io.rs
git commit -m "docs(fs-core): replace vfs_io transitional comment with post-refactor doc"
```

---

## Stage 5: Roadmap + documentation update

### Task 5.1: Update `remote-workspace-roadmap.md` Slice B status

- [ ] **Step 1: Read the current status row**

Open `docs/planning/remote-workspace-roadmap.md`, find the row for "B — Remote Operation Pipeline for SFTP" in the "Current Implementation Status" table.

- [ ] **Step 2: Update it**

Replace the row body with:

- Status: `**Done**`
- Evidence: "Single-URI write methods (`create_directory`, `create_file`, `rename`, `remove`, `copy_file` same-provider, `read_file_prefix`) implemented on the `VfsProvider` trait. `LocalFsProvider` and `SftpProvider` provide concrete impls; `VfsFilesystem` reduced to cross-scheme orchestration. `ProviderCapabilities` reflects trait reality."
- Remaining: "Trash/archive/editor-save still local-only by design; documented in Phase 4 (power-user workflows) and Phase 5 (protocol expansion readiness)."

- [ ] **Step 3: Commit**

```bash
git add docs/planning/remote-workspace-roadmap.md
git commit -m "docs(roadmap): mark Slice B (remote op pipeline) done after VfsProvider write refactor"
```

### Task 5.2: Update API reference

- [ ] **Step 1: Update `docs/architecture/api-reference.md`**

Find the section that documents `VfsProvider` (or the closest equivalent — search for "VfsProvider" in `docs/architecture/`). Append a paragraph listing the new trait surface:

```markdown
**Write surface (added 2026-MM-DD):** `create_directory`, `create_file`, `rename`,
`remove`, `copy_file` (same-provider), `read_file_prefix`. Cross-provider copy
and move flow through `fs_core::vfs_io::VfsFilesystem`, which composes two
provider impls. Providers that don't support writes inherit `UnsupportedOperation`
defaults from the trait.
```

If no architecture doc covers `VfsProvider` yet, add a short subsection in `docs/architecture/modules/vfs.md` with the same content.

- [ ] **Step 2: Verify docs build**

```bash
pnpm format:check
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/api-reference.md docs/architecture/modules/vfs.md
git commit -m "docs(architecture): document new VfsProvider write surface"
```

---

## Verification matrix

After every stage:

- `cargo test --workspace`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo fmt --all -- --check`

After Stage 4:

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check` (no TS changes expected, but verify catalogs guard still passes).

Manual smoke after Stage 4 (when next available against a real SFTP server):

- Create folder on `sftp://`
- Rename a remote file
- Delete a remote tree
- Copy a remote file within the same profile
- Copy a local file to remote (cross-scheme orchestration)
- Copy a remote file to local
- Move a remote file (within profile = trait `rename`; cross-profile = orchestrated copy + remove)

---

## Self-review checklist

- Each trait method has a default `UnsupportedOperation` impl so unrelated providers don't break.
- `LocalFsProvider` and `SftpProvider` both implement every new write method.
- `VfsFilesystem` no longer has per-scheme dispatch for single-URI writes; cross-scheme `copy_file` orchestration stays.
- `ProviderCapabilities::read_write()` is reported by providers that actually implement the trait writes.
- Tests cover every new write method on `LocalFsProvider`; SFTP coverage uses mock sessions where feasible, real-server smoke where not.
- `OperationRuntime` continues to construct `VfsFilesystem` (now with the registry) and is the only IPC-facing entry point — no command handlers call provider methods directly.
- The transitional comment in `vfs_io.rs` is replaced with a post-refactor doc.
- Roadmap "Current Implementation Status" reflects the new state.
