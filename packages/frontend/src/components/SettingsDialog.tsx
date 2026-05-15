import { useState } from "react";
import type { UserPreferencesDto } from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";
import { useDialogEscape } from "../hooks/useDialogEscape";

type SettingsSection = "general" | "appearance" | "files" | "layout";

interface SettingsDialogProps {
  open: boolean;
  preferences: UserPreferencesDto;
  onClose: () => void;
  onChange: (key: string, value: string) => void;
}

export function SettingsDialog({
  open,
  preferences,
  onClose,
  onChange,
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
                <p>Startup and system preferences will appear here.</p>
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
