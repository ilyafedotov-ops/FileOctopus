# Security

FileOctopus is a desktop file manager with intentionally powerful local
capabilities. The security model assumes the Rust backend is the authority for
filesystem, terminal, remote-provider, plugin, and diagnostics actions.

## Trust Boundary

- Frontend code does not receive unrestricted filesystem permissions.
- Filesystem resources cross IPC as `local://` `ResourceUri` strings.
- Mutating filesystem work goes through `plan_file_operation` and
  `start_file_operation`.
- IPC errors cross as stable `IpcError { code, message }` values.
- Event names are shared through `crates/app-ipc` and `packages/ts-api`.

## Areas Requiring Security Review

- IPC command or DTO changes.
- Filesystem mutation, archive extraction, path normalization, and symlink
  handling.
- Terminal execution, SSH, host-key trust, and remote provider credentials.
- Plugin installation, plugin IDs, sandbox permissions, and uninstall paths.
- Diagnostics export content and log redaction.
- Tauri permissions, CSP, and capability changes.

## Current Automated Checks

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:backend:rc`
- `bash scripts/pre-push-audit.sh`
- `secretlint` through the pre-commit hook and release-prep checks

Report vulnerabilities through GitHub private vulnerability reporting. See the
root [SECURITY.md](../../SECURITY.md).
