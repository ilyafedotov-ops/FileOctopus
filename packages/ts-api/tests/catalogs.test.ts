import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FILE_OPERATION_WARNING_CODES, IPC_ERROR_CODES } from "../src";

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

function extractRustStringConsts(source: string, moduleName: string): string[] {
  const moduleMatch = source.match(
    new RegExp(`pub mod ${moduleName} \\{([\\s\\S]*?)\\n\\}`, "m"),
  );

  if (!moduleMatch) {
    throw new Error(`module ${moduleName} not found`);
  }

  return [
    ...moduleMatch[1].matchAll(/pub const [A-Z0-9_]+: &str = "([^"]+)";/g),
  ]
    .map((match) => match[1])
    .sort();
}

describe("Rust/TS contract mirrors", () => {
  it("keeps IPC error codes aligned with crates/app-ipc", () => {
    const rustSource = readRepoFile("../../../crates/app-ipc/src/lib.rs");
    const rustCodes = extractRustStringConsts(rustSource, "error_codes");
    const tsCodes = Object.values(IPC_ERROR_CODES).sort();

    expect(tsCodes).toEqual(rustCodes);
  });

  it("keeps file-operation warning codes aligned with crates/vfs", () => {
    const rustSource = readRepoFile("../../../crates/vfs/src/lib.rs");
    const rustCodes = extractRustStringConsts(
      rustSource,
      "file_operation_warning_codes",
    );
    const tsCodes = Object.values(FILE_OPERATION_WARNING_CODES).sort();

    expect(tsCodes).toEqual(rustCodes);
  });
});
