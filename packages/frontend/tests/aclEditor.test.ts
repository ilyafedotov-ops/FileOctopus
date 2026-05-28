import { describe, it, expect } from "vitest";
import {
  octalFromEntries,
  entriesFromOctal,
} from "../src/components/dialogs/AclEditor";
import type { AclEntry } from "@fileoctopus/ts-api";

describe("octalFromEntries", () => {
  it("converts full permissions to 777", () => {
    const entries: AclEntry[] = [
      { principal: "owner", read: true, write: true, execute: true },
      { principal: "group", read: true, write: true, execute: true },
      { principal: "other", read: true, write: true, execute: true },
    ];
    expect(octalFromEntries(entries)).toBe("777");
  });

  it("converts default file permissions to 644", () => {
    const entries: AclEntry[] = [
      { principal: "owner", read: true, write: true, execute: false },
      { principal: "group", read: true, write: false, execute: false },
      { principal: "other", read: true, write: false, execute: false },
    ];
    expect(octalFromEntries(entries)).toBe("644");
  });

  it("converts no permissions to 000", () => {
    const entries: AclEntry[] = [
      { principal: "owner", read: false, write: false, execute: false },
      { principal: "group", read: false, write: false, execute: false },
      { principal: "other", read: false, write: false, execute: false },
    ];
    expect(octalFromEntries(entries)).toBe("000");
  });

  it("converts 755 permissions", () => {
    const entries: AclEntry[] = [
      { principal: "owner", read: true, write: true, execute: true },
      { principal: "group", read: true, write: false, execute: true },
      { principal: "other", read: true, write: false, execute: true },
    ];
    expect(octalFromEntries(entries)).toBe("755");
  });
});

describe("entriesFromOctal", () => {
  it("parses 755 to correct entries", () => {
    const entries = entriesFromOctal("755");
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({
      principal: "owner",
      read: true,
      write: true,
      execute: true,
    });
    expect(entries[1]).toEqual({
      principal: "group",
      read: true,
      write: false,
      execute: true,
    });
    expect(entries[2]).toEqual({
      principal: "other",
      read: true,
      write: false,
      execute: true,
    });
  });

  it("parses 644 to correct entries", () => {
    const entries = entriesFromOctal("644");
    expect(entries[0]).toEqual({
      principal: "owner",
      read: true,
      write: true,
      execute: false,
    });
    expect(entries[1]).toEqual({
      principal: "group",
      read: true,
      write: false,
      execute: false,
    });
    expect(entries[2]).toEqual({
      principal: "other",
      read: true,
      write: false,
      execute: false,
    });
  });

  it("parses 000 to all false", () => {
    const entries = entriesFromOctal("000");
    for (const entry of entries) {
      expect(entry.read).toBe(false);
      expect(entry.write).toBe(false);
      expect(entry.execute).toBe(false);
    }
  });

  it("round-trips through octalFromEntries", () => {
    const octal = "755";
    const entries = entriesFromOctal(octal);
    expect(octalFromEntries(entries)).toBe(octal);
  });
});
