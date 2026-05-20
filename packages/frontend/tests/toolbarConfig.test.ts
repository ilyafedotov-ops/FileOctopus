import { describe, expect, it } from "vitest";
import type { UserPreferencesDto } from "@fileoctopus/ts-api";
import {
  DEFAULT_TOOLBAR_ENTRIES,
  normalizeToolbarEntries,
  parseToolbarEntriesJson,
  toolbarCommandMeta,
} from "../src/commands/toolbarConfig";
import { isToolbarCommandDisabled } from "../src/commands/toolbarCommandState";
import { resolveToolbarEntriesForTests } from "../src/hooks/useToolbarConfig";

describe("toolbarConfig", () => {
  it("ships the SDD default core operation layout", () => {
    const labels = DEFAULT_TOOLBAR_ENTRIES.filter(
      (entry) => entry.kind === "command",
    ).map((entry) => toolbarCommandMeta(entry.commandId).label);

    expect(labels).toEqual([
      "View",
      "Edit",
      "Open with default",
      "Rename",
      "Copy",
      "Move",
      "Folder+",
      "Trash",
      "Props",
    ]);
  });

  it("puts shortcuts in tooltips instead of button labels", () => {
    const meta = toolbarCommandMeta("op.copyTo");
    expect(meta.label).toBe("Copy");
    expect(meta.tooltip).toContain("F5");
  });

  it("dedupes commands and trims edge separators", () => {
    const normalized = normalizeToolbarEntries([
      { kind: "separator" },
      { kind: "command", commandId: "op.copy" },
      { kind: "command", commandId: "op.copy" },
      { kind: "separator" },
    ]);
    expect(normalized).toEqual([{ kind: "command", commandId: "op.copy" }]);
  });

  it("disables rename without a single selection", () => {
    expect(
      isToolbarCommandDisabled("op.rename", {
        selectedCount: 2,
        canRename: false,
        canPaste: false,
        canView: true,
        canEdit: false,
      }),
    ).toBe(true);
  });

  it("parses toolbar entries from preference JSON", () => {
    const parsed = parseToolbarEntriesJson(
      JSON.stringify([{ kind: "command", commandId: "op.copy" }]),
    );
    expect(parsed).toEqual([{ kind: "command", commandId: "op.copy" }]);
  });

  it("prefers toolbar entries from preferences over local storage", () => {
    const preferences = {
      toolbarEntries: JSON.stringify([
        { kind: "command", commandId: "op.cut" },
      ]),
    } as UserPreferencesDto;

    expect(resolveToolbarEntriesForTests(preferences)).toEqual([
      { kind: "command", commandId: "op.cut" },
    ]);
  });

  it("falls back to defaults when preference JSON is empty", () => {
    expect(
      resolveToolbarEntriesForTests({
        toolbarEntries: "",
      } as UserPreferencesDto),
    ).toEqual(DEFAULT_TOOLBAR_ENTRIES);
  });
});
