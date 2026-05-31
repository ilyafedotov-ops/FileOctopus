import { describe, expect, it } from "vitest";
import {
  encodeTerminalInput,
  shellEscapePosixPath,
  terminalControlFromKeydown,
} from "../src/terminal/shellEscape";

describe("shellEscapePosixPath", () => {
  it("wraps paths in single quotes", () => {
    expect(shellEscapePosixPath("/tmp/demo")).toBe("'/tmp/demo'");
  });

  it("escapes embedded single quotes", () => {
    expect(shellEscapePosixPath("/tmp/o'brien")).toBe("'/tmp/o'\\''brien'");
  });

  it("returns empty quoted path for empty input", () => {
    expect(shellEscapePosixPath("")).toBe("''");
  });

  it("handles paths with spaces", () => {
    expect(shellEscapePosixPath("/path/with spaces/file")).toBe(
      "'/path/with spaces/file'",
    );
  });

  it("handles paths with special shell characters", () => {
    expect(shellEscapePosixPath("/tmp/$HOME")).toBe("'/tmp/$HOME'");
    expect(shellEscapePosixPath("/tmp/`cmd`")).toBe("'/tmp/`cmd`'");
    expect(shellEscapePosixPath('/tmp/"quoted"')).toBe("'/tmp/\"quoted\"'");
    expect(shellEscapePosixPath("/tmp/file;rm -rf /")).toBe(
      "'/tmp/file;rm -rf /'",
    );
    expect(shellEscapePosixPath("/tmp/a&b")).toBe("'/tmp/a&b'");
    expect(shellEscapePosixPath("/tmp/a|b")).toBe("'/tmp/a|b'");
  });

  it("handles paths with newlines", () => {
    expect(shellEscapePosixPath("/tmp/new\nline")).toBe("'/tmp/new\nline'");
  });

  it("handles paths with Unicode characters", () => {
    expect(shellEscapePosixPath("/home/用户/文件")).toBe("'/home/用户/文件'");
    expect(shellEscapePosixPath("/tmp/🎉")).toBe("'/tmp/🎉'");
  });

  it("handles paths with multiple single quotes", () => {
    expect(shellEscapePosixPath("it's a test's")).toBe(
      "'it'\\''s a test'\\''s'",
    );
  });

  it("handles paths with backslashes", () => {
    expect(shellEscapePosixPath("/tmp/a\\b")).toBe("'/tmp/a\\b'");
  });

  it("handles paths with tabs and special whitespace", () => {
    expect(shellEscapePosixPath("/tmp/a\tb")).toBe("'/tmp/a\tb'");
  });

  it("handles root path", () => {
    expect(shellEscapePosixPath("/")).toBe("'/'");
  });

  it("handles relative paths", () => {
    expect(shellEscapePosixPath("../parent")).toBe("'../parent'");
    expect(shellEscapePosixPath("./current")).toBe("'./current'");
  });
});

describe("encodeTerminalInput", () => {
  it("encodes a simple ASCII string", () => {
    const result = encodeTerminalInput("hello");
    expect(result).toBe(btoa("hello"));
  });

  it("encodes an empty string", () => {
    expect(encodeTerminalInput("")).toBe("");
  });

  it("encodes strings with special characters", () => {
    const result = encodeTerminalInput("ls -la\n");
    const expected = btoa(
      Array.from(new TextEncoder().encode("ls -la\n"), (byte) =>
        String.fromCharCode(byte),
      ).join(""),
    );
    expect(result).toBe(expected);
  });

  it("encodes Unicode strings correctly", () => {
    const result = encodeTerminalInput("你好");
    const expected = btoa(
      Array.from(new TextEncoder().encode("你好"), (byte) =>
        String.fromCharCode(byte),
      ).join(""),
    );
    expect(result).toBe(expected);
  });

  it("encodes control characters", () => {
    const input = "\x03";
    const result = encodeTerminalInput(input);
    const expected = btoa(
      Array.from(new TextEncoder().encode(input), (byte) =>
        String.fromCharCode(byte),
      ).join(""),
    );
    expect(result).toBe(expected);
  });

  it("encodes strings with null bytes", () => {
    const input = "a\x00b";
    const result = encodeTerminalInput(input);
    const bytes = new TextEncoder().encode(input);
    const expected = btoa(
      Array.from(bytes, (b) => String.fromCharCode(b)).join(""),
    );
    expect(result).toBe(expected);
  });

  it("produces valid base64 for ASCII", () => {
    const result = encodeTerminalInput("test");
    expect(result).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
  });

  it("round-trips through atob for ASCII data", () => {
    const input = "hello world";
    const encoded = encodeTerminalInput(input);
    const decoded = atob(encoded);
    expect(decoded).toBe(input);
  });
});

