export function shellEscapePosixPath(path: string): string {
  if (!path) {
    return "''";
  }
  return `'${path.replace(/'/g, "'\\''")}'`;
}

export function encodeTerminalInput(data: string): string {
  return btoa(
    Array.from(new TextEncoder().encode(data), (byte) =>
      String.fromCharCode(byte),
    ).join(""),
  );
}

export function terminalControlFromKeydown(
  event: KeyboardEvent,
): string | null {
  if (event.type !== "keydown" || event.metaKey || event.altKey) {
    return null;
  }
  if (event.key === "Backspace") {
    return "\x7f";
  }
  if (event.key === "Delete") {
    return "\x1b[3~";
  }
  if (!event.ctrlKey) {
    return null;
  }
  if (event.key === "\x03") {
    return "\x03";
  }
  if (event.key === "\x04") {
    return "\x04";
  }
  if (event.key === "\x1a") {
    return "\x1a";
  }
  const key = event.key.toLowerCase();
  if (key.length === 1 && key >= "a" && key <= "z") {
    return String.fromCharCode(key.charCodeAt(0) - 96);
  }
  if (/^Key[A-Z]$/.test(event.code)) {
    return String.fromCharCode(event.code.charCodeAt(3) - 64);
  }
  if (event.key === "[" || event.code === "BracketLeft") {
    return "\x1b";
  }
  if (event.key === "\\" || event.code === "Backslash") {
    return "\x1c";
  }
  if (event.key === "]" || event.code === "BracketRight") {
    return "\x1d";
  }
  return null;
}
