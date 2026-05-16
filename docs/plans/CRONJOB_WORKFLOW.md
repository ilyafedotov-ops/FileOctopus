# FileOctopus Continuous Integration Cronjob Workflow

## Purpose

This document describes the automated 4-hourly health check and development cycle
for the FileOctopus project. The cronjob agent reads this file for context.

## Project State File

- **Status file:** `docs/plans/CRON_STATUS.md` — created/updated by each cron run
- **Task queue:** `docs/plans/CRON_TASKS.md` — pending tasks for next cycle

## Verification Checklist

1. `cd ~/FileOctupus && git status` — working tree clean?
2. `cd ~/FileOctupus/packages/frontend && npx tsc --noEmit` — TypeScript OK?
3. `cd ~/FileOctupus && cargo check --workspace` — Rust OK?
4. `cd ~/FileOctupus/packages/frontend && npx vitest run tests --environment jsdom` — all tests green?
5. `cd ~/FileOctupus && pnpm lint` — ESLint clean?

## Spec & Reference Files

- **UI Design Spec:** `docs/FileOctopus_UI_Design_Spec.md`
- **Menu & Modal Spec:** `docs/plans/FileOctopus_Menu_and_Modal_Specification.md` (1746 lines)
- **UI Feature Inventory:** `docs/planning/UI_FEATURE_INVENTORY.md`
- **MVP Engineering Spec:** `docs/architecture/mvp-engineering-spec.md`
- **Gap Analysis:** `~/.hermes/skills/dogfood/fileoctopus-dev/references/gap-analysis-2026-05.md`
- **Reference Images:** `docs/Images/MainApp/` (11 PNGs), `docs/Images/MenuImages/` (6 PNGs)
- **E2E Audit:** `docs/qa/e2e-audit-report.md`

## Task Priority Order

1. Fix failing tests / TypeScript errors / Rust errors
2. Compare implementation against specs (menu spec, UI design spec)
3. Compare UI screenshots against reference images in docs/Images/
4. Update documentation if implementation diverges from docs
5. Pick next feature from gap analysis / inventory backlog
6. Implement using TDD (RED→GREEN→REFACTOR)

## Current Stats (as of 2026-05-16)

- Tests: 90/90 GREEN
- TypeScript: 0 errors
- Rust: OK (1 pre-existing warning)
- Commits: 10 feature commits on main
- Branch: main @ e544643
