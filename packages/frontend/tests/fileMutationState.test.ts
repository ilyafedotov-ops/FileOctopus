import { describe, expect, it } from "vitest";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import {
  fileMutationState,
  paneDirectoryCanWrite,
} from "../src/navigation/fileMutationState";
import { createInitialState, activeTab } from "../src/panelStore";
import type { PanelTabState } from "../src/panelStore";

function makeFileEntry(overrides: Partial<FileEntryDto> = {}): FileEntryDto {
  return {
    uri: "local:///tmp/file.txt",
    name: "file.txt",
    kind: "file",
    size: 100,
    isHidden: false,
    isSymlink: false,
    providerId: "local",
    canRead: true,
    canList: false,
    canWrite: true,
    canDelete: true,
    canRename: true,
    ...overrides,
  };
}

function makeDirEntry(overrides: Partial<FileEntryDto> = {}): FileEntryDto {
  return {
    uri: "local:///tmp/docs",
    name: "docs",
    kind: "directory",
    isHidden: false,
    isSymlink: false,
    providerId: "local",
    canRead: true,
    canList: true,
    canWrite: true,
    canDelete: true,
    canRename: true,
    ...overrides,
  };
}

function makeTabWithEntries(
  entries: FileEntryDto[],
  overrides: Partial<PanelTabState> = {},
): PanelTabState {
  const entriesById: Record<string, FileEntryDto> = {};
  for (const e of entries) {
    entriesById[e.uri] = e;
  }
  return {
    ...activeTab(createInitialState().panels.left),
    entriesById,
    orderedEntryIds: entries.map((e) => e.uri),
    selectedIds: entries.map((e) => e.uri),
    selectedId: entries.length > 0 ? entries[0].uri : null,
    ...overrides,
  };
}

describe("paneDirectoryCanWrite", () => {
  it("returns true when directory entry exists and canWrite is true", () => {
    const tab = makeTabWithEntries([], {
      uri: "local:///tmp",
      entriesById: {
        "local:///tmp": makeDirEntry({
          uri: "local:///tmp",
          canWrite: true,
        }),
      },
    });
    expect(paneDirectoryCanWrite(tab)).toBe(true);
  });

  it("returns false when directory entry exists and canWrite is false", () => {
    const tab = makeTabWithEntries([], {
      uri: "local:///tmp",
      entriesById: {
        "local:///tmp": makeDirEntry({
          uri: "local:///tmp",
          canWrite: false,
        }),
      },
    });
    expect(paneDirectoryCanWrite(tab)).toBe(false);
  });

  it("returns true for local URI without directory entry (non-remote)", () => {
    const tab = makeTabWithEntries([], {
      uri: "local:///some/path",
      entriesById: {},
    });
    expect(paneDirectoryCanWrite(tab)).toBe(true);
  });

  it("returns true for remote URI with empty entriesById", () => {
    const tab = makeTabWithEntries([], {
      uri: "sftp://profile-id/home",
      entriesById: {},
    });
    expect(paneDirectoryCanWrite(tab)).toBe(true);
  });

  it("returns true for remote URI when some entries have canWrite", () => {
    const tab = makeTabWithEntries([], {
      uri: "sftp://profile-id/home",
      entriesById: {
        "sftp://profile-id/home/a": makeFileEntry({
          uri: "sftp://profile-id/home/a",
          canWrite: true,
        }),
        "sftp://profile-id/home/b": makeFileEntry({
          uri: "sftp://profile-id/home/b",
          canWrite: false,
        }),
      },
    });
    expect(paneDirectoryCanWrite(tab)).toBe(true);
  });

  it("returns false for remote URI when no entries have canWrite", () => {
    const tab = makeTabWithEntries([], {
      uri: "sftp://profile-id/home",
      entriesById: {
        "sftp://profile-id/home/a": makeFileEntry({
          uri: "sftp://profile-id/home/a",
          canWrite: false,
        }),
      },
    });
    expect(paneDirectoryCanWrite(tab)).toBe(false);
  });

  it("ignores non-directory entries in entriesById for the directory check", () => {
    const tab = makeTabWithEntries([], {
      uri: "local:///tmp",
      entriesById: {
        "local:///tmp/somefile.txt": makeFileEntry({
          uri: "local:///tmp/somefile.txt",
        }),
      },
    });
    expect(paneDirectoryCanWrite(tab)).toBe(true);
  });
});

