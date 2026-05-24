import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaneWorkspace } from "../src/shell/PaneWorkspace";
import { createInitialState } from "../src/panelStore";
import type { ShellLayoutContextValue } from "../src/shell/ShellLayoutContext";
import { ShellLayoutProvider } from "../src/shell/ShellLayoutContext";

vi.mock("../src/pane/FilePanel", () => ({
  FilePanel: () => <div data-testid="file-panel" />,
}));

function renderPaneWorkspace(overrides: Partial<ShellLayoutContextValue> = {}) {
  const value = {
    state: createInitialState(),
    jobs: {},
    operationError: null,
    appHealth: null,
    diagnosticsOpen: false,
    setPreviewOpen: vi.fn(),
    handleCommandSelect: vi.fn(),
    handleCopyOrMove: vi.fn(),
    handleCreateFolder: vi.fn(),
    handleTrash: vi.fn(),
    handleProperties: vi.fn(async () => undefined),
    markActivityPinnedOpen: vi.fn(),
    setActivityCollapsed: vi.fn(),
    updatePreference: vi.fn(async () => undefined),
    preferences: { paneMode: "dual", paneDirection: "horizontal" },
    client: {
      fs: {
        discoverVolumes: vi.fn(async () => ({ volumes: [] })),
      },
    },
    locations: [],
    favorites: [],
    recentToday: [],
    recentWeek: [],
    starred: [],
    networkProfiles: [],
    networkStatuses: [],
    appInfo: null,
    busyProfileIds: new Set(),
    activeTabUri: "local:///tmp",
    workspaceRef: { current: null },
    makeFilePanelProps: () =>
      ({}) as unknown as import("../src/pane/FilePanel").FilePanelProps,
    ...overrides,
  } as unknown as ShellLayoutContextValue;

  const result = render(
    <ShellLayoutProvider value={value}>
      <PaneWorkspace />
    </ShellLayoutProvider>,
  );

  return { ...result, value };
}

afterEach(() => {
  cleanup();
});

describe("PaneWorkspace pane direction", () => {
  it("renders horizontal by default", () => {
    renderPaneWorkspace();
    const pane = document.querySelector(".fo-dual-pane");
    expect(pane).toBeTruthy();
    expect(pane!.getAttribute("data-pane-direction")).toBe("horizontal");
  });

  it("renders vertical when preference is vertical", () => {
    renderPaneWorkspace({
      preferences: { paneMode: "dual", paneDirection: "vertical" },
    });
    const pane = document.querySelector(".fo-dual-pane");
    expect(pane).toBeTruthy();
    expect(pane!.getAttribute("data-pane-direction")).toBe("vertical");
  });
});
