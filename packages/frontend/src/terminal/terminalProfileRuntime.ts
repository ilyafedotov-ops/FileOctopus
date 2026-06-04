import type { ITheme, ITerminalOptions } from "@xterm/xterm";
import type { TerminalProfileDto } from "@fileoctopus/ts-api";
import { buildTerminalTheme } from "./terminalTheme";

const DEFAULT_FONT_FAMILY =
  'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, "Cascadia Mono", Consolas, "Liberation Mono", "Courier New", monospace';

type CursorStyle = NonNullable<ITerminalOptions["cursorStyle"]>;

function boundedNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  if (value < min || value > max) {
    return fallback;
  }
  return value;
}

function cursorStyle(value: string | undefined): CursorStyle {
  if (value === "bar" || value === "underline" || value === "block") {
    return value;
  }
  return "block";
}

function parseThemeOverrides(value: string | undefined): Partial<ITheme> {
  if (!value?.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, entryValue]) => typeof entryValue === "string",
      ),
    ) as Partial<ITheme>;
  } catch {
    return {};
  }
}

export function terminalThemeForProfile(
  profile?: TerminalProfileDto | null,
): ITheme {
  return {
    ...buildTerminalTheme(),
    ...parseThemeOverrides(profile?.themeOverrides),
  };
}

export function terminalOptionsForProfile(
  profile?: TerminalProfileDto | null,
): ITerminalOptions {
  return {
    cursorBlink: profile?.cursorBlink ?? true,
    cursorStyle: cursorStyle(profile?.cursorStyle),
    fontFamily: profile?.fontFamily?.trim() || DEFAULT_FONT_FAMILY,
    fontSize: boundedNumber(profile?.fontSize, 13, 8, 32),
    lineHeight: boundedNumber(profile?.lineHeight, 1.2, 1, 2),
    letterSpacing: 0,
    scrollback: boundedNumber(profile?.scrollback, 5000, 100, 100000),
    theme: terminalThemeForProfile(profile),
  };
}
