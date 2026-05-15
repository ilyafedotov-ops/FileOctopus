import type {
  FavoriteEntryDto,
  RecentEntryDto,
  StandardLocationDto,
  StarredEntryDto,
} from "@fileoctopus/ts-api";
import { Button, cx, Icons } from "@fileoctopus/ui";
import { useState, type MouseEvent, type ReactNode } from "react";

const STANDARD_SECTION_ORDER = [
  "Favorites",
  "User folders",
  "Devices/Volumes",
] as const;

interface SidebarProps {
  locations: StandardLocationDto[];
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
}

export function Sidebar({
  locations,
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
}: SidebarProps) {
  const [favoriteMenu, setFavoriteMenu] = useState<FavoriteEntryDto | null>(null);
  const grouped = locations.reduce<Record<string, StandardLocationDto[]>>(
    (groups, location) => ({
      ...groups,
      [location.section]: [...(groups[location.section] ?? []), location],
    }),
    {},
  );

  return (
    <aside
      className="fo-sidebar"
      aria-label="Standard locations"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("application/x-fileoctopus-uri")) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        const uri = event.dataTransfer.getData("application/x-fileoctopus-uri");
        const label = event.dataTransfer.getData("application/x-fileoctopus-name");
        if (uri) {
          event.preventDefault();
          onAddFavorite(uri, label || uri);
        }
      }}
    >
      {STANDARD_SECTION_ORDER.map((section) => {
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

      {favorites.length > 0 ? (
        <SidebarSection title="Pinned">
          {favorites.map((item) => (
            <SidebarItem
              key={item.id}
              icon={Icons.pin()}
              label={item.label}
              active={item.uri === activeUri}
              onClick={() => onNavigate(item.uri)}
              onContextMenu={(event) => {
                event.preventDefault();
                setFavoriteMenu(item);
              }}
            />
          ))}
        </SidebarSection>
      ) : null}

      <SidebarSection title="Recent">
        <SidebarGroupLabel>Today</SidebarGroupLabel>
        {recentToday.length === 0 ? (
          <SidebarEmptyHint>No folders visited today</SidebarEmptyHint>
        ) : (
          recentToday.map((item) => (
            <SidebarItem
              key={item.uri}
              icon={Icons.recent()}
              label={item.label}
              active={item.uri === activeUri}
              onClick={() => onNavigate(item.uri)}
              indented
              subdued
            />
          ))
        )}
        <SidebarGroupLabel>This week</SidebarGroupLabel>
        {recentWeek.length === 0 ? (
          <SidebarEmptyHint>No other recent folders</SidebarEmptyHint>
        ) : (
          recentWeek.map((item) => (
            <SidebarItem
              key={item.uri}
              icon={Icons.recent()}
              label={item.label}
              active={item.uri === activeUri}
              onClick={() => onNavigate(item.uri)}
              indented
              subdued
            />
          ))
        )}
      </SidebarSection>

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

      {favoriteMenu ? (
        <div className="fo-sidebar-menu" role="menu">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const next = globalThis.prompt("Rename favorite", favoriteMenu.label);
              if (next) {
                onRenameFavorite(favoriteMenu.id, next);
              }
              setFavoriteMenu(null);
            }}
          >
            Rename
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onRevealFavorite(favoriteMenu.uri);
              setFavoriteMenu(null);
            }}
          >
            Reveal
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onRemoveFavorite(favoriteMenu.id);
              setFavoriteMenu(null);
            }}
          >
            Remove
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setFavoriteMenu(null)}>
            Cancel
          </Button>
        </div>
      ) : null}
    </aside>
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

function SidebarGroupLabel({ children }: { children: ReactNode }) {
  return <div className="fo-sidebar-group-label">{children}</div>;
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
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  onContextMenu?: (event: MouseEvent<HTMLButtonElement>) => void;
  indented?: boolean;
  subdued?: boolean;
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
      )}
      title={label}
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
    default:
      return Icons.volume();
  }
}
