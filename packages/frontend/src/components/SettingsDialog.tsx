import { useState } from "react";
import type {
  AutostartStatusDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";
import { useDialogEscape } from "../hooks/useDialogEscape";

type SettingsSection = "general" | "appearance" | "files" | "layout";

interface SettingsDialogProps {
  open: boolean;
  preferences: UserPreferencesDto;
  autostart: AutostartStatusDto | null;
  onClose: () => void;
  onChange: (key: string, value: string) => void;
  onSetAutostart: (enabled: boolean) => Promise<void>;
}

export function SettingsDialog({
  open,
  preferences,
  autostart,
  onClose,
  onChange,
  onSetAutostart,
}: SettingsDialogProps) {
  useDialogEscape(open, onClose);

  const [activeSection, setActiveSection] =
    useState<SettingsSection>("appearance");

  if (!open) {
    return null;
  }

  return (
    <div className="fo-dialog-backdrop" role="presentation" onClick={onClose}>
      <dialog
        open
        role="dialog"
        className="fo-dialog fo-settings-dialog"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <div>
            <h2 id="settings-title">Settings</h2>
            <p>Preferences for appearance, file lists, and layout.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>
        <div className="fo-settings-layout">
          <nav className="fo-settings-nav" aria-label="Settings sections">
            <button
              type="button"
              className={
                activeSection === "general"
                  ? "fo-settings-nav-active"
                  : undefined
              }
              onClick={() => setActiveSection("general")}
            >
              General
            </button>
            <button
              type="button"
              className={
                activeSection === "appearance"
                  ? "fo-settings-nav-active"
                  : undefined
              }
              onClick={() => setActiveSection("appearance")}
            >
              Appearance
            </button>
            <button
              type="button"
              className={
                activeSection === "files" ? "fo-settings-nav-active" : undefined
              }
              onClick={() => setActiveSection("files")}
            >
              Files &amp; Folders
            </button>
            <button
              type="button"
              className={
                activeSection === "layout"
                  ? "fo-settings-nav-active"
                  : undefined
              }
              onClick={() => setActiveSection("layout")}
            >
              Layout
            </button>
          </nav>
          <div className="fo-settings-content">
            {activeSection === "general" && (
              <section className="fo-settings-section">
                <h3>General</h3>
                <label className="fo-settings-switch">
                  <input
                    type="checkbox"
                    checked={autostart?.enabled === true}
                    disabled={!autostart || autostart.supported === false}
                    onChange={(event) =>
                      void onSetAutostart(event.target.checked)
                    }
                  />
                  <span>Start automatically at login</span>
                </label>
                {autostart && !autostart.supported && (
                  <p className="fo-settings-hint">
                    Autostart is not supported on this platform.
                  </p>
                )}
              </section>
            )}
            {activeSection === "appearance" && (
              <section className="fo-settings-section">
                <h3>Appearance</h3>
                <label className="fo-settings-field">
                  <span>Theme</span>
                  <select
                    value={preferences.theme}
                    onChange={(event) => onChange("theme", event.target.value)}
                  >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>
                <label className="fo-settings-field">
                  <span>Density</span>
                  <select
                    value={preferences.density}
                    onChange={(event) =>
                      onChange("density", event.target.value)
                    }
                  >
                    <option value="compact">Compact</option>
                    <option value="comfortable">Comfortable</option>
                    <option value="spacious">Spacious</option>
                  </select>
                </label>
                <fieldset className="fo-settings-fieldset">
                  <legend>Accent color</legend>
                  <div
                    className="fo-accent-swatches"
                    role="radiogroup"
                    aria-label="Accent color"
                  >
                    {(
                      [
                        ["blue", "Accent blue"],
                        ["indigo", "Accent indigo"],
                        ["violet", "Accent violet"],
                        ["pink", "Accent pink"],
                        ["red", "Accent red"],
                        ["orange", "Accent orange"],
                        ["amber", "Accent amber"],
                        ["green", "Accent green"],
                      ] as const
                    ).map(([color, label]) => (
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
                        <span
                          className="fo-accent-swatch-dot"
                          data-accent={color}
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="fo-settings-fieldset">
                  <legend>Font size</legend>
                  <div
                    className="fo-segmented"
                    role="radiogroup"
                    aria-label="Font size"
                  >
                    {(["small", "medium", "large"] as const).map((scale) => (
                      <label key={scale}>
                        <input
                          type="radio"
                          name="fontScale"
                          value={scale}
                          checked={preferences.fontScale === scale}
                          onChange={() => onChange("fontScale", scale)}
                        />
                        <span>
                          {scale === "small"
                            ? "Small"
                            : scale === "large"
                              ? "Large"
                              : "Medium"}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="fo-settings-fieldset">
                  <legend>Icon size</legend>
                  <div
                    className="fo-segmented"
                    role="radiogroup"
                    aria-label="Icon size"
                  >
                    {(["small", "medium", "large"] as const).map((scale) => (
                      <label key={scale}>
                        <input
                          type="radio"
                          name="iconScale"
                          value={scale}
                          checked={preferences.iconScale === scale}
                          onChange={() => onChange("iconScale", scale)}
                        />
                        <span>
                          {scale === "small"
                            ? "Small"
                            : scale === "large"
                              ? "Large"
                              : "Medium"}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </section>
            )}
            {activeSection === "files" && (
              <section className="fo-settings-section">
                <h3>Files &amp; Folders</h3>
                <label className="fo-settings-field">
                  <span>Default view</span>
                  <select
                    value={preferences.defaultViewMode}
                    onChange={(event) =>
                      onChange("defaultViewMode", event.target.value)
                    }
                  >
                    <option value="details">Details</option>
                    <option value="list">List</option>
                    <option value="icons">Icons</option>
                    <option value="columns">Columns</option>
                  </select>
                </label>
                <label className="fo-settings-switch">
                  <input
                    type="checkbox"
                    checked={preferences.showHiddenFiles}
                    onChange={(event) =>
                      onChange(
                        "showHiddenFiles",
                        event.target.checked ? "true" : "false",
                      )
                    }
                  />
                  <span>Show hidden files by default</span>
                </label>
                <label className="fo-settings-switch">
                  <input
                    type="checkbox"
                    checked={preferences.confirmDelete}
                    onChange={(event) =>
                      onChange(
                        "confirmDelete",
                        event.target.checked ? "true" : "false",
                      )
                    }
                  />
                  <span>Confirm before delete</span>
                </label>
                <label className="fo-settings-switch">
                  <input
                    type="checkbox"
                    checked={preferences.confirmPermanentDelete}
                    onChange={(event) =>
                      onChange(
                        "confirmPermanentDelete",
                        event.target.checked ? "true" : "false",
                      )
                    }
                  />
                  <span>Confirm before permanent delete</span>
                </label>
                <label className="fo-settings-switch">
                  <input
                    type="checkbox"
                    checked={preferences.useTrashByDefault}
                    onChange={(event) =>
                      onChange(
                        "useTrashByDefault",
                        event.target.checked ? "true" : "false",
                      )
                    }
                  />
                  <span>Use trash by default</span>
                </label>
                <label className="fo-settings-switch">
                  <input
                    type="checkbox"
                    checked={preferences.confirmOverwrite}
                    onChange={(event) =>
                      onChange(
                        "confirmOverwrite",
                        event.target.checked ? "true" : "false",
                      )
                    }
                  />
                  <span>Confirm before overwrite</span>
                </label>
                <label className="fo-settings-field">
                  <span>Default conflict policy</span>
                  <select
                    value={preferences.defaultConflictPolicy}
                    onChange={(event) =>
                      onChange("defaultConflictPolicy", event.target.value)
                    }
                  >
                    <option value="fail">Fail</option>
                    <option value="skip">Skip</option>
                    <option value="overwrite">Overwrite</option>
                    <option value="renameNew">Rename New</option>
                    <option value="renameExisting">Rename Existing</option>
                  </select>
                </label>
              </section>
            )}
            {activeSection === "layout" && (
              <section className="fo-settings-section">
                <h3>Layout</h3>
                <label className="fo-settings-switch">
                  <input
                    type="checkbox"
                    checked={preferences.sidebarVisible}
                    onChange={(event) =>
                      onChange(
                        "sidebarVisible",
                        event.target.checked ? "true" : "false",
                      )
                    }
                  />
                  <span>Show sidebar</span>
                </label>
                <label className="fo-settings-switch">
                  <input
                    type="checkbox"
                    checked={preferences.activityPanelVisible}
                    onChange={(event) =>
                      onChange(
                        "activityPanelVisible",
                        event.target.checked ? "true" : "false",
                      )
                    }
                  />
                  <span>Show activity panel</span>
                </label>
              </section>
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
}
