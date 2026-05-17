import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const TAURI_DRIVER = process.env.TAURI_DRIVER ?? "tauri-driver";
const NATIVE_DRIVER =
  process.env.TAURI_NATIVE_DRIVER ?? "/usr/bin/WebKitWebDriver";
const TAURI_PORT = Number(process.env.TAURI_DRIVER_PORT ?? 4444);

const REPO_ROOT = resolve(import.meta.dirname, "..");
const BIN_DEBUG = resolve(REPO_ROOT, "target/debug/fileoctopus-desktop");
const BIN_RELEASE = resolve(REPO_ROOT, "target/release/fileoctopus-desktop");
const TAURI_BIN = process.env.TAURI_BIN
  ? resolve(process.env.TAURI_BIN)
  : existsSync(BIN_DEBUG)
    ? BIN_DEBUG
    : BIN_RELEASE;

if (!existsSync(TAURI_BIN)) {
  throw new Error(
    `Tauri binary not found at ${TAURI_BIN}. Build it first: cargo build --manifest-path apps/desktop-tauri/src-tauri/Cargo.toml`,
  );
}

let driver: ChildProcess | null = null;

export const config = {
  runner: "local",
  tsConfigPath: resolve(import.meta.dirname, "tsconfig.json"),

  specs: [resolve(import.meta.dirname, "specs/**/*.spec.ts")],
  maxInstances: 1,

  capabilities: [
    {
      "tauri:options": { application: TAURI_BIN },
      browserName: "wry",
    },
  ],

  hostname: "127.0.0.1",
  port: TAURI_PORT,
  path: "/",

  logLevel: (process.env.WDIO_LOG_LEVEL ?? "warn") as
    | "trace"
    | "debug"
    | "info"
    | "warn"
    | "error"
    | "silent",

  framework: "mocha",
  mochaOpts: { ui: "bdd", timeout: 60_000 },

  reporters: ["spec"],

  outputDir: resolve(import.meta.dirname, "logs"),

  onPrepare: () => {
    const child = spawn(
      TAURI_DRIVER,
      ["--port", String(TAURI_PORT), "--native-driver", NATIVE_DRIVER],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    driver = child;
    child.stdout?.on("data", (chunk: Buffer) => {
      if (process.env.TAURI_DRIVER_VERBOSE) {
        process.stdout.write(`[tauri-driver] ${chunk}`);
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (process.env.TAURI_DRIVER_VERBOSE) {
        process.stderr.write(`[tauri-driver] ${chunk}`);
      }
    });
  },

  onComplete: () => {
    driver?.kill("SIGTERM");
    driver = null;
  },
} as const;
