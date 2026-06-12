# Cloud Placeholder File Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make FileOctopus detect macOS/Windows cloud placeholder ("dataless") files, show a cloud badge, gate large auto-downloads in the preview panel, label hydration as "Downloading from cloud…", and surface a stable `cloud_unavailable` error instead of the raw "Operation timed out (os error 60)" string.

**Architecture:** Detection happens once at the local-FS boundary: `FileEntry` gains `is_placeholder` (read from metadata bits already in hand), and every io-error mapping funnel classifies `ErrorKind::TimedOut` on a still-dataless file as a new `CloudUnavailable` error (code `cloud_unavailable`). The IPC layer mirrors both additively (`isPlaceholder`, `CLOUD_UNAVAILABLE`). The frontend consumes the two facts: friendly message, row badge, preview size-gate (10 MB), and loading labels. Separately, three Tauri read commands move their blocking reads onto `spawn_blocking`.

**Tech Stack:** Rust 2021 (cargo workspace), serde camelCase DTOs, React 19 + TypeScript, Vitest. No new dependencies.

**Important repo rules:** No code comments. IPC contract must change on both sides in the same commit (`packages/ts-api/tests/catalogs.test.ts` enforces error-code parity by parsing the Rust source). This plan file stays **untracked** — never `git add` it. Repo lives in iCloud-synced ~/Documents: before building/pushing, delete any `* 2.*` duplicate artifacts (see memory note).

**Background facts (verified during diagnosis on 2026-06-12):**

- Files under `~/Library/CloudStorage/*` that aren't downloaded carry the BSD `SF_DATALESS` flag (`0x4000_0000` in `st_flags`), visible via `ls -lO`.
- Reading one triggers kernel hydration; if the provider app (e.g. OneDrive main app) isn't running, the syscall fails fast with errno 60 (`ETIMEDOUT`), which Rust maps to `io::ErrorKind::TimedOut` (errno 110 on Linux maps to the same kind, so kind-based matching is cross-platform).
- Directory listing works regardless (placeholder metadata is local), so `stat`/`list` succeed while reads fail.

---

### Task 0: Branch setup

- [ ] **Step 0.1: Create the feature branch** (no worktree — iCloud sync corrupts worktrees in this repo)

```bash
cd /Users/ilya/Documents/FileOctupus
git checkout -b fix/cloud-placeholder-files
```

---

### Task 1: `cloud_unavailable` error vocabulary in `crates/vfs`

**Files:**

- Modify: `crates/vfs/src/lib.rs` (VfsError enum ~line 711, code() ~758, constructors ~803, Display ~834; FileOperationError enum ~459, code() ~490, user_message() ~510; From<VfsError> ~541; inline `mod tests` at bottom)

- [ ] **Step 1.1: Write the failing test** — add to the existing inline `mod tests` at the bottom of `crates/vfs/src/lib.rs`:

```rust
#[test]
fn cloud_unavailable_codes_are_stable() {
    let uri = ResourceUri::parse("local:///tmp/file.txt").unwrap();
    let vfs_error = VfsError::cloud_unavailable(&uri);
    assert_eq!(vfs_error.code(), "cloud_unavailable");

    let op_error = FileOperationError::from(vfs_error);
    assert_eq!(op_error.code(), "cloud_unavailable");
    assert!(op_error.user_message().contains("local:///tmp/file.txt"));
}
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `cargo test -p vfs cloud_unavailable_codes_are_stable`
Expected: COMPILE ERROR (`no function or associated item named cloud_unavailable`)

- [ ] **Step 1.3: Implement.** In `VfsError`, after the `DeviceUnavailable` variant:

```rust
    CloudUnavailable {
        uri: String,
    },
```

In `VfsError::code()`, after the `DeviceUnavailable` arm:

```rust
            Self::CloudUnavailable { .. } => "cloud_unavailable",
```

Next to the other constructors (`not_found`, `permission_denied`, ~line 803):

```rust
    pub fn cloud_unavailable(uri: &ResourceUri) -> Self {
        Self::CloudUnavailable {
            uri: uri.as_str().to_string(),
        }
    }
```

In `impl fmt::Display for VfsError`, after the `DeviceUnavailable` arm:

```rust
            Self::CloudUnavailable { uri } => {
                write!(formatter, "cloud file could not be downloaded `{uri}`")
            }
```

In `FileOperationError`, after the `Timeout { message: String },` variant:

```rust
    CloudUnavailable { uri: String },
