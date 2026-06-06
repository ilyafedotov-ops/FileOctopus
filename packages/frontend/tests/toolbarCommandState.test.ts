import { describe, it, expect } from "vitest";
import { isToolbarCommandDisabled } from "../src/commands/toolbarCommandState";
import type { ToolbarCommandContext } from "../src/commands/toolbarCommandState";
import type { CommandId } from "../src/commands/types";

function ctx(
  overrides: Partial<ToolbarCommandContext> = {},
): ToolbarCommandContext {
  return {
    selectedCount: 1,
    canRename: true,
    canPaste: true,
    canView: true,
    canEdit: true,
    ...overrides,
  };
}

describe("isToolbarCommandDisabled", () => {
  it("enables op.view always", () => {
    expect(isToolbarCommandDisabled("op.view", ctx())).toBe(false);
    expect(isToolbarCommandDisabled("op.view", ctx({ selectedCount: 0 }))).toBe(
      false,
    );
  });

  it("disables op.edit when canEdit is false", () => {
    expect(isToolbarCommandDisabled("op.edit", ctx({ canEdit: true }))).toBe(
      false,
    );
    expect(isToolbarCommandDisabled("op.edit", ctx({ canEdit: false }))).toBe(
      true,
    );
  });

  it("disables op.openDefault when canEdit is false", () => {
    expect(
      isToolbarCommandDisabled("op.openDefault", ctx({ canEdit: true })),
    ).toBe(false);
    expect(
      isToolbarCommandDisabled("op.openDefault", ctx({ canEdit: false })),
    ).toBe(true);
  });

  it("disables op.rename when canRename is false", () => {
    expect(
      isToolbarCommandDisabled("op.rename", ctx({ canRename: true })),
    ).toBe(false);
    expect(
      isToolbarCommandDisabled("op.rename", ctx({ canRename: false })),
    ).toBe(true);
  });

  it("disables op.paste when canPaste is false", () => {
    expect(isToolbarCommandDisabled("op.paste", ctx({ canPaste: true }))).toBe(
      false,
    );
    expect(isToolbarCommandDisabled("op.paste", ctx({ canPaste: false }))).toBe(
      true,
    );
  });

  it("disables op.properties when nothing selected", () => {
    expect(
      isToolbarCommandDisabled("op.properties", ctx({ selectedCount: 1 })),
    ).toBe(false);
    expect(
      isToolbarCommandDisabled("op.properties", ctx({ selectedCount: 0 })),
    ).toBe(true);
  });

  const selectionCommands = [
    "op.copy",
    "op.cut",
    "op.copyTo",
    "op.moveTo",
    "op.delete",
    "op.trash",
    "op.deletePermanent",
    "op.reveal",
    "op.compress",
    "op.extract",
    "op.checksum",
    "clipboard.copyPath",
    "clipboard.copyName",
    "op.calculateSize",
    "op.toggleStarred",
  ] as const;

  for (const cmd of selectionCommands) {
    describe(cmd, () => {
      it("is enabled when selectedCount > 0", () => {
        expect(isToolbarCommandDisabled(cmd, ctx({ selectedCount: 1 }))).toBe(
          false,
        );
        expect(isToolbarCommandDisabled(cmd, ctx({ selectedCount: 3 }))).toBe(
          false,
        );
      });

      it("is disabled when selectedCount === 0", () => {
        expect(isToolbarCommandDisabled(cmd, ctx({ selectedCount: 0 }))).toBe(
          true,
        );
      });
    });
  }

  it("enables unknown commands by default", () => {
    expect(
      isToolbarCommandDisabled("app.settings" as unknown as CommandId, ctx()),
    ).toBe(false);
    expect(
      isToolbarCommandDisabled("nav.back" as unknown as CommandId, ctx()),
    ).toBe(false);
    expect(
      isToolbarCommandDisabled("view.details" as unknown as CommandId, ctx()),
    ).toBe(false);
  });
});
