# MVP RC Checklist

## Build

- [x] `pnpm install --frozen-lockfile`
- [x] `pnpm rc:validate` (2026-05-19)
- [ ] `FILEOCTOPUS_COMMIT_SHA="$(git rev-parse --short HEAD)" pnpm tauri:build`
- [ ] Packaged artifact exists under `target/release/bundle`

## Automated QA

- [x] `pnpm test:backend:rc`
- [x] `pnpm test:frontend:rc`
- [ ] CI `check` workflow is green when triggered (docs-only changes skip CI; run `pnpm lint`, `pnpm build`, `pnpm rc:validate`, `pnpm tauri:build` locally)

## Manual QA

- [ ] Complete `docs/qa/sprint-3-smoke-test.md`
- [ ] Complete `docs/qa/sprint-4-baseline-qa.md`
- [ ] Capture large directory result from `docs/performance.md`
- [ ] Capture large file operation result from `docs/performance.md`
- [ ] Export and inspect diagnostics bundle

## Known Issues

- [ ] Blockers fixed
- [ ] Accepted non-blockers listed with owner and follow-up issue

## Go/No-Go

- Decision:
- Owner:
- Date:
- Notes: Automated RC validation green 2026-05-19; Tauri e2e job remains `continue-on-error` in CI until driver hang resolved.
