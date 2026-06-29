# Testing

## Automated

```bash
pnpm test                    # Vitest (frontend, ts-api where configured)
pnpm --filter @fileoctopus/frontend test   # requires --environment jsdom (in package script)
pnpm rust:test               # cargo test --workspace
pnpm typecheck && pnpm lint && pnpm rust:fmt && pnpm rust:clippy
pnpm rc:validate             # full release validation bundle
```

## Manual Checks

Before a public release, smoke-test the packaged app on each target platform:

- launch and quit
- browse home, root, and a removable or external location when available
- copy, move, rename, trash, permanent delete, and conflict handling
- archive create/extract and folder-size jobs
- terminal launch, Git review, diagnostics export, and preferences persistence
- dark/light theme, density, keyboard shortcuts, and context menus

## Fixtures

```bash
cargo run -p test-support --bin fileoctopus-test-tree -- --root ./tmp/100k --files 100000 --dirs 0
```

Performance baselines: [performance.md](../performance.md).
