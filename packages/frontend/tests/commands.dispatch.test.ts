import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { COMMAND_DEFINITIONS } from "../src/commands/registry";

function commandIdsFromDispatchCases(): string[] {
  const source = readFileSync("src/commands/dispatch.ts", "utf8");
  const matches = [...source.matchAll(/case "([^"]+)":/g)];
  return matches.map((match) => match[1]).sort();
}

describe("commands/dispatch exhaustiveness", () => {
  it("handles every command in the registry", () => {
    const registryIds = COMMAND_DEFINITIONS.map((command) => command.id).sort();
    const dispatchIds = commandIdsFromDispatchCases();
    expect(dispatchIds).toEqual(registryIds);
  });
});
