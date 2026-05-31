import { describe, it, expect } from "vitest";
import { formatSize, formatDate } from "../src/pane/fileTableUtils";

describe("formatSize", () => {
  it("returns dash for null", () => {
    expect(formatSize(null)).toBe("—");
  });

  it("returns dash for undefined", () => {
    expect(formatSize(undefined)).toBe("—");
  });

  it("formats bytes", () => {
    expect(formatSize(0)).toBe("0 B");
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(1023)).toBe("1023 B");
  });

  it("formats kilobytes", () => {
    expect(formatSize(1024)).toBe("1.0 KB");
    expect(formatSize(1536)).toBe("1.5 KB");
    expect(formatSize(1048575)).toBe("1024.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatSize(1048576)).toBe("1.0 MB");
    expect(formatSize(1073741824)).toBe("1024.0 MB");
  });
});

describe("formatDate", () => {
  it("returns dash for null", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("returns dash for undefined", () => {
    expect(formatDate(undefined)).toBe("—");
  });

  it("returns dash for empty string", () => {
    expect(formatDate("")).toBe("—");
  });

  it("returns dash for invalid date", () => {
    expect(formatDate("not-a-date")).toBe("—");
  });

  it("formats a valid ISO date string", () => {
    const result = formatDate("2025-01-15T10:30:00Z");
    expect(result).toBeTruthy();
    expect(result.indexOf("Jan")).not.toBe(-1);
  });

  it("shows Today for current date", () => {
    const now = new Date();
    const result = formatDate(now.toISOString());
    expect(result.indexOf("Today")).toBe(0);
  });

  it("shows Yesterday for yesterday", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const result = formatDate(yesterday.toISOString());
    expect(result.indexOf("Yesterday")).toBe(0);
  });
});
