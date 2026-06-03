# Welcome Wizard and Network Settings Expansion

Date: 2026-06-02
Status: Done

## Summary

FileOctopus currently has the right primitives for a stronger onboarding and
remote-connection experience, but the UI is thinner than the backend surface.
The first-run welcome overlay is a three-tile launcher, Network settings expose
only four raw preferences, and the Add Server wizard has a "Test" step that does
not perform a real connection test. The network stack already includes saved
profiles, status events, host-key pinning, keychain secrets, SFTP/SSH/SMB/S3
provider crates, cloud provider crates, and virtual `network:///` discovery.

This plan upgrades the experience in two layers:

- A polished, shippable UI pass for first-run setup, connection management,
  SSH/login parameters, provider-aware settings, and real status feedback.
- A small IPC/API expansion so advanced controls are backed by typed provider
  capabilities, profile test results, and JSON-backed per-protocol options.

The implementation should prioritize practical SFTP/SSH/SMB/S3 workflows. WebDAV
must be shown as unavailable until a provider is registered.

## Product Direction

Comparable apps establish the expected baseline:

- Cyberduck uses bookmarks with filtering, labels, comments, import/export, and
  protocol profiles.
- WinSCP exposes advanced connection options such as response timeout and IP
  version/addressing preferences.
- Transmit emphasizes saved servers, SSH key management, activity/status, cloud
  breadth, and sync-oriented workflows.
- Commander One exposes a dedicated connections manager for remote and cloud
  services.

FileOctopus should keep its commander-style density and avoid a marketing-style
onboarding screen. The first screen should help users configure the application,
not explain the application.

## Solution Architecture

### UI Layer

The frontend remains a pure React package and continues to use
`@fileoctopus/ts-api` for all privileged operations. No Tauri imports are added
to `packages/frontend`.

New and changed UI surfaces:

- `FirstRunOverlay` becomes a `WizardShell`-based setup assistant.
- `SettingsNetwork` becomes "Network & Connections" with provider-aware groups.
- `NetworkLocationsDialog` becomes a searchable, filterable connection manager.
- `ConnectServerDialog` gains provider selection, login options, SSH key support,
  protocol-specific advanced fields, and a real test/save step.

The wizard and settings UI should reuse existing dialog and settings classes
where practical. New CSS should stay under `packages/frontend/src/styles/`.

### IPC/API Layer

The Rust to TypeScript boundary remains the trust boundary. All new commands and
DTO fields must be mirrored across:

- `crates/app-ipc/src/network.rs`
- `packages/ts-api/src/types.ts`
- `packages/ts-api/src/clients/network.ts`
- `packages/ts-api/src/commandMap.ts`
- `apps/desktop-tauri/src-tauri/src/commands/network.rs`
- `apps/desktop-tauri/src-tauri/src/lib.rs`
- `packages/ts-api/src/transports/preview.ts`

The API reference should be updated after the commands land, not before.

### Persistence Layer

Use a JSON column for per-protocol profile options:

- Add `network_profiles.options_json text not null default '{}'`.
- Bump `NETWORK_SCHEMA_VERSION`.
- Add `NetworkProtocolOptions` in `crates/config/src/network.rs`.
- Include `options` in `NetworkProfile`, `NewNetworkProfile`, and
  `UpdateNetworkProfile`.

This avoids schema churn for every protocol-specific setting while preserving a
typed Rust and TS boundary.

### Runtime Layer

`network.profileTest` should support two modes:

- Existing profile id: perform a real connect attempt through
  `ConnectionSessionManager`, using persisted profile data and OS keychain
  secrets.
- Unsaved draft: validate profile shape and return a clear result that live
  authentication requires saving/storing secrets first, unless the session
  manager is later extended to support ephemeral profile+secret testing.

This is intentional. The current session manager connects by persisted profile
id and secret-store lookup; pretending to test transient credentials would be
misleading.

## API Additions

### `network.providersList`

Returns the provider catalog used by settings and the connection wizard.

Response shape:

```ts
interface NetworkProviderCapabilityDto {
  scheme: string;
  label: string;
  category: "server" | "cloud" | "virtual";
  defaultPort: number | null;
  authKinds: string[];
  fileCapable: boolean;
  terminalCapable: boolean;
  status: "available" | "unavailable";
  missingDependency: string | null;
  supportedOptions: string[];
}

interface NetworkProvidersListResponse {
  providers: NetworkProviderCapabilityDto[];
}
```

