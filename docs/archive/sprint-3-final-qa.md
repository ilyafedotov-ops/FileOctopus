# Sprint 3 Final QA

## Automated Runs

| Command                                                                          | Result | Evidence                                                                                              |
| -------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| `corepack pnpm rc:validate`                                                      | Pass   | Rust fmt/check/test/clippy passed; TS typecheck, ESLint, Vitest, and Vite build passed on 2026-05-15. |
| `corepack pnpm format:check`                                                     | Pass   | Prettier reported all matched files formatted on 2026-05-15.                                          |
| `FILEOCTOPUS_COMMIT_SHA=$(git rev-parse --short HEAD) corepack pnpm tauri:build` | Pass   | Produced `.deb`, `.rpm`, and `.AppImage` bundles under `target/release/bundle`.                       |

## Manual Runs

| Check                          | Result | Notes                                                                                                                                  |
| ------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Packaged-app smoke test        | Pass   | `HOME=$(mktemp -d) timeout 6s xvfb-run -a target/release/fileoctopus-desktop` stayed alive until timeout and initialized logs/history. |
| Large directory benchmark      | Pass   | Frontend test injects 100k entries and asserts fewer than 80 mounted rows; backend streams 10k entries without collecting all first.   |
| Large file operation benchmark | Pass   | Rust tests cover streaming large-file copy progress and deterministic cancellation.                                                    |
| Diagnostics export             | Pass   | `fileoctopus-desktop` unit test writes a diagnostics ZIP with app info, app-data health, operation history, and log excerpt entries.   |
| Accessibility baseline         | Pass   | Dialogs have accessible names, text buttons are labeled, file tables are keyboard navigable, and shortcuts ignore text inputs.         |

## Findings

| Severity | Finding                                                                    | Disposition                                                                      |
| -------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Low      | Linux smoke emitted DRI3 acceleration warnings under Xvfb.                 | Non-blocking; expected headless graphics warning, app initialized data surfaces. |
| Medium   | macOS and Windows package smoke tests are not run in this Linux workspace. | Track as platform QA before wider dogfooding.                                    |

## Decision

- Go/no-go: Go for Linux internal dogfooding; no-go for claiming cross-platform RC until macOS/Windows smoke tests are run.
- Accepted blockers: None.
- Follow-up issues: See `docs/release/sprint-3-follow-up-issues.md`.
