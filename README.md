# FileOctopus

FileOctopus is a Tauri v2 desktop file manager built around a Rust-owned filesystem boundary and a React TypeScript frontend.

## Prerequisites

- Rust via `rustup`
- Node.js
- pnpm
- Platform prerequisites for Tauri v2

## Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm test
cargo check --workspace
cargo test --workspace
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
```

## Layout

- `apps/desktop-tauri`: Tauri v2 desktop shell.
- `crates`: Rust workspace crates for privileged application logic.
- `packages/frontend`: Shared React application shell.
- `packages/ui`: Shared UI primitives.
- `packages/ts-api`: Typed frontend API boundary.
- `docs/adr`: Architecture decision records.

