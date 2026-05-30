import { describe, expect, it } from "vitest";
import {
  parseKeyCombo,
  serializeKeyCombo,
  eventToKeyCombo,
  matchesKeyCombo,
  formatKeyComboForDisplay,
  type KeyCombo,
} from "../src/commands/keyCombo";

describe("parseKeyCombo", () => {
  it("parses simple key", () => {
    const result = parseKeyCombo("a");
    expect(result).toEqual({
      key: "a",
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
    });
  });

  it("parses Ctrl+A", () => {
    const result = parseKeyCombo("Ctrl+A");
    expect(result).toEqual({
      key: "a",
      ctrl: true,
      alt: false,
      shift: false,
      meta: false,
    });
  });

  it("parses Ctrl+Shift+P", () => {
    const result = parseKeyCombo("Ctrl+Shift+P");
    expect(result).toEqual({
      key: "p",
      ctrl: true,
      alt: false,
      shift: true,
      meta: false,
    });
  });

  it("parses Ctrl+Alt+Delete (key becomes lowercase via default case)", () => {
    const result = parseKeyCombo("Ctrl+Alt+Delete");
    expect(result).toEqual({
      key: "delete",
      ctrl: true,
      alt: true,
      shift: false,
      meta: false,
    });
  });

  it("parses Ctrl+Control as ctrl flag only", () => {
    const result = parseKeyCombo("Ctrl+Control+A");
    expect(result).toBeTruthy();
    expect(result!.ctrl).toBe(true);
    expect(result!.key).toBe("a");
  });

  it("parses modifier aliases: opt, option", () => {
    const r1 = parseKeyCombo("Opt+A");
    expect(r1?.alt).toBe(true);
    const r2 = parseKeyCombo("Option+A");
    expect(r2?.alt).toBe(true);
  });

  it("parses modifier aliases: cmd, command, win, windows", () => {
    for (const alias of ["Cmd", "Command", "Win", "Windows"]) {
      const result = parseKeyCombo(`${alias}+C`);
      expect(result?.meta).toBe(true);
      expect(result?.key).toBe("c");
    }
  });

  it("parses arrow key aliases", () => {
    expect(parseKeyCombo("Left")?.key).toBe("ArrowLeft");
    expect(parseKeyCombo("Right")?.key).toBe("ArrowRight");
    expect(parseKeyCombo("Up")?.key).toBe("ArrowUp");
    expect(parseKeyCombo("Down")?.key).toBe("ArrowDown");
    expect(parseKeyCombo("ArrowLeft")?.key).toBe("ArrowLeft");
    expect(parseKeyCombo("ArrowRight")?.key).toBe("ArrowRight");
  });

  it("parses Enter and Return", () => {
    expect(parseKeyCombo("Enter")?.key).toBe("Enter");
    expect(parseKeyCombo("Return")?.key).toBe("Enter");
  });

  it("parses Esc → Escape", () => {
    expect(parseKeyCombo("Esc")?.key).toBe("Escape");
  });

  it("parses Del → Delete", () => {
    expect(parseKeyCombo("Del")?.key).toBe("Delete");
  });

  it("parses Delete as lowercase (default case, multi-char)", () => {
    expect(parseKeyCombo("Delete")?.key).toBe("delete");
  });

  it("parses Ins → Insert", () => {
    expect(parseKeyCombo("Ins")?.key).toBe("Insert");
  });

  it("parses PgUp/PageUp and PgDn/PageDown", () => {
    expect(parseKeyCombo("PgUp")?.key).toBe("PageUp");
    expect(parseKeyCombo("PageUp")?.key).toBe("PageUp");
    expect(parseKeyCombo("PgDn")?.key).toBe("PageDown");
    expect(parseKeyCombo("PageDown")?.key).toBe("PageDown");
  });

  it("parses function keys F1-F12", () => {
    expect(parseKeyCombo("F1")?.key).toBe("F1");
    expect(parseKeyCombo("F5")?.key).toBe("F5");
    expect(parseKeyCombo("F12")?.key).toBe("F12");
    expect(parseKeyCombo("Ctrl+F5")?.key).toBe("F5");
    expect(parseKeyCombo("Ctrl+F5")?.ctrl).toBe(true);
  });

  it("parses Space key — standalone space returns null (split edge case)", () => {
    // A bare " " splits to ["", ""], so key stays empty → null
    expect(parseKeyCombo(" ")).toBeNull();
  });

  it("parses punctuation keys", () => {
    expect(parseKeyCombo(",")?.key).toBe(",");
    expect(parseKeyCombo(".")?.key).toBe(".");
    expect(parseKeyCombo("/")?.key).toBe("/");
    expect(parseKeyCombo(";")?.key).toBe(";");
    expect(parseKeyCombo("=")?.key).toBe("=");
    expect(parseKeyCombo("-")?.key).toBe("-");
    expect(parseKeyCombo("[")?.key).toBe("[");
    expect(parseKeyCombo("]")?.key).toBe("]");
    expect(parseKeyCombo("\\")?.key).toBe("\\");
    expect(parseKeyCombo("'")?.key).toBe("'");
    expect(parseKeyCombo("`")?.key).toBe("`");
  });

  it("returns null for empty string", () => {
    expect(parseKeyCombo("")).toBeNull();
  });

  it("returns null for modifiers-only string", () => {
    expect(parseKeyCombo("Ctrl")).toBeNull();
    expect(parseKeyCombo("Ctrl+Shift")).toBeNull();
    expect(parseKeyCombo("Ctrl+Alt+Shift+Meta")).toBeNull();
  });

  it("is case-insensitive for modifiers", () => {
    const r1 = parseKeyCombo("ctrl+shift+a");
    const r2 = parseKeyCombo("CTRL+SHIFT+A");
    expect(r1).toEqual(r2);
    expect(r1?.ctrl).toBe(true);
    expect(r1?.shift).toBe(true);
  });

  it("handles full Ctrl+Shift+Alt+Meta combo", () => {
    const result = parseKeyCombo("Ctrl+Shift+Alt+Meta+X");
    expect(result).toEqual({
      key: "x",
      ctrl: true,
      shift: true,
      alt: true,
      meta: true,
    });
  });
});

