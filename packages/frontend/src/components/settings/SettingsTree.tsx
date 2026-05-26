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
  return (
    <nav className="fo-settings-nav" aria-label="Settings sections">
      {SETTINGS_TREE.map((item) =>
        renderTreeItem(item, activeCategory, onSelect),
      )}
    </nav>
  );
}
