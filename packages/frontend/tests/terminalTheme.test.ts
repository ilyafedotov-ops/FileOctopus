import { describe, expect, it, vi } from "vitest";
import { buildTerminalTheme } from "../src/terminal/terminalTheme";

describe("buildTerminalTheme", () => {
  it("returns fallback colors when document is undefined", () => {
    const theme = buildTerminalTheme();
    expect(theme.background).toBe("#1e1e1e");
    expect(theme.foreground).toBe("#cccccc");
    expect(theme.cursor).toBe("#007acc");
    expect(theme.cursorAccent).toBe("#1e1e1e");
    expect(theme.selectionBackground).toBe("#264f78");
  });

  it("returns all 16 ANSI colors", () => {
    const theme = buildTerminalTheme();
    expect(theme.black).toBe("#000000");
    expect(theme.red).toBe("#cd3131");
    expect(theme.green).toBe("#0dbc79");
    expect(theme.yellow).toBe("#e5e510");
    expect(theme.blue).toBe("#2472c8");
    expect(theme.magenta).toBe("#bc3fbc");
    expect(theme.cyan).toBe("#11a8cd");
    expect(theme.white).toBe("#e5e5e5");
    expect(theme.brightBlack).toBe("#666666");
    expect(theme.brightRed).toBe("#f14c4c");
    expect(theme.brightGreen).toBe("#23d18b");
    expect(theme.brightYellow).toBe("#f5f543");
    expect(theme.brightBlue).toBe("#3b8eea");
    expect(theme.brightMagenta).toBe("#d670d6");
    expect(theme.brightCyan).toBe("#29b8db");
    expect(theme.brightWhite).toBe("#ffffff");
  });

  it("reads CSS custom properties from document when available", () => {
    const originalDocument = globalThis.document;

    const mockGetPropertyValue = vi.fn((name: string) => {
      const map: Record<string, string> = {
        "--fo-editor-bg": "#2d2d2d",
        "--fo-text": "#eeeeee",
        "--fo-accent": "#ff0000",
        "--fo-selection-bg": "#555555",
      };
      return map[name] ?? "";
    });

    const mockGetComputedStyle = vi.fn(() => ({
      getPropertyValue: mockGetPropertyValue,
    }));

    Object.defineProperty(globalThis, "document", {
      value: {
        documentElement: {},
      },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "getComputedStyle", {
      value: mockGetComputedStyle,
      configurable: true,
      writable: true,
    });

    const theme = buildTerminalTheme();

    expect(mockGetComputedStyle).toHaveBeenCalled();
    expect(theme.background).toBe("#2d2d2d");
    expect(theme.foreground).toBe("#eeeeee");
    expect(theme.cursor).toBe("#ff0000");
    expect(theme.cursorAccent).toBe("#2d2d2d");
    expect(theme.selectionBackground).toBe("#555555");

    Object.defineProperty(globalThis, "document", {
      value: originalDocument,
      configurable: true,
      writable: true,
    });
  });

  it("falls back to defaults when CSS variables return empty strings", () => {
    const mockGetPropertyValue = vi.fn(() => "");
    const mockGetComputedStyle = vi.fn(() => ({
      getPropertyValue: mockGetPropertyValue,
    }));

    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", {
      value: { documentElement: {} },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "getComputedStyle", {
      value: mockGetComputedStyle,
      configurable: true,
      writable: true,
    });

    const theme = buildTerminalTheme();

    expect(theme.background).toBe("#1e1e1e");
    expect(theme.foreground).toBe("#cccccc");
    expect(theme.cursor).toBe("#007acc");
    expect(theme.cursorAccent).toBe("#1e1e1e");
    expect(theme.selectionBackground).toBe("#264f78");

    Object.defineProperty(globalThis, "document", {
      value: originalDocument,
      configurable: true,
      writable: true,
    });
  });

  it("trims whitespace from CSS variable values", () => {
    const mockGetPropertyValue = vi.fn((name: string) => {
      const map: Record<string, string> = {
        "--fo-editor-bg": "  #2d2d2d  ",
        "--fo-text": "  #eeeeee  ",
        "--fo-accent": "  #ff0000  ",
        "--fo-selection-bg": "  #555555  ",
      };
      return map[name] ?? "";
    });

    const mockGetComputedStyle = vi.fn(() => ({
      getPropertyValue: mockGetPropertyValue,
    }));

    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", {
      value: { documentElement: {} },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "getComputedStyle", {
      value: mockGetComputedStyle,
      configurable: true,
      writable: true,
    });

    const theme = buildTerminalTheme();

    expect(theme.background).toBe("#2d2d2d");
    expect(theme.foreground).toBe("#eeeeee");

    Object.defineProperty(globalThis, "document", {
      value: originalDocument,
      configurable: true,
      writable: true,
    });
  });
});
