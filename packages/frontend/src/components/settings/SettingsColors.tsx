import { useState } from "react";
import type { UserPreferencesDto } from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";
import {
  DEFAULT_FILE_TYPE_COLORS,
  parseFileTypeColorRules,
  serializeFileTypeColorRules,
  type FileTypeColorRule,
  type FileTypeMatchType,
} from "../../utils/fileTypeColors";

interface SettingsColorsProps {
  preferences: UserPreferencesDto;
  onChange: (key: string, value: string) => void;
}

const ACCENT_COLORS = [
  ["blue", "Accent blue"],
  ["indigo", "Accent indigo"],
  ["violet", "Accent violet"],
  ["pink", "Accent pink"],
  ["red", "Accent red"],
  ["orange", "Accent orange"],
  ["amber", "Accent amber"],
  ["green", "Accent green"],
] as const;

const PRESET_COLORS = [
  "#4ec9b0",
  "#b180d7",
  "#dcdcaa",
  "#ce9178",
  "#f14c4c",
  "#3794ff",
  "#8b95a8",
  "#c586c0",
  "#9cdcfe",
  "#ce9178",
  "#608b4e",
  "#d7ba7d",
];

export function SettingsColors({ preferences, onChange }: SettingsColorsProps) {
  const [rules, setRules] = useState<FileTypeColorRule[]>(() =>
    parseFileTypeColorRules(preferences.fileTypeColorRules),
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSave = () => {
    onChange("fileTypeColorRules", serializeFileTypeColorRules(rules));
  };

  const handleReset = () => {
    setRules(DEFAULT_FILE_TYPE_COLORS);
    onChange(
      "fileTypeColorRules",
      serializeFileTypeColorRules(DEFAULT_FILE_TYPE_COLORS),
    );
  };

  const handleAddRule = () => {
    const newRule: FileTypeColorRule = {
      id: `rule-${Date.now()}`,
      name: "New Rule",
      pattern: "",
      matchType: "extension",
      color: "#3794ff",
      enabled: true,
    };
    setRules([...rules, newRule]);
    setEditingId(newRule.id);
  };

  const handleUpdateRule = (
    id: string,
    updates: Partial<FileTypeColorRule>,
  ) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const handleDeleteRule = (id: string) => {
    setRules(rules.filter((r) => r.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const handleMoveRule = (id: string, direction: "up" | "down") => {
    const index = rules.findIndex((r) => r.id === id);
    if (index === -1) return;
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= rules.length) return;
    const newRules = [...rules];
    [newRules[index], newRules[newIndex]] = [
      newRules[newIndex],
      newRules[index],
    ];
    setRules(newRules);
  };

  return (
    <section className="fo-settings-section">
      <h3>Colors</h3>
      <fieldset className="fo-settings-fieldset">
        <legend>Accent color</legend>
        <div
          className="fo-accent-swatches"
          role="radiogroup"
          aria-label="Accent color"
        >
          {ACCENT_COLORS.map(([color, label]) => (
            <label
              key={color}
              className={
                "fo-accent-swatch" +
                (preferences.accentColor === color
                  ? " fo-accent-swatch-active"
                  : "")
              }
              title={label}
            >
              <input
                type="radio"
                name="accentColor"
                value={color}
                aria-label={label}
                checked={preferences.accentColor === color}
                onChange={() => onChange("accentColor", color)}
              />
              <span className="fo-accent-swatch-dot" data-accent={color} />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="fo-settings-field">
        <span>File type color rules</span>
        <p className="fo-settings-hint">
          Define color rules for file types. Rules are matched in order; the
          first matching rule wins.
        </p>
      </div>

      <div className="fo-file-type-rules">
        {rules.map((rule, index) => (
          <div key={rule.id} className="fo-file-type-rule">
            <div className="fo-file-type-rule-header">
              <label className="fo-settings-checkbox">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(e) =>
                    handleUpdateRule(rule.id, { enabled: e.target.checked })
                  }
                />
                <span>{rule.name}</span>
              </label>
              <div className="fo-file-type-rule-actions">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={index === 0}
                  onClick={() => handleMoveRule(rule.id, "up")}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={index === rules.length - 1}
                  onClick={() => handleMoveRule(rule.id, "down")}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setEditingId(editingId === rule.id ? null : rule.id)
                  }
                >
                  {editingId === rule.id ? "Collapse" : "Edit"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteRule(rule.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
            {editingId === rule.id && (
              <div className="fo-file-type-rule-editor">
                <label className="fo-settings-field">
                  <span>Name</span>
                  <input
                    type="text"
                    value={rule.name}
                    onChange={(e) =>
                      handleUpdateRule(rule.id, { name: e.target.value })
                    }
                  />
                </label>
                <label className="fo-settings-field">
                  <span>Match type</span>
                  <select
                    value={rule.matchType}
                    onChange={(e) =>
                      handleUpdateRule(rule.id, {
                        matchType: e.target.value as FileTypeMatchType,
                      })
                    }
                  >
                    <option value="extension">Extension</option>
                    <option value="name">Name pattern</option>
                    <option value="pattern">Regex pattern</option>
                  </select>
                </label>
                <label className="fo-settings-field">
                  <span>
                    {rule.matchType === "extension"
                      ? "Extensions (comma-separated)"
                      : rule.matchType === "name"
                        ? "Name patterns (comma-separated, * wildcard)"
                        : "Regex pattern"}
                  </span>
                  <input
                    type="text"
                    value={rule.pattern}
                    onChange={(e) =>
                      handleUpdateRule(rule.id, { pattern: e.target.value })
                    }
                    placeholder={
                      rule.matchType === "extension"
                        ? "jpg,png,gif"
                        : rule.matchType === "name"
                          ? "*.txt,README-*"
                          : "\\.test\\.(ts|js)$"
                    }
                  />
                </label>
                <label className="fo-settings-field">
                  <span>Color</span>
                  <div className="fo-file-type-color-picker">
                    <input
                      type="color"
                      value={rule.color}
                      onChange={(e) =>
                        handleUpdateRule(rule.id, { color: e.target.value })
                      }
                    />
                    <div className="fo-file-type-color-presets">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={
                            "fo-file-type-color-preset" +
                            (rule.color === color
                              ? " fo-file-type-color-preset-active"
                              : "")
                          }
                          style={{ backgroundColor: color }}
                          onClick={() => handleUpdateRule(rule.id, { color })}
                          aria-label={`Color ${color}`}
                        />
                      ))}
                    </div>
                  </div>
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="fo-settings-field">
        <div style={{ display: "flex", gap: "8px" }}>
          <Button type="button" size="sm" onClick={handleAddRule}>
            Add rule
          </Button>
          <Button type="button" size="sm" onClick={handleSave}>
            Save changes
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={handleReset}>
            Reset to defaults
          </Button>
        </div>
      </div>
    </section>
  );
}
