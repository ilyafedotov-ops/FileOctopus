import { describe, expect, it } from "vitest";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import {
  createParentDirectoryEntry,
  isParentDirectoryEntry,
  isParentDirectoryUri,
  prependParentDirectoryEntry,
} from "../src/utils/parentEntry";

function fileEntry(name: string): FileEntryDto {
  return {
    uri: `local:///tmp/${name}`,
    name,
    kind: "file",
    isHidden: false,
    isSymlink: false,
    providerId: "local",
    canRead: true,
    canList: false,
    canWrite: false,
    canDelete: false,
    canRename: false,
  };
}

describe("parentEntry", () => {
  it("creates a parent directory entry for nested paths", () => {
    const entry = createParentDirectoryEntry("local:///Users/ilya/Documents");

    expect(entry).toEqual({
      uri: "local:///Users/ilya",
      name: "..",
      extension: null,
      kind: "directory",
      size: null,
      modifiedAt: null,
      createdAt: null,
      accessedAt: null,
      isHidden: false,
      isSymlink: false,
      isPlaceholder: false,
      symlinkTarget: null,
      providerId: "local",
      canRead: true,
      canList: true,
      canWrite: false,
      canDelete: false,
      canRename: false,
      permissions: null,
      owner: null,
    });
  });

  it("returns null at filesystem root", () => {
    expect(createParentDirectoryEntry("local:///Users")).toBeNull();
  });

  it("creates a parent directory entry for remote paths", () => {
    const entry = createParentDirectoryEntry(
      "sftp://77ac077d-d721-480f-9ee0-bb22403f0fd5/home/ilya",
    );

    expect(entry).toEqual({
      uri: "sftp://77ac077d-d721-480f-9ee0-bb22403f0fd5/home",
      name: "..",
      extension: null,
      kind: "directory",
      size: null,
      modifiedAt: null,
      createdAt: null,
      accessedAt: null,
      isHidden: false,
      isSymlink: false,
      isPlaceholder: false,
      symlinkTarget: null,
      providerId: "sftp",
      canRead: true,
      canList: true,
      canWrite: false,
      canDelete: false,
      canRename: false,
      permissions: null,
      owner: null,
    });
  });

  it("detects synthetic parent entries", () => {
    const parent = createParentDirectoryEntry("local:///tmp/nested")!;

    expect(isParentDirectoryEntry(parent, "local:///tmp/nested")).toBe(true);
    expect(isParentDirectoryUri("local:///tmp", "local:///tmp/nested")).toBe(
      true,
    );
    expect(
      isParentDirectoryEntry(fileEntry("readme.txt"), "local:///tmp/nested"),
    ).toBe(false);
  });

  it("prepends parent entry and dedupes existing .. rows", () => {
    const currentUri = "local:///tmp/nested";
    const entries = [fileEntry("a.txt"), fileEntry("b.txt")];
    const withParent = prependParentDirectoryEntry(currentUri, entries);

    expect(withParent).toHaveLength(3);
    expect(withParent[0]?.name).toBe("..");
    expect(withParent[0]?.uri).toBe("local:///tmp");

    const existingParent = fileEntry("..");
    existingParent.uri = "local:///tmp";
    existingParent.kind = "directory";

    expect(
      prependParentDirectoryEntry(currentUri, [existingParent, ...entries]),
    ).toHaveLength(3);
  });
});
