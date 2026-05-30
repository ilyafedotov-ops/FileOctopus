import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useToolbarKeyboardNavigation } from "../src/hooks/useToolbarKeyboardNavigation";
import { useRef } from "react";

function createContainerWithButtons(count: number): {
  container: HTMLDivElement;
  buttons: HTMLButtonElement[];
} {
  const container = document.createElement("div");
  container.className = "fo-toolbar";
  const group = document.createElement("div");
  group.className = "fo-toolbar-group";
  const buttons: HTMLButtonElement[] = [];
  for (let i = 0; i < count; i++) {
    const btn = document.createElement("button");
    btn.textContent = `Btn ${i}`;
    btn.tabIndex = 0;
    group.appendChild(btn);
    buttons.push(btn);
  }
  container.appendChild(group);
  document.body.appendChild(container);
  return { container, buttons };
}

function createContainerWithGroups(groupSizes: number[]): {
  container: HTMLDivElement;
  allButtons: HTMLButtonElement[];
  groups: HTMLDivElement[];
} {
  const container = document.createElement("div");
  container.className = "fo-toolbar";
  const allButtons: HTMLButtonElement[] = [];
  const groups: HTMLDivElement[] = [];
  for (const size of groupSizes) {
    const group = document.createElement("div");
    group.className = "fo-toolbar-group";
    for (let i = 0; i < size; i++) {
      const btn = document.createElement("button");
      btn.textContent = `Btn ${allButtons.length}`;
      btn.tabIndex = 0;
      group.appendChild(btn);
      allButtons.push(btn);
    }
    container.appendChild(group);
    groups.push(group);
  }
  document.body.appendChild(container);
  return { container, allButtons, groups };
}

function fireKeyEvent(
  target: HTMLElement,
  key: string,
  opts?: { ctrlKey?: boolean; metaKey?: boolean },
) {
  target.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ctrlKey: opts?.ctrlKey ?? false,
      metaKey: opts?.metaKey ?? false,
    }),
  );
}

describe("useToolbarKeyboardNavigation", () => {
  let containers: HTMLDivElement[] = [];

  beforeEach(() => {
    containers = [];
  });

  afterEach(() => {
    for (const c of containers) {
      c.remove();
    }
  });

  function renderWithContainer(): {
    container: HTMLDivElement;
    buttons: HTMLButtonElement[];
    rerender: () => void;
  } {
    const { container, buttons } = createContainerWithButtons(5);
    containers.push(container);

    const wrapper = ({ children }: { children: React.ReactNode }) => {
      return children;
    };

    const { rerender } = renderHook(
      () => {
        const ref = useRef<HTMLDivElement | null>(container);
        useToolbarKeyboardNavigation(ref);
        return null;
      },
      { wrapper },
    );

    return { container, buttons, rerender };
  }

  it("focuses next button on ArrowRight", () => {
    const { buttons } = renderWithContainer();
    buttons[0].focus();
    fireKeyEvent(buttons[0], "ArrowRight");
    expect(document.activeElement).toBe(buttons[1]);
  });

  it("focuses previous button on ArrowLeft", () => {
    const { buttons } = renderWithContainer();
    buttons[2].focus();
    fireKeyEvent(buttons[2], "ArrowLeft");
    expect(document.activeElement).toBe(buttons[1]);
  });

  it("wraps from last to first on ArrowRight", () => {
    const { buttons } = renderWithContainer();
    buttons[4].focus();
    fireKeyEvent(buttons[4], "ArrowRight");
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("wraps from first to last on ArrowLeft", () => {
    const { buttons } = renderWithContainer();
    buttons[0].focus();
    fireKeyEvent(buttons[0], "ArrowLeft");
    expect(document.activeElement).toBe(buttons[4]);
  });

  it("focuses first button on Home", () => {
    const { buttons } = renderWithContainer();
    buttons[3].focus();
    fireKeyEvent(buttons[3], "Home");
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("focuses last button on End", () => {
    const { buttons } = renderWithContainer();
    buttons[1].focus();
    fireKeyEvent(buttons[1], "End");
    expect(document.activeElement).toBe(buttons[4]);
  });

  it("ignores events when focus is outside the container", () => {
    renderWithContainer();
    const outside = document.createElement("button");
    outside.textContent = "Outside";
    document.body.appendChild(outside);
    containers.push(outside as unknown as HTMLDivElement);

    outside.focus();
    fireKeyEvent(outside, "ArrowRight");
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it("ignores non-navigation keys", () => {
    const { buttons } = renderWithContainer();
    buttons[0].focus();
    fireKeyEvent(buttons[0], "Enter");
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("jumps to next group on Ctrl+ArrowRight", () => {
    const { container, allButtons } = createContainerWithGroups([2, 2, 2]);
    containers.push(container);

    renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(container);
      useToolbarKeyboardNavigation(ref);
      return null;
    });

    // Focus first button in group 0
    allButtons[0].focus();
    fireKeyEvent(allButtons[0], "ArrowRight", { ctrlKey: true });
    // Should focus first button in group 1
    expect(document.activeElement).toBe(allButtons[2]);
  });

  it("jumps to previous group on Ctrl+ArrowLeft", () => {
    const { container, allButtons } = createContainerWithGroups([2, 2, 2]);
    containers.push(container);

    renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(container);
      useToolbarKeyboardNavigation(ref);
      return null;
    });

    // Focus first button in group 2
    allButtons[4].focus();
    fireKeyEvent(allButtons[4], "ArrowLeft", { ctrlKey: true });
    // Should focus first button in group 1
    expect(document.activeElement).toBe(allButtons[2]);
  });

  it("wraps around groups with Ctrl+ArrowRight from last group", () => {
    const { container, allButtons } = createContainerWithGroups([2, 2, 2]);
    containers.push(container);

    renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(container);
      useToolbarKeyboardNavigation(ref);
      return null;
    });

    // Focus first button in last group
    allButtons[4].focus();
    fireKeyEvent(allButtons[4], "ArrowRight", { ctrlKey: true });
    // Should wrap to first button in first group
    expect(document.activeElement).toBe(allButtons[0]);
  });

  it("skips disabled buttons", () => {
    const container = document.createElement("div");
    container.className = "fo-toolbar";
    const group = document.createElement("div");
    group.className = "fo-toolbar-group";

    const btn0 = document.createElement("button");
    btn0.textContent = "Enabled";
    btn0.tabIndex = 0;
    const btn1 = document.createElement("button");
    btn1.textContent = "Disabled";
    btn1.disabled = true;
    const btn2 = document.createElement("button");
    btn2.textContent = "Enabled2";
    btn2.tabIndex = 0;

    group.appendChild(btn0);
    group.appendChild(btn1);
    group.appendChild(btn2);
    container.appendChild(group);
    document.body.appendChild(container);
    containers.push(container);

    renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(container);
      useToolbarKeyboardNavigation(ref);
      return null;
    });

    btn0.focus();
    fireKeyEvent(btn0, "ArrowRight");
    // Should skip disabled button and go to btn2
    expect(document.activeElement).toBe(btn2);
  });
});
