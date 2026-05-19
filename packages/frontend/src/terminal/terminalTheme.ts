import type { ITheme } from "@xterm/xterm";

function readCssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

export function buildTerminalTheme(): ITheme {
  return {
    background: readCssVar("--fo-editor-bg", "#1e1e1e"),
    foreground: readCssVar("--fo-text", "#cccccc"),
    cursor: readCssVar("--fo-accent", "#007acc"),
    cursorAccent: readCssVar("--fo-editor-bg", "#1e1e1e"),
    selectionBackground: readCssVar("--fo-selection-bg", "#264f78"),
    black: "#000000",
    red: "#cd3131",
    green: "#0dbc79",
    yellow: "#e5e510",
    blue: "#2472c8",
    magenta: "#bc3fbc",
    cyan: "#11a8cd",
    white: "#e5e5e5",
    brightBlack: "#666666",
    brightRed: "#f14c4c",
    brightGreen: "#23d18b",
    brightYellow: "#f5f543",
    brightBlue: "#3b8eea",
    brightMagenta: "#d670d6",
    brightCyan: "#29b8db",
    brightWhite: "#ffffff",
  };
}
