import type {
  FavoriteEntryDto,
  NetworkConnectionStatusDto,
  NetworkProfileDto,
  RecentEntryDto,
  StandardLocationDto,
  StarredEntryDto,
} from "@fileoctopus/ts-api";
import { Button, cx, Icons } from "@fileoctopus/ui";
import {
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  isDriveTargetActive,
  networkProfileBadge,
  networkProfileTitle,
} from "../navigation/driveTargets";

const STANDARD_SECTION_ORDER = [
  "Favorites",
  "User folders",
  "Devices/Volumes",
] as const;

interface SidebarContextMenuState {
  x: number;
  y: number;
  favorite: FavoriteEntryDto;
}

interface SidebarNetworkContextMenuState {
  x: number;
  y: number;
  profile: NetworkProfileDto;
}

interface SidebarProps {
  locations: StandardLocationDto[];
  networkProfiles: NetworkProfileDto[];
  networkStatuses: NetworkConnectionStatusDto[];
  favorites: FavoriteEntryDto[];
  recentToday: RecentEntryDto[];
  recentWeek: RecentEntryDto[];
  starred: StarredEntryDto[];
  activeUri: string;
  onNavigate: (uri: string) => void;
  onAddFavorite: (uri: string, label: string) => void;
  onRemoveFavorite: (id: number) => void;
  onRenameFavorite: (id: number, label: string) => void;
  onRevealFavorite: (uri: string) => void;
  onAddServer: () => void;
  onConnectProfile: (profileId: string) => void;
  onDisconnectProfile: (profileId: string) => void;
  onEditProfile: (profile: NetworkProfileDto) => void;
  onDeleteProfile: (profileId: string) => void;
  onOpenProfileTerminal: (profile: NetworkProfileDto) => void;
  busyProfileIds: Set<string>;
  networkEnabled?: boolean;
}