```

In `FileOperationError::code()`, after the `Timeout` arm:

```rust
            Self::CloudUnavailable { .. } => "cloud_unavailable",
```

In `FileOperationError::user_message()`, add a dedicated arm (do NOT fold into the big `|` group):

```rust
            Self::CloudUnavailable { uri } => {
                format!("could not download cloud file `{uri}`")
            }
```

In `impl From<VfsError> for FileOperationError`, after the `VfsError::DeviceUnavailable` arm:

```rust
            VfsError::CloudUnavailable { uri } => Self::CloudUnavailable { uri },
```

- [ ] **Step 1.4: Run test and workspace check.** Both error enums are matched exhaustively in places this plan can't enumerate — `cargo check` finds them all.

Run: `cargo test -p vfs cloud_unavailable_codes_are_stable && cargo check --workspace`
Expected: test PASS. If `cargo check` reports non-exhaustive `match` errors in other crates, add a `CloudUnavailable` arm mirroring whatever the adjacent `DeviceUnavailable`/`Timeout` arm does in that match, then re-run until clean.

- [ ] **Step 1.5: Commit**

```bash
git add crates/vfs
git commit -m "feat(vfs): add cloud_unavailable error vocabulary"
```

---

### Task 2: `FileEntry.is_placeholder` field

**Files:**

- Modify: `crates/vfs/src/lib.rs:184` (struct) plus test literals ~1115, ~1265
- Modify (add `is_placeholder: false,` to each `FileEntry { … }` literal):
  - `crates/fs-core/src/lib.rs:74`
  - `crates/fs-core/src/direct_ops.rs:73`
  - `crates/fs-core/tests/provider_neutral_planning.rs:176`
  - `crates/app-ipc/src/lib.rs:877` (inline test)
  - `crates/provider-sftp/src/provider.rs:444`, `crates/provider-sftp/src/connector.rs:376`
  - `crates/provider-s3/src/provider.rs:94`, `:135`, `:170`, `crates/provider-s3/src/ops.rs:18`, `:66`
  - `crates/provider-dropbox/src/ops.rs:26`
  - `crates/provider-onedrive/src/ops.rs:36`
  - `crates/provider-gdrive/src/ops.rs:33`
  - `crates/provider-smb/src/provider.rs:387`, `crates/provider-smb/src/ops.rs:56`, `:153`

- [ ] **Step 2.1: Add the field.** In `crates/vfs/src/lib.rs` `pub struct FileEntry`, after `pub is_symlink: bool,`:

```rust
    pub is_placeholder: bool,
```

- [ ] **Step 2.2: Update every construction site.** Add `is_placeholder: false,` to each literal listed above (line numbers are pre-change anchors; the literal starts there). Remote providers are genuinely `false` — the placeholder concept only applies to local File Provider mounts.

- [ ] **Step 2.3: Verify nothing is missed**

Run: `cargo check --workspace`
Expected: clean. Any `missing field is_placeholder` error points to a site missed above — fix and re-run.

Run: `cargo test -p vfs && cargo test -p fs-core && cargo test -p app-ipc`
Expected: PASS.

- [ ] **Step 2.4: Commit**

```bash
git add crates
git commit -m "feat(vfs): add is_placeholder flag to FileEntry"
```

---

### Task 3: Placeholder detection + timeout classification in `fs-core`

**Files:**

- Create: `crates/fs-core/src/placeholder.rs`
- Create: `crates/fs-core/tests/placeholder.rs`
- Modify: `crates/fs-core/src/lib.rs` (module decl ~line 12-21; `map_io_error` :31; `entry_for_path` :74)
- Modify: `crates/fs-core/src/direct_ops.rs` (`entry_for_path` ~:73, `map_std_io_error` ~:110)
- Modify: `crates/fs-core/src/metadata.rs` (`map_io_error` ~:232)
- Modify: `crates/fs-core/src/vfs_io.rs` (`map_local_io` ~:674)
- Modify: `crates/fs-core/src/file_ops/paths.rs` (`map_io_error` ~:39, `map_std_io_error` ~:51)

- [ ] **Step 3.1: Write the failing tests** — create `crates/fs-core/tests/placeholder.rs`:

```rust
use std::path::Path;

use fs_core::placeholder::{
    attributes_indicate_placeholder, classify_timed_out_path, classify_timed_out_uri,
    flags_indicate_placeholder, is_placeholder_path, FILE_ATTRIBUTE_OFFLINE,
    FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS, FILE_ATTRIBUTE_RECALL_ON_OPEN, SF_DATALESS,
};
use vfs::ResourceUri;