describe("serializeKeyCombo", () => {
  it("serializes simple key", () => {
    expect(
      serializeKeyCombo({
        key: "a",
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
      }),
    ).toBe("a");
  });

  it("serializes Ctrl+A", () => {
    expect(
      serializeKeyCombo({
        key: "a",
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      }),
    ).toBe("Ctrl+a");
  });

  it("serializes Ctrl+Shift+P", () => {
    expect(
      serializeKeyCombo({
        key: "p",
        ctrl: true,
        alt: false,
        shift: true,
        meta: false,
      }),
    ).toBe("Ctrl+Shift+p");
  });

  it("serializes full combo with all modifiers", () => {
    expect(
      serializeKeyCombo({
        key: "x",
        ctrl: true,
        alt: true,
        shift: true,
        meta: true,
      }),
    ).toBe("Ctrl+Alt+Shift+Meta+x");
  });

  it("serializes Space key", () => {
    expect(
      serializeKeyCombo({
        key: " ",
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
      }),
    ).toBe("Space");
  });

  it("serializes single uppercase key as lowercase", () => {
    expect(
      serializeKeyCombo({
        key: "A",
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
      }),
    ).toBe("a");
  });

  it("serializes multi-char keys as-is (e.g., F1, Enter)", () => {
    expect(
      serializeKeyCombo({
        key: "F1",
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
      }),
    ).toBe("F1");
    expect(
      serializeKeyCombo({
        key: "Enter",
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
      }),
    ).toBe("Enter");
  });
});

describe("eventToKeyCombo", () => {
  it("extracts key combo from keyboard event", () => {
    const event = new KeyboardEvent("keydown", {
      key: "a",
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    });
    expect(eventToKeyCombo(event)).toEqual({
      key: "a",
      ctrl: true,
      shift: false,
      alt: false,
      meta: false,
    });
  });

  it("extracts all modifiers", () => {
    const event = new KeyboardEvent("keydown", {
      key: "X",
      ctrlKey: true,
      shiftKey: true,
      altKey: true,
      metaKey: true,
    });
    expect(eventToKeyCombo(event)).toEqual({
      key: "X",
      ctrl: true,
      shift: true,
      alt: true,
      meta: true,
    });
  });
});

