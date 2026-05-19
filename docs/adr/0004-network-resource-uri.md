# ADR 0004: Network Resource URI Model

## Status

Accepted

## Context

FileOctopus needs remote filesystem browsing through pluggable network providers. ADR-0003 established `local://` for local resources. Remote providers require canonical URI schemes, secure credential handling, and a session model tied to saved connection profiles.

## Decision

### URI schemes

| Scheme   | Authority    | Path body      | v1 provider |
| -------- | ------------ | -------------- | ----------- |
| `sftp`   | Profile UUID | POSIX absolute | Yes         |
| `smb`    | Profile UUID | POSIX absolute | Reserved    |
| `webdav` | Profile UUID | POSIX absolute | Reserved    |

Examples:

```text
sftp://550e8400-e29b-41d4-a716-446655440000/
sftp://550e8400-e29b-41d4-a716-446655440000/home/user/Documents
```

Rules:

- Authority is the UUID of a row in `network_profiles` (SQLite).
- Remote path is always POSIX (`/home/user`), never a host OS path.
- Path segments must not contain `..`.
- `ResourceUri::parse` accepts `sftp`, `smb`, and `webdav`; unregistered schemes fail at provider lookup with `unsupported_provider`.

### Credentials

- Passwords and private-key passphrases are stored in the OS keychain via `platform::SecretStore`.
- Profile metadata (host, port, username, auth kind) lives in `network.sqlite`.
- The frontend receives profile metadata and connection status only; secrets never cross the IPC boundary outbound.

### Host key verification (SFTP)

- On first successful connect, store the server host-key fingerprint in the profile row.
- On subsequent connects, reject mismatched fingerprints with `authentication_failed`.
- User may reset the fingerprint by editing the profile or reconnecting after explicit confirmation (future UI).

## Consequences

- Navigation favorites, recent entries, and pane state may persist `sftp://` URIs.
- File mutations remain local-only until the operation pipeline gains provider-aware execution.
- Remote entries expose read-only `EntryCapabilities` in v1.

## Alternatives

- OS mount integration only — rejected; does not support saved servers or cross-platform browsing without admin mounts.
- Raw `user@host:port` in URIs without profiles — deferred; profile-scoped URIs keep credentials and host metadata out of navigation state.
