# MVP RC Checklist

## Build

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm rc:validate`
- [ ] `FILEOCTOPUS_COMMIT_SHA="$(git rev-parse --short HEAD)" pnpm tauri:build`
- [ ] Packaged artifact exists under `target/release/bundle`

## Automated QA

- [ ] `pnpm test:backend:rc`
- [ ] `pnpm test:frontend:rc`
- [ ] CI `release-candidate` workflow is green

## Manual QA

- [ ] Complete `docs/qa/sprint-3-smoke-test.md`
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
- Notes:
