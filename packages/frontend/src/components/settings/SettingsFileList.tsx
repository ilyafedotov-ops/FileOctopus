import { useState } from "react";
import type { UserPreferencesDto } from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";
import {
  DEFAULT_COLUMN_PRESETS,
  parseColumnPresets,
  serializeColumnPresets,
  type ColumnPreset,
} from "../../utils/columnPresets";

interface SettingsFileListProps {
  preferences: UserPreferencesDto;
  onChange: (key: string, value: string) => void;
}

export function SettingsFileList({
  preferences,
  onChange,
}: SettingsFileListProps) {
  const [presets, setPresets] = useState<ColumnPreset[]>(() =>
    parseColumnPresets(preferences.columnPresets),
  );

  const handleDeletePreset = (id: string) => {
    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated);
    onChange("columnPresets", serializeColumnPresets(updated));
  };

  const handleResetPresets = () => {
    setPresets(DEFAULT_COLUMN_PRESETS);
    onChange("columnPresets", serializeColumnPresets(DEFAULT_COLUMN_PRESETS));
  };

  return (
    <section className="fo-settings-section">
      <h3>File List</h3>
      <label className="fo-settings-field">
        <span>Default view</span>
        <select
          value={preferences.defaultViewMode}
          onChange={(event) => onChange("defaultViewMode", event.target.value)}
        >
          <option value="details">Details</option>
          <option value="list">List</option>
          <option value="icons">Icons</option>
          <option value="columns">Columns</option>
        </select>
      </label>
      <label className="fo-settings-checkbox">
        <input
          type="checkbox"
          checked={preferences.showHiddenFiles}
          onChange={(event) =>
            onChange("showHiddenFiles", event.target.checked ? "true" : "false")
          }
        />
        <span>Show hidden files by default</span>
      </label>

      <div className="fo-settings-field">
        <span>Column presets</span>
        <p className="fo-settings-hint">
          Column presets define which columns are visible and their widths.
          Apply a preset from the column header context menu in the file list.
        </p>
      </div>

      {presets.length > 0 && (
        <div className="fo-column-presets-list">
          {presets.map((preset) => (
            <div key={preset.id} className="fo-column-preset-item">
              <div className="fo-column-preset-info">
                <strong>{preset.name}</strong>
                <span className="fo-column-preset-columns">
                  {preset.visibleColumns.join(", ")}
                </span>
              </div>
              <div className="fo-column-preset-actions">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeletePreset(preset.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="fo-settings-field">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleResetPresets}
        >
          Reset to default presets
        </Button>
      </div>
    </section>
  );
}
