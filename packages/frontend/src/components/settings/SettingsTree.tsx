import { useState } from "react";
import type { ReactElement } from "react";
import type { SettingsCategory, SettingsTreeItem } from "./types";
import { SETTINGS_TREE } from "./types";

interface SettingsTreeProps {
  activeCategory: SettingsCategory;
  onSelect: (category: SettingsCategory) => void;
}

function renderTreeItem(
  item: SettingsTreeItem,
  activeCategory: SettingsCategory,
  onSelect: (category: SettingsCategory) => void,
): ReactElement {
  const isActive = activeCategory === item.id;
  return (
    <button
      key={item.id}
      type="button"
      className={isActive ? "fo-settings-nav-active" : undefined}
      onClick={() => onSelect(item.id)}
    >
      {item.label}
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
        {filteredItems.map((item) =>
          renderTreeItem(item, activeCategory, onSelect),
        )}
      </nav>
    </div>
  );
}