export function Sidebar({
  locations,
  networkProfiles,
  networkStatuses,
  favorites,
  recentToday,
  recentWeek,
  starred,
  activeUri,
  onNavigate,
  onAddFavorite,
  onRemoveFavorite,
  onRenameFavorite,
  onRevealFavorite,
  onAddServer,
  onConnectProfile,
  onDisconnectProfile,
  onEditProfile,
  onDeleteProfile,
  onOpenProfileTerminal,
  busyProfileIds,
  networkEnabled = false,
}: SidebarProps) {
  const [contextMenu, setContextMenu] =
    useState<SidebarContextMenuState | null>(null);
  const [networkContextMenu, setNetworkContextMenu] =
    useState<SidebarNetworkContextMenuState | null>(null);
  const [renamingFavoriteId, setRenamingFavoriteId] = useState<number | null>(
    null,
  );
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const grouped = locations.reduce<Record<string, StandardLocationDto[]>>(
    (groups, location) => ({
      ...groups,
      [location.section]: [...(groups[location.section] ?? []), location],
    }),
    {},
  );

  useEffect(() => {
    if (renamingFavoriteId != null && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingFavoriteId]);

  const handleRenameSubmit = useCallback(() => {
    if (renamingFavoriteId != null && renameValue.trim()) {
      onRenameFavorite(renamingFavoriteId, renameValue.trim());
    }
    setRenamingFavoriteId(null);
    setRenameValue("");
  }, [renamingFavoriteId, renameValue, onRenameFavorite]);

  const handleRenameKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleRenameSubmit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setRenamingFavoriteId(null);
        setRenameValue("");
      }
    },
    [handleRenameSubmit],
  );

  const renderNetworkProfileItem = (profile: NetworkProfileDto) => {
    const status = networkStatuses.find(
      (item) => item.profileId === profile.id,
    );
    const networkTarget = {
      kind: "network" as const,
      id: profile.id,
      label: profile.label,
      uri: profile.defaultUri,
      profile,
      status,
    };

    const browseable = profile.scheme === "sftp";
    return (
      <SidebarItem
        key={`network-${profile.id}`}
        icon={Icons.server()}
        label={profile.label}
        active={browseable && isDriveTargetActive(networkTarget, activeUri)}
        busy={busyProfileIds.has(profile.id)}
        badge={networkProfileBadge(profile, status)}
        onClick={() =>
          browseable
            ? onNavigate(profile.defaultUri)
            : onOpenProfileTerminal(profile)
        }
        onContextMenu={(event) => {
          event.preventDefault();
          setNetworkContextMenu({
            x: event.clientX,
            y: event.clientY,
            profile,
          });
        }}
        title={networkProfileTitle(profile, status)}
      />
    );
  };

  return (
    <aside
      className="fo-sidebar"
      aria-label="Standard locations"
      onDragOver={(event) => {
        if (
          event.dataTransfer.types.includes("application/x-fileoctopus-uri")
        ) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        const uri = event.dataTransfer.getData("application/x-fileoctopus-uri");
        const label = event.dataTransfer.getData(
          "application/x-fileoctopus-name",
        );
        if (uri) {
          event.preventDefault();
          onAddFavorite(uri, label || uri);
        }
      }}
    >
      {STANDARD_SECTION_ORDER.map((section) => {
        if (section === "Devices/Volumes") {
          const localItems = grouped[section] ?? [];
          const browseableNetworkProfiles = networkProfiles.filter(
            (profile) => profile.scheme === "sftp",
          );
          const hasLocal = localItems.length > 0;
          const hasNetwork =
            networkEnabled && browseableNetworkProfiles.length > 0;

          return (
            <SidebarSection key={section} title={sidebarSectionTitle(section)}>
              {!hasLocal && !hasNetwork ? (
                <SidebarEmptyHint>{emptySectionHint(section)}</SidebarEmptyHint>
              ) : (
                <>
                  {!hasLocal ? (
                    <SidebarEmptyHint>No local volumes</SidebarEmptyHint>
                  ) : (
                    localItems.map((item) => (
                      <SidebarItem
                        key={item.uri}
                        icon={locationIcon(item.id)}
                        label={item.name}
                        active={item.uri === activeUri}
                        onClick={() => onNavigate(item.uri)}
                      />
                    ))
                  )}
                  {hasNetwork ? (
                    <>
                      <p className="fo-sidebar-group-label">Network drives</p>
                      {browseableNetworkProfiles.map((profile) =>
                        renderNetworkProfileItem(profile),
                      )}
                    </>
                  ) : null}
                </>
              )}
            </SidebarSection>
          );
        }

        const items = grouped[section] ?? [];

        return (
          <SidebarSection key={section} title={sidebarSectionTitle(section)}>
            {items.length === 0 ? (
              <SidebarEmptyHint>{emptySectionHint(section)}</SidebarEmptyHint>
            ) : (
              items.map((item) => (
                <SidebarItem
                  key={item.uri}
                  icon={locationIcon(item.id)}
                  label={item.name}
                  active={item.uri === activeUri}
                  onClick={() => onNavigate(item.uri)}
                />
              ))
            )}
          </SidebarSection>
        );
      })}

      {networkEnabled ? (
        <SidebarSection title="Network">
          {networkProfiles.length === 0 ? (
            <SidebarEmptyHint>No saved servers</SidebarEmptyHint>
          ) : (
            networkProfiles.map((profile) => renderNetworkProfileItem(profile))
          )}
          <SidebarItem
            icon={Icons.folderPlus()}
            label="Add server…"
            active={false}
            onClick={onAddServer}
          />
        </SidebarSection>
      ) : null}

      {favorites.length > 0 ? (
        <SidebarSection title="Pinned">
          {favorites.map((item) =>
            renamingFavoriteId === item.id ? (
              <input
                key={item.id}
                ref={renameInputRef}
                className="fo-sidebar-rename-input"
                type="text"
                value={renameValue}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setRenameValue(e.target.value)
                }
                onKeyDown={handleRenameKeyDown}
                onBlur={handleRenameSubmit}
              />
            ) : (
              <SidebarItem
                key={item.id}
                icon={Icons.pin()}
                label={item.label}
                active={item.uri === activeUri}
                onClick={() => onNavigate(item.uri)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenu({
                    x: event.clientX,
                    y: event.clientY,
                    favorite: item,
                  });
                }}
              />
            ),
          )}
        </SidebarSection>
      ) : null}

      <SidebarSection title="Today">
        {recentToday.length === 0 ? (
          <SidebarEmptyHint>No recent folders</SidebarEmptyHint>
        ) : (
          recentToday.map((item) => (
            <SidebarItem
              key={item.uri}
              icon={Icons.recent()}
              label={item.label}
              active={item.uri === activeUri}
              onClick={() => onNavigate(item.uri)}
              subdued
            />
          ))
        )}
      </SidebarSection>

      {recentWeek.length > 0 ? (
        <SidebarSection title="This Week">
          {recentWeek.map((item) => (
            <SidebarItem
              key={item.uri}
              icon={Icons.recent()}
              label={item.label}
              active={item.uri === activeUri}
              onClick={() => onNavigate(item.uri)}
              subdued
            />
          ))}
        </SidebarSection>
      ) : null}

      {starred.length > 0 ? (
        <SidebarSection title="Starred">
          {starred.map((item) => (
            <SidebarItem
              key={item.uri}
              icon={Icons.star()}
              label={item.label}
              active={item.uri === activeUri}
              onClick={() => onNavigate(item.uri)}
            />
          ))}
        </SidebarSection>
      ) : null}

      {networkContextMenu ? (
        <SidebarNetworkContextMenu
          profile={networkContextMenu.profile}
          connected={
            networkStatuses.find(
              (item) => item.profileId === networkContextMenu.profile.id,
            )?.status === "connected"
          }
          x={networkContextMenu.x}
          y={networkContextMenu.y}
          onClose={() => setNetworkContextMenu(null)}
          onConnect={() => onConnectProfile(networkContextMenu.profile.id)}
          onDisconnect={() =>
            onDisconnectProfile(networkContextMenu.profile.id)
          }
          onEdit={() => onEditProfile(networkContextMenu.profile)}
          onRemove={() => onDeleteProfile(networkContextMenu.profile.id)}
          onOpenTerminal={() =>
            onOpenProfileTerminal(networkContextMenu.profile)
          }
          onAddFavorite={() =>
            onAddFavorite(
              networkContextMenu.profile.defaultUri,
              networkContextMenu.profile.label,
            )
          }
        />
      ) : null}

      {contextMenu ? (
        <SidebarContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onRename={() => {
            setRenamingFavoriteId(contextMenu.favorite.id);
            setRenameValue(contextMenu.favorite.label);
            setContextMenu(null);
          }}
          onRemove={() => {
            onRemoveFavorite(contextMenu.favorite.id);
            setContextMenu(null);
          }}
          onReveal={() => {
            onRevealFavorite(contextMenu.favorite.uri);
            setContextMenu(null);
          }}
        />
      ) : null}
    </aside>
  );
}

