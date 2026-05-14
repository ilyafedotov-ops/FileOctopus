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
pnpm format:check
pnpm test
cargo check --workspace
cargo test --workspace
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo run -p test-support --bin fileoctopus-test-tree -- --root ./tmp/100k --files 100000 --dirs 0
```

## Bootstrap

```bash
bash scripts/bootstrap.sh
powershell -ExecutionPolicy Bypass -File scripts/bootstrap.ps1
```

## Layout

- `apps/desktop-tauri`: Tauri v2 desktop shell.
- `crates`: Rust workspace crates for privileged application logic.
- `packages/frontend`: Shared React application shell.
- `packages/ui`: Shared UI primitives.
- `packages/ts-api`: Typed frontend API boundary.
- `docs/adr`: Architecture decision records.
- `docs/testing`: Sprint 1 test protocol and demo script.

## ADRs

Start from `docs/adr/README.md` and use `docs/adr/0000-template.md` for new decisions.

## Sprint 1 Performance Workflow

Use `fileoctopus-test-tree` to generate 10k and 100k entry folders, then follow `docs/testing/large-directory-performance.md` and `docs/testing/sprint-1-demo.md`.
