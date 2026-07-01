# FileOctopus Build

## Development

```bash
pnpm install
pnpm dev
```

`pnpm dev` builds the shared TypeScript packages and starts `cargo tauri dev`.

## Release Candidate Package

```bash
pnpm install --frozen-lockfile
FILEOCTOPUS_COMMIT_SHA="$(git rev-parse --short HEAD)" pnpm tauri:build
```

Tauri runs `corepack pnpm build` before packaging, uses the release Rust profile, and writes bundles under `target/release/bundle`.

## Metadata

The packaged app identifies as `com.fileoctopus.desktop`, product name `FileOctopus`, version `0.1.3`. The diagnostics panel shows version, build profile, commit SHA when supplied, target OS, data directory, log directory, and database schema version.