function SidebarContextMenu({
  x,
  y,
  onClose,
  onRename,
  onRemove,
  onReveal,
}: {
  x: number;
  y: number;
  onClose: () => void;
  onRename: () => void;
  onRemove: () => void;
  onReveal: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    maxHeight?: number;
  } | null>(null);

  useEffect(() => {
    if (!menuRef.current) {
      setPos(null);
      return;
    }
    const el = menuRef.current;
    const pad = 8;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x;
    let top = y;
    let maxHeight: number | undefined;

    if (left + rect.width > vw - pad) {
      left = Math.max(pad, vw - rect.width - pad);
    }

    const availableBelow = vh - top - pad;
    if (rect.height > availableBelow) {
      const availableAbove = top - pad;
      if (availableAbove > availableBelow) {
        top = Math.max(pad, vh - rect.height - pad);
        maxHeight = vh - top - pad;
      } else {
        maxHeight = availableBelow;
      }
    }

    setPos({ left, top, maxHeight });
  }, [x, y]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  const run = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      className="fo-sidebar-menu-backdrop"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        ref={menuRef}
        className="fo-sidebar-context-menu"
        role="menu"
        style={
          pos
            ? { left: pos.left, top: pos.top, maxHeight: pos.maxHeight }
            : { left: x, top: y }
        }
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="fo-context-menu-item"
          role="menuitem"
          onClick={() => run(onRename)}
        >
          Rename Favorite
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="fo-context-menu-item"
          role="menuitem"
          onClick={() => run(onRemove)}
        >
          Remove Favorite
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="fo-context-menu-item"
          role="menuitem"
          onClick={() => run(onReveal)}
        >
          Reveal Path
        </Button>
      </div>
    </div>
  );
}