Initial catalog:

- `sftp`: available, file-capable, terminal-capable, password/private key.
- `ssh`: available, terminal-capable only, password/private key.
- `smb`: available when provider is registered; warn if `smbclient` is missing.
- `s3`: available, file-capable, access key.
- `webdav`: unavailable until a provider exists.

### `network.profileTest`

Tests or validates a profile.

Request shape:

```ts
interface NetworkProfileDraftDto {
  label: string;
  scheme: string;
  host: string;
  port: number;
  username: string;
  authKind: string;
  privateKeyPath: string | null;
  defaultPath: string;
  options: NetworkProtocolOptionsDto;
}

interface NetworkProfileTestRequest {
  id?: string;
  draft?: NetworkProfileDraftDto;
  password?: string;
  passphrase?: string;
}
```

Response shape:

```ts
interface NetworkProfileTestResponse {
  ok: boolean;
  status: "success" | "warning" | "error";
  message: string;
  durationMs: number;
  resolvedUri: string | null;
  observedFingerprint: string | null;
  trustState: "trusted" | "untrusted" | "mismatch" | "notApplicable";
  warnings: string[];
}
```

Validation rules:

- Exactly one of `id` or `draft` must be provided.
- Existing profile tests may perform a real connection attempt.
- Draft tests validate host/port/auth/default path and return a warning if live
  auth cannot run without persisted secrets.
- Errors use stable IPC codes: `invalid_request`, `authentication_failed`,
  `connection_lost`, `network_error`, or `not_found`.

### Profile Options DTO

```ts
interface NetworkProtocolOptionsDto {
  ssh?: SshProtocolOptionsDto;
  smb?: SmbProtocolOptionsDto;
  s3?: S3ProtocolOptionsDto;
}

interface SshProtocolOptionsDto {
  useAgent?: boolean | null;
  sshConfigHost?: string | null;
  proxyJump?: string | null;
  proxyCommand?: string | null;
  keepaliveSecs?: number | null;
  compression?: boolean | null;
  addressFamily?: "auto" | "ipv4" | "ipv6" | null;
  terminalInitialCommand?: string | null;
  terminalEnv?: Array<{ name: string; value: string }>;
}

interface SmbProtocolOptionsDto {
  workgroup?: string | null;
  minProtocol?: string | null;
  signingMode?: "default" | "required" | "disabled" | null;
  sharePath?: string | null;
}

interface S3ProtocolOptionsDto {
  region?: string | null;
  useTls?: boolean | null;
  pathStyle?: boolean | null;
  rootPrefix?: string | null;
}
```

## First-Run Setup Assistant

Replace the current three-tile welcome overlay with a setup wizard:

1. Workspace
   - Choose single or dual pane.
   - Choose split direction.
   - Toggle sidebar, toolbar, status bar, and activity panel.
2. Appearance
   - Theme, density, accent, font scale, icon scale.
3. Locations
   - Show detected standard locations and cloud sync folders.
   - Offer to open Network discovery.
4. Network
   - Choose default protocol.
   - Offer "Add first connection".
   - Show network disabled/provider unavailable state.
5. Terminal
   - Choose terminal default behavior.
   - Set default SSH key path and SSH agent preference.
6. Finish
   - Open main workspace, connection manager, shortcuts, or settings.

Persist completion with `firstRunCompletedVersion`. Continue to honor the old
localStorage dismissal as a one-time migration fallback.

## Network Settings

Rename the section to "Network & Connections".

Groups:

- Overview: network enabled state, saved profile count, connected/error count,
  unavailable providers.
- General: connection timeout, auto-reconnect, reconnect attempts, keepalive,
  max simultaneous network connections.
- SSH Keys & Trust: default SSH key path, use SSH agent by default, read
  `~/.ssh/config`, known-host/fingerprint policy summary.
- Protocol Defaults: default protocol, SFTP/SSH defaults, SMB defaults, S3
  defaults.
- Diagnostics: open connection manager, test selected profile, refresh provider
  catalog.

The UI must be provider-aware. Unsupported options should be hidden or disabled
with a concise reason.

## Connection Manager

Upgrade `NetworkLocationsDialog` into a connection manager:

- Search by label, host, username, scheme, and error text.
- Filter by protocol and status.
- Show status, auth state, last connected, last error, fingerprint/trust state,
  and missing secret warnings.
