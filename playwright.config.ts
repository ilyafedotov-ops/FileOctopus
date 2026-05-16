import { defineConfig } from "@playwright/test";
import path from "node:path";

/**
 * Playwright E2E config for FileOctopus.
 *
 * Two modes via FO_E2E_MODE env var:
 *   - "vite" (default): starts Vite dev server on port 1420 — fast UI tests
 *   - "tauri": connects to running Tauri app — full integration tests
 */
const mode = (process.env.FO_E2E_MODE || "vite").toLowerCase();
const isTauri = mode === "tauri";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: "http://localhost:1420",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1280, height: 720 },
  },

  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],

  ...(isTauri
    ? {}
    : {
        webServer: {
          command: "pnpm dev",
          port: 1420,
          timeout: 60_000,
          reuseExistingServer: true,
          cwd: path.resolve(import.meta.dirname),
        },
      }),
});