#[test]
fn dataless_flag_is_detected() {
    assert!(flags_indicate_placeholder(SF_DATALESS));
    assert!(flags_indicate_placeholder(SF_DATALESS | 0x1));
    assert!(!flags_indicate_placeholder(0));
    assert!(!flags_indicate_placeholder(0x1));
}

#[test]
fn windows_recall_attributes_are_detected() {
    assert!(attributes_indicate_placeholder(FILE_ATTRIBUTE_OFFLINE));
    assert!(attributes_indicate_placeholder(FILE_ATTRIBUTE_RECALL_ON_OPEN));
    assert!(attributes_indicate_placeholder(
        FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS
    ));
    assert!(!attributes_indicate_placeholder(0x20));
    assert!(!attributes_indicate_placeholder(0));
}

#[test]
fn regular_file_is_not_a_placeholder() {
    let path = std::env::temp_dir().join(format!("fo-placeholder-{}", std::process::id()));
    std::fs::write(&path, b"data").unwrap();
    assert!(!is_placeholder_path(&path));
    std::fs::remove_file(&path).ok();
}

#[test]
fn missing_file_is_not_a_placeholder() {
    assert!(!is_placeholder_path(Path::new("/nonexistent/fo-placeholder")));
}

#[test]
fn timed_out_on_regular_file_classifies_as_timeout() {
    let path = std::env::temp_dir().join(format!("fo-timeout-{}", std::process::id()));
    std::fs::write(&path, b"data").unwrap();
    let error = std::io::Error::from_raw_os_error(60);
    let uri = ResourceUri::from_local_path(&path).unwrap();

    assert_eq!(classify_timed_out_uri(&uri, &error).code(), "timeout");
    assert_eq!(classify_timed_out_path(&path, &error).code(), "timeout");
    std::fs::remove_file(&path).ok();
}
```

- [ ] **Step 3.2: Run tests to verify they fail**

Run: `cargo test -p fs-core --test placeholder`
Expected: COMPILE ERROR (`could not find placeholder in fs_core`)

- [ ] **Step 3.3: Create `crates/fs-core/src/placeholder.rs`:**

```rust
use std::fs::Metadata;
use std::path::Path;

use vfs::{FileOperationError, ResourceUri};

pub const SF_DATALESS: u32 = 0x4000_0000;
pub const FILE_ATTRIBUTE_OFFLINE: u32 = 0x0000_1000;
pub const FILE_ATTRIBUTE_RECALL_ON_OPEN: u32 = 0x0004_0000;
pub const FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS: u32 = 0x0040_0000;

pub fn flags_indicate_placeholder(st_flags: u32) -> bool {
    st_flags & SF_DATALESS != 0
}

pub fn attributes_indicate_placeholder(attributes: u32) -> bool {
    attributes
        & (FILE_ATTRIBUTE_OFFLINE
            | FILE_ATTRIBUTE_RECALL_ON_OPEN
            | FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS)
        != 0
}

#[cfg(target_os = "macos")]
pub fn is_placeholder_metadata(metadata: &Metadata) -> bool {
    use std::os::macos::fs::MetadataExt;
    flags_indicate_placeholder(metadata.st_flags())
}

#[cfg(windows)]
pub fn is_placeholder_metadata(metadata: &Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    attributes_indicate_placeholder(metadata.file_attributes())
}

#[cfg(not(any(target_os = "macos", windows)))]
pub fn is_placeholder_metadata(_metadata: &Metadata) -> bool {
    false
}

pub fn is_placeholder_path(path: &Path) -> bool {
    std::fs::symlink_metadata(path)
        .map(|metadata| is_placeholder_metadata(&metadata))
        .unwrap_or(false)
}

pub fn classify_timed_out_uri(uri: &ResourceUri, error: &std::io::Error) -> FileOperationError {
    match uri.to_local_path() {
        Ok(path) if is_placeholder_path(&path) => FileOperationError::CloudUnavailable {
            uri: uri.as_str().to_string(),
        },
        _ => FileOperationError::timeout(error.to_string()),
    }
}

