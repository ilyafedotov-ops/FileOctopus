import type { UserPreferencesDto } from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";

interface SettingsLayoutProps {
  preferences: UserPreferencesDto;
  onChange: (key: string, value: string) => void;
  onCustomizeToolbar?: () => void;
  onClose: () => void;
}

export function SettingsLayout({
  preferences,
  onChange,
  onCustomizeToolbar,
  onClose,
}: SettingsLayoutProps) {
  return (
    <section className="fo-settings-section">
      <h3>Layout</h3>
      <label className="fo-settings-checkbox">
        <input
          type="checkbox"
          checked={preferences.sidebarVisible}
          onChange={(event) =>
            onChange("sidebarVisible", event.target.checked ? "true" : "false")
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
            onChange("toolbarVisible", event.target.checked ? "true" : "false")
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
          onChange={(event) => onChange("paneMode", event.target.value)}
        >
          <option value="dual">Dual pane</option>
          <option value="single">Single pane</option>
        </select>
      </label>
      <label className="fo-settings-field">
        <span>Split direction</span>
        <select
          value={preferences.paneDirection}
          disabled={preferences.paneMode === "single"}
          onChange={(event) => onChange("paneDirection", event.target.value)}
        >
          <option value="horizontal">Horizontal (side by side)</option>
          <option value="vertical">Vertical (stacked)</option>
        </select>
      </label>
      <label className="fo-settings-checkbox">
        <input
          type="checkbox"
          checked={preferences.rememberLastUsedPanes !== false}
          onChange={(event) =>
            onChange(
              "rememberLastUsedPanes",
              event.target.checked ? "true" : "false",
            )
          }
        />
        <span>Remember last used pane paths across sessions</span>
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
  );
}
