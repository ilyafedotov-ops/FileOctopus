import { describe, it, expect } from "vitest";
import { isArchiveFile, ARCHIVE_EXTENSIONS } from "../src/utils/archiveUtils";

describe("isArchiveFile", () => {
  it("returns true for .zip files", () => {
    expect(isArchiveFile("archive.zip")).toBe(true);
  });

  it("returns true for .tar files", () => {
    expect(isArchiveFile("backup.tar")).toBe(true);
  });

  it("returns true for .tar.gz files", () => {
    expect(isArchiveFile("backup.tar.gz")).toBe(true);
  });

  it("returns true for .tgz files", () => {
    expect(isArchiveFile("package.tgz")).toBe(true);
  });

  it("returns true for .tar.bz2 files", () => {
    expect(isArchiveFile("backup.tar.bz2")).toBe(true);
  });

  it("returns true for .tbz2 files", () => {
    expect(isArchiveFile("package.tbz2")).toBe(true);
  });

  it("returns false for regular files", () => {
    expect(isArchiveFile("document.pdf")).toBe(false);
    expect(isArchiveFile("image.png")).toBe(false);
    expect(isArchiveFile("readme.txt")).toBe(false);
  });

  it("returns false for directory names", () => {
    expect(isArchiveFile("my-folder")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isArchiveFile("archive.ZIP")).toBe(true);
    expect(isArchiveFile("backup.Tar.Gz")).toBe(true);
    expect(isArchiveFile("package.TGZ")).toBe(true);
  });

  it("handles names with dots before the extension", () => {
    expect(isArchiveFile("my.archive.file.zip")).toBe(true);
    expect(isArchiveFile("release.v1.0.tar.gz")).toBe(true);
  });
});

describe("ARCHIVE_EXTENSIONS", () => {
  it("contains all supported formats", () => {
    expect(ARCHIVE_EXTENSIONS).toContain(".zip");
    expect(ARCHIVE_EXTENSIONS).toContain(".tar");
    expect(ARCHIVE_EXTENSIONS).toContain(".tar.gz");
    expect(ARCHIVE_EXTENSIONS).toContain(".tgz");
    expect(ARCHIVE_EXTENSIONS).toContain(".tar.bz2");
    expect(ARCHIVE_EXTENSIONS).toContain(".tbz2");
  });
});
