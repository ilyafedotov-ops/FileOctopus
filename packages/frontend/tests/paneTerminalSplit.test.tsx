import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { PaneTerminalSplit } from "../src/pane/PaneTerminalSplit";
import type { TerminalSession } from "../src/terminal/terminalSlice";

const mockSetPaneTerminalCollapsed = vi.fn();
const mockSetPaneTerminalMaximized = vi.fn();
const mockClosePaneTerminal = vi.fn();
const mockCloseTerminalTab = vi.fn();
const mockMarkSessionExited = vi.fn();

vi.mock("../src/app/providers/TerminalProvider", () => ({
  useTerminal: () => ({
    markSessionExited: mockMarkSessionExited,
    closeTerminalTab: mockCloseTerminalTab,
    setPaneTerminalCollapsed: mockSetPaneTerminalCollapsed,
    setPaneTerminalMaximized: mockSetPaneTerminalMaximized,
    closePaneTerminal: mockClosePaneTerminal,
  }),
}));

vi.mock("../src/shell/LayoutResizers", () => ({
  PaneTerminalResizer: ({
    panelId,
    onResize,
  }: {
    panelId: string;
    onResize: (r: number) => void;
  }) => (
    <div
      data-testid="resizer"
      data-panel={panelId}
      onClick={() => onResize(0.5)}
    />
  ),
}));

vi.mock("../src/pane/PaneTerminalRegion", () => ({
  PaneTerminalRegion: ({
    tabBarActions,
  }: {
    tabBarActions: React.ReactNode;
  }) => <div data-testid="terminal-region">{tabBarActions}</div>,
}));

