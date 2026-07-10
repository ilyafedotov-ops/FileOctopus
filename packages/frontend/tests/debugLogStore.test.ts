import { beforeEach, describe, expect, it } from "vitest";
import {
  getDebugLog,
  clearDebugLog,
  installConsoleCapture,
  pushBackendLog,
} from "../src/dev/debugLogStore";

describe("debugLogStore", () => {
  beforeEach(() => {
    clearDebugLog();
  });

  it("starts with empty logs", () => {
    expect(getDebugLog()).toEqual([]);
  });

  it("installConsoleCapture captures console.log entries", () => {
    installConsoleCapture(true);
    console.log("Test message");
    const logs = getDebugLog();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      level: "log",
      message: "Test message",
    });
  });

  it("captured entries include timestamp", () => {
    installConsoleCapture(true);
    console.warn("Warning message");
    const logs = getDebugLog();
    expect(logs[0].timestamp).toBeTypeOf("number");
  });

  it("captured entries preserve order", () => {
    installConsoleCapture(true);
    console.log("First");
    console.warn("Second");
    console.error("Third");
    const logs = getDebugLog();
    expect(logs.map((l) => l.message)).toEqual(["First", "Second", "Third"]);
  });

  it("clearDebugLog removes all entries", () => {
    installConsoleCapture(true);
    console.log("A");
    console.log("B");
    clearDebugLog();
    expect(getDebugLog()).toEqual([]);
  });

  it("supports different log levels", () => {
    installConsoleCapture(true);
    console.log("Log msg");
    console.warn("Warn msg");
    console.error("Error msg");
    const logs = getDebugLog();
    expect(logs.map((l) => l.level)).toEqual(["log", "warn", "error"]);
  });

  it("pushBackendLog records backend entries with mapped level and target", () => {
    pushBackendLog({
      level: "DEBUG",
      target: "fs_core::listing",
      message: "listed entries",
      timestampMs: 1234,
    });
    const logs = getDebugLog();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      level: "debug",
      source: "backend",
      target: "fs_core::listing",
      message: "listed entries",
      timestamp: 1234,
    });
  });

  it("pushBackendLog falls back to log level for unknown levels", () => {
    pushBackendLog({
      level: "WEIRD",
      target: "x",
      message: "msg",
      timestampMs: 0,
    });
    expect(getDebugLog()[0].level).toBe("log");
  });

  it("frontend captures are tagged with the frontend source", () => {
    installConsoleCapture(true);
    console.log("hello");
    expect(getDebugLog()[0].source).toBe("frontend");
  });
});
