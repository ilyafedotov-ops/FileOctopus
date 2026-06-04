# FileOctopus Architecture and Security Review

Date: 2026-06-03

## Findings

### 1. High: plugin IDs can escape the plugin directory and later drive `remove_dir_all`

`apps/desktop-tauri/src-tauri/src/commands/plugin.rs` builds `dest_dir` with `state.plugins_dir.join(&manifest.id)`, while `crates/plugin-core/src/lib.rs` only validates that `id` is non-empty.

A manifest ID like `../outside` or an absolute path can install outside `data/plugins`; the stored `install_path` is later passed to `remove_dir_all` on uninstall.

Recommended fix:

- Enforce a strict plugin ID regex.
- Reject path separators, absolute paths, and `..`.
- Canonicalize or lexically normalize the destination.
- Recheck containment before uninstall deletion.

### 2. Medium: SMB passwords are exposed in subprocess arguments

`crates/provider-smb/src/connector.rs` invokes `smbclient` and passes credentials as `username%password` in a command-line argument.

On many systems, other local processes or users can inspect process arguments.

Recommended fix:

- Prefer a native SMB library.
- If `smbclient` remains, pass credentials through a restrictive temporary auth file or file descriptor and delete it immediately.

### 3. Medium: SSH/SFTP trust-on-first-use is automatic

SFTP rejects mismatches only when a fingerprint is already stored. New fingerprints are persisted automatically by the remote session manager and terminal SSH path.

A first-connection MITM can therefore be trusted silently.

Recommended fix:

- Return an `unknown_host_key` or `host_key_changed` response with the observed fingerprint.
- Require explicit user confirmation before persisting the fingerprint.

### 4. Low: diagnostics export includes raw recent logs

The diagnostics bundle destination is well-contained, but the bundle includes `recent-log.txt` from the latest log file. Unlike operation history, this log excerpt is not redacted.

Recommended fix:

- Add a redaction pass for home paths, profile IDs, hostnames, tokens, password-like values, and private key paths.

## Architecture Opinion

The core architecture is sound for a Tauri file manager. The frontend does not get direct filesystem plugin permissions, Tauri capabilities are narrow, `ResourceUri` is consistently used, archive extraction has path containment, and diagnostics output path validation is strong.

The main systemic risk is that the custom IPC surface is intentionally powerful: file mutation, ACLs, terminal command execution, remote credentials, and plugins. That is acceptable for the product, but any renderer compromise becomes high impact. Keep investing in command-level validation, confirmation gates for destructive or command-execution-capable actions, and tests that treat IPC as hostile input.

## Validation Performed

- `cargo audit --json`: no active Rust vulnerability advisories; warnings include unmaintained GTK3-era crates and a `glib` unsoundness advisory.
- `pnpm audit --json`: zero vulnerabilities.
- `cargo test -p plugin-core -p provider-smb -p remote-core`: passed.
- `pnpm --filter @fileoctopus/ts-api test`: passed.
