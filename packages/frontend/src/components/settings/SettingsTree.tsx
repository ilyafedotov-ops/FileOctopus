import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Icons } from "@fileoctopus/ui";
import type { SettingsCategory, SettingsTreeItem } from "./types";
import { SETTINGS_TREE } from "./types";

interface SettingsTreeProps {
  activeCategory: SettingsCategory;
  onSelect: (category: SettingsCategory) => void;
}

const CATEGORY_ICONS: Record<SettingsCategory, () => ReactNode> = {
  general: Icons.settings,
  display: Icons.monitor,
  colors: Icons.sun,
  layout: Icons.maximize,
  "layout-profiles": Icons.copy,
  "file-list": Icons.documents,
  operations: Icons.refresh,
  terminal: Icons.terminal,
  keyboard: Icons.hash,
  advanced: Icons.more,
  network: Icons.server,
  editor: Icons.pencil,
  viewer: Icons.pictures,
  plugins: Icons.archive,
};

/**
 * Wrap the matched substring of `text` in a `<mark>` so the active search term
 * is highlighted in the navigation labels. Falls back to the plain string when
 * there is no active filter or no match.
 */
function highlightMatch(text: string, filter: string): ReactNode {
  if (!filter) return text;
  const index = text.toLowerCase().indexOf(filter);
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="fo-settings-nav-match">
        {text.slice(index, index + filter.length)}
      </mark>
      {text.slice(index + filter.length)}
    </>
  );
}

function renderTreeItem(
  item: SettingsTreeItem,
  activeCategory: SettingsCategory,
  filter: string,
  onSelect: (category: SettingsCategory) => void,
): ReactElement {
  const isActive = activeCategory === item.id;
  const icon = CATEGORY_ICONS[item.id];
  return (
    <button
      key={item.id}
      type="button"
      className={isActive ? "fo-settings-nav-active" : undefined}
      data-active={isActive ? "true" : undefined}
      onClick={() => onSelect(item.id)}
    >
      {icon ? (
        <span className="fo-settings-nav-icon" aria-hidden="true">
          {icon()}
        </span>
      ) : null}
      <span className="fo-settings-nav-label">
        {highlightMatch(item.label, filter)}
      </span>
    </button>
  );
}

export function SettingsTree({ activeCategory, onSelect }: SettingsTreeProps) {
  const [filter, setFilter] = useState("");

  const normalizedFilter = filter.toLowerCase().trim();
  const filteredItems = normalizedFilter
    ? SETTINGS_TREE.filter(
        (item) =>
          item.label.toLowerCase().indexOf(normalizedFilter) !== -1 ||
          item.description.toLowerCase().indexOf(normalizedFilter) !== -1 ||
          item.id.toLowerCase().indexOf(normalizedFilter) !== -1,
      )
    : SETTINGS_TREE;

  return (
    <div className="fo-settings-nav-wrapper">
      <div className="fo-settings-search">
        <input
          type="text"
          placeholder="Search settings…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Search settings"
        />
      </div>
      <nav className="fo-settings-nav" aria-label="Settings sections">
        {filteredItems.length > 0 ? (
          filteredItems.map((item) =>
            renderTreeItem(item, activeCategory, normalizedFilter, onSelect),
          )
        ) : (
          <p className="fo-settings-nav-empty">No matching settings.</p>
        )}
      </nav>
    </div>
  );
}
