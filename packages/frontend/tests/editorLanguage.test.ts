import { describe, expect, it } from "vitest";
import { languageExtensionForFileName } from "../src/components/codemirror/language";

describe("languageExtensionForFileName", () => {
  it("returns a language extension for TypeScript files", () => {
    expect(languageExtensionForFileName("module.ts")).not.toBeNull();
  });

  it("returns a language extension for Markdown files", () => {
    expect(languageExtensionForFileName("readme.md")).not.toBeNull();
  });

  it("returns null for unknown extensions", () => {
    expect(languageExtensionForFileName("payload.bin")).toBeNull();
  });
});
