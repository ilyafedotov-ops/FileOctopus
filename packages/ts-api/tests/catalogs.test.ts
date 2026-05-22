import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FILE_OPERATION_WARNING_CODES, IPC_ERROR_CODES } from "../src";
import { commandMap } from "../src/commandMap";
import * as eventCatalog from "../src/events";

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

function extractRustEventConsts(source: string): Record<string, string> {
  return Object.fromEntries(
    [
      ...source.matchAll(/pub const ([A-Z0-9_]+_EVENT): &str = "([^"]+)";/g),
    ].map((match) => [match[1], match[2]]),
  );
}

function extractRegisteredCommands(source: string): string[] {
  const handlerMatch = source.match(
    /tauri::generate_handler!\[\s*([\s\S]*?)\s*\]\)/m,
  );

  if (!handlerMatch) {
    throw new Error("generate_handler registry not found");
  }

  return [...handlerMatch[1].matchAll(/commands::[a-z_]+::([a-z0-9_]+)/g)]
    .map((match) => match[1])
    .sort();
}

function extractApiReferenceCommandCount(source: string): number {
  const countMatch = source.match(/\*\*(\d+) commands\*\*/);

  if (!countMatch) {
    throw new Error("API reference command count not found");
  }

  return Number(countMatch[1]);
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

  it("keeps event channel constants aligned with crates/app-ipc", () => {
    const rustSource = readRepoFile("../../../crates/app-ipc/src/lib.rs");
    const rustEvents = extractRustEventConsts(rustSource);
    const tsEvents = Object.fromEntries(
      Object.entries(eventCatalog)
        .filter(([key]) => key.endsWith("_EVENT"))
        .sort(([left], [right]) => left.localeCompare(right)),
    );

    expect(tsEvents).toEqual(
      Object.fromEntries(
        Object.entries(rustEvents).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    );
  });

  it("keeps the command map aligned with registered Tauri handlers", () => {
    const rustSource = readRepoFile(
      "../../../apps/desktop-tauri/src-tauri/src/lib.rs",
    );
    const registeredCommands = extractRegisteredCommands(rustSource);
    const mappedCommands = Object.values(commandMap).sort();

    expect(mappedCommands).toEqual(registeredCommands);
  });

  it("keeps the API reference command count aligned with the live registry", () => {
    const rustSource = readRepoFile(
      "../../../apps/desktop-tauri/src-tauri/src/lib.rs",
    );
    const apiReference = readRepoFile(
      "../../../docs/architecture/api-reference.md",
    );

    expect(extractApiReferenceCommandCount(apiReference)).toBe(
      extractRegisteredCommands(rustSource).length,
    );
  });
});