pub fn classify_timed_out_path(path: &Path, error: &std::io::Error) -> FileOperationError {
    if is_placeholder_path(path) {
        let uri = ResourceUri::from_local_path(path)
            .map(|uri| uri.as_str().to_string())
            .unwrap_or_else(|_| path.to_string_lossy().to_string());
        FileOperationError::CloudUnavailable { uri }
    } else {
        FileOperationError::timeout(error.to_string())
    }
}
```

In `crates/fs-core/src/lib.rs`, add to the module list (alphabetical, after `pub mod metadata;`):

```rust
pub mod placeholder;
```

- [ ] **Step 3.4: Wire detection into entry construction.**

In `crates/fs-core/src/lib.rs` `entry_for_path` (the `FileEntry` literal at ~:74), change `is_placeholder: false,` to:

```rust
            is_placeholder: placeholder::is_placeholder_metadata(&metadata),
```

In `crates/fs-core/src/direct_ops.rs` `entry_for_path` (~:73), change `is_placeholder: false,` to:

```rust
        is_placeholder: crate::placeholder::is_placeholder_metadata(&metadata),
```

- [ ] **Step 3.5: Wire timeout classification into all six mapping funnels.**

`crates/fs-core/src/lib.rs` `LocalFsProvider::map_io_error` (:31) — add an arm before the `_` fallback:

```rust
            io::ErrorKind::TimedOut => {
                let is_placeholder = uri
                    .to_local_path()
                    .map(|path| placeholder::is_placeholder_path(&path))
                    .unwrap_or(false);
                if is_placeholder {
                    VfsError::cloud_unavailable(uri)
                } else {
                    VfsError::timeout(uri)
                }
            }
```

`crates/fs-core/src/vfs_io.rs` `map_local_io` (:674) — add before the `_` fallback:

```rust
        std::io::ErrorKind::TimedOut => crate::placeholder::classify_timed_out_uri(uri, &error),
```

`crates/fs-core/src/metadata.rs` `map_io_error` (~:232) — add before the `_` fallback:

```rust
        std::io::ErrorKind::TimedOut => crate::placeholder::classify_timed_out_uri(uri, &error),
```

`crates/fs-core/src/file_ops/paths.rs` `map_io_error` (~:39) — add before the `_` fallback:

```rust
        std::io::ErrorKind::TimedOut => crate::placeholder::classify_timed_out_uri(uri, &error),
```

`crates/fs-core/src/file_ops/paths.rs` `map_std_io_error` (~:51) — add before the `_` fallback:

```rust
        std::io::ErrorKind::TimedOut => crate::placeholder::classify_timed_out_path(path, &error),
```

`crates/fs-core/src/direct_ops.rs` `map_std_io_error` (~:110) — add before the `_` fallback:

```rust
        std::io::ErrorKind::TimedOut => crate::placeholder::classify_timed_out_path(path, &error),
```

- [ ] **Step 3.6: Run tests**

Run: `cargo test -p fs-core && cargo check --workspace`
Expected: all PASS (new placeholder tests included), clean check.

- [ ] **Step 3.7: Commit**

```bash
git add crates/fs-core
git commit -m "feat(fs-core): detect cloud placeholders and classify hydration timeouts"
```

---

### Task 4: IPC contract — Rust DTO/code + TS mirror (one commit, parity test enforces this)

**Files:**

- Modify: `crates/app-ipc/src/lib.rs` (error_codes module ~:101-185; `From<FileEntry> for FileEntryDto` :339; inline tests ~:867+)
- Modify: `crates/app-ipc/src/listing.rs` (`FileEntryDto` :46)
- Modify: `packages/ts-api/src/types.ts` (`IPC_ERROR_CODES` ~:10-50; `FileEntryDto` :1042)

- [ ] **Step 4.1: Write the failing Rust test** — add to the inline `mod tests` in `crates/app-ipc/src/lib.rs`:

```rust
    #[test]
    fn cloud_unavailable_ipc_error_preserves_code() {
        let uri = ResourceUri::parse("local:///tmp/file.txt").unwrap();
        let error = IpcError::from(vfs::VfsError::cloud_unavailable(&uri));
        assert_eq!(error.code, error_codes::CLOUD_UNAVAILABLE);
    }
```

Run: `cargo test -p app-ipc cloud_unavailable_ipc_error_preserves_code`
Expected: COMPILE ERROR (`CLOUD_UNAVAILABLE` not found)

- [ ] **Step 4.2: Add the Rust constant.** In `crates/app-ipc/src/lib.rs` `pub mod error_codes`, after `pub const DEVICE_UNAVAILABLE: …`:

```rust
    pub const CLOUD_UNAVAILABLE: &str = "cloud_unavailable";
```

And in the `ALL` slice, after `DEVICE_UNAVAILABLE,`:

```rust
        CLOUD_UNAVAILABLE,
