import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  persistSessionPaths,
  restoreSessionPaths,
  clearSessionPaths,
} from "../src/pane/sessionPaths";

describe("sessionPaths", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("restoreSessionPaths returns null when nothing is stored", () => {
    const result = restoreSessionPaths();
    expect(result.left).toBeNull();
    expect(result.right).toBeNull();
  });

  it("persistSessionPaths saves paths to localStorage", () => {
    persistSessionPaths("local:///home/user", "local:///home/user/Documents");
    const result = restoreSessionPaths();
    expect(result.left).toBe("local:///home/user");
    expect(result.right).toBe("local:///home/user/Documents");
  });

  it("clearSessionPaths removes stored paths", () => {
    persistSessionPaths("local:///home/user", "local:///home/user/Documents");
    clearSessionPaths();
    const result = restoreSessionPaths();
    expect(result.left).toBeNull();
    expect(result.right).toBeNull();
  });

  it("handles corrupted localStorage data gracefully", () => {
    localStorage.setItem("fileoctopus.sessionPaths", "{invalid json");
    const result = restoreSessionPaths();
    expect(result.left).toBeNull();
    expect(result.right).toBeNull();
  });

  it("persistSessionPaths overwrites previous paths", () => {
    persistSessionPaths("local:///old/left", "local:///old/right");
    persistSessionPaths("local:///new/left", "local:///new/right");
    const result = restoreSessionPaths();
    expect(result.left).toBe("local:///new/left");
    expect(result.right).toBe("local:///new/right");
  });

  it("persistSessionPaths handles localStorage quota error silently", () => {
    const original = localStorage.setItem;
    localStorage.setItem = () => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    };
    expect(() => persistSessionPaths("local:///a", "local:///b")).not.toThrow();
    localStorage.setItem = original;
  });
});
