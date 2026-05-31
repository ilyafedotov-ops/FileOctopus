import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLayoutFocusStore } from "../src/state/layoutStore";

describe("useLayoutFocusStore", () => {
  it("initializes all tokens to 0", () => {
    const { result } = renderHook(() => useLayoutFocusStore());
    const store = result.current;
    expect(store.pathFocusToken).toBe(0);
    expect(store.renameFocusToken).toBe(0);
    expect(store.filterFocusToken).toBe(0);
    expect(store.recursiveSearchFocusToken).toBe(0);
  });

  it("exposes setter functions for all tokens", () => {
    const { result } = renderHook(() => useLayoutFocusStore());
    const store = result.current;
    expect(typeof store.setPathFocusToken).toBe("function");
    expect(typeof store.setRenameFocusToken).toBe("function");
    expect(typeof store.setFilterFocusToken).toBe("function");
    expect(typeof store.setRecursiveSearchFocusToken).toBe("function");
  });

  it("increments pathFocusToken via setter", () => {
    const { result } = renderHook(() => useLayoutFocusStore());
    act(() => {
      result.current.setPathFocusToken((n) => n + 1);
    });
    expect(result.current.pathFocusToken).toBe(1);
  });

  it("increments renameFocusToken via setter", () => {
    const { result } = renderHook(() => useLayoutFocusStore());
    act(() => {
      result.current.setRenameFocusToken((n) => n + 1);
    });
    expect(result.current.renameFocusToken).toBe(1);
  });

  it("increments filterFocusToken via setter", () => {
    const { result } = renderHook(() => useLayoutFocusStore());
    act(() => {
      result.current.setFilterFocusToken((n) => n + 1);
    });
    expect(result.current.filterFocusToken).toBe(1);
  });

  it("increments recursiveSearchFocusToken via setter", () => {
    const { result } = renderHook(() => useLayoutFocusStore());
    act(() => {
      result.current.setRecursiveSearchFocusToken((n) => n + 1);
    });
    expect(result.current.recursiveSearchFocusToken).toBe(1);
  });

  it("sets pathFocusToken to an absolute value", () => {
    const { result } = renderHook(() => useLayoutFocusStore());
    act(() => {
      result.current.setPathFocusToken(42);
    });
    expect(result.current.pathFocusToken).toBe(42);
  });

  it("sets renameFocusToken to an absolute value", () => {
    const { result } = renderHook(() => useLayoutFocusStore());
    act(() => {
      result.current.setRenameFocusToken(7);
    });
    expect(result.current.renameFocusToken).toBe(7);
  });

  it("sets filterFocusToken to an absolute value", () => {
    const { result } = renderHook(() => useLayoutFocusStore());
    act(() => {
      result.current.setFilterFocusToken(99);
    });
    expect(result.current.filterFocusToken).toBe(99);
  });

  it("sets recursiveSearchFocusToken to an absolute value", () => {
    const { result } = renderHook(() => useLayoutFocusStore());
    act(() => {
      result.current.setRecursiveSearchFocusToken(3);
    });
    expect(result.current.recursiveSearchFocusToken).toBe(3);
  });

  it("increments same token multiple times", () => {
    const { result } = renderHook(() => useLayoutFocusStore());
    act(() => {
      result.current.setPathFocusToken((n) => n + 1);
    });
    act(() => {
      result.current.setPathFocusToken((n) => n + 1);
    });
    act(() => {
      result.current.setPathFocusToken((n) => n + 1);
    });
    expect(result.current.pathFocusToken).toBe(3);
  });

  it("increments different tokens independently", () => {
    const { result } = renderHook(() => useLayoutFocusStore());
    act(() => {
      result.current.setPathFocusToken((n) => n + 1);
    });
    act(() => {
      result.current.setRenameFocusToken((n) => n + 1);
    });
    act(() => {
      result.current.setRenameFocusToken((n) => n + 1);
    });
    expect(result.current.pathFocusToken).toBe(1);
    expect(result.current.renameFocusToken).toBe(2);
    expect(result.current.filterFocusToken).toBe(0);
    expect(result.current.recursiveSearchFocusToken).toBe(0);
  });

  it("returns a stable object reference when no values change", () => {
    const { result, rerender } = renderHook(() => useLayoutFocusStore());
    const first = result.current;
    rerender();
    // The useMemo deps only change when token values change, not setters
    // Since nothing changed, the returned object should be the same
    expect(result.current).toBe(first);
  });

  it("returns a new object when a token value changes", () => {
    const { result } = renderHook(() => useLayoutFocusStore());
    const first = result.current;
    act(() => {
      result.current.setPathFocusToken((n) => n + 1);
    });
    expect(result.current).not.toBe(first);
  });

  it("resets a token to 0 via absolute setter", () => {
    const { result } = renderHook(() => useLayoutFocusStore());
    act(() => {
      result.current.setPathFocusToken(5);
    });
    expect(result.current.pathFocusToken).toBe(5);
    act(() => {
      result.current.setPathFocusToken(0);
    });
    expect(result.current.pathFocusToken).toBe(0);
  });
});
