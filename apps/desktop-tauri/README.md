# FileOctopus desktop (Tauri v2)

Rust + React shell for FileOctopus. The WebView runs `@fileoctopus/frontend`; privileged work is exposed only through Tauri commands in `src-tauri/src/lib.rs`.

## Develop

From the repo root:

```bash
pnpm dev
```

This builds `ts-api` → `ui` → `frontend`, then runs `tauri dev` (Vite on port 1420).

## Package layout

- `src/` — React entry (`main.tsx`, `App.tsx`, `App.css`)
- `src-tauri/` — Rust crate `fileoctopus-desktop`, `tauri.conf.json`, capabilities

## IPC

39 commands registered in `src-tauri/src/lib.rs`. Contract: [docs/architecture/api-reference.md](../../docs/architecture/api-reference.md).

Capabilities: `src-tauri/capabilities/default.json` grants only `core:default` (no `tauri-plugin-fs`). See ADR-0002.

## Build release

```bash
FILEOCTOPUS_COMMIT_SHA="$(git rev-parse --short HEAD)" pnpm tauri:build
```

Artifacts under `target/release/bundle`. See [docs/build.md](../../docs/build.md).
