import { describe, expect, it } from "vitest";
import { isEditableTarget, isTerminalInputContext } from "../src/shortcuts";
import { terminalControlFromKeydown } from "../src/terminal/shellEscape";

describe("terminal keyboard context", () => {
  it("treats xterm helper textarea as editable", () => {
    const host = document.createElement("div");
    host.className = "fo-terminal-view-host";
    const xtermRoot = document.createElement("div");
    xtermRoot.className = "xterm";
    const textarea = document.createElement("textarea");
    textarea.className = "xterm-helper-textarea";
    xtermRoot.append(textarea);
    host.append(xtermRoot);
    document.body.append(host);

    textarea.focus();
    expect(isTerminalInputContext()).toBe(true);
    expect(isEditableTarget(textarea)).toBe(true);

    host.remove();
  });
});

describe("terminalControlFromKeydown", () => {
  it("maps Ctrl+C to SIGINT", () => {
    const event = new KeyboardEvent("keydown", { ctrlKey: true, key: "c" });
    expect(terminalControlFromKeydown(event)).toBe("\x03");
  });

  it("ignores Cmd+C on macOS", () => {
    const event = new KeyboardEvent("keydown", { metaKey: true, key: "c" });
    expect(terminalControlFromKeydown(event)).toBeNull();
  });

  it("maps Ctrl+Shift+C to SIGINT", () => {
    const event = new KeyboardEvent("keydown", {
      ctrlKey: true,
      shiftKey: true,
      key: "C",
    });
    expect(terminalControlFromKeydown(event)).toBe("\x03");
  });

  it("maps Ctrl+C via KeyboardEvent.code", () => {
    const event = new KeyboardEvent("keydown", {
      ctrlKey: true,
      code: "KeyC",
      key: "c",
    });
    expect(terminalControlFromKeydown(event)).toBe("\x03");
  });

  it("maps Ctrl+U to terminal kill-line input", () => {
    const event = new KeyboardEvent("keydown", { ctrlKey: true, key: "u" });
    expect(terminalControlFromKeydown(event)).toBe("\x15");
  });

  it("maps Backspace to DEL", () => {
    const event = new KeyboardEvent("keydown", { key: "Backspace" });
    expect(terminalControlFromKeydown(event)).toBe("\x7f");
  });

  it("maps Delete to the terminal delete sequence", () => {
    const event = new KeyboardEvent("keydown", { key: "Delete" });
    expect(terminalControlFromKeydown(event)).toBe("\x1b[3~");
  });

  it("ignores printable keys without Ctrl", () => {
    const event = new KeyboardEvent("keydown", { key: "a" });
    expect(terminalControlFromKeydown(event)).toBeNull();
  });
});