```

- [ ] **Step 4.3: Add the DTO field.** In `crates/app-ipc/src/listing.rs` `FileEntryDto`, at the end of the struct after the `description` field:

```rust
    #[serde(default)]
    pub is_placeholder: bool,
```

In `crates/app-ipc/src/lib.rs` `impl From<FileEntry> for FileEntryDto` (:339), after `owner: entry.owner,`:

```rust
            is_placeholder: entry.is_placeholder,
```

- [ ] **Step 4.4: Run Rust tests; fix any snapshot-style expectations**

Run: `cargo test -p app-ipc`
Expected: the new test PASSES. If existing serialization tests fail on the added `isPlaceholder` JSON field, update their expected JSON to include `"isPlaceholder": false` exactly as the failure diff shows. Also run `grep -rn "FileEntryDto {" crates apps --include="*.rs"` — any literal DTO construction found needs `is_placeholder: false,` added.

- [ ] **Step 4.5: Mirror in TypeScript.** In `packages/ts-api/src/types.ts`:

In `IPC_ERROR_CODES`, after the `TIMEOUT` entry:

```ts
  CLOUD_UNAVAILABLE: "cloud_unavailable",
```

In `interface FileEntryDto` (:1042), after `description?: string | null;`:

```ts
  isPlaceholder?: boolean;
```

- [ ] **Step 4.6: Run the parity + package tests**

Run: `pnpm --filter @fileoctopus/ts-api build && pnpm --filter @fileoctopus/ts-api test`
Expected: PASS — `catalogs.test.ts` compares Rust `error_codes` consts with `IPC_ERROR_CODES`; both sides now match.

- [ ] **Step 4.7: Commit**

```bash
git add crates/app-ipc packages/ts-api
git commit -m "feat(ipc): expose isPlaceholder flag and cloud_unavailable error code"
```

---

### Task 5: Frontend friendly message

**Files:**

- Modify: `packages/frontend/src/dialogs/operationJobState.ts` (`operationErrorMessage` :182)
- Test: `packages/frontend/tests/operationDialogUtils.test.ts` (existing `describe("operationErrorMessage")` block ~:61)

- [ ] **Step 5.1: Write the failing test** — add inside the existing `describe("operationErrorMessage", …)` block:

```ts
it("returns a friendly message for cloud_unavailable", () => {
  expect(operationErrorMessage("cloud_unavailable", "fallback")).toBe(
    "Couldn't download this file from its cloud provider. Make sure the cloud storage app (OneDrive, iCloud, …) is running and online, then try again.",
  );
});
```

Run: `pnpm --filter @fileoctopus/frontend test -- -t "cloud_unavailable"`
Expected: FAIL (receives `"fallback"`)

- [ ] **Step 5.2: Implement.** In the `messages` map in `operationErrorMessage`, after the `TIMEOUT` entry:

```ts
    [IPC_ERROR_CODES.CLOUD_UNAVAILABLE]:
      "Couldn't download this file from its cloud provider. Make sure the cloud storage app (OneDrive, iCloud, …) is running and online, then try again.",
```

- [ ] **Step 5.3: Run test**

Run: `pnpm --filter @fileoctopus/frontend test -- -t "cloud_unavailable"`
Expected: PASS

- [ ] **Step 5.4: Commit**

```bash
git add packages/frontend/src/dialogs/operationJobState.ts packages/frontend/tests/operationDialogUtils.test.ts
git commit -m "feat(frontend): friendly message for cloud_unavailable errors"
```

---

### Task 6: Cloud badge in file rows

**Files:**

- Modify: `packages/frontend/src/pane/FileRow.tsx` (after symlink badge, :219-227)
- Modify: `packages/frontend/src/styles/regions/pane.css` (after `.fo-row-selected .fo-row-symlink-badge` block ~:1043)
- Test: `packages/frontend/tests/fileRow.test.tsx`

- [ ] **Step 6.1: Write the failing test.** Open `packages/frontend/tests/fileRow.test.tsx`, copy its existing minimal render setup (entry factory + render helper), and add:

```tsx
it("shows a cloud badge for placeholder entries", () => {
  // reuse this file's existing entry factory/render helper; override the entry with isPlaceholder: true
  expect(screen.getByLabelText("Cloud-only file")).toBeInTheDocument();
});

