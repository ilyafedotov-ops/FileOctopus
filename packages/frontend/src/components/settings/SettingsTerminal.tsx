import type { UserPreferencesDto } from "@fileoctopus/ts-api";

interface SettingsTerminalProps {
  preferences: UserPreferencesDto;
  onChange: (key: string, value: string) => void;
}

export function SettingsTerminal({
  preferences,
  onChange,
}: SettingsTerminalProps) {
  return (
    <section
      className="fo-settings-section"
      role="region"
      aria-label="Terminal settings"
    >
      <h3>Terminal</h3>
      <p className="fo-settings-description">
        Shell program, arguments, and pane terminal behavior.
      </p>
      <label className="fo-settings-field">
        <span>Shell program</span>
        <input
          value={preferences.terminalShell}
          placeholder="Use OS default"
          onChange={(event) => onChange("terminalShell", event.target.value)}
        />
      </label>
      <label className="fo-settings-field">
        <span>Launch arguments</span>
        <textarea
          value={preferences.terminalArgs}
          placeholder="-l"
          rows={4}
          onChange={(event) => onChange("terminalArgs", event.target.value)}
        />
      </label>
      <p className="fo-settings-hint">
        Leave shell blank for the OS default. Put one argument per line; leave
        arguments blank for default shell startup arguments.
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
        <span>Change directory when the file pane navigates (local only)</span>
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
          Confirm before hiding a pane with a running embedded terminal
        </span>
      </label>
      <p className="fo-settings-hint">
        Pane terminal height is saved when you resize the split inside each file
        pane.
      </p>
    </section>
  );
}
