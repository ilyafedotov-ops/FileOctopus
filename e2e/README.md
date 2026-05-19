# E2E tests (Playwright)

## Quick run (Vite preview shell, recommended)

```bash
pnpm test:e2e:vite
```

Uses `FO_E2E_WEB_SERVER=vite` so Playwright starts Vite on port 1420 without full `tauri dev`.

## Visual regression baselines

Snapshots live in `e2e/visual-regression.e2e.ts-snapshots/` (Linux: `*-chromium-linux.png`).

Regenerate after intentional UI changes:

```bash
FO_E2E_WEB_SERVER=vite npx playwright test e2e/visual-regression.e2e.ts --update-snapshots
```

## Full Tauri integration

```bash
FO_E2E_MODE=tauri pnpm test:e2e:tauri
```

Requires a running Tauri app (see root `package.json` scripts).
