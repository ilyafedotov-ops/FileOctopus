# MVP RC Checklist

## Build

- [x] `pnpm install --frozen-lockfile`
- [x] `pnpm rc:validate` (2026-05-19)
- [x] `FILEOCTOPUS_COMMIT_SHA="$(git rev-parse --short HEAD)" pnpm tauri:build` (2026-05-19)
- [x] Packaged artifact exists under `target/release/bundle` (deb/rpm/AppImage)

## Automated QA

- [x] `pnpm test:backend:rc`
- [x] `pnpm test:frontend:rc`
- [x] `scripts/rc-qa-automated.sh` (fixtures + RC tests + Playwright with `FO_E2E_WEB_SERVER=vite`)
- [x] `e2e/diagnostics.e2e.ts` — Help → Diagnostics → export bundle (preview transport)
- [x] `e2e/visual-regression.e2e.ts` — 12 snapshots (linux chromium)
- [x] `packages/frontend/tests/visualSnapshots.test.tsx` — shell chrome plus permission-denied and operation-error failure snapshots (2026-05-24)
- [x] `packages/frontend/tests/accessibility.test.tsx` — baseline dialog/context-menu semantics including first-run overlay action names (2026-05-24)
- [x] `pnpm test:e2e:vite` — 104 passed, 33 skipped (no directory rows in preview FS)
- [ ] CI `check` workflow is green when triggered (docs-only changes skip CI; run `pnpm lint`, `pnpm build`, `pnpm rc:validate`, `pnpm tauri:build` locally)

## Manual QA

- [ ] Complete `docs/qa/sprint-3-smoke-test.md`
- [ ] Complete `docs/qa/sprint-4-baseline-qa.md`
- [ ] Capture large directory result from `docs/performance.md`
- [ ] Capture large file operation result from `docs/performance.md`
- [x] Export diagnostics bundle (automated E2E in preview; inspect zip on packaged build manually)

## Known Issues

- [ ] Blockers fixed
- [ ] Accepted non-blockers listed with owner and follow-up issue

## Go/No-Go

- Decision:
- Owner:
- Date:
- Notes: Automated RC validation green 2026-05-19; Tauri e2e job remains `continue-on-error` in CI until driver hang resolved.