vi.mock("@fileoctopus/ui", () => ({
  IconButton: ({
    label,
    onClick,
    children,
  }: {
    label: string;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <button
      data-testid={`icon-btn-${label.toLowerCase().replace(/\s+/g, "-")}`}
      onClick={onClick}
    >
      {children}
    </button>
  ),
  Icons: {
    terminal: () => <span>terminal-icon</span>,
    x: () => <span>x-icon</span>,
    maximize: () => <span>maximize-icon</span>,
    minimize: () => <span>minimize-icon</span>,
  },
}));

function makeSession(
  id: string,
  uri: string,
  paneId: "left" | "right" | "rail" = "left",
): TerminalSession {
  return {
    id,
    uri,
    label: uri.split("/").pop() ?? "Shell",
    status: "running",
    paneId,
  };
}

function mockClient() {
  return {} as unknown as import("@fileoctopus/ts-api").FileOctopusClient;
}

afterEach(cleanup);

describe("PaneTerminalSplit", () => {
  beforeEach(() => {
    mockSetPaneTerminalCollapsed.mockReset();
    mockSetPaneTerminalMaximized.mockReset();
    mockClosePaneTerminal.mockReset();
    mockCloseTerminalTab.mockReset();
    mockMarkSessionExited.mockReset();
  });

  it("returns null when no sessions belong to the pane", () => {
    const { container } = render(
      <PaneTerminalSplit
        client={mockClient()}
        panelId="left"
        sessions={[makeSession("s1", "local:///x", "right")]}
        activeSessionId="s1"
        splitRatio={0.35}
        collapsed={false}
        maximized={false}
        panelActive={true}
        onResize={vi.fn()}
        onSwitch={vi.fn()}
        onNewSession={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders collapsed state with expand button", () => {
    render(
      <PaneTerminalSplit
        client={mockClient()}
        panelId="left"
        sessions={[makeSession("s1", "local:///home/user")]}
        activeSessionId="s1"
        splitRatio={0.35}
        collapsed={true}
        maximized={false}
        panelActive={true}
        onResize={vi.fn()}
        onSwitch={vi.fn()}
        onNewSession={vi.fn()}
      />,
    );

    const collapsedDiv = document.querySelector(".fo-panel-terminal-collapsed");
    expect(collapsedDiv).toBeTruthy();

    const expandBtn = document.querySelector(
      ".fo-panel-terminal-collapsed-expand",
    ) as HTMLElement;
    expect(expandBtn).toBeTruthy();
    expect(expandBtn.textContent).toContain("user");
    expect(expandBtn.textContent).toContain("Expand");
  });

  it("expands terminal on collapsed expand button click", () => {
    render(
      <PaneTerminalSplit
        client={mockClient()}
        panelId="left"
        sessions={[makeSession("s1", "local:///home/user")]}
        activeSessionId="s1"
        splitRatio={0.35}
        collapsed={true}
        maximized={false}
        panelActive={true}
        onResize={vi.fn()}
        onSwitch={vi.fn()}
        onNewSession={vi.fn()}
      />,
    );

    const expandBtn = document.querySelector(
      ".fo-panel-terminal-collapsed-expand",
    ) as HTMLElement;
    fireEvent.click(expandBtn);
    expect(mockSetPaneTerminalCollapsed).toHaveBeenCalledWith("left", false);
  });

  it("closes terminal from collapsed state", () => {
    render(
      <PaneTerminalSplit
        client={mockClient()}
        panelId="left"
        sessions={[makeSession("s1", "local:///home/user")]}
        activeSessionId="s1"
        splitRatio={0.35}
        collapsed={true}
        maximized={false}
        panelActive={true}
        onResize={vi.fn()}
        onSwitch={vi.fn()}
        onNewSession={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("icon-btn-close-terminal"));
    expect(mockClosePaneTerminal).toHaveBeenCalledWith("left");
  });

  it("renders expanded terminal section", () => {
    render(
      <PaneTerminalSplit
        client={mockClient()}
        panelId="left"
        sessions={[makeSession("s1", "local:///home/user")]}
        activeSessionId="s1"
        splitRatio={0.35}
        collapsed={false}
        maximized={false}
        panelActive={true}
        onResize={vi.fn()}
        onSwitch={vi.fn()}
        onNewSession={vi.fn()}
      />,
    );

    const section = document.querySelector(".fo-panel-terminal") as HTMLElement;
    expect(section).toBeTruthy();
    expect(section.getAttribute("aria-label")).toBe("Pane terminal");
    expect(section.style.flex).toContain("0.35");
  });

  it("renders resizer when not maximized", () => {
    render(
      <PaneTerminalSplit
        client={mockClient()}
        panelId="left"
        sessions={[makeSession("s1", "local:///home/user")]}
        activeSessionId="s1"
        splitRatio={0.35}
        collapsed={false}
        maximized={false}
        panelActive={true}
        onResize={vi.fn()}
        onSwitch={vi.fn()}
        onNewSession={vi.fn()}
      />,
    );

    expect(screen.getByTestId("resizer")).toBeTruthy();
  });

  it("hides resizer when maximized", () => {
    render(
      <PaneTerminalSplit
        client={mockClient()}
        panelId="left"
        sessions={[makeSession("s1", "local:///home/user")]}
        activeSessionId="s1"
        splitRatio={0.35}
        collapsed={false}
        maximized={true}
        panelActive={true}
        onResize={vi.fn()}
        onSwitch={vi.fn()}
        onNewSession={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("resizer")).toBeNull();
  });

  it("applies maximized class when maximized", () => {
    render(
      <PaneTerminalSplit
        client={mockClient()}
        panelId="left"
        sessions={[makeSession("s1", "local:///home/user")]}
        activeSessionId="s1"
        splitRatio={0.35}
        collapsed={false}
        maximized={true}
        panelActive={true}
        onResize={vi.fn()}
        onSwitch={vi.fn()}
        onNewSession={vi.fn()}
      />,
    );

    const section = document.querySelector(".fo-panel-terminal") as HTMLElement;
    expect(section.classList.contains("fo-panel-terminal-maximized")).toBe(
      true,
    );
    expect(section.style.flex).toBe("");
  });

  it("calls onResize when resizer triggers resize", () => {
    const onResize = vi.fn();
    render(
      <PaneTerminalSplit
        client={mockClient()}
        panelId="left"
        sessions={[makeSession("s1", "local:///home/user")]}
        activeSessionId="s1"
        splitRatio={0.35}
        collapsed={false}
        maximized={false}
        panelActive={true}
        onResize={onResize}
        onSwitch={vi.fn()}
        onNewSession={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("resizer"));
    expect(onResize).toHaveBeenCalledWith(0.5);
  });

  it("renders terminal region", () => {
    render(
      <PaneTerminalSplit
        client={mockClient()}
        panelId="left"
        sessions={[makeSession("s1", "local:///home/user")]}
        activeSessionId="s1"
        splitRatio={0.35}
        collapsed={false}
        maximized={false}
        panelActive={true}
        onResize={vi.fn()}
        onSwitch={vi.fn()}
        onNewSession={vi.fn()}
      />,
    );

    expect(screen.getByTestId("terminal-region")).toBeTruthy();
  });

  it("maximize button toggles maximize state", () => {
    render(
      <PaneTerminalSplit
        client={mockClient()}
        panelId="left"
        sessions={[makeSession("s1", "local:///home/user")]}
        activeSessionId="s1"
        splitRatio={0.35}
        collapsed={false}
        maximized={false}
        panelActive={true}
        onResize={vi.fn()}
        onSwitch={vi.fn()}
        onNewSession={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("icon-btn-maximize-terminal"));
    expect(mockSetPaneTerminalMaximized).toHaveBeenCalledWith("left", true);
  });

  it("restore button toggles maximize state back", () => {
    render(
      <PaneTerminalSplit
        client={mockClient()}
        panelId="left"
        sessions={[makeSession("s1", "local:///home/user")]}
        activeSessionId="s1"
        splitRatio={0.35}
        collapsed={false}
        maximized={true}
        panelActive={true}
        onResize={vi.fn()}
        onSwitch={vi.fn()}
        onNewSession={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("icon-btn-restore-terminal"));
    expect(mockSetPaneTerminalMaximized).toHaveBeenCalledWith("left", false);
  });

  it("collapse button calls setPaneTerminalCollapsed", () => {
    render(
      <PaneTerminalSplit
        client={mockClient()}
        panelId="left"
        sessions={[makeSession("s1", "local:///home/user")]}
        activeSessionId="s1"
        splitRatio={0.35}
        collapsed={false}
        maximized={false}
        panelActive={true}
        onResize={vi.fn()}
        onSwitch={vi.fn()}
        onNewSession={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("icon-btn-collapse-terminal"));
    expect(mockSetPaneTerminalCollapsed).toHaveBeenCalledWith("left", true);
  });

  it("close button calls closePaneTerminal in expanded mode", () => {
    render(
      <PaneTerminalSplit
        client={mockClient()}
        panelId="left"
        sessions={[makeSession("s1", "local:///home/user")]}
        activeSessionId="s1"
        splitRatio={0.35}
        collapsed={false}
        maximized={false}
        panelActive={true}
        onResize={vi.fn()}
        onSwitch={vi.fn()}
        onNewSession={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("icon-btn-close-terminal"));
    expect(mockClosePaneTerminal).toHaveBeenCalledWith("left");
  });

  it("falls back to last session when activeSessionId does not match", () => {
    render(
      <PaneTerminalSplit
        client={mockClient()}
        panelId="left"
        sessions={[
          makeSession("s1", "local:///home/user/a"),
          makeSession("s2", "local:///home/user/b"),
        ]}
        activeSessionId="nonexistent"
        splitRatio={0.35}
        collapsed={true}
        maximized={false}
        panelActive={true}
        onResize={vi.fn()}
        onSwitch={vi.fn()}
        onNewSession={vi.fn()}
      />,
    );

    const expandBtn = document.querySelector(
      ".fo-panel-terminal-collapsed-expand",
    ) as HTMLElement;
    expect(expandBtn.textContent).toContain("b");
  });

  it("shows 'Terminal' label when no active session", () => {
    render(
      <PaneTerminalSplit
        client={mockClient()}
        panelId="left"
        sessions={[makeSession("s1", "local:///home/user")]}
        activeSessionId="nonexistent"
        splitRatio={0.35}
        collapsed={true}
        maximized={false}
        panelActive={true}
        onResize={vi.fn()}
        onSwitch={vi.fn()}
        onNewSession={vi.fn()}
      />,
    );

    const expandBtn = document.querySelector(
      ".fo-panel-terminal-collapsed-expand",
    ) as HTMLElement;
    expect(expandBtn.textContent).toContain("user");
  });
});
