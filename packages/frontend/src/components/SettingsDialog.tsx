import type { UserPreferencesDto } from "@fileoctopus/ts-api";

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
          <h2 id="settings-title">Settings</h2>
          <button type="button" className="fo-dialog-close" onClick={onClose}>
            Close
          </button>
        </header>
        <section className="fo-settings-section">
          <h3>Appearance</h3>
          <label>
            Theme
            <select
              value={preferences.theme}
              onChange={(event) => onChange("theme", event.target.value)}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label>
            Density
            <select
              value={preferences.density}
              onChange={(event) => onChange("density", event.target.value)}
            >
              <option value="compact">Compact</option>
              <option value="comfortable">Comfortable</option>
              <option value="spacious">Spacious</option>
            </select>
          </label>
        </section>
        <section className="fo-settings-section">
          <h3>File list</h3>
          <label>
            Default view
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
          <label className="fo-checkbox-label">
            <input
              type="checkbox"
              checked={preferences.showHiddenFiles}
              onChange={(event) =>
                onChange("showHiddenFiles", event.target.checked ? "true" : "false")
              }
            />
            Show hidden files by default
          </label>
        </section>
        <section className="fo-settings-section">
          <h3>Layout</h3>
          <label className="fo-checkbox-label">
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
            Show activity panel
          </label>
        </section>
      </dialog>
    </div>
  );
}
