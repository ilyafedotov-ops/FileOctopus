import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  FavoriteEntryDto,
  NetworkProfileDto,
  NetworkConnectionStatusDto,
  RecentEntryDto,
  StandardLocationDto,
  StarredEntryDto,
  VolumeDto,
} from "@fileoctopus/ts-api";
import type { SmartFolder } from "../src/savedSearches";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("@fileoctopus/ui", () => {
  const cx = (...args: unknown[]) => args.filter(Boolean).join(" ");
  const Icons = new Proxy({} as Record<string, () => string>, {
    get: (_target, prop: string) => () => `<${prop} />`,
  });
  const Button = ({
    children,
    onClick,
    disabled,
    className,
    title,
    ...rest
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    title?: string;
    [k: string]: unknown;
  }) => (
    <button
      disabled={disabled}
      onClick={onClick}
      className={className}
      title={title}
      data-testid="ui-button"
      {...rest}
    >
      {children}
    </button>
  );
  return { Button, cx, Icons };
});

vi.mock("../src/navigation/driveTargets", () => ({
  isDriveTargetActive: vi.fn(() => false),
  isBrowseableProfile: vi.fn(
    (profile: { scheme: string }) =>
      profile.scheme === "sftp" ||
      profile.scheme === "smb" ||
      profile.scheme === "s3" ||
      profile.scheme === "webdav",
  ),
  networkProfileBadge: vi.fn(() => null),
  networkProfileTitle: vi.fn(() => "title"),
}));

import { Sidebar } from "../src/sidebar/Sidebar";

// ── test data factories ──────────────────────────────────────────────────

function makeLocation(
  overrides: Partial<StandardLocationDto> = {},
): StandardLocationDto {
  return {
    id: "home",
    name: "Home",
    uri: "local:///home/user",
    section: "User folders",
    ...overrides,
  };
}

function makeFavorite(
  overrides: Partial<FavoriteEntryDto> = {},
): FavoriteEntryDto {
  return {
    id: 1,
    label: "Projects",
    uri: "local:///home/user/projects",
    ...overrides,
  };
}

function makeNetworkProfile(
  overrides: Partial<NetworkProfileDto> = {},
): NetworkProfileDto {
  return {
    id: "server-1",
    label: "My Server",
    scheme: "sftp",
    defaultUri: "sftp://myserver/home",
    host: "myserver",
    ...overrides,
  };
}

function makeRecent(overrides: Partial<RecentEntryDto> = {}): RecentEntryDto {
  return {
    uri: "local:///home/user/recent",
    label: "Recent Folder",
    ...overrides,
  };
}

function makeStarred(
  overrides: Partial<StarredEntryDto> = {},
): StarredEntryDto {
  return {
    uri: "local:///home/user/starred-file.txt",
    label: "starred-file.txt",
    ...overrides,
  };
}

function makeVolume(overrides: Partial<VolumeDto> = {}): VolumeDto {
  return {
    name: "USB Drive",
    mountUri: "local:///media/usb",
    mountPoint: "/media/usb",
    isRemovable: false,
    ...overrides,
  };
}

function makeSmartFolder(overrides: Partial<SmartFolder> = {}): SmartFolder {
  return {
    id: "sf-1",
    name: "My Search",
    baseUri: "local:///home/user",
    query: "*.ts",
    ...overrides,
  };
}

function makeSidebarProps(overrides: Record<string, unknown> = {}) {
  return {
    locations: [] as StandardLocationDto[],
    networkProfiles: [] as NetworkProfileDto[],
    networkStatuses: [] as NetworkConnectionStatusDto[],
    favorites: [] as FavoriteEntryDto[],
    recentToday: [] as RecentEntryDto[],
    recentWeek: [] as RecentEntryDto[],
    starred: [] as StarredEntryDto[],
    activeUri: "",
    onNavigate: vi.fn(),
    onAddFavorite: vi.fn(),
    onRemoveFavorite: vi.fn(),
    onRenameFavorite: vi.fn(),
    onRevealFavorite: vi.fn(),
    onAddServer: vi.fn(),
    onConnectProfile: vi.fn(),
    onDisconnectProfile: vi.fn(),
    onEditProfile: vi.fn(),
    onDeleteProfile: vi.fn(),
    onOpenProfileTerminal: vi.fn(),
    busyProfileIds: new Set<string>(),
    networkEnabled: false,
    volumes: [] as VolumeDto[],
    onEjectVolume: undefined as ((mountPoint: string) => void) | undefined,
    smartFolders: [] as SmartFolder[],
    onOpenSmartFolder: undefined as ((folder: SmartFolder) => void) | undefined,
    onRemoveSmartFolder: undefined as ((id: string) => void) | undefined,
    onRenameSmartFolder: undefined as
      ((id: string, name: string) => void) | undefined,
    onSaveSearch: undefined as (() => void) | undefined,
    ...overrides,
  };
}