describe("terminalControlFromKeydown", () => {
  function makeEvent(overrides: Partial<KeyboardEvent> = {}): KeyboardEvent {
    return {
      type: "keydown",
      key: "",
      code: "",
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      ...overrides,
    } as KeyboardEvent;
  }

  it("returns null for non-keydown event type", () => {
    const event = makeEvent({ type: "keyup" });
    expect(terminalControlFromKeydown(event)).toBeNull();
  });

  it("returns null when metaKey is held without ctrlKey", () => {
    const event = makeEvent({ metaKey: true, ctrlKey: false });
    expect(terminalControlFromKeydown(event)).toBeNull();
  });

  it("does not return null when metaKey is held with ctrlKey", () => {
    const event = makeEvent({
      metaKey: true,
      ctrlKey: true,
      key: "c",
    });
    expect(terminalControlFromKeydown(event)).toBe("\x03");
  });

  it("returns null when altKey is held", () => {
    const event = makeEvent({ altKey: true, ctrlKey: true });
    expect(terminalControlFromKeydown(event)).toBeNull();
  });

  it("returns DEL for Backspace key", () => {
    const event = makeEvent({ key: "Backspace" });
    expect(terminalControlFromKeydown(event)).toBe("\x7f");
  });

  it("returns escape sequence for Delete key", () => {
    const event = makeEvent({ key: "Delete" });
    expect(terminalControlFromKeydown(event)).toBe("\x1b[3~");
  });

  it("returns null when no ctrlKey is held (non-special key)", () => {
    const event = makeEvent({ key: "a", ctrlKey: false });
    expect(terminalControlFromKeydown(event)).toBeNull();
  });

  it("handles Ctrl+C via key \\x03", () => {
    const event = makeEvent({ ctrlKey: true, key: "\x03" });
    expect(terminalControlFromKeydown(event)).toBe("\x03");
  });

  it("handles Ctrl+D via key \\x04", () => {
    const event = makeEvent({ ctrlKey: true, key: "\x04" });
    expect(terminalControlFromKeydown(event)).toBe("\x04");
  });

  it("handles Ctrl+Z via key \\x1a", () => {
    const event = makeEvent({ ctrlKey: true, key: "\x1a" });
    expect(terminalControlFromKeydown(event)).toBe("\x1a");
  });

  it("handles Ctrl+A through Ctrl+Z via lowercase key", () => {
    for (let i = 0; i < 26; i++) {
      const char = String.fromCharCode(97 + i); // a-z
      const event = makeEvent({ ctrlKey: true, key: char });
      const expected = String.fromCharCode(i + 1);
      expect(terminalControlFromKeydown(event)).toBe(expected);
    }
  });

  it("handles Ctrl+A through Ctrl+Z via uppercase key", () => {
    for (let i = 0; i < 26; i++) {
      const char = String.fromCharCode(65 + i); // A-Z
      const event = makeEvent({ ctrlKey: true, key: char });
      const expected = String.fromCharCode(i + 1);
      expect(terminalControlFromKeydown(event)).toBe(expected);
    }
  });

  it("handles Ctrl+letter via event.code (KeyA-KeyZ)", () => {
    const event = makeEvent({
      ctrlKey: true,
      key: "Unknown",
      code: "KeyC",
    });
    // KeyC → charCodeAt(3) = 'C' = 67 → 67 - 64 = 3 → \x03
    expect(terminalControlFromKeydown(event)).toBe("\x03");
  });

  it("returns ESC for Ctrl+[ via key", () => {
    const event = makeEvent({ ctrlKey: true, key: "[" });
    expect(terminalControlFromKeydown(event)).toBe("\x1b");
  });

  it("returns ESC for Ctrl+[ via code BracketLeft", () => {
    const event = makeEvent({
      ctrlKey: true,
      key: "Unknown",
      code: "BracketLeft",
    });
    expect(terminalControlFromKeydown(event)).toBe("\x1b");
  });

  it("returns FS for Ctrl+\\ via key", () => {
    const event = makeEvent({ ctrlKey: true, key: "\\" });
    expect(terminalControlFromKeydown(event)).toBe("\x1c");
  });

  it("returns FS for Ctrl+\\ via code Backslash", () => {
    const event = makeEvent({
      ctrlKey: true,
      key: "Unknown",
      code: "Backslash",
    });
    expect(terminalControlFromKeydown(event)).toBe("\x1c");
  });

  it("returns GS for Ctrl+] via key", () => {
    const event = makeEvent({ ctrlKey: true, key: "]" });
    expect(terminalControlFromKeydown(event)).toBe("\x1d");
  });

  it("returns GS for Ctrl+] via code BracketRight", () => {
    const event = makeEvent({
      ctrlKey: true,
      key: "Unknown",
      code: "BracketRight",
    });
    expect(terminalControlFromKeydown(event)).toBe("\x1d");
  });

  it("returns null for unrecognized ctrl combo", () => {
    const event = makeEvent({
      ctrlKey: true,
      key: "1",
      code: "Digit1",
    });
    expect(terminalControlFromKeydown(event)).toBeNull();
  });

  it("returns null for ctrl with multi-char non-letter key", () => {
    const event = makeEvent({
      ctrlKey: true,
      key: "Enter",
      code: "Enter",
    });
    expect(terminalControlFromKeydown(event)).toBeNull();
  });
});
