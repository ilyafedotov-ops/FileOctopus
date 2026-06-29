# Contributing

FileOctopus is a Tauri v2 desktop file manager. Rust owns privileged filesystem
logic, and React TypeScript owns the UI.

## Setup

```bash
pnpm install
pnpm bootstrap
pnpm dev
```

Prerequisites:

- Rust via `rustup`
- Node.js
- pnpm 10.26.2+
- Platform prerequisites for Tauri v2

## Checks

Run focused checks while developing and the release-candidate bundle before
larger changes:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm rust:fmt
pnpm rust:clippy
pnpm rust:test
pnpm rc:validate
```

## Pull Requests

- Use Conventional Commit style for commit messages, for example `feat:` or
  `fix:`.
- Fill out `.github/pull_request_template.md`.
- Include tests run and any remaining risk.
- Include screenshots for UI changes.
- Call out filesystem, IPC, permission, terminal, remote-provider, or plugin
  boundary changes in the security impact section.

## Boundary Changes

The Rust-to-TypeScript IPC boundary is the trust boundary. Before changing IPC
commands, events, DTOs, filesystem resource handling, or error codes, read
`docs/architecture/api-reference.md` and `AGENTS.md`.

Filesystem resources cross the boundary as `local://` `ResourceUri` strings.
Frontend code must not use unrestricted filesystem access; mutations go through
the planned file-operation pipeline.