describe("fileMutationState", () => {
  it("returns all false with no selection", () => {
    const tab = makeTabWithEntries([]);
    const state = fileMutationState(tab, []);
    expect(state.canCopy).toBe(false);
    expect(state.canMove).toBe(false);
    expect(state.canRename).toBe(false);
    expect(state.canDelete).toBe(false);
    expect(state.canNewFolder).toBe(true);
    expect(state.canCreateFile).toBe(true);
    expect(state.canEdit).toBe(false);
  });

  it("enables copy when files are readable", () => {
    const entry = makeFileEntry({ canRead: true });
    const tab = makeTabWithEntries([entry]);
    expect(fileMutationState(tab, [entry]).canCopy).toBe(true);
  });

  it("disables copy when a file is not readable", () => {
    const entry = makeFileEntry({ canRead: false });
    const tab = makeTabWithEntries([entry]);
    expect(fileMutationState(tab, [entry]).canCopy).toBe(false);
  });

  it("enables copy for directory that canList", () => {
    const dir = makeDirEntry({ canList: true, canRead: false });
    const tab = makeTabWithEntries([dir]);
    expect(fileMutationState(tab, [dir]).canCopy).toBe(true);
  });

  it("disables copy for directory that cannot list", () => {
    const dir = makeDirEntry({ canList: false, canRead: false });
    const tab = makeTabWithEntries([dir]);
    expect(fileMutationState(tab, [dir]).canCopy).toBe(false);
  });

  it("enables move when files are writable and deletable", () => {
    const entry = makeFileEntry({ canWrite: true, canDelete: true });
    const tab = makeTabWithEntries([entry]);
    expect(fileMutationState(tab, [entry]).canMove).toBe(true);
  });

  it("disables move when file is not writable", () => {
    const entry = makeFileEntry({ canWrite: false, canDelete: true });
    const tab = makeTabWithEntries([entry]);
    expect(fileMutationState(tab, [entry]).canMove).toBe(false);
  });

  it("disables move when file is not deletable", () => {
    const entry = makeFileEntry({ canWrite: true, canDelete: false });
    const tab = makeTabWithEntries([entry]);
    expect(fileMutationState(tab, [entry]).canMove).toBe(false);
  });

  it("enables rename with single selected and canRename", () => {
    const entry = makeFileEntry({ canRename: true });
    const tab = makeTabWithEntries([entry]);
    expect(fileMutationState(tab, [entry]).canRename).toBe(true);
  });

  it("disables rename with multiple selections", () => {
    const a = makeFileEntry({ uri: "local:///a", canRename: true });
    const b = makeFileEntry({ uri: "local:///b", canRename: true });
    const tab = makeTabWithEntries([a, b]);
    expect(fileMutationState(tab, [a, b]).canRename).toBe(false);
  });

  it("disables rename when canRename is false", () => {
    const entry = makeFileEntry({ canRename: false });
    const tab = makeTabWithEntries([entry]);
    expect(fileMutationState(tab, [entry]).canRename).toBe(false);
  });

  it("enables delete when all files are deletable", () => {
    const a = makeFileEntry({ uri: "local:///a", canDelete: true });
    const b = makeFileEntry({ uri: "local:///b", canDelete: true });
    const tab = makeTabWithEntries([a, b]);
    expect(fileMutationState(tab, [a, b]).canDelete).toBe(true);
  });

  it("disables delete when any file is not deletable", () => {
    const a = makeFileEntry({ uri: "local:///a", canDelete: true });
    const b = makeFileEntry({ uri: "local:///b", canDelete: false });
    const tab = makeTabWithEntries([a, b]);
    expect(fileMutationState(tab, [a, b]).canDelete).toBe(false);
  });

  it("canNewFolder follows paneDirectoryCanWrite", () => {
    const dir = makeDirEntry({ uri: "local:///tmp", canWrite: true });
    const tab = makeTabWithEntries([], {
      uri: "local:///tmp",
      entriesById: { "local:///tmp": dir },
    });
    expect(fileMutationState(tab, []).canNewFolder).toBe(true);
  });

  it("canNewFolder is false when directory is not writable", () => {
    const dir = makeDirEntry({ uri: "local:///tmp", canWrite: false });
    const tab = makeTabWithEntries([], {
      uri: "local:///tmp",
      entriesById: { "local:///tmp": dir },
    });
    expect(fileMutationState(tab, []).canNewFolder).toBe(false);
  });

  it("canCreateFile follows paneDirectoryCanWrite", () => {
    const dir = makeDirEntry({ uri: "local:///tmp", canWrite: true });
    const tab = makeTabWithEntries([], {
      uri: "local:///tmp",
      entriesById: { "local:///tmp": dir },
    });
    expect(fileMutationState(tab, []).canCreateFile).toBe(true);
  });

  it("enables edit for local file with selection", () => {
    const entry = makeFileEntry({ uri: "local:///tmp/file.txt" });
    const tab = makeTabWithEntries([entry], { uri: "local:///tmp" });
    expect(fileMutationState(tab, [entry]).canEdit).toBe(true);
  });

  it("disables edit for remote file", () => {
    const entry = makeFileEntry({
      uri: "sftp://profile-id/home/file.txt",
      providerId: "sftp",
    });
    const tab = makeTabWithEntries([entry], {
      uri: "sftp://profile-id/home",
    });
    expect(fileMutationState(tab, [entry]).canEdit).toBe(false);
  });
});
