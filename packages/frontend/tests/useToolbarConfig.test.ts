import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useToolbarConfig,
  resolveToolbarEntriesForTests,
} from "../src/hooks/useToolbarConfig";
import {
  DEFAULT_TOOLBAR_ENTRIES,
  clearStoredToolbarEntries,
} from "../src/commands/toolbarConfig";

vi.mock("../src/commands/toolbarConfig", async (importOriginal) => {
  const mod =
    await importOriginal<typeof import("../src/commands/toolbarConfig")>();
  return {
    ...mod,
    clearStoredToolbarEntries: vi.fn(),
  };
});

function te(id: string) {
  return { kind: "command" as const, commandId: id };
}

describe("useToolbarConfig", () => {
  it("returns default entries when preferences is null", () => {
    const updatePref = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useToolbarConfig(null, updatePref));
    expect(result.current.entries).toEqual(DEFAULT_TOOLBAR_ENTRIES);
  });

  it("returns default entries when toolbarEntries is empty", () => {
    const updatePref = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useToolbarConfig(
        { toolbarEntries: "" } as unknown as Record<string, unknown>,
        updatePref,
      ),
    );
    expect(result.current.entries).toEqual(DEFAULT_TOOLBAR_ENTRIES);
  });

  it("returns parsed entries from preferences", () => {
    const custom = [te("nav.back"), te("nav.forward")];
    const updatePref = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useToolbarConfig(
        { toolbarEntries: JSON.stringify(custom) } as unknown as Record<
          string,
          unknown
        >,
        updatePref,
      ),
    );
    expect(result.current.entries).toEqual(custom);
  });

  it("saveEntries calls updatePreference with normalized entries", async () => {
    const updatePref = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useToolbarConfig(null, updatePref));
    const newEntries = [te("nav.home")];
    await act(async () => {
      await result.current.saveEntries(newEntries);
    });
    expect(updatePref).toHaveBeenCalledWith(
      "toolbarEntries",
      expect.any(String),
    );
    const passed = JSON.parse(updatePref.mock.calls[0][1]);
    expect(passed).toEqual(newEntries);
  });

  it("saveEntries calls clearStoredToolbarEntries", async () => {
    const updatePref = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useToolbarConfig(null, updatePref));
    await act(async () => {
      await result.current.saveEntries([te("nav.home")]);
    });
    expect(clearStoredToolbarEntries).toHaveBeenCalled();
  });

  it("resetEntries saves DEFAULT_TOOLBAR_ENTRIES", async () => {
    const updatePref = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useToolbarConfig(null, updatePref));
    await act(async () => {
      await result.current.resetEntries();
    });
    expect(updatePref).toHaveBeenCalledWith(
      "toolbarEntries",
      expect.any(String),
    );
    const passed = JSON.parse(updatePref.mock.calls[0][1]);
    expect(passed).toEqual([...DEFAULT_TOOLBAR_ENTRIES]);
  });

  it("migrates legacy localStorage entries on first mount", async () => {
    const updatePref = vi.fn().mockResolvedValue(undefined);
    const legacy = [te("nav.back")];
    window.localStorage.setItem(
      "fileoctopus.toolbarEntries",
      JSON.stringify(legacy),
    );
    renderHook(() =>
      useToolbarConfig(
        { toolbarEntries: "" } as unknown as Record<string, unknown>,
        updatePref,
      ),
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(updatePref).toHaveBeenCalledWith(
      "toolbarEntries",
      JSON.stringify(legacy),
    );
    window.localStorage.removeItem("fileoctopus.toolbarEntries");
  });

  it("does not migrate when preferences already have toolbarEntries", async () => {
    const updatePref = vi.fn().mockResolvedValue(undefined);
    window.localStorage.setItem(
      "fileoctopus.toolbarEntries",
      JSON.stringify([te("nav.up")]),
    );
    renderHook(() =>
      useToolbarConfig(
        {
          toolbarEntries: JSON.stringify([te("nav.home")]),
        } as unknown as Record<string, unknown>,
        updatePref,
      ),
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(updatePref).not.toHaveBeenCalled();
    window.localStorage.removeItem("fileoctopus.toolbarEntries");
  });

  it("only migrates once across rerenders", async () => {
    const updatePref = vi.fn().mockResolvedValue(undefined);
    const legacy = [te("nav.back")];
    window.localStorage.setItem(
      "fileoctopus.toolbarEntries",
      JSON.stringify(legacy),
    );
    const { rerender } = renderHook(() =>
      useToolbarConfig(
        { toolbarEntries: "" } as unknown as Record<string, unknown>,
        updatePref,
      ),
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    const callCount = updatePref.mock.calls.length;
    rerender({ toolbarEntries: "" } as unknown as Record<string, unknown>);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(updatePref.mock.calls.length).toBe(callCount);
    window.localStorage.removeItem("fileoctopus.toolbarEntries");
  });
});

describe("resolveToolbarEntriesForTests", () => {
  it("returns entries from preferences when available", () => {
    const custom = [te("nav.home")];
    const result = resolveToolbarEntriesForTests({
      toolbarEntries: JSON.stringify(custom),
    } as unknown as Record<string, unknown>);
    expect(result).toEqual(custom);
  });

  it("returns default when preferences null and no stored entries", () => {
    window.localStorage.removeItem("fileoctopus.toolbarEntries");
    const result = resolveToolbarEntriesForTests(null);
    expect(result).toEqual(DEFAULT_TOOLBAR_ENTRIES);
  });

  it("returns stored entries when no preferences", () => {
    const stored = [te("nav.forward")];
    window.localStorage.setItem(
      "fileoctopus.toolbarEntries",
      JSON.stringify(stored),
    );
    const result = resolveToolbarEntriesForTests(null);
    expect(result).toEqual(stored);
    window.localStorage.removeItem("fileoctopus.toolbarEntries");
  });
});
