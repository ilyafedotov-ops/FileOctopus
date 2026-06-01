import type {
  FavoriteEntryDto,
  NetworkConnectionStatusDto,
  NetworkProfileDto,
  RecentEntryDto,
  StandardLocationDto,
  StarredEntryDto,
  VolumeDto,
} from "@fileoctopus/ts-api";
import { Button, cx, Icons } from "@fileoctopus/ui";
import type { SmartFolder } from "../savedSearches";
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

import {
  SidebarContextMenu,
  SidebarNetworkContextMenu,
  SidebarVolumeContextMenu,
  SidebarSmartFolderContextMenu,
} from "./contextMenus";

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

interface SidebarVolumeContextMenuState {
  x: number;
  y: number;
  volume: VolumeDto;
}

interface SidebarSmartFolderContextMenuState {
  x: number;
  y: number;
  folder: SmartFolder;
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
  volumes?: VolumeDto[];
  onEjectVolume?: (mountPoint: string) => void;
  smartFolders?: SmartFolder[];
  onOpenSmartFolder?: (folder: SmartFolder) => void;
  onRemoveSmartFolder?: (id: string) => void;
  onRenameSmartFolder?: (id: string, name: string) => void;
  onSaveSearch?: () => void;
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
  volumes = [],
  onEjectVolume,
  smartFolders = [],
  onOpenSmartFolder,
  onRemoveSmartFolder,
  onRenameSmartFolder,
  onSaveSearch,
}: SidebarProps) {
  const [contextMenu, setContextMenu] =
    useState<SidebarContextMenuState | null>(null);
  const [networkContextMenu, setNetworkContextMenu] =
    useState<SidebarNetworkContextMenuState | null>(null);
  const [volumeContextMenu, setVolumeContextMenu] =
    useState<SidebarVolumeContextMenuState | null>(null);
  const [smartFolderContextMenu, setSmartFolderContextMenu] =
    useState<SidebarSmartFolderContextMenuState | null>(null);
  const [renamingFavoriteId, setRenamingFavoriteId] = useState<number | null>(
    null,
  );
  const [renamingSmartFolderId, setRenamingSmartFolderId] = useState<
    string | null
  >(null);
  const [smartFolderRenameValue, setSmartFolderRenameValue] = useState("");
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

    const browseable =
      profile.scheme === "sftp" ||
      profile.scheme === "smb" ||
      profile.scheme === "s3";
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
          const hasLocal = localItems.length > 0;

          return (
            <SidebarSection key={section} title={sidebarSectionTitle(section)}>
              {!hasLocal ? (
                <SidebarEmptyHint>{emptySectionHint(section)}</SidebarEmptyHint>
              ) : (
                localItems.map((item) => {
                  const vol = volumes.find((v) => v.mountUri === item.uri);
                  const isRemovable = vol?.isRemovable === true;
                  return (
                    <SidebarItem
                      key={item.uri}
                      icon={isRemovable ? Icons.usb() : locationIcon(item.id)}
                      label={item.name}
                      active={item.uri === activeUri}
                      onClick={() => onNavigate(item.uri)}
                      onContextMenu={
                        isRemovable && onEjectVolume
                          ? (event) => {
                              event.preventDefault();
                              if (vol) {
                                setVolumeContextMenu({
                                  x: event.clientX,
                                  y: event.clientY,
                                  volume: vol,
                                });
                              }
                            }
                          : undefined
                      }
                    />
                  );
                })
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
        <SidebarSection
          title="Network"
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onAddServer}
              title="Add server"
              aria-label="Add server"
            >
              {Icons.folderPlus()}
            </Button>
          }
        >
          {networkProfiles.length === 0 ? (
            <SidebarEmptyHint>No saved servers</SidebarEmptyHint>
          ) : (
            networkProfiles.map((profile) => renderNetworkProfileItem(profile))
          )}
          <SidebarItem
            icon={Icons.server()}
            label="Add server…"
            active={false}
            onClick={onAddServer}
          />
        </SidebarSection>
      ) : null}

      {favorites.length > 0 ? (
        <SidebarSection title="Favorites">
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

      <SidebarSection title="Smart Folders">
        {smartFolders.length === 0 && !onSaveSearch ? (
          <SidebarEmptyHint>No saved searches</SidebarEmptyHint>
        ) : (
          <>
            {smartFolders.map((folder) =>
              renamingSmartFolderId === folder.id ? (
                <input
                  key={folder.id}
                  className="fo-sidebar-rename-input"
                  type="text"
                  autoFocus
                  value={smartFolderRenameValue}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setSmartFolderRenameValue(e.target.value)
                  }
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (
                        smartFolderRenameValue.trim() &&
                        onRenameSmartFolder
                      ) {
                        onRenameSmartFolder(
                          folder.id,
                          smartFolderRenameValue.trim(),
                        );
                      }
                      setRenamingSmartFolderId(null);
                      setSmartFolderRenameValue("");
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setRenamingSmartFolderId(null);
                      setSmartFolderRenameValue("");
                    }
                  }}
                  onBlur={() => {
                    if (
                      smartFolderRenameValue.trim() &&
                      onRenameSmartFolder &&
                      renamingSmartFolderId
                    ) {
                      onRenameSmartFolder(
                        renamingSmartFolderId,
                        smartFolderRenameValue.trim(),
                      );
                    }
                    setRenamingSmartFolderId(null);
                    setSmartFolderRenameValue("");
                  }}
                />
              ) : (
                <SidebarItem
                  key={folder.id}
                  icon={Icons.search()}
                  label={folder.name}
                  active={false}
                  onClick={() => onOpenSmartFolder?.(folder)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setSmartFolderContextMenu({
                      x: event.clientX,
                      y: event.clientY,
                      folder,
                    });
                  }}
                />
              ),
            )}
            {onSaveSearch ? (
              <SidebarItem
                icon={Icons.folderPlus()}
                label="Save Search…"
                active={false}
                onClick={onSaveSearch}
              />
            ) : null}
          </>
        )}
      </SidebarSection>

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

      {volumeContextMenu && onEjectVolume ? (
        <SidebarVolumeContextMenu
          volume={volumeContextMenu.volume}
          x={volumeContextMenu.x}
          y={volumeContextMenu.y}
          onClose={() => setVolumeContextMenu(null)}
          onEject={() => {
            const mountUri = volumeContextMenu.volume.mountUri;
            const mountPoint = mountUri.startsWith("local://")
              ? mountUri.slice("local://".length)
              : mountUri;
            onEjectVolume(mountPoint);
            setVolumeContextMenu(null);
          }}
        />
      ) : null}

      {smartFolderContextMenu ? (
        <SidebarSmartFolderContextMenu
          folder={smartFolderContextMenu.folder}
          x={smartFolderContextMenu.x}
          y={smartFolderContextMenu.y}
          onClose={() => setSmartFolderContextMenu(null)}
          onRename={() => {
            setRenamingSmartFolderId(smartFolderContextMenu.folder.id);
            setSmartFolderRenameValue(smartFolderContextMenu.folder.name);
            setSmartFolderContextMenu(null);
          }}
          onRemove={() => {
            onRemoveSmartFolder?.(smartFolderContextMenu.folder.id);
            setSmartFolderContextMenu(null);
          }}
        />
      ) : null}
    </aside>
  );
}

function SidebarSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="fo-sidebar-section">
      <div className="fo-sidebar-section-header">
        <h2 className="fo-sidebar-section-title">{title}</h2>
        {action}
      </div>
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
