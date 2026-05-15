import type {
  FavoriteEntryDto,
  RecentEntryDto,
  StandardLocationDto,
  StarredEntryDto,
} from "@fileoctopus/ts-api";
import { useState, type MouseEvent, type ReactNode } from "react";

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
      {Object.entries(grouped).map(([section, items]) => (
        <SidebarSection key={section} title={section}>
          {items.map((item) => (
            <SidebarItem
              key={item.uri}
              icon={locationIcon(item.id)}
              label={item.name}
              active={item.uri === activeUri}
              onClick={() => onNavigate(item.uri)}
            />
          ))}
        </SidebarSection>
      ))}

      {favorites.length > 0 ? (
        <SidebarSection title="Pinned">
          {favorites.map((item) => (
            <SidebarItem
              key={item.id}
              icon="★"
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
        <SidebarItem
          icon="◷"
          label="Today"
          active={false}
          onClick={() => undefined}
          subdued
        />
        {recentToday.map((item) => (
          <SidebarItem
            key={item.uri}
            icon="·"
            label={item.label}
            active={item.uri === activeUri}
            onClick={() => onNavigate(item.uri)}
            indented
          />
        ))}
        <SidebarItem
          icon="◷"
          label="This Week"
          active={false}
          onClick={() => undefined}
          subdued
        />
        {recentWeek.map((item) => (
          <SidebarItem
            key={item.uri}
            icon="·"
            label={item.label}
            active={item.uri === activeUri}
            onClick={() => onNavigate(item.uri)}
            indented
          />
        ))}
      </SidebarSection>

      {starred.length > 0 ? (
        <SidebarSection title="Starred">
          {starred.map((item) => (
            <SidebarItem
              key={item.uri}
              icon="☆"
              label={item.label}
              active={item.uri === activeUri}
              onClick={() => onNavigate(item.uri)}
            />
          ))}
        </SidebarSection>
      ) : null}

      {favoriteMenu ? (
        <div className="fo-sidebar-menu" role="menu">
          <button
            type="button"
            onClick={() => {
              const next = globalThis.prompt("Rename favorite", favoriteMenu.label);
              if (next) {
                onRenameFavorite(favoriteMenu.id, next);
              }
              setFavoriteMenu(null);
            }}
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => {
              onRevealFavorite(favoriteMenu.uri);
              setFavoriteMenu(null);
            }}
          >
            Reveal
          </button>
          <button
            type="button"
            onClick={() => {
              onRemoveFavorite(favoriteMenu.id);
              setFavoriteMenu(null);
            }}
          >
            Remove
          </button>
          <button type="button" onClick={() => setFavoriteMenu(null)}>
            Cancel
          </button>
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
    <section>
      <strong>{title}</strong>
      {children}
    </section>
  );
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
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
  onContextMenu?: (event: MouseEvent<HTMLButtonElement>) => void;
  indented?: boolean;
  subdued?: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        active ? "fo-sidebar-active" : "",
        indented ? "fo-sidebar-indented" : "",
        subdued ? "fo-sidebar-subdued" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <span className="fo-sidebar-icon" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

function locationIcon(id: string): string {
  switch (id) {
    case "home":
      return "⌂";
    case "desktop":
      return "▣";
    case "documents":
      return "□";
    case "downloads":
      return "↓";
    case "pictures":
      return "▧";
    case "music":
      return "♫";
    default:
      return "◉";
  }
}