describe("matchesKeyCombo", () => {
  const ctrlA: KeyCombo = {
    key: "a",
    ctrl: true,
    alt: false,
    shift: false,
    meta: false,
  };

  it("matches identical combo", () => {
    const event = new KeyboardEvent("keydown", { key: "a", ctrlKey: true });
    expect(matchesKeyCombo(event, ctrlA)).toBe(true);
  });

  it("matches case-insensitively", () => {
    const event = new KeyboardEvent("keydown", { key: "A", ctrlKey: true });
    expect(matchesKeyCombo(event, ctrlA)).toBe(true);
  });

  it("does not match when ctrl is not pressed", () => {
    const event = new KeyboardEvent("keydown", { key: "a", ctrlKey: false });
    expect(matchesKeyCombo(event, ctrlA)).toBe(false);
  });

  it("does not match when extra modifier is pressed", () => {
    const event = new KeyboardEvent("keydown", {
      key: "a",
      ctrlKey: true,
      shiftKey: true,
    });
    expect(matchesKeyCombo(event, ctrlA)).toBe(false);
  });

  it("does not match wrong key", () => {
    const event = new KeyboardEvent("keydown", { key: "b", ctrlKey: true });
    expect(matchesKeyCombo(event, ctrlA)).toBe(false);
  });
});

describe("formatKeyComboForDisplay", () => {
  const ctrlA: KeyCombo = {
    key: "a",
    ctrl: true,
    alt: false,
    shift: false,
    meta: false,
  };
  const cmdSpace: KeyCombo = {
    key: " ",
    ctrl: false,
    alt: false,
    shift: false,
    meta: true,
  };

  it("formats for Windows/Linux with + separators", () => {
    expect(formatKeyComboForDisplay(ctrlA, "windowsLinux")).toBe("Ctrl+A");
  });

  it("formats for Mac with symbols and no separators", () => {
    expect(formatKeyComboForDisplay(ctrlA, "mac")).toBe("⌃A");
  });

  it("formats Meta as ⌘ on Mac and Win on Windows/Linux", () => {
    expect(formatKeyComboForDisplay(cmdSpace, "mac")).toBe("⌘Space");
    expect(formatKeyComboForDisplay(cmdSpace, "windowsLinux")).toBe(
      "Win+Space",
    );
  });

  it("formats Shift modifier", () => {
    const combo: KeyCombo = {
      key: "Tab",
      ctrl: false,
      alt: false,
      shift: true,
      meta: false,
    };
    expect(formatKeyComboForDisplay(combo, "mac")).toBe("⇧Tab");
    expect(formatKeyComboForDisplay(combo, "windowsLinux")).toBe("Shift+Tab");
  });

  it("formats Alt modifier", () => {
    const combo: KeyCombo = {
      key: "F4",
      ctrl: false,
      alt: true,
      shift: false,
      meta: false,
    };
    expect(formatKeyComboForDisplay(combo, "mac")).toBe("⌥F4");
    expect(formatKeyComboForDisplay(combo, "windowsLinux")).toBe("Alt+F4");
  });

  it("formats arrow keys", () => {
    const left: KeyCombo = {
      key: "ArrowLeft",
      ctrl: true,
      alt: false,
      shift: false,
      meta: false,
    };
    expect(formatKeyComboForDisplay(left, "mac")).toBe("⌃←");
    expect(formatKeyComboForDisplay(left, "windowsLinux")).toBe("Ctrl+←");
  });

  it("formats Enter as Return on Mac and Enter on Windows/Linux", () => {
    const combo: KeyCombo = {
      key: "Enter",
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
    };
    expect(formatKeyComboForDisplay(combo, "mac")).toBe("Return");
    expect(formatKeyComboForDisplay(combo, "windowsLinux")).toBe("Enter");
  });

  it("formats Escape as Esc", () => {
    const combo: KeyCombo = {
      key: "Escape",
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
    };
    expect(formatKeyComboForDisplay(combo, "mac")).toBe("Esc");
    expect(formatKeyComboForDisplay(combo, "windowsLinux")).toBe("Esc");
  });

  it("formats Delete as Del on Windows/Linux", () => {
    const combo: KeyCombo = {
      key: "Delete",
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
    };
    expect(formatKeyComboForDisplay(combo, "windowsLinux")).toBe("Del");
  });
});
