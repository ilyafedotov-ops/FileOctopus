export interface KeyCombo {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export function parseKeyCombo(str: string): KeyCombo | null {
  const parts = str.split("+").map((p) => p.trim().toLowerCase());
  if (parts.length === 0) return null;

  const combo: KeyCombo = {
    key: "",
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
  };

  for (const part of parts) {
    switch (part) {
      case "ctrl":
      case "control":
        combo.ctrl = true;
        break;
      case "alt":
      case "option":
      case "opt":
        combo.alt = true;
        break;
      case "shift":
        combo.shift = true;
        break;
      case "meta":
      case "cmd":
      case "command":
      case "win":
      case "windows":
        combo.meta = true;
        break;
      case "arrowleft":
      case "left":
        combo.key = "ArrowLeft";
        break;
      case "arrowright":
      case "right":
        combo.key = "ArrowRight";
        break;
      case "arrowup":
      case "up":
        combo.key = "ArrowUp";
        break;
      case "arrowdown":
      case "down":
        combo.key = "ArrowDown";
        break;
      case "return":
      case "enter":
        combo.key = "Enter";
        break;
      case "esc":
        combo.key = "Escape";
        break;
      case "del":
        combo.key = "Delete";
        break;
      case "ins":
        combo.key = "Insert";
        break;
      case "pgup":
      case "pageup":
        combo.key = "PageUp";
        break;
      case "pgdn":
      case "pagedown":
        combo.key = "PageDown";
        break;
      case " ":
        combo.key = " ";
        break;
      case ",":
        combo.key = ",";
        break;
      case ".":
        combo.key = ".";
        break;
      case "/":
        combo.key = "/";
        break;
      case ";":
        combo.key = ";";
        break;
      case "=":
        combo.key = "=";
        break;
      case "-":
        combo.key = "-";
        break;
      case "[":
        combo.key = "[";
        break;
      case "]":
        combo.key = "]";
        break;
      case "\\":
        combo.key = "\\";
        break;
      case "'":
        combo.key = "'";
        break;
      case "`":
        combo.key = "`";
        break;
      default:
        if (part.startsWith("f") && /^\d+$/.test(part.slice(1))) {
          combo.key = part.toUpperCase();
        } else if (part.length === 1) {
          combo.key = part;
        } else {
          combo.key = part;
        }
    }
  }

  if (!combo.key) return null;
  return combo;
}

export function serializeKeyCombo(combo: KeyCombo): string {
  const parts: string[] = [];
  if (combo.ctrl) parts.push("Ctrl");
  if (combo.alt) parts.push("Alt");
  if (combo.shift) parts.push("Shift");
  if (combo.meta) parts.push("Meta");

  let key = combo.key;
  if (key === " ") key = "Space";
  else if (key.length === 1) key = key.toLowerCase();
  parts.push(key);

  return parts.join("+");
}

export function eventToKeyCombo(
  event: KeyboardEvent | React.KeyboardEvent,
): KeyCombo {
  return {
    key: event.key,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  };
}

export function matchesKeyCombo(
  event: KeyboardEvent | React.KeyboardEvent,
  combo: KeyCombo,
): boolean {
  const eventKey = event.key;
  const comboKey = combo.key;

  const keyMatch =
    eventKey === comboKey || eventKey.toLowerCase() === comboKey.toLowerCase();

  return (
    keyMatch &&
    event.ctrlKey === combo.ctrl &&
    event.altKey === combo.alt &&
    event.shiftKey === combo.shift &&
    event.metaKey === combo.meta
  );
}

export function formatKeyComboForDisplay(
  combo: KeyCombo,
  platform: "mac" | "windowsLinux",
): string {
  const parts: string[] = [];
  if (platform === "mac") {
    if (combo.ctrl) parts.push("⌃");
    if (combo.alt) parts.push("⌥");
    if (combo.shift) parts.push("⇧");
    if (combo.meta) parts.push("⌘");
  } else {
    if (combo.ctrl) parts.push("Ctrl");
    if (combo.alt) parts.push("Alt");
    if (combo.shift) parts.push("Shift");
    if (combo.meta) parts.push("Win");
  }

  let key = combo.key;
  if (key === " ") key = "Space";
  else if (key === "ArrowLeft") key = platform === "mac" ? "←" : "←";
  else if (key === "ArrowRight") key = platform === "mac" ? "→" : "→";
  else if (key === "ArrowUp") key = platform === "mac" ? "↑" : "↑";
  else if (key === "ArrowDown") key = platform === "mac" ? "↓" : "↓";
  else if (key === "Enter") key = platform === "mac" ? "Return" : "Enter";
  else if (key === "Escape") key = "Esc";
  else if (key === "Delete") key = platform === "mac" ? "Delete" : "Del";
  else if (key.length === 1) key = key.toUpperCase();

  parts.push(key);

  return platform === "mac" ? parts.join("") : parts.join("+");
}
