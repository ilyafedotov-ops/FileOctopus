import { describe, expect, it } from "vitest";
import {
  normalizeCommandContext,
  type CommandInvokeContext,
} from "../src/commands/invokeContext";
import type { FileEntryDto } from "@fileoctopus/ts-api";

const sampleEntry: FileEntryDto = {
  uri: "local:///home/user/file.txt",
  name: "file.txt",
  kind: "file",
  size: 1024,
  modifiedAt: "2026-01-01T00:00:00Z",
  isHidden: false,
  isSymlink: false,
  providerId: "local",
  canRead: true,
  canWrite: true,
  canDelete: true,
  canRename: true,
  canList: false,
};

describe("normalizeCommandContext", () => {
  it("returns undefined for undefined input", () => {
    expect(normalizeCommandContext(undefined)).toBeUndefined();
  });

  it("wraps null into { entry: null }", () => {
    expect(normalizeCommandContext(null)).toEqual({ entry: null });
  });

  it("wraps FileEntryDto into { entry: dto }", () => {
    const result = normalizeCommandContext(sampleEntry);
    expect(result).toEqual({ entry: sampleEntry });
  });

  it("passes through CommandInvokeContext as-is", () => {
    const ctx: CommandInvokeContext = {
      entry: sampleEntry,
      targetUri: "local:///home/user/dest",
      sortField: "name",
      sortAscending: true,
    };
    expect(normalizeCommandContext(ctx)).toBe(ctx);
  });

  it("passes through CommandInvokeContext with favoriteId", () => {
    const ctx: CommandInvokeContext = {
      favoriteId: 42,
    };
    expect(normalizeCommandContext(ctx)).toBe(ctx);
  });

  it("passes through CommandInvokeContext with preferenceValue", () => {
    const ctx: CommandInvokeContext = {
      preferenceValue: "dark",
    };
    expect(normalizeCommandContext(ctx)).toBe(ctx);
  });

  it("passes through CommandInvokeContext with targetUri", () => {
    const ctx: CommandInvokeContext = {
      targetUri: "local:///home/user/target",
    };
    expect(normalizeCommandContext(ctx)).toBe(ctx);
  });

  it("distinguishes FileEntryDto from CommandInvokeContext via sortField", () => {
    const ctx: CommandInvokeContext = {
      entry: sampleEntry,
      sortField: "name",
    };
    const result = normalizeCommandContext(ctx);
    expect(result).toBe(ctx);
    expect(result).not.toEqual({ entry: ctx });
  });

  it("distinguishes FileEntryDto from CommandInvokeContext via preferenceValue", () => {
    const ctx: CommandInvokeContext = {
      entry: sampleEntry,
      preferenceValue: "test",
    };
    expect(normalizeCommandContext(ctx)).toBe(ctx);
  });

  it("distinguishes FileEntryDto from CommandInvokeContext via targetUri", () => {
    const ctx: CommandInvokeContext = {
      entry: sampleEntry,
      targetUri: "local:///some/path",
    };
    expect(normalizeCommandContext(ctx)).toBe(ctx);
  });

  it("distinguishes FileEntryDto from CommandInvokeContext via favoriteId", () => {
    const ctx: CommandInvokeContext = {
      entry: sampleEntry,
      favoriteId: 1,
    };
    expect(normalizeCommandContext(ctx)).toBe(ctx);
  });
});
