import { describe, it, expect, beforeEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { Sidebar } from "../src/sidebar/Sidebar";
import type { SmartFolder } from "../src/savedSearches";

const noop = () => {};

const baseProps = {
  locations: [] as Array<{
    id: string;
    name: string;
    uri: string;
    section: string;
  }>,
  networkProfiles: [] as Array<{
    id: string;
    label: string;
    defaultUri: string;
    scheme: string;
  }>,
  networkStatuses: [] as Array<{ profileId: string; status: string }>,
  favorites: [] as Array<{ id: number; label: string; uri: string }>,
  recentToday: [] as Array<{ label: string; uri: string }>,
  recentWeek: [] as Array<{ label: string; uri: string }>,
  starred: [] as Array<{ label: string; uri: string }>,
  activeUri: "",
  onNavigate: noop,
  onAddFavorite: noop,
  onRemoveFavorite: noop,
  onRenameFavorite: noop,
  onRevealFavorite: noop,
  onAddServer: noop,
  onConnectProfile: noop,
  onDisconnectProfile: noop,
  onEditProfile: noop,
  onDeleteProfile: noop,
  onOpenProfileTerminal: noop,
  busyProfileIds: new Set<string>(),
  smartFolders: [] as SmartFolder[],
  onOpenSmartFolder: noop as (folder: SmartFolder) => void,
  onRemoveSmartFolder: noop as (id: string) => void,
  onRenameSmartFolder: noop as (id: string, name: string) => void,
  onSaveSearch: noop,
};

beforeEach(() => {
  cleanup();
  localStorage.clear();
});

describe("Sidebar Smart Folders", () => {
  it("shows empty hint when no smart folders", () => {
    render(<Sidebar {...baseProps} />);
    const section = screen
      .getAllByRole("heading")
      .find((h) => h.textContent === "Smart Folders");
    expect(section).toBeTruthy();
  });

  it("renders smart folder items", () => {
    const folders: SmartFolder[] = [
      {
        id: "1",
        name: "My PDFs",
        baseUri: "local:///home/user/docs",
        query: "*.pdf",
      },
    ];
    render(<Sidebar {...baseProps} smartFolders={folders} />);
    expect(screen.getByText("My PDFs")).toBeTruthy();
  });

  it("calls onOpenSmartFolder when clicked", () => {
    const folder: SmartFolder = {
      id: "1",
      name: "Test",
      baseUri: "local:///tmp",
      query: "*.txt",
    };
    let called = false;
    render(
      <Sidebar
        {...baseProps}
        smartFolders={[folder]}
        onOpenSmartFolder={(f) => {
          called = f.id === "1";
        }}
      />,
    );
    screen.getByText("Test").click();
    expect(called).toBe(true);
  });

  it("renders Save Search action button", () => {
    render(<Sidebar {...baseProps} onSaveSearch={noop} />);
    expect(screen.getByText("Save Search…")).toBeTruthy();
  });
});
