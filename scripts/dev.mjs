import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

for (const packageName of [
  "@fileoctopus/ts-api",
  "@fileoctopus/ui",
  "@fileoctopus/frontend",
]) {
  const result = spawnSync(pnpm, ["--filter", packageName, "build"], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const result = spawnSync(
  pnpm,
  [
    "--filter",
    "@fileoctopus/desktop-tauri",
    "tauri",
    "dev",
    "--features",
    "devtools",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      FILEOCTOPUS_DATA_DIR:
        process.env.FILEOCTOPUS_DATA_DIR || join(homedir(), ".fileoctopus-dev"),
    },
  },
);
process.exit(result.status ?? 1);