it("shows no cloud badge for regular entries", () => {
  // render with the default entry (isPlaceholder undefined)
  expect(screen.queryByLabelText("Cloud-only file")).toBeNull();
});
```

Run: `pnpm --filter @fileoctopus/frontend test -- -t "cloud badge"`
Expected: FAIL (badge not rendered)

- [ ] **Step 6.2: Implement.** In `FileRow.tsx`, immediately after the symlink-badge conditional (`{entry.isSymlink ? (…) : null}` ending :227):

```tsx
{
  entry.isPlaceholder ? (
    <span
      className="fo-row-cloud-badge"
      aria-label="Cloud-only file"
      title="Cloud-only — downloads when opened"
    >
      ☁
    </span>
  ) : null;
}
```

In `pane.css`, after the `.fo-row-selected .fo-row-symlink-badge` rule:

```css
.fo-row-cloud-badge {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 2px;
  color: var(--fo-muted-text);
  font-size: 11px;
}

.fo-row-selected .fo-row-cloud-badge {
  color: var(--fo-on-accent-soft);
}
```

- [ ] **Step 6.3: Run tests**

Run: `pnpm --filter @fileoctopus/frontend test -- -t "cloud badge"`
Expected: PASS

- [ ] **Step 6.4: Commit**

```bash
git add packages/frontend/src/pane/FileRow.tsx packages/frontend/src/styles/regions/pane.css packages/frontend/tests/fileRow.test.tsx
git commit -m "feat(frontend): cloud badge for placeholder entries in file rows"
```

---

### Task 7: Preview panel download gate + downloading label

**Files:**

- Modify: `packages/frontend/src/components/PreviewPanel.tsx`
- Modify: `packages/frontend/src/styles/regions/dialogs.css` (preview styles live here — `fo-preview-loading` is in this file)
- Create: `packages/frontend/tests/previewCloudGate.test.ts`

- [ ] **Step 7.1: Write the failing tests** — create `packages/frontend/tests/previewCloudGate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import {
  CLOUD_AUTO_DOWNLOAD_LIMIT_BYTES,
  shouldDeferCloudDownload,
} from "../src/components/PreviewPanel";

function entry(overrides: Partial<FileEntryDto>): FileEntryDto {
  return {
    uri: "local:///tmp/file.txt",
    name: "file.txt",
    kind: "file",
    isHidden: false,
    isSymlink: false,
    providerId: "local",
    canRead: true,
    canList: false,
    canWrite: true,
    canDelete: true,
    canRename: true,
    ...overrides,
  } as FileEntryDto;
}

describe("shouldDeferCloudDownload", () => {
  it("defers placeholders larger than the limit", () => {
    expect(
      shouldDeferCloudDownload(
        entry({
          isPlaceholder: true,
          size: CLOUD_AUTO_DOWNLOAD_LIMIT_BYTES + 1,
        }),
      ),
    ).toBe(true);
  });

  it("auto-loads small placeholders", () => {
    expect(
      shouldDeferCloudDownload(entry({ isPlaceholder: true, size: 1024 })),
    ).toBe(false);
  });

  it("auto-loads placeholders with unknown size", () => {
    expect(shouldDeferCloudDownload(entry({ isPlaceholder: true }))).toBe(
      false,
    );
  });

  it("never defers regular files regardless of size", () => {
    expect(shouldDeferCloudDownload(entry({ size: 50 * 1024 * 1024 }))).toBe(
      false,
    );
  });

  it("returns false for null", () => {
    expect(shouldDeferCloudDownload(null)).toBe(false);
  });
});
```

Run: `pnpm --filter @fileoctopus/frontend test -- -t "shouldDeferCloudDownload"`
Expected: FAIL (export not found)

- [ ] **Step 7.2: Implement helper + gate in `PreviewPanel.tsx`.**

After the `MAX_DATA_URI_PREVIEW_BYTES` const (:106), add:

```ts
export const CLOUD_AUTO_DOWNLOAD_LIMIT_BYTES = 10 * 1024 * 1024;

