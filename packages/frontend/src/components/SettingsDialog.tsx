import { useRef, useState } from "react";
import type {
  AutostartStatusDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import { Button, Icons } from "@fileoctopus/ui";
import { useDialogEscape } from "../hooks/useDialogEscape";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { formatShortcut, shortcutGroups } from "../shortcuts";

type SettingsSection =
  | "general"
  | "appearance"
  | "files"
  | "layout"
  | "terminal"
  | "operations"
  | "diagnostics"
  | "shortcuts";

interface SettingsDialogProps {
  open: boolean;
  preferences: UserPreferencesDto;
  autostart: AutostartStatusDto | null;
  onClose: () => void;
  onChange: (key: string, value: string) => void;
  onSetAutostart: (enabled: boolean) => Promise<void>;
  onCustomizeToolbar?: () => void;
}

export function SettingsDialog({
  open,
  preferences,
  autostart,
  onClose,
  onChange,
  onSetAutostart,
  onCustomizeToolbar,
}: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogEscape(open, onClose);
  useFocusTrap(dialogRef, open);

  const [activeSection, setActiveSection] =
    useState<SettingsSection>("appearance");

  if (!open) {
    return null;
  }

  return (
    <div className="fo-dialog-backdrop" role="presentation" onClick={onClose}>
      <dialog
        ref={dialogRef}
        open
        role="dialog"
        className="fo-dialog fo-settings-dialog"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <div className="fo-dialog-titleblock">
            <span className="fo-dialog-icon" aria-hidden="true">
              {Icons.settings()}
            </span>
            <div>
              <h2 id="settings-title">Settings</h2>
              <p>Preferences for appearance, file lists, and layout.</p>
            </div>
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
            <button
              type="button"
              className={
                activeSection === "terminal"
                  ? "fo-settings-nav-active"
                  : undefined
              }
              onClick={() => setActiveSection("terminal")}
            >
              Terminal
            </button>
            <button
              type="button"
              className={
                activeSection === "operations"
                  ? "fo-settings-nav-active"
                  : undefined
              }
              onClick={() => setActiveSection("operations")}
            >
              Operations
            </button>
            <button
              type="button"
              className={
                activeSection === "diagnostics"
                  ? "fo-settings-nav-active"
                  : undefined
              }
              onClick={() => setActiveSection("diagnostics")}
            >
              Diagnostics
            </button>
            <button
              type="button"
              className={
                activeSection === "shortcuts"
                  ? "fo-settings-nav-active"
                  : undefined
              }
              onClick={() => setActiveSection("shortcuts")}
            >
              Shortcuts
            </button>
          </nav>
          <div className="fo-settings-content">
            {activeSection === "general" && (
              <section className="fo-settings-section">
                <h3>General</h3>
                <label className="fo-settings-checkbox">
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
                <label className="fo-settings-checkbox">
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
                <label className="fo-settings-checkbox">
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
                <label className="fo-settings-checkbox">
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
                <label className="fo-settings-checkbox">
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
                <label className="fo-settings-checkbox">
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
                <label className="fo-settings-checkbox">
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
                <label className="fo-settings-checkbox">
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
                <label className="fo-settings-checkbox">
                  <input
                    type="checkbox"
                    checked={preferences.statusBarVisible !== false}
                    onChange={(event) =>
                      onChange(
                        "statusBarVisible",
                        event.target.checked ? "true" : "false",
                      )
                    }
                  />
                  <span>Show status bar</span>
                </label>
                <label className="fo-settings-checkbox">
                  <input
                    type="checkbox"
                    checked={preferences.toolbarVisible !== false}
                    onChange={(event) =>
                      onChange(
                        "toolbarVisible",
                        event.target.checked ? "true" : "false",
                      )
                    }
                  />
                  <span>Show pane toolbar</span>
                </label>
                {onCustomizeToolbar ? (
                  <div className="fo-settings-field">
                    <Button
                      type="button"
                      size="sm"
                      disabled={preferences.toolbarVisible === false}
                      onClick={() => {
                        onCustomizeToolbar();
                        onClose();
                      }}
                    >
                      Customize button bar…
                    </Button>
                  </div>
                ) : null}
                <label className="fo-settings-field">
                  <span>Pane mode</span>
                  <select
                    value={preferences.paneMode}
                    onChange={(event) =>
                      onChange("paneMode", event.target.value)
                    }
                  >
                    <option value="dual">Dual pane</option>
                    <option value="single">Single pane</option>
                  </select>
                </label>
                <label className="fo-settings-field">
                  <span>Job drawer behavior</span>
                  <select
                    value={preferences.jobDrawerBehavior}
                    onChange={(event) =>
                      onChange("jobDrawerBehavior", event.target.value)
                    }
                  >
                    <option value="manual">Manual</option>
                    <option value="openOnStart">Open when a job starts</option>
                    <option value="openOnError">Open on error</option>
                  </select>
                </label>
              </section>
            )}
            {activeSection === "terminal" && (
              <section
                className="fo-settings-section"
                role="region"
                aria-label="Terminal settings"
              >
                <h3>Terminal</h3>
                <label className="fo-settings-field">
                  <span>Shell program</span>
                  <input
                    value={preferences.terminalShell}
                    placeholder="Use OS default"
                    onChange={(event) =>
                      onChange("terminalShell", event.target.value)
                    }
                  />
                </label>
                <label className="fo-settings-field">
                  <span>Launch arguments</span>
                  <textarea
                    value={preferences.terminalArgs}
                    placeholder="-l"
                    rows={4}
                    onChange={(event) =>
                      onChange("terminalArgs", event.target.value)
                    }
                  />
                </label>
                <p className="fo-settings-hint">
                  Leave shell blank for the OS default. Put one argument per
                  line; leave arguments blank for default shell startup
                  arguments.
                </p>
                <label className="fo-settings-checkbox">
                  <input
                    type="checkbox"
                    checked={preferences.paneTerminalDefaultOpen}
                    onChange={(event) =>
                      onChange(
                        "paneTerminalDefaultOpen",
                        event.target.checked ? "true" : "false",
                      )
                    }
                  />
                  <span>Open pane terminal expanded when started</span>
                </label>
                <label className="fo-settings-checkbox">
                  <input
                    type="checkbox"
                    checked={preferences.terminalCdOnNavigate}
                    onChange={(event) =>
                      onChange(
                        "terminalCdOnNavigate",
                        event.target.checked ? "true" : "false",
                      )
                    }
                  />
                  <span>
                    Change directory when the file pane navigates (local only)
                  </span>
                </label>
                <label className="fo-settings-checkbox">
                  <input
                    type="checkbox"
                    checked={preferences.confirmClosePaneWithTerminal}
                    onChange={(event) =>
                      onChange(
                        "confirmClosePaneWithTerminal",
                        event.target.checked ? "true" : "false",
                      )
                    }
                  />
                  <span>
                    Confirm before hiding a pane with a running embedded
                    terminal
                  </span>
                </label>
                <p className="fo-settings-hint">
                  Pane terminal height is saved when you resize the split inside
                  each file pane.
                </p>
              </section>
            )}
            {activeSection === "operations" && (
              <section
                className="fo-settings-section"
                role="region"
                aria-label="Operations settings"
              >
                <h3>Operations</h3>
                <label className="fo-settings-checkbox">
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
                  <span>Confirm move to trash</span>
                </label>
                <label className="fo-settings-checkbox">
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
                  <span>Confirm permanent delete</span>
                </label>
                <label className="fo-settings-checkbox">
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
                  <span>Confirm before overwriting files</span>
                </label>
                <label className="fo-settings-checkbox">
                  <input
                    type="checkbox"
                    checked={preferences.showAdvancedCopyOptions}
                    onChange={(event) =>
                      onChange(
                        "showAdvancedCopyOptions",
                        event.target.checked ? "true" : "false",
                      )
                    }
                  />
                  <span>Show advanced copy options</span>
                </label>
                <label className="fo-settings-checkbox">
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
                    <option value="fail">Fail without changes</option>
                    <option value="skip">Skip existing destinations</option>
                    <option value="overwrite">Overwrite</option>
                    <option value="renameNew">Rename new items</option>
                    <option value="renameExisting">
                      Rename existing items
                    </option>
                  </select>
                </label>
              </section>
            )}
            {activeSection === "diagnostics" && (
              <section
                className="fo-settings-section"
                role="region"
                aria-label="Diagnostics settings"
              >
                <h3>Diagnostics</h3>
                <p className="fo-settings-hint">
                  Open the Help menu to view diagnostics or export a support
                  bundle.
                </p>
              </section>
            )}
            {activeSection === "shortcuts" && (
              <section
                className="fo-settings-section"
                role="region"
                aria-label="Shortcuts settings"
              >
                <h3>Keyboard Shortcuts</h3>
                <div className="fo-shortcuts-groups">
                  {shortcutGroups.map((group) => (
                    <div key={group.title} className="fo-shortcuts-group">
                      <h4>{group.title}</h4>
                      <table className="fo-shortcuts-table">
                        <tbody>
                          {group.entries.map((entry) => (
                            <tr key={entry.id}>
                              <td>{entry.label}</td>
                              <td>
                                <kbd role="presentation">
                                  {formatShortcut(entry)}
                                </kbd>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
}
