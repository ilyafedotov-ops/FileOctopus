import { describe, expect, it } from "vitest";
import type { TerminalProfileDto } from "@fileoctopus/ts-api";
import {
  terminalOptionsForProfile,
  terminalThemeForProfile,
} from "../src/terminal/terminalProfileRuntime";

function profile(
  overrides: Partial<TerminalProfileDto> = {},
): TerminalProfileDto {
  return {
    id: "profile-1",
    name: "Dev Shell",
    scope: "local",
    shell: "/bin/zsh",
    args: "-l",
    env: "",
    workingDirectoryMode: "currentPane",
    customCwdUri: "",
    networkProfileId: null,
    remoteCwd: "",
    initialCommand: "",
    fontFamily: "JetBrains Mono",
    fontSize: 15,
    lineHeight: 1.3,
    cursorStyle: "bar",
    cursorBlink: false,
    scrollback: 12000,
    themeId: "system",
    themeOverrides: "",
    copyOnSelect: false,
    rightClickAction: "contextMenu",
    pasteConfirmation: true,
    linkHandling: "openExternal",
    sortOrder: 0,
    isDefault: true,
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

describe("terminal profile runtime options", () => {
  it("maps profile appearance to xterm options", () => {
    expect(terminalOptionsForProfile(profile())).toMatchObject({
      cursorBlink: false,
      cursorStyle: "bar",
      fontFamily: "JetBrains Mono",
      fontSize: 15,
      lineHeight: 1.3,
      scrollback: 12000,
    });
  });

  it("falls back for invalid numeric and cursor profile values", () => {
    expect(
      terminalOptionsForProfile(
        profile({
          cursorStyle: "invalid",
          fontSize: 200,
          lineHeight: 8,
          scrollback: 1,
        }),
      ),
    ).toMatchObject({
      cursorStyle: "block",
      fontSize: 13,
      lineHeight: 1.2,
      scrollback: 5000,
    });
  });

  it("merges valid theme overrides and ignores invalid JSON", () => {
    expect(
      terminalThemeForProfile(
        profile({
          themeOverrides: JSON.stringify({
            background: "#101010",
            foreground: "#eeeeee",
          }),
        }),
      ),
    ).toMatchObject({
      background: "#101010",
      foreground: "#eeeeee",
    });

    expect(
      terminalThemeForProfile(profile({ themeOverrides: "not json" })),
    ).toHaveProperty("background");
  });
});
