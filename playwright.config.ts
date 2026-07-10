import { defineConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mode = (process.env.FO_E2E_MODE || "vite").toLowerCase();
const isTauri = mode === "tauri";
const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const viteOnly =
  process.env.FO_E2E_WEB_SERVER === "vite" ||
  process.env.FO_E2E_WEB_SERVER === "light";

const webServerCommand = viteOnly
  ? "pnpm --filter @fileoctopus/ts-api build && pnpm --filter @fileoctopus/ui build && pnpm --filter @fileoctopus/frontend build && pnpm --filter @fileoctopus/desktop-tauri build && pnpm --filter @fileoctopus/desktop-tauri preview --host 127.0.0.1 --port 1420 --strictPort"
  : "pnpm dev";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
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
    // Auto-dismiss first-run overlay before every page load
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://localhost:1420",
          localStorage: [
            {
              name: "fileoctopus.firstRunDismissed",
              value: "true",
            },
          ],
        },
      ],
    },
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
          command: webServerCommand,
          port: 1420,
          timeout: viteOnly ? 120_000 : 180_000,
          reuseExistingServer: !viteOnly,
          cwd: configDirectory,
        },
      }),
});
