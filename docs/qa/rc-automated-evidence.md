# RC Automated Evidence

- **Date (UTC):** 2026-05-23T10:34:59Z
- **Commit:** d74e917
- **Runner:** `scripts/rc-qa-automated.sh`

## Automated checks (this run)

| Check                  | Command / test                                                            | Result                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| RC validate backend    | `pnpm test:backend:rc`                                                    | ✅ Pass — cargo fmt, check, test, clippy all clean (193 tests)                                               |
| RC validate frontend   | `pnpm test:frontend:rc`                                                   | ✅ Pass — typecheck, lint, test (502 tests), build all clean                                                 |
| 10k list streaming     | `cargo test -p fs-core list_streams_without_collecting_all_entries_first` | ✅ included in backend RC                                                                                    |
| 100k UI virtualization | `appShell.test.tsx` — 100k batch DOM cap                                  | ✅ included in frontend RC (~6.6s)                                                                           |
| Playwright E2E         | `FO_E2E_WEB_SERVER=vite npx playwright test`                              | ⚠️ Environmental timeout — webServer startup exceeds 120s in headless VM; known issue, not a code regression |
| Smoke fixture          | `/tmp/fileoctopus-smoke`                                                  | ✅ prepared                                                                                                  |
| Sprint 4 fixture       | `/tmp/fileoctopus-sprint-4`                                               | ✅ prepared                                                                                                  |
| 10k tree               | `./tmp/10k`                                                               | ✅ reused                                                                                                    |

## Previous automated evidence (2026-05-19)

| Check                  | Result                                 |
| ---------------------- | -------------------------------------- |
| Diagnostics E2E        | ✅ 2/2 pass (`FO_E2E_WEB_SERVER=vite`) |
| App layout E2E         | ✅ 24/24 pass                          |
| Visual regression      | ✅ 12/12 pass                          |
| Full Playwright        | ✅ 104 passed, 33 skipped              |
| Diagnostics zip (Rust) | ✅ Pass (backend RC)                   |

## Manual follow-up (human on target hardware)

- [ ] `docs/qa/sprint-3-smoke-test.md` against packaged `.deb` / AppImage
- [ ] `docs/qa/sprint-4-baseline-qa.md` full checklist
- [ ] `docs/testing/large-directory-performance.md` scroll recording for `tmp/10k` and `tmp/100k`
- [ ] Export diagnostics bundle from Help menu and inspect zip contents

## Navigation URIs (preview / dev)

- 10k: `local:///home/ilya/FileOctupus/tmp/10k`
- 100k: generate with `fileoctopus-test-tree --files 100000` then navigate to `local:///home/ilya/FileOctupus/tmp/100k`
