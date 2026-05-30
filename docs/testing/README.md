# Testing

## Automated

```bash
pnpm test                    # Vitest (frontend, ts-api where configured)
pnpm --filter @fileoctopus/frontend test   # requires --environment jsdom (in package script)
pnpm rust:test               # cargo test --workspace
pnpm typecheck && pnpm lint && pnpm rust:fmt && pnpm rust:clippy
pnpm rc:validate             # release-candidate bundle of checks
```

## Manual & performance protocols

| Document                                                           | Purpose                                          |
| ------------------------------------------------------------------ | ------------------------------------------------ |
| [large-directory-performance.md](./large-directory-performance.md) | 10k / 100k listing and scroll validation         |
| [sprint-1-demo.md](../archive/sprint-1-demo.md)                    | Early vertical-slice demo script (historical)    |
| [sprint-5-macos-qa.md](./sprint-5-macos-qa.md)                     | macOS-specific smoke (verify against current UI) |

## QA checklists

| Document                                                      | Purpose                                                                                                  |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [sprint-3-smoke-test.md](../archive/sprint-3-smoke-test.md)   | Core IPC and operations smoke                                                                            |
| [sprint-4-baseline-qa.md](../archive/sprint-4-baseline-qa.md) | Baseline file manager completeness                                                                       |
| [e2e-audit-report.md](../archive/e2e-audit-report.md)         | E2E snapshot — **partially stale**; see [alignment doc](../planning/PROJECT_STATUS_AND_DOC_ALIGNMENT.md) |

## Fixtures

```bash
cargo run -p test-support --bin fileoctopus-test-tree -- --root ./tmp/100k --files 100000 --dirs 0
bash scripts/sprint-2-manual-qa.sh [root]
```

Performance baselines: [../performance.md](../performance.md).