- Actions: Open, Connect, Disconnect, Test, Edit, Duplicate, Remove.
- Keep remove confirmation.
- Empty state should offer Add Connection and Network discovery.

## Connection Wizard

Replace Target/Credentials/Test/Save with:

1. Provider
   - Protocol cards/list from `network.providersList`.
   - Disable unavailable providers.
2. Target
   - Label, host/endpoint, port, path/share/bucket.
3. Credentials
   - Password.
   - Private key path plus passphrase.
   - SSH agent toggle.
   - Access key/secret for S3.
4. Login Options
   - SSH config host alias.
   - ProxyJump or ProxyCommand.
   - Keepalive, timeout, compression, address family.
   - Terminal initial command and env vars for SSH profiles.
   - SMB/S3 protocol-specific options.
5. Test & Save
   - Run `network.profileTest`.
   - Display duration, resolved URI, warnings, fingerprint, and trust state.
   - Allow Save after validation; real auth may require saved secrets for drafts.

## SSH Key and Login Support

In scope for this iteration:

- Private key path selection/manual entry.
- Key passphrase stored in OS keychain.
- SSH agent preference and per-profile override.
- Optional `ssh_config` host alias field.
- ProxyJump and ProxyCommand fields.
- Host-key fingerprint display, forget action, and trust state in test result.
- Keepalive seconds, compression, address family.
- SSH terminal initial command and environment variables.

Deferred:

- SSH key generation/import/export.
- Hardware security keys and PKCS#11.
- SSH certificates.
- Custom cipher/KEX/MAC ordering.
- Multi-hop bastion chain editor beyond one ProxyJump/ProxyCommand field.

## Implementation Sequence

1. Backend persistence
   - Add `NetworkProtocolOptions` to config.
   - Add `options_json` migration.
   - Include `options` in profile add/update/list/get.
   - Add config tests for option round-trip and migration.

2. App IPC and TS API
   - Add provider capability DTOs.
   - Add profile test DTOs.
   - Add `options` to profile DTOs and requests.
   - Update preview transport and command map tests.

3. Tauri commands
   - Implement `network_providers_list`.
   - Implement `network_profile_test`.
   - Register commands in `src-tauri/src/lib.rs`.
   - Keep WebDAV unavailable.

4. Frontend data plumbing
   - Add `NetworkClient.listProviders`.
   - Add `NetworkClient.testProfile`.
   - Load provider catalog where settings/wizard need it.
   - Add fallback preview data.

5. First-run wizard
   - Replace current overlay body with `WizardShell`.
   - Persist completion preference.
   - Add focused tests for step navigation and preference application.

6. Network settings and dialogs
   - Redesign `SettingsNetwork`.
   - Upgrade `NetworkLocationsDialog`.
   - Upgrade `ConnectServerDialog`.
   - Add tests for SSH key/login options and test/save behavior.

7. Validation
   - `pnpm --filter @fileoctopus/ts-api test -- previewTransport catalogs`
   - `pnpm --filter @fileoctopus/frontend test -- firstRun network settings`
   - `cargo test -p config network`
   - `cargo test -p app-ipc network`
   - `cargo test -p app-core network`
   - `pnpm typecheck`
   - `pnpm lint`
   - `pnpm test`
   - `pnpm rust:test`
   - `pnpm rust:clippy`

## Acceptance Criteria

- First-run setup is a multi-step assistant and no longer a basic tile overlay.
- Network settings show provider-aware controls and actionable connection state.
- The connection manager supports search/filter/test/edit/duplicate/remove.
- The connection wizard captures practical SSH key and login parameters.
- Profile options persist across restart.
- Existing SFTP/SSH profile behavior remains compatible.
- WebDAV no longer appears as a usable provider while unsupported.
- All new IPC commands and DTOs are mirrored and tested.

## Current Implementation Notes

An initial implementation pass began before this document was created:

- Added failing TS preview tests for `network.providersList` and
  `network.profileTest`.
- Added a failing config test for `NetworkProtocolOptions` persistence.
- Started adding `NetworkProtocolOptions` and `options_json` support in
  `crates/config/src/network.rs`.

Before continuing, finish the config compile errors by updating existing
`NetworkProfile`, `NewNetworkProfile`, and `UpdateNetworkProfile` literals with
default `options`, then proceed with the API and UI sequence above.
