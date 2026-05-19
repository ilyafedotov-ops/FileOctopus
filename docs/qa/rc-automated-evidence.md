# RC Automated Evidence

- **Date (UTC):** 2026-05-19T07:05:00Z
- **Commit:** (local workspace)
- **Runner:** `scripts/rc-qa-automated.sh` (partial) + targeted commands

## Automated checks

| Check                  | Command / test                                                            | Result                                                                    |
| ---------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| RC validate            | `pnpm rc:validate`                                                        | Pass (2026-05-19 session)                                                 |
| Tauri bundles          | `pnpm tauri:build`                                                        | Pass — deb/rpm/AppImage under `target/release/bundle/`                    |
| 10k list streaming     | `cargo test -p fs-core list_streams_without_collecting_all_entries_first` | Pass (~0.53s)                                                             |
| 100k UI virtualization | `appShell.test.tsx` — 100k batch DOM cap                                  | Pass (frontend RC)                                                        |
| Diagnostics E2E        | `e2e/diagnostics.e2e.ts`                                                  | 2/2 pass (`FO_E2E_WEB_SERVER=vite`)                                       |
| Visual regression      | `e2e/visual-regression.e2e.ts`                                            | 12/12 pass; baselines in `e2e/visual-regression.e2e.ts-snapshots/`        |
| Full Playwright        | `pnpm test:e2e:vite`                                                      | 104 passed, 33 skipped (preview has no real FS rows for navigation tests) |
| Diagnostics zip (Rust) | `diagnostics_bundle_contains_expected_files`                              | Pass (backend RC)                                                         |

## Fixtures prepared

| Fixture           | Path                                                         |
| ----------------- | ------------------------------------------------------------ |
| Sprint 3 smoke    | `/tmp/fileoctopus-smoke` (includes 32 MiB `large.bin`)       |
| Sprint 4 baseline | `/tmp/fileoctopus-sprint-4` (hidden file + `needle.txt`)     |
| 10k tree          | `./tmp/10k` (reuse or `fileoctopus-test-tree --files 10000`) |

## Manual follow-up (target hardware)

- [ ] `docs/qa/sprint-3-smoke-test.md` on packaged AppImage/deb
- [ ] `docs/qa/sprint-4-baseline-qa.md` full matrix
- [ ] `docs/testing/large-directory-performance.md` — UI scroll recording for `tmp/10k` and `tmp/100k`
- [ ] Inspect real diagnostics zip from packaged build (not preview transport)

## Dev navigation URIs

Replace `<repo>` with absolute workspace path:

- 10k: `local://<repo>/tmp/10k`
- 100k: generate then `local://<repo>/tmp/100k`
