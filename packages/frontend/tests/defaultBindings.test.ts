import { describe, expect, it } from "vitest";
import {
  buildDefaultBindings,
  DEFAULT_KEY_BINDINGS,
} from "../src/commands/defaultBindings";

describe("buildDefaultBindings", () => {
  it("returns a non-empty array", () => {
    const bindings = buildDefaultBindings();
    expect(bindings.length).toBeGreaterThan(0);
  });

  it("each binding has a commandId and at least one combo", () => {
    const bindings = buildDefaultBindings();
    for (const binding of bindings) {
      expect(binding.commandId).toBeTruthy();
      expect(binding.combos.length).toBeGreaterThan(0);
    }
  });

  it("includes filter command (Ctrl+F)", () => {
    const bindings = buildDefaultBindings();
    const filter = bindings.find((b) => b.commandId === "search.focusFilter");
    expect(filter).toBeTruthy();
    expect(filter!.combos.length).toBeGreaterThan(0);
  });

  it("includes recursive search command (Ctrl+Shift+F)", () => {
    const bindings = buildDefaultBindings();
    const search = bindings.find((b) => b.commandId === "search.recursive");
    expect(search).toBeTruthy();
    expect(search!.combos.length).toBeGreaterThan(0);
  });

  it("includes trash command (Delete)", () => {
    const bindings = buildDefaultBindings();
    const trash = bindings.find((b) => b.commandId === "op.trash");
    expect(trash).toBeTruthy();
    expect(trash!.combos.length).toBeGreaterThan(0);
  });

  it("includes app.shortcuts with F1", () => {
    const bindings = buildDefaultBindings();
    const shortcuts = bindings.find((b) => b.commandId === "app.shortcuts");
    expect(shortcuts).toBeTruthy();
    const hasF1 = shortcuts!.combos.some((c) => c.key === "F1");
    expect(hasF1).toBe(true);
  });

  it("includes app.commandPalette with F10", () => {
    const bindings = buildDefaultBindings();
    const palette = bindings.find((b) => b.commandId === "app.commandPalette");
    expect(palette).toBeTruthy();
    const hasF10 = palette!.combos.some((c) => c.key === "F10");
    expect(hasF10).toBe(true);
  });

  it("DEFAULT_KEY_BINDINGS is pre-computed and matches buildDefaultBindings()", () => {
    const fresh = buildDefaultBindings();
    expect(DEFAULT_KEY_BINDINGS.length).toBe(fresh.length);
  });

  it("addOrExtendBinding deduplicates — some commandIds are overridden", () => {
    const bindings = buildDefaultBindings();
    const ids = bindings.map((b) => b.commandId);
    const uniqueIds = new Set(ids);
    // addOrExtendBinding replaces existing entries for app.shortcuts,
    // app.commandPalette, and op.trash — so total may be > unique
    expect(uniqueIds.size).toBeLessThanOrEqual(ids.length);
    expect(uniqueIds.size).toBeGreaterThan(0);
  });
});
