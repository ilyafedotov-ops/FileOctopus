import { describe, expect, it } from "vitest";
import type { SearchMatchDto } from "@fileoctopus/ts-api";
import {
  propertyType,
  searchMatchToEntry,
  providerIdFromUri,
} from "../src/utils/paneUtils";

function makeMatch(
  overrides: Partial<SearchMatchDto> & {
    name: string;
    kind: SearchMatchDto["kind"];
  },
): SearchMatchDto {
  return {
    uri: `local:///home/user/${overrides.name}`,
    parentUri: "local:///home/user",
    size: 0,
    modifiedAt: null,
    ...overrides,
  };
}

describe("propertyType", () => {
  it("returns Folder for directory kind", () => {
    expect(
      propertyType({ kind: "directory", isSymlink: false } as Parameters<
        typeof propertyType
      >[0]),
    ).toBe("Folder");
  });

  it("returns Symlink for symlink entries", () => {
    expect(
      propertyType({ kind: "file", isSymlink: true } as Parameters<
        typeof propertyType
      >[0]),
    ).toBe("Symlink");
  });

  it("returns kind for regular files", () => {
    expect(
      propertyType({ kind: "file", isSymlink: false } as Parameters<
        typeof propertyType
      >[0]),
    ).toBe("file");
  });

  it("returns kind when isSymlink is false", () => {
    expect(
      propertyType({ kind: "unknown", isSymlink: false } as Parameters<
        typeof propertyType
      >[0]),
    ).toBe("unknown");
  });
});

describe("searchMatchToEntry", () => {
  it("maps a file match to FileEntryDto", () => {
    const match = makeMatch({
      name: "file.txt",
      kind: "file",
      size: 1024,
      modifiedAt: "2026-01-01T00:00:00Z",
    });
    const entry = searchMatchToEntry(match);
    expect(entry.uri).toBe("local:///home/user/file.txt");
    expect(entry.name).toBe("file.txt");
    expect(entry.kind).toBe("file");
    expect(entry.size).toBe(1024);
    expect(entry.isHidden).toBe(false);
    expect(entry.canRead).toBe(true);
    expect(entry.canWrite).toBe(true);
    expect(entry.canDelete).toBe(true);
    expect(entry.canRename).toBe(true);
    expect(entry.providerId).toBe("local");
  });

  it("maps a directory match with canList=true", () => {
    const match = makeMatch({
      name: "docs",
      kind: "directory",
      size: 4096,
    });
    const entry = searchMatchToEntry(match);
    expect(entry.kind).toBe("directory");
    expect(entry.canList).toBe(true);
  });

  it("maps a file match with canList=false", () => {
    const match = makeMatch({ name: "file.txt", kind: "file" });
    const entry = searchMatchToEntry(match);
    expect(entry.canList).toBe(false);
  });

  it("sets isSymlink=true for symlink kind", () => {
    const match = makeMatch({ name: "link", kind: "symlink" });
    const entry = searchMatchToEntry(match);
    expect(entry.isSymlink).toBe(true);
  });
});

describe("providerIdFromUri", () => {
  it("returns local for local:// URI", () => {
    expect(providerIdFromUri("local:///home")).toBe("local");
  });

  it("returns sftp for sftp:// URI", () => {
    expect(providerIdFromUri("sftp://host/path")).toBe("sftp");
  });

  it("returns smb for smb:// URI", () => {
    expect(providerIdFromUri("smb://server/share")).toBe("smb");
  });

  it("returns local for plain path without scheme", () => {
    // uriScheme returns null for no scheme, which falls back to "local"
    expect(providerIdFromUri("/home/user")).toBe("local");
  });
});
