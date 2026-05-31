import { beforeEach, describe, expect, it } from "vitest";
import {
  getDebugLog,
  clearDebugLog,
  installConsoleCapture,
} from "../src/dev/debugLogStore";

describe("debugLogStore", () => {
  beforeEach(() => {
    clearDebugLog();
  });

  it("starts with empty logs", () => {
    expect(getDebugLog()).toEqual([]);
  });

  it("installConsoleCapture captures console.log entries", () => {
    installConsoleCapture();
    console.log("Test message");
    const logs = getDebugLog();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      level: "log",
      message: "Test message",
    });
  });

  it("captured entries include timestamp", () => {
    installConsoleCapture();
    console.warn("Warning message");
    const logs = getDebugLog();
    expect(logs[0].timestamp).toBeTypeOf("number");
  });

  it("captured entries preserve order", () => {
    installConsoleCapture();
    console.log("First");
    console.warn("Second");
    console.error("Third");
    const logs = getDebugLog();
    expect(logs.map((l) => l.message)).toEqual(["First", "Second", "Third"]);
  });

  it("clearDebugLog removes all entries", () => {
    installConsoleCapture();
    console.log("A");
    console.log("B");
    clearDebugLog();
    expect(getDebugLog()).toEqual([]);
  });

  it("supports different log levels", () => {
    installConsoleCapture();
    console.log("Log msg");
    console.warn("Warn msg");
    console.error("Error msg");
    const logs = getDebugLog();
    expect(logs.map((l) => l.level)).toEqual(["log", "warn", "error"]);
  });
});
