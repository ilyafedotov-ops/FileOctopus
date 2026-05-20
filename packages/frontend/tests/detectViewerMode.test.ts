import { describe, expect, it } from "vitest";
import { detectViewerMode } from "../src/components/viewer/detectViewerMode";
import type { FileEntryDto } from "@fileoctopus/ts-api";

function entry(name: string): FileEntryDto {
  return {
    uri: `local:///tmp/${name}`,
    name,
    kind: "file",
  } as FileEntryDto;
}

describe("detectViewerMode", () => {
  it("returns image for png", () => {
    expect(detectViewerMode(entry("photo.png"))).toBe("image");
  });

  it("returns text for known text extensions", () => {
    expect(detectViewerMode(entry("readme.md"))).toBe("text");
    expect(detectViewerMode(entry("module.ts"))).toBe("text");
  });

  it("falls back to hex for binary-looking files", () => {
    expect(detectViewerMode(entry("payload.bin"))).toBe("hex");
    expect(detectViewerMode(entry("archive.zip"))).toBe("hex");
  });

  it("returns text for null entry", () => {
    expect(detectViewerMode(null)).toBe("text");
  });
});
