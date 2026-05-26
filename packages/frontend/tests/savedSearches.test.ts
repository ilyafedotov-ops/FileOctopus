import { describe, it, expect, beforeEach } from "vitest";
import {
  type SmartFolder,
  loadSmartFolders,
  saveSmartFolders,
  addSmartFolder,
  removeSmartFolder,
  renameSmartFolder,
  SMART_FOLDERS_KEY,
} from "../src/savedSearches";

const mockFolder: Omit<SmartFolder, "id"> = {
  name: "My PDFs",
  baseUri: "local:///home/user/Documents",
  query: "*.pdf",
};

beforeEach(() => {
  localStorage.clear();
});

describe("loadSmartFolders", () => {
  it("returns empty array when nothing stored", () => {
    expect(loadSmartFolders()).toEqual([]);
  });

  it("returns parsed array from localStorage", () => {
    const folders: SmartFolder[] = [
      { id: "abc", name: "Test", baseUri: "local:///tmp", query: "*.txt" },
    ];
    localStorage.setItem(SMART_FOLDERS_KEY, JSON.stringify(folders));
    expect(loadSmartFolders()).toEqual(folders);
  });

  it("returns empty array on invalid JSON", () => {
    localStorage.setItem(SMART_FOLDERS_KEY, "not json");
    expect(loadSmartFolders()).toEqual([]);
  });
});

describe("saveSmartFolders", () => {
  it("writes to localStorage", () => {
    const folders: SmartFolder[] = [
      { id: "1", name: "A", baseUri: "local:///a", query: "a*" },
    ];
    saveSmartFolders(folders);
    expect(localStorage.getItem(SMART_FOLDERS_KEY)).toEqual(
      JSON.stringify(folders),
    );
  });
});

describe("addSmartFolder", () => {
  it("adds a folder with generated id", () => {
    const result = addSmartFolder(mockFolder);
    expect(result.id).toBeTruthy();
    expect(result.name).toBe("My PDFs");
    expect(result.baseUri).toBe("local:///home/user/Documents");
    expect(result.query).toBe("*.pdf");
  });

  it("persists to localStorage", () => {
    addSmartFolder(mockFolder);
    const stored = loadSmartFolders();
    expect(stored.length).toBe(1);
    expect(stored[0].name).toBe("My PDFs");
  });

  it("appends to existing folders", () => {
    addSmartFolder(mockFolder);
    addSmartFolder({ ...mockFolder, name: "Images", query: "*.png" });
    const stored = loadSmartFolders();
    expect(stored.length).toBe(2);
  });
});

describe("removeSmartFolder", () => {
  it("removes folder by id", () => {
    const folder = addSmartFolder(mockFolder);
    removeSmartFolder(folder.id);
    expect(loadSmartFolders()).toEqual([]);
  });

  it("no-ops for non-existent id", () => {
    addSmartFolder(mockFolder);
    removeSmartFolder("nonexistent");
    expect(loadSmartFolders().length).toBe(1);
  });
});

describe("renameSmartFolder", () => {
  it("renames folder by id", () => {
    const folder = addSmartFolder(mockFolder);
    renameSmartFolder(folder.id, "Renamed");
    const stored = loadSmartFolders();
    expect(stored[0].name).toBe("Renamed");
  });

  it("no-ops for non-existent id", () => {
    addSmartFolder(mockFolder);
    renameSmartFolder("nonexistent", "X");
    expect(loadSmartFolders()[0].name).toBe("My PDFs");
  });
});