export function shouldDeferCloudDownload(entry: FileEntryDto | null): boolean {
  if (!entry?.isPlaceholder) return false;
  return (entry.size ?? 0) > CLOUD_AUTO_DOWNLOAD_LIMIT_BYTES;
}
```

Inside the component, after the `zoom` state (:203), add:

```ts
const [cloudDownloadApproved, setCloudDownloadApproved] = useState(false);
```

Add a dedicated reset effect (so clicking the button doesn't immediately un-approve):

```ts
useEffect(() => {
  setCloudDownloadApproved(false);
}, [entry]);
```

Change the existing load effect (:245-255) condition from
`if (entry && isPreviewable(entry)) {` to:

```ts
if (
  entry &&
  isPreviewable(entry) &&
  (!shouldDeferCloudDownload(entry) || cloudDownloadApproved)
) {
  void loadContent();
}
```

and add `cloudDownloadApproved` to that effect's dependency array.

In the header meta (:325), replace `{loading ? "Loading..." : …}` with:

```tsx
{
  loading
    ? entry.isPlaceholder
      ? "Downloading from cloud…"
      : "Loading..."
    : error
      ? "Error"
      : formatBytes(byteSize);
}
```

In the content area, replace `{loading && <div className="fo-preview-loading">Loading...</div>}` with:

```tsx
{
  loading && (
    <div className="fo-preview-loading">
      {entry.isPlaceholder ? "Downloading from cloud…" : "Loading..."}
    </div>
  );
}
{
  !loading &&
    !error &&
    shouldDeferCloudDownload(entry) &&
    !cloudDownloadApproved && (
      <div className="fo-preview-cloud-gate">
        <p>
          Cloud-only file ({formatBytes(entry.size ?? 0)}) — not downloaded to
          this device yet.
        </p>
        <button onClick={() => setCloudDownloadApproved(true)}>
          Download and preview
        </button>
      </div>
    );
}
```

In `dialogs.css`, near the `.fo-preview-loading` rule, add:

```css
.fo-preview-cloud-gate {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 16px;
  color: var(--fo-muted-text);
  text-align: center;
}
```

- [ ] **Step 7.3: Run tests + typecheck**

Run: `pnpm --filter @fileoctopus/frontend test -- -t "shouldDeferCloudDownload" && pnpm --filter @fileoctopus/frontend typecheck`
Expected: PASS, clean

- [ ] **Step 7.4: Commit**

```bash
git add packages/frontend/src/components/PreviewPanel.tsx packages/frontend/src/styles/regions/dialogs.css packages/frontend/tests/previewCloudGate.test.ts
git commit -m "feat(frontend): gate large cloud-only files in preview with download prompt"
```

---

### Task 8: "Downloading from cloud…" labels in viewer and editor

**Files:**

- Modify: `packages/frontend/src/components/viewer/ViewerTextMode.tsx:102`
- Modify: `packages/frontend/src/components/viewer/ViewerHexMode.tsx:115`
- Modify: `packages/frontend/src/components/editor/EditorDialog.tsx:424`

- [ ] **Step 8.1: Implement.** All three components already receive `entry` (`FileEntryDto`).

`ViewerTextMode.tsx:102` — replace `{loading && <div className="fo-viewer-loading">Loading…</div>}` with:

```tsx
{
  loading && (
    <div className="fo-viewer-loading">
      {entry.isPlaceholder ? "Downloading from cloud…" : "Loading…"}
    </div>
  );
}
```

`ViewerHexMode.tsx:115` — same replacement (identical JSX, same `fo-viewer-loading` class).

`EditorDialog.tsx:424` — replace `{loading && <div className="fo-editor-loading">Loading…</div>}` with:

```tsx
{
  loading && (
    <div className="fo-editor-loading">
      {entry?.isPlaceholder ? "Downloading from cloud…" : "Loading…"}
    </div>
  );
}
```

(Editor uses `entry?.` — entry can be momentarily unset in that component.)

- [ ] **Step 8.2: Verify**

Run: `pnpm --filter @fileoctopus/frontend typecheck && pnpm --filter @fileoctopus/frontend test`
Expected: clean, all PASS

- [ ] **Step 8.3: Commit**

```bash
git add packages/frontend/src/components/viewer packages/frontend/src/components/editor/EditorDialog.tsx
git commit -m "feat(frontend): show downloading-from-cloud label while hydrating placeholders"
```

---

### Task 9: Move blocking reads off the async runtime in Tauri commands

**Files:**

- Modify: `apps/desktop-tauri/src-tauri/src/commands/fs.rs` (`fs_read_text_file` :62-65, `fs_read_file_as_data_uri` :399-403, `fs_read_image_as_data_uri` :442-446)

Rationale: `VfsFilesystem::read_file_prefix` blocks via `block_on_vfs`; calling it directly in an async command pins a tokio worker for the whole cloud hydration. `fs_read_file_range` (:97) already wraps in `spawn_blocking` — replicate that pattern. In all three functions `uri` is not used after the read, so it can move into the closure.

- [ ] **Step 9.1: `fs_read_text_file`** — replace:

```rust
    let vfs = VfsFilesystem::with_sessions(state.sessions(), state.vfs());
    let buf = vfs
        .read_file_prefix(&uri, read_len)
        .map_err(IpcError::from)?;
```

with:

```rust
    let vfs = VfsFilesystem::with_sessions(state.sessions(), state.vfs());
    let buf = tauri::async_runtime::spawn_blocking(move || vfs.read_file_prefix(&uri, read_len))
        .await
        .map_err(|_| IpcError::internal("read_text_file task join failed"))?
        .map_err(IpcError::from)?;
```

- [ ] **Step 9.2: `fs_read_file_as_data_uri`** — replace:

```rust
    let vfs = VfsFilesystem::with_sessions(state.sessions(), state.vfs());
    let read_len = entry.size.unwrap_or(max_bytes);
    let buf = vfs
        .read_file_prefix(&uri, read_len)
        .map_err(IpcError::from)?;
```

with:

```rust
    let vfs = VfsFilesystem::with_sessions(state.sessions(), state.vfs());
    let read_len = entry.size.unwrap_or(max_bytes);
    let buf = tauri::async_runtime::spawn_blocking(move || vfs.read_file_prefix(&uri, read_len))
        .await
        .map_err(|_| IpcError::internal("read_file_as_data_uri task join failed"))?
        .map_err(IpcError::from)?;
```

- [ ] **Step 9.3: `fs_read_image_as_data_uri`** — replace:

```rust
    let vfs = VfsFilesystem::with_sessions(state.sessions(), state.vfs());
    let read_len = entry.size.unwrap_or(MAX_IMAGE_BYTES);
    let buf = vfs
        .read_file_prefix(&uri, read_len)
        .map_err(IpcError::from)?;
```

with:

```rust
    let vfs = VfsFilesystem::with_sessions(state.sessions(), state.vfs());
    let read_len = entry.size.unwrap_or(MAX_IMAGE_BYTES);
    let buf = tauri::async_runtime::spawn_blocking(move || vfs.read_file_prefix(&uri, read_len))
        .await
        .map_err(|_| IpcError::internal("read_image_as_data_uri task join failed"))?
        .map_err(IpcError::from)?;
```

- [ ] **Step 9.4: Verify**

Run: `cargo check --workspace && cargo test -p desktop-tauri 2>/dev/null || cargo test --workspace`
Expected: clean check, tests PASS

- [ ] **Step 9.5: Commit**

```bash
git add apps/desktop-tauri/src-tauri/src/commands/fs.rs
git commit -m "fix(tauri): run blocking file reads on spawn_blocking in read commands"
```

---

### Task 10: Full verification + manual QA

- [ ] **Step 10.1: iCloud artifact sweep** (per project memory — iCloud duplicates break builds)

```bash
find /Users/ilya/Documents/FileOctupus -name "* 2*" -not -path "*/node_modules/*" -not -path "*/target/*"
```

Expected: no output. Delete any hits before proceeding.

- [ ] **Step 10.2: Full Rust suite**

Run: `pnpm rust:fmt && pnpm rust:clippy && pnpm rust:check && pnpm rust:test`
Expected: all clean/PASS. Fix any clippy `-D warnings` findings (likely candidates: needless borrows in new code).

- [ ] **Step 10.3: Full JS suite**

Run: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`
Expected: all clean/PASS.

- [ ] **Step 10.4: Manual QA on real OneDrive placeholders** (requires this Mac; get user confirmation before quitting OneDrive)

1. In Finder, right-click a small file in `~/Library/CloudStorage/OneDrive-Personal` → "Free Up Space" to re-create a dataless file (verify with `ls -lO`, expect `dataless` flag). Do the same check for the large `.mp4` files which are likely still dataless.
2. `pnpm dev`, browse to the OneDrive folder: dataless files show the ☁ badge.
3. Quit OneDrive (`osascript -e 'quit app "OneDrive"'`). Open a dataless file in the viewer: expect the friendly cloud message (not "os error 60").
4. Relaunch OneDrive (`open -gj -a OneDrive`). Open the same file: expect "Downloading from cloud…" then content.
5. Select a >10 MB dataless file with the preview panel open: expect the "Download and preview" gate instead of an automatic download.

- [ ] **Step 10.5: Final commit if QA produced fixes; otherwise proceed to branch finishing** (use superpowers:finishing-a-development-branch — merge/PR decision belongs to the user).
