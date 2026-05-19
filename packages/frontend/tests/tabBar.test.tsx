import { describe, expect, it, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, within } from "@testing-library/react";
import { TabBar } from "../src/pane/TabBar";
import type { PanelState, PanelTabState } from "../src/panelStore";

function makeTab(
  uri: string,
  overrides: Partial<PanelTabState> = {},
): PanelTabState {
  return {
    uri,
    entriesById: {},
    orderedEntryIds: [],
    selectedIds: [],
    selectedId: null,
    focusedId: null,
    anchorId: null,
    sessionId: null,
    activeRequestId: null,
    loadState: "loaded",
    error: null,
    errorCode: null,
    filter: "",
    recursiveQuery: "",
    sort: { field: "name" as const, direction: "asc" as const },
    viewMode: "details" as const,
    showHidden: false,
    hashMap: {},
    ...overrides,
  } as PanelTabState;
}

function makePanel(
  tabs: Record<string, PanelTabState>,
  activeTabId: string,
): PanelState {
  return { id: "left", activeTabId, tabs };
}

afterEach(cleanup);

describe("TabBar", () => {
  it("renders the active tab and new tab button when only one tab exists", () => {
    const panel = makePanel({ t1: makeTab("local:///home/user") }, "t1");
    const { getByRole, getByLabelText } = render(
      <TabBar
        panelId="left"
        panel={panel}
        onSwitchTab={vi.fn()}
        onCloseTab={vi.fn()}
        onOpenTab={vi.fn()}
      />,
    );
    const tablist = getByRole("tablist");
    expect(within(tablist).getAllByRole("tab").length).toBe(1);
    expect(getByLabelText("New tab")).toBeTruthy();
    expect(document.querySelectorAll(".fo-tab-close").length).toBe(0);
  });

  it("renders tab buttons when multiple tabs exist", () => {
    const panel = makePanel(
      {
        t1: makeTab("local:///home/user/docs"),
        t2: makeTab("local:///home/user/downloads"),
      },
      "t1",
    );
    const { getByRole } = render(
      <TabBar
        panelId="left"
        panel={panel}
        onSwitchTab={vi.fn()}
        onCloseTab={vi.fn()}
        onOpenTab={vi.fn()}
      />,
    );
    const tablist = getByRole("tablist");
    expect(tablist).toBeTruthy();
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.length).toBe(2);
  });

  it("marks the active tab with aria-selected", () => {
    const panel = makePanel(
      {
        t1: makeTab("local:///home/user/docs"),
        t2: makeTab("local:///home/user/downloads"),
      },
      "t1",
    );
    const { getByRole } = render(
      <TabBar
        panelId="left"
        panel={panel}
        onSwitchTab={vi.fn()}
        onCloseTab={vi.fn()}
        onOpenTab={vi.fn()}
      />,
    );
    const tablist = getByRole("tablist");
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(tabs[1].getAttribute("aria-selected")).toBe("false");
  });

  it("displays the last path segment as tab label", () => {
    const panel = makePanel(
      {
        t1: makeTab("local:///home/user/documents"),
        t2: makeTab("local:///home/user"),
      },
      "t1",
    );
    const { getByRole } = render(
      <TabBar
        panelId="left"
        panel={panel}
        onSwitchTab={vi.fn()}
        onCloseTab={vi.fn()}
        onOpenTab={vi.fn()}
      />,
    );
    const tablist = getByRole("tablist");
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs[0].textContent).toContain("documents");
    expect(tabs[1].textContent).toContain("user");
  });

  it("calls onSwitchTab when a tab is clicked", () => {
    const panel = makePanel(
      {
        t1: makeTab("local:///home/user/docs"),
        t2: makeTab("local:///home/user/downloads"),
      },
      "t1",
    );
    const onSwitchTab = vi.fn();
    const { getByRole } = render(
      <TabBar
        panelId="left"
        panel={panel}
        onSwitchTab={onSwitchTab}
        onCloseTab={vi.fn()}
        onOpenTab={vi.fn()}
      />,
    );
    const tablist = getByRole("tablist");
    const tabs = within(tablist).getAllByRole("tab");
    fireEvent.click(tabs[1]);
    expect(onSwitchTab).toHaveBeenCalledWith("left", "t2");
  });

  it("calls onCloseTab when close button is clicked", () => {
    const panel = makePanel(
      {
        t1: makeTab("local:///home/user/docs"),
        t2: makeTab("local:///home/user/downloads"),
      },
      "t1",
    );
    const onCloseTab = vi.fn();
    render(
      <TabBar
        panelId="left"
        panel={panel}
        onSwitchTab={vi.fn()}
        onCloseTab={onCloseTab}
        onOpenTab={vi.fn()}
      />,
    );
    const closeButtons = document.querySelectorAll(".fo-tab-close");
    expect(closeButtons.length).toBe(2);
    fireEvent.click(closeButtons[1]);
    expect(onCloseTab).toHaveBeenCalledWith("left", "t2");
  });

  it("calls onOpenTab when the new-tab button is clicked", () => {
    const panel = makePanel(
      {
        t1: makeTab("local:///home/user/docs"),
        t2: makeTab("local:///home/user/downloads"),
      },
      "t1",
    );
    const onOpenTab = vi.fn();
    const { getByLabelText } = render(
      <TabBar
        panelId="left"
        panel={panel}
        onSwitchTab={vi.fn()}
        onCloseTab={vi.fn()}
        onOpenTab={onOpenTab}
      />,
    );
    const newBtn = getByLabelText("New tab");
    fireEvent.click(newBtn);
    expect(onOpenTab).toHaveBeenCalledWith("left");
  });

  it("shows root label for root path", () => {
    const panel = makePanel(
      {
        t1: makeTab("local:///"),
        t2: makeTab("local:///home/user"),
      },
      "t1",
    );
    const { getByRole } = render(
      <TabBar
        panelId="left"
        panel={panel}
        onSwitchTab={vi.fn()}
        onCloseTab={vi.fn()}
        onOpenTab={vi.fn()}
      />,
    );
    const tablist = getByRole("tablist");
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs[0].textContent).toContain("/");
  });
});