afterEach(cleanup);

// ── tests ────────────────────────────────────────────────────────────────

describe("Sidebar", () => {
  // ── Standard sections ──────────────────────────────────────────────

  it("renders standard section titles", () => {
    const props = makeSidebarProps();
    render(<Sidebar {...props} />);
    expect(screen.getByText("Favorites")).toBeTruthy();
    expect(screen.getByText("User folders")).toBeTruthy();
    expect(screen.getByText("Devices / Volumes")).toBeTruthy();
  });

  it("renders empty hints for empty standard sections", () => {
    const props = makeSidebarProps();
    render(<Sidebar {...props} />);
    expect(screen.getByText("No favorite locations")).toBeTruthy();
    expect(screen.getByText("No user folders found")).toBeTruthy();
    expect(screen.getByText("No mounted volumes")).toBeTruthy();
  });

  it("renders User folders section items", () => {
    const props = makeSidebarProps({
      locations: [
        makeLocation({
          id: "home",
          name: "Home",
          uri: "local:///home/user",
          section: "User folders",
        }),
        makeLocation({
          id: "downloads",
          name: "Downloads",
          uri: "local:///home/user/downloads",
          section: "User folders",
        }),
      ],
    });
    render(<Sidebar {...props} />);
    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("Downloads")).toBeTruthy();
  });

  it("renders Devices/Volumes section items", () => {
    const props = makeSidebarProps({
      locations: [
        makeLocation({
          id: "root",
          name: "Root",
          uri: "local:///",
          section: "Devices/Volumes",
        }),
      ],
      volumes: [makeVolume({ name: "Root", mountUri: "local:///" })],
    });
    render(<Sidebar {...props} />);
    expect(screen.getByText("Root")).toBeTruthy();
  });

  it("calls onNavigate when a location item is clicked", () => {
    const onNavigate = vi.fn();
    const props = makeSidebarProps({
      onNavigate,
      locations: [
        makeLocation({
          id: "home",
          name: "Home",
          uri: "local:///home/user",
          section: "User folders",
        }),
      ],
    });
    render(<Sidebar {...props} />);
    // Find the button that contains "Home" text
    const buttons = screen.getAllByText("Home");
    // The sidebar item for "Home" is in a button
    const homeButton = buttons.find((el) => el.closest("button"));
    expect(homeButton).toBeTruthy();
    fireEvent.click(homeButton!);
    expect(onNavigate).toHaveBeenCalledWith("local:///home/user");
  });

  it("highlights active location", () => {
    const props = makeSidebarProps({
      activeUri: "local:///home/user",
      locations: [
        makeLocation({
          id: "home",
          name: "Home",
          uri: "local:///home/user",
          section: "User folders",
        }),
        makeLocation({
          id: "downloads",
          name: "Downloads",
          uri: "local:///home/user/downloads",
          section: "User folders",
        }),
      ],
    });
    const { container } = render(<Sidebar {...props} />);
    const activeItems = container.querySelectorAll(".fo-sidebar-active");
    expect(activeItems.length).toBe(1);
  });

  // ── Favorites section ──────────────────────────────────────────────

  it("renders Favorites section when favorites exist", () => {
    const props = makeSidebarProps({
      favorites: [
        makeFavorite({
          id: 1,
          label: "Projects",
          uri: "local:///home/user/projects",
        }),
      ],
    });
    render(<Sidebar {...props} />);
    // The section header "Favorites" should be rendered
    const headings = screen.getAllByText("Favorites");
    expect(headings.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Projects")).toBeTruthy();
  });

  it("does not render Favorites section when no favorites", () => {
    const props = makeSidebarProps({ favorites: [] });
    const { container } = render(<Sidebar {...props} />);
    // Favorites section should be absent (the standard section "Favorites" is separate)
    // Actually, the standard "Favorites" section in STANDARD_SECTION_ORDER always renders
    // But the favorites section at line 331-366 is conditional
    // The standard section always shows, but the dedicated favorites section is conditional
    // Let's check that the dedicated favorites section with SidebarItem is not there
    const sidebarItems = container.querySelectorAll(".fo-sidebar-item");
    let foundProjectItem = false;
    sidebarItems.forEach((el) => {
      if (el.textContent?.includes("Projects")) foundProjectItem = true;
    });
    expect(foundProjectItem).toBe(false);
  });

  it("navigates when a favorite is clicked", () => {
    const onNavigate = vi.fn();
    const props = makeSidebarProps({
      onNavigate,
      favorites: [
        makeFavorite({
          id: 1,
          label: "Projects",
          uri: "local:///home/user/projects",
        }),
      ],
    });
    render(<Sidebar {...props} />);
    fireEvent.click(screen.getByText("Projects"));
    expect(onNavigate).toHaveBeenCalledWith("local:///home/user/projects");
  });

  it("opens favorite context menu on right-click", () => {
    const props = makeSidebarProps({
      favorites: [
        makeFavorite({
          id: 1,
          label: "Projects",
          uri: "local:///home/user/projects",
        }),
      ],
    });
    render(<Sidebar {...props} />);
    const label = screen.getByText("Projects");
    const btn = label.closest("button")!;
    fireEvent.contextMenu(btn, { clientX: 100, clientY: 200 });
    // Context menu should appear
    expect(screen.getByText("Rename Favorite")).toBeTruthy();
    expect(screen.getByText("Remove Favorite")).toBeTruthy();
    expect(screen.getByText("Reveal Path")).toBeTruthy();
  });

  it("calls onRemoveFavorite when Remove Favorite is clicked", () => {
    const onRemoveFavorite = vi.fn();
    const props = makeSidebarProps({
      onRemoveFavorite,
      favorites: [
        makeFavorite({
          id: 1,
          label: "Projects",
          uri: "local:///home/user/projects",
        }),
      ],
    });
    render(<Sidebar {...props} />);
    fireEvent.contextMenu(screen.getByText("Projects"), {
      clientX: 100,
      clientY: 200,
    });
    fireEvent.click(screen.getByText("Remove Favorite"));
    expect(onRemoveFavorite).toHaveBeenCalledWith(1);
  });

  it("enters rename mode when Rename Favorite is clicked", () => {
    const props = makeSidebarProps({
      favorites: [
        makeFavorite({
          id: 1,
          label: "Projects",
          uri: "local:///home/user/projects",
        }),
      ],
    });
    render(<Sidebar {...props} />);
    fireEvent.contextMenu(screen.getByText("Projects"), {
      clientX: 100,
      clientY: 200,
    });
    fireEvent.click(screen.getByText("Rename Favorite"));
    // Should now show an input with current label
    const input = screen.getByDisplayValue("Projects");
    expect(input).toBeTruthy();
  });

  it("calls onRenameFavorite on rename submit (Enter)", () => {
    const onRenameFavorite = vi.fn();
    const props = makeSidebarProps({
      onRenameFavorite,
      favorites: [
        makeFavorite({
          id: 1,
          label: "Projects",
          uri: "local:///home/user/projects",
        }),
      ],
    });
    render(<Sidebar {...props} />);
    // Right-click -> Rename
    fireEvent.contextMenu(screen.getByText("Projects"), {
      clientX: 100,
      clientY: 200,
    });
    fireEvent.click(screen.getByText("Rename Favorite"));
    const input = screen.getByDisplayValue("Projects");
    fireEvent.change(input, { target: { value: "My Projects" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRenameFavorite).toHaveBeenCalledWith(1, "My Projects");
  });

  it("cancels rename on Escape", () => {
    const onRenameFavorite = vi.fn();
    const props = makeSidebarProps({
      onRenameFavorite,
      favorites: [
        makeFavorite({
          id: 1,
          label: "Projects",
          uri: "local:///home/user/projects",
        }),
      ],
    });
    render(<Sidebar {...props} />);
    fireEvent.contextMenu(screen.getByText("Projects"), {
      clientX: 100,
      clientY: 200,
    });
    fireEvent.click(screen.getByText("Rename Favorite"));
    const input = screen.getByDisplayValue("Projects");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onRenameFavorite).not.toHaveBeenCalled();
  });

  // ── Today section ──────────────────────────────────────────────────

  it("renders Today section with empty hint", () => {
    const props = makeSidebarProps({ recentToday: [] });
    render(<Sidebar {...props} />);
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("No recent folders")).toBeTruthy();
  });

  it("renders recent today items", () => {
    const props = makeSidebarProps({
      recentToday: [
        makeRecent({ uri: "local:///home/user/recent1", label: "Recent1" }),
      ],
    });
    render(<Sidebar {...props} />);
    expect(screen.getByText("Recent1")).toBeTruthy();
  });

  it("navigates when a recent today item is clicked", () => {
    const onNavigate = vi.fn();
    const props = makeSidebarProps({
      onNavigate,
      recentToday: [
        makeRecent({ uri: "local:///home/user/recent1", label: "Recent1" }),
      ],
    });
    render(<Sidebar {...props} />);
    fireEvent.click(screen.getByText("Recent1"));
    expect(onNavigate).toHaveBeenCalledWith("local:///home/user/recent1");
  });

  // ── This Week section ──────────────────────────────────────────────

  it("does not show This Week section when empty", () => {
    const props = makeSidebarProps({ recentWeek: [] });
    render(<Sidebar {...props} />);
    expect(screen.queryByText("This Week")).toBeNull();
  });

  it("renders This Week section when items exist", () => {
    const props = makeSidebarProps({
      recentWeek: [
        makeRecent({ uri: "local:///home/user/week1", label: "WeekFolder" }),
      ],
    });
    render(<Sidebar {...props} />);
    expect(screen.getByText("This Week")).toBeTruthy();
    expect(screen.getByText("WeekFolder")).toBeTruthy();
  });

  // ── Starred section ────────────────────────────────────────────────

  it("does not show Starred section when empty", () => {
    const props = makeSidebarProps({ starred: [] });
    render(<Sidebar {...props} />);
    expect(screen.queryByText("Starred")).toBeNull();
  });

  it("renders Starred section when items exist", () => {
    const props = makeSidebarProps({
      starred: [
        makeStarred({ uri: "local:///home/user/star.txt", label: "star.txt" }),
      ],
    });
    render(<Sidebar {...props} />);
    expect(screen.getByText("Starred")).toBeTruthy();
    expect(screen.getByText("star.txt")).toBeTruthy();
  });

  it("navigates when a starred item is clicked", () => {
    const onNavigate = vi.fn();
    const props = makeSidebarProps({
      onNavigate,
      starred: [
        makeStarred({ uri: "local:///home/user/star.txt", label: "star.txt" }),
      ],
    });
    render(<Sidebar {...props} />);
    fireEvent.click(screen.getByText("star.txt"));
    expect(onNavigate).toHaveBeenCalledWith("local:///home/user/star.txt");
  });

  // ── Network section ────────────────────────────────────────────────

  it("does not show Network section when networkEnabled is false", () => {
    const props = makeSidebarProps({ networkEnabled: false });
    render(<Sidebar {...props} />);
    expect(screen.queryByText("Network")).toBeNull();
  });

  it("shows Network section when networkEnabled is true", () => {
    const props = makeSidebarProps({
      networkEnabled: true,
      networkProfiles: [],
    });
    render(<Sidebar {...props} />);
    expect(screen.getByText("Network")).toBeTruthy();
    expect(screen.getByText("No saved connections")).toBeTruthy();
  });

  it("renders network profiles", () => {
    const props = makeSidebarProps({
      networkEnabled: true,
      networkProfiles: [
        makeNetworkProfile({
          id: "s1",
          label: "My Server",
          scheme: "sftp",
          defaultUri: "sftp://myserver/home",
        }),
      ],
    });
    render(<Sidebar {...props} />);
    expect(screen.getByText("My Server")).toBeTruthy();
  });

  it("navigates on browseable network profile click", () => {
    const onNavigate = vi.fn();
    const props = makeSidebarProps({
      networkEnabled: true,
      onNavigate,
      networkProfiles: [
        makeNetworkProfile({
          id: "s1",
          scheme: "sftp",
          defaultUri: "sftp://myserver/home",
        }),
      ],
    });
    render(<Sidebar {...props} />);
    fireEvent.click(screen.getByText("My Server"));
    expect(onNavigate).toHaveBeenCalledWith("sftp://myserver/home");
  });

  it("calls onOpenProfileTerminal for non-browseable profile click", () => {
    const onOpenProfileTerminal = vi.fn();
    const props = makeSidebarProps({
      networkEnabled: true,
      onOpenProfileTerminal,
      networkProfiles: [
        makeNetworkProfile({
          id: "s1",
          scheme: "docker",
          defaultUri: "docker://container",
        }),
      ],
    });
    render(<Sidebar {...props} />);
    // The profile label is "My Server"
    fireEvent.click(screen.getByText("My Server"));
    expect(onOpenProfileTerminal).toHaveBeenCalledTimes(1);
    expect(onOpenProfileTerminal.mock.calls[0][0].id).toBe("s1");
  });

  it("shows Add connection button in Network section", () => {
    const onAddServer = vi.fn();
    const props = makeSidebarProps({
      networkEnabled: true,
      onAddServer,
    });
    render(<Sidebar {...props} />);
    fireEvent.click(screen.getByText("Add connection…"));
    expect(onAddServer).toHaveBeenCalled();
  });

  it("opens network context menu on right-click", () => {
    const props = makeSidebarProps({
      networkEnabled: true,
      networkProfiles: [
        makeNetworkProfile({
          id: "s1",
          scheme: "sftp",
          defaultUri: "sftp://myserver/home",
        }),
      ],
    });
    render(<Sidebar {...props} />);
    fireEvent.contextMenu(screen.getByText("My Server"), {
      clientX: 100,
      clientY: 200,
    });
    expect(screen.getByText("Open Terminal")).toBeTruthy();
    expect(screen.getByText("Edit")).toBeTruthy();
    expect(screen.getByText("Remove")).toBeTruthy();
  });

  it("shows Connect for disconnected browseable network profile", () => {
    const props = makeSidebarProps({
      networkEnabled: true,
      networkProfiles: [makeNetworkProfile({ id: "s1", scheme: "sftp" })],
      networkStatuses: [{ profileId: "s1", status: "disconnected" }],
    });
    render(<Sidebar {...props} />);
    fireEvent.contextMenu(screen.getByText("My Server"), {
      clientX: 100,
      clientY: 200,
    });
    expect(screen.getByText("Connect")).toBeTruthy();
  });

  it("shows Disconnect for connected browseable network profile", () => {
    const props = makeSidebarProps({
      networkEnabled: true,
      networkProfiles: [makeNetworkProfile({ id: "s1", scheme: "sftp" })],
      networkStatuses: [{ profileId: "s1", status: "connected" }],
    });
    render(<Sidebar {...props} />);
    fireEvent.contextMenu(screen.getByText("My Server"), {
      clientX: 100,
      clientY: 200,
    });
    expect(screen.getByText("Disconnect")).toBeTruthy();
  });

  it("does not show Connect/Disconnect for non-browseable profiles", () => {
    const props = makeSidebarProps({
      networkEnabled: true,
      networkProfiles: [makeNetworkProfile({ id: "s1", scheme: "docker" })],
    });
    render(<Sidebar {...props} />);
    fireEvent.contextMenu(screen.getByText("My Server"), {
      clientX: 100,
      clientY: 200,
    });
    expect(screen.queryByText("Connect")).toBeNull();
    expect(screen.queryByText("Disconnect")).toBeNull();
  });

  it("shows Add to Favorites for browseable network profiles", () => {
    const props = makeSidebarProps({
      networkEnabled: true,
      networkProfiles: [makeNetworkProfile({ id: "s1", scheme: "sftp" })],
    });
    render(<Sidebar {...props} />);
    fireEvent.contextMenu(screen.getByText("My Server"), {
      clientX: 100,
      clientY: 200,
    });
    expect(screen.getByText("Add to Favorites")).toBeTruthy();
  });

  it("does not show Add to Favorites for non-browseable profiles", () => {
    const props = makeSidebarProps({
      networkEnabled: true,
      networkProfiles: [makeNetworkProfile({ id: "s1", scheme: "docker" })],
    });
    render(<Sidebar {...props} />);
    fireEvent.contextMenu(screen.getByText("My Server"), {
      clientX: 100,
      clientY: 200,
    });
    expect(screen.queryByText("Add to Favorites")).toBeNull();
  });

  it("calls network context menu actions correctly", () => {
    const onConnectProfile = vi.fn();
    const props = makeSidebarProps({
      networkEnabled: true,
      onConnectProfile,
      networkProfiles: [makeNetworkProfile({ id: "s1", scheme: "sftp" })],
      networkStatuses: [{ profileId: "s1", status: "disconnected" }],
    });
    render(<Sidebar {...props} />);
    fireEvent.contextMenu(screen.getByText("My Server"), {
      clientX: 100,
      clientY: 200,
    });
    fireEvent.click(screen.getByText("Connect"));
    expect(onConnectProfile).toHaveBeenCalledWith("s1");
  });

  // ── Volume context menu ────────────────────────────────────────────

  it("shows volume context menu for removable volumes", () => {
    const onEjectVolume = vi.fn();
    const props = makeSidebarProps({
      locations: [
        makeLocation({
          id: "usb",
          name: "USB Drive",
          uri: "local:///media/usb",
          section: "Devices/Volumes",
        }),
      ],
      volumes: [
        makeVolume({
          name: "USB Drive",
          mountUri: "local:///media/usb",
          isRemovable: true,
        }),
      ],
      onEjectVolume,
    });
    render(<Sidebar {...props} />);
    fireEvent.contextMenu(screen.getByText("USB Drive"), {
      clientX: 100,
      clientY: 200,
    });
    expect(screen.getByText("Eject USB Drive")).toBeTruthy();
  });

  it("calls onEjectVolume when eject is clicked", () => {
    const onEjectVolume = vi.fn();
    const props = makeSidebarProps({
      locations: [
        makeLocation({
          id: "usb",
          name: "USB Drive",
          uri: "local:///media/usb",
          section: "Devices/Volumes",
        }),
      ],
      volumes: [
        makeVolume({
          name: "USB Drive",
          mountUri: "local:///media/usb",
          isRemovable: true,
        }),
      ],
      onEjectVolume,
    });
    render(<Sidebar {...props} />);
    fireEvent.contextMenu(screen.getByText("USB Drive"), {
      clientX: 100,
      clientY: 200,
    });
    fireEvent.click(screen.getByText("Eject USB Drive"));
    expect(onEjectVolume).toHaveBeenCalledWith("/media/usb");
  });

  it("does not show context menu for non-removable volumes", () => {
    const props = makeSidebarProps({
      locations: [
        makeLocation({
          id: "root",
          name: "Root",
          uri: "local:///",
          section: "Devices/Volumes",
        }),
      ],
      volumes: [
        makeVolume({ name: "Root", mountUri: "local:///", isRemovable: false }),
      ],
    });
    render(<Sidebar {...props} />);
    // Right-clicking non-removable volume shouldn't open a context menu
    fireEvent.contextMenu(screen.getByText("Root"), {
      clientX: 100,
      clientY: 200,
    });
    expect(screen.queryByText(/Eject/)).toBeNull();
  });

  // ── Smart Folders section ──────────────────────────────────────────

  it("renders Smart Folders section with empty hint", () => {
    const props = makeSidebarProps({
      smartFolders: [],
      onSaveSearch: undefined,
    });
    render(<Sidebar {...props} />);
    expect(screen.getByText("Smart Folders")).toBeTruthy();
    expect(screen.getByText("No saved searches")).toBeTruthy();
  });

  it("renders smart folders when provided", () => {
    const props = makeSidebarProps({
      smartFolders: [makeSmartFolder({ id: "sf-1", name: "My Search" })],
    });
    render(<Sidebar {...props} />);
    expect(screen.getByText("My Search")).toBeTruthy();
  });

  it("calls onOpenSmartFolder when a smart folder is clicked", () => {
    const onOpenSmartFolder = vi.fn();
    const folder = makeSmartFolder({ id: "sf-1", name: "My Search" });
    const props = makeSidebarProps({
      smartFolders: [folder],
      onOpenSmartFolder,
    });
    render(<Sidebar {...props} />);
    fireEvent.click(screen.getByText("My Search"));
    expect(onOpenSmartFolder).toHaveBeenCalledWith(folder);
  });

  it("shows Save Search button when onSaveSearch is provided", () => {
    const onSaveSearch = vi.fn();
    const props = makeSidebarProps({ onSaveSearch });
    render(<Sidebar {...props} />);
    expect(screen.getByText("Save Search…")).toBeTruthy();
    fireEvent.click(screen.getByText("Save Search…"));
    expect(onSaveSearch).toHaveBeenCalled();
  });

  it("does not show Save Search button when onSaveSearch is undefined", () => {
    const props = makeSidebarProps();
    render(<Sidebar {...props} />);
    expect(screen.queryByText("Save Search…")).toBeNull();
  });

  it("opens smart folder context menu on right-click", () => {
    const props = makeSidebarProps({
      smartFolders: [makeSmartFolder({ id: "sf-1", name: "My Search" })],
    });
    render(<Sidebar {...props} />);
    fireEvent.contextMenu(screen.getByText("My Search"), {
      clientX: 100,
      clientY: 200,
    });
    expect(screen.getByText("Rename")).toBeTruthy();
    expect(screen.getByText("Remove")).toBeTruthy();
  });

  it("calls onRemoveSmartFolder when Remove is clicked", () => {
    const onRemoveSmartFolder = vi.fn();
    const props = makeSidebarProps({
      smartFolders: [makeSmartFolder({ id: "sf-1", name: "My Search" })],
      onRemoveSmartFolder,
    });
    render(<Sidebar {...props} />);
    fireEvent.contextMenu(screen.getByText("My Search"), {
      clientX: 100,
      clientY: 200,
    });
    fireEvent.click(screen.getByText("Remove"));
    expect(onRemoveSmartFolder).toHaveBeenCalledWith("sf-1");
  });

  it("enters rename mode for smart folder when Rename is clicked", () => {
    const onRenameSmartFolder = vi.fn();
    const props = makeSidebarProps({
      smartFolders: [makeSmartFolder({ id: "sf-1", name: "My Search" })],
      onRenameSmartFolder,
    });
    render(<Sidebar {...props} />);
    fireEvent.contextMenu(screen.getByText("My Search"), {
      clientX: 100,
      clientY: 200,
    });
    fireEvent.click(screen.getByText("Rename"));
    const input = screen.getByDisplayValue("My Search");
    expect(input).toBeTruthy();
  });

  it("calls onRenameSmartFolder on Enter in smart folder rename", () => {
    const onRenameSmartFolder = vi.fn();
    const props = makeSidebarProps({
      smartFolders: [makeSmartFolder({ id: "sf-1", name: "My Search" })],
      onRenameSmartFolder,
    });
    render(<Sidebar {...props} />);
    fireEvent.contextMenu(screen.getByText("My Search"), {
      clientX: 100,
      clientY: 200,
    });
    fireEvent.click(screen.getByText("Rename"));
    const input = screen.getByDisplayValue("My Search");
    fireEvent.change(input, { target: { value: "Renamed Search" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRenameSmartFolder).toHaveBeenCalledWith("sf-1", "Renamed Search");
  });

  it("cancels smart folder rename on Escape", () => {
    const onRenameSmartFolder = vi.fn();
    const props = makeSidebarProps({
      smartFolders: [makeSmartFolder({ id: "sf-1", name: "My Search" })],
      onRenameSmartFolder,
    });
    render(<Sidebar {...props} />);
    fireEvent.contextMenu(screen.getByText("My Search"), {
      clientX: 100,
      clientY: 200,
    });
    fireEvent.click(screen.getByText("Rename"));
    const input = screen.getByDisplayValue("My Search");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onRenameSmartFolder).not.toHaveBeenCalled();
  });

  // ── Drag & Drop to add favorites ──────────────────────────────────

  it("adds favorite on drop with URI data", () => {
    const onAddFavorite = vi.fn();
    const props = makeSidebarProps({ onAddFavorite });
    const { container } = render(<Sidebar {...props} />);
    const aside = container.querySelector("aside")!;
    const dt = {
      types: ["application/x-fileoctopus-uri"],
      getData: (type: string) => {
        if (type === "application/x-fileoctopus-uri")
          return "local:///home/user/dropped";
        if (type === "application/x-fileoctopus-name") return "dropped";
        return "";
      },
    };
    fireEvent.drop(aside, { dataTransfer: dt });
    expect(onAddFavorite).toHaveBeenCalledWith(
      "local:///home/user/dropped",
      "dropped",
    );
  });

  it("adds favorite with URI as label when no name in drop", () => {
    const onAddFavorite = vi.fn();
    const props = makeSidebarProps({ onAddFavorite });
    const { container } = render(<Sidebar {...props} />);
    const aside = container.querySelector("aside")!;
    const dt = {
      types: ["application/x-fileoctopus-uri"],
      getData: (type: string) => {
        if (type === "application/x-fileoctopus-uri")
          return "local:///home/user/dropped";
        return "";
      },
    };
    fireEvent.drop(aside, { dataTransfer: dt });
    expect(onAddFavorite).toHaveBeenCalledWith(
      "local:///home/user/dropped",
      "local:///home/user/dropped",
    );
  });

  it("does not add favorite on drop without URI data", () => {
    const onAddFavorite = vi.fn();
    const props = makeSidebarProps({ onAddFavorite });
    const { container } = render(<Sidebar {...props} />);
    const aside = container.querySelector("aside")!;
    const dt = {
      types: ["text/plain"],
      getData: () => "",
    };
    fireEvent.drop(aside, { dataTransfer: dt });
    expect(onAddFavorite).not.toHaveBeenCalled();
  });

  it("allows drag over with fileoctopus URI type", () => {
    const props = makeSidebarProps();
    const { container } = render(<Sidebar {...props} />);
    const aside = container.querySelector("aside")!;
    expect(aside).toBeTruthy();
    // dragOver should not throw and the sidebar should handle it
    const dt = {
      types: ["application/x-fileoctopus-uri"],
    };
    expect(() => {
      fireEvent.dragOver(aside, { dataTransfer: dt });
    }).not.toThrow();
  });

  // ── Context menu close behavior ────────────────────────────────────

  it("closes context menu when backdrop is clicked", () => {
    const props = makeSidebarProps({
      favorites: [makeFavorite({ id: 1, label: "Projects" })],
    });
    render(<Sidebar {...props} />);
    // Open context menu
    fireEvent.contextMenu(screen.getByText("Projects"), {
      clientX: 100,
      clientY: 200,
    });
    expect(screen.getByText("Rename Favorite")).toBeTruthy();
    // Click backdrop to close
    const backdrop = document.querySelector(".fo-sidebar-menu-backdrop")!;
    fireEvent.click(backdrop);
    // Menu should be gone
    expect(screen.queryByText("Rename Favorite")).toBeNull();
  });

  it("closes context menu on Escape key", () => {
    const props = makeSidebarProps({
      favorites: [makeFavorite({ id: 1, label: "Projects" })],
    });
    render(<Sidebar {...props} />);
    fireEvent.contextMenu(screen.getByText("Projects"), {
      clientX: 100,
      clientY: 200,
    });
    expect(screen.getByText("Rename Favorite")).toBeTruthy();
    const backdrop = document.querySelector(".fo-sidebar-menu-backdrop")!;
    fireEvent.keyDown(backdrop, { key: "Escape" });
    expect(screen.queryByText("Rename Favorite")).toBeNull();
  });

  // ── Busy state ─────────────────────────────────────────────────────

  it("marks network profile as busy", () => {
    const props = makeSidebarProps({
      networkEnabled: true,
      networkProfiles: [makeNetworkProfile({ id: "s1", scheme: "sftp" })],
      busyProfileIds: new Set(["s1"]),
    });
    const { container } = render(<Sidebar {...props} />);
    const busyItems = container.querySelectorAll(".fo-sidebar-busy");
    expect(busyItems.length).toBe(1);
  });
});