function SidebarNetworkContextMenu({
  profile,
  connected,
  x,
  y,
  onClose,
  onConnect,
  onDisconnect,
  onEdit,
  onRemove,
  onOpenTerminal,
  onAddFavorite,
}: {
  profile: NetworkProfileDto;
  connected: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onOpenTerminal: () => void;
  onAddFavorite: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    maxHeight?: number;
  } | null>(null);

  useEffect(() => {
    if (!menuRef.current) {
      setPos(null);
      return;
    }
    const el = menuRef.current;
    const pad = 8;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x;
    let top = y;
    let maxHeight: number | undefined;

    if (left + rect.width > vw - pad) {
      left = Math.max(pad, vw - rect.width - pad);
    }

    const availableBelow = vh - top - pad;
    if (rect.height > availableBelow) {
      const availableAbove = top - pad;
      if (availableAbove > availableBelow) {
        top = Math.max(pad, vh - rect.height - pad);
        maxHeight = vh - top - pad;
      } else {
        maxHeight = availableBelow;
      }
    }

    setPos({ left, top, maxHeight });
  }, [x, y]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  const run = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      className="fo-sidebar-menu-backdrop"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        ref={menuRef}
        className="fo-sidebar-context-menu"
        role="menu"
        aria-label={`${profile.label} actions`}
        style={
          pos
            ? { left: pos.left, top: pos.top, maxHeight: pos.maxHeight }
            : { left: x, top: y }
        }
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="fo-context-menu-item"
          role="menuitem"
          onClick={() => run(onOpenTerminal)}
        >
          Open Terminal
        </Button>
        {profile.scheme === "sftp" && connected ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="fo-context-menu-item"
            role="menuitem"
            onClick={() => run(onDisconnect)}
          >
            Disconnect
          </Button>
        ) : profile.scheme === "sftp" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="fo-context-menu-item"
            role="menuitem"
            onClick={() => run(onConnect)}
          >
            Connect
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="fo-context-menu-item"
          role="menuitem"
          onClick={() => run(onEdit)}
        >
          Edit
        </Button>
        {profile.scheme === "sftp" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="fo-context-menu-item"
            role="menuitem"
            onClick={() => run(onAddFavorite)}
          >
            Add to Pinned
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="fo-context-menu-item"
          role="menuitem"
          onClick={() => run(onRemove)}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}

function SidebarSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="fo-sidebar-section">
      <h2 className="fo-sidebar-section-title">{title}</h2>
      {children}
    </section>
  );
}

function SidebarEmptyHint({ children }: { children: ReactNode }) {
  return <p className="fo-sidebar-empty-hint">{children}</p>;
}

function SidebarItem({
  icon,
  label,
  active,
  onClick,
  onContextMenu,
  indented = false,
  subdued = false,
  title,
  badge,
  busy = false,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  indented?: boolean;
  subdued?: boolean;
  title?: string;
  badge?: "warning" | "error" | null;
  busy?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cx(
        "fo-sidebar-item",
        active && "fo-sidebar-active",
        indented && "fo-sidebar-indented",
        subdued && "fo-sidebar-subdued",
        badge === "warning" && "fo-sidebar-warning",
        badge === "error" && "fo-sidebar-error",
        busy && "fo-sidebar-busy",
      )}
      title={title ?? label}
      aria-busy={busy || undefined}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <span className="fo-sidebar-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="fo-sidebar-label">{label}</span>
    </Button>
  );
}

function sidebarSectionTitle(section: string): string {
  if (section === "Devices/Volumes") {
    return "Devices / Volumes";
  }

  return section;
}

function emptySectionHint(section: string): string {
  switch (section) {
    case "Favorites":
      return "No favorite locations";
    case "User folders":
      return "No user folders found";
    case "Devices/Volumes":
      return "No mounted volumes";
    default:
      return "Nothing here yet";
  }
}

function locationIcon(id: string): ReactNode {
  switch (id) {
    case "home":
      return Icons.home();
    case "desktop":
      return Icons.desktop();
    case "documents":
      return Icons.documents();
    case "downloads":
      return Icons.downloads();
    case "pictures":
      return Icons.pictures();
    case "music":
      return Icons.music();
    case "videos":
      return Icons.video();
    default:
      return Icons.volume();
  }
}
