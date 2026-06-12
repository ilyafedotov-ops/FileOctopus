import type { UserPreferencesDto } from "@fileoctopus/ts-api";

interface SettingsOperationsProps {
  preferences: UserPreferencesDto;
  onChange: (key: string, value: string) => void;
}

export function SettingsOperations({
  preferences,
  onChange,
}: SettingsOperationsProps) {
  return (
    <section
      className="fo-settings-section"
      role="region"
      aria-label="Operations settings"
    >
      <h3>Operations</h3>
      <p className="fo-settings-description">
        Confirmations, trash, and conflict policies.
      </p>
      <label className="fo-settings-checkbox">
        <input
          type="checkbox"
          checked={preferences.confirmDelete}
          onChange={(event) =>
            onChange("confirmDelete", event.target.checked ? "true" : "false")
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
        <span>Show Move to Trash in menus</span>
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
          <option value="fail">Stop and report</option>
          <option value="skip">Skip conflicting items</option>
          <option value="overwrite">Overwrite existing</option>
          <option value="renameNew">Keep both (rename new)</option>
          <option value="renameExisting">Keep both (rename existing)</option>
        </select>
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
          checked={preferences.operationIdleTimeoutSecs > 0}
          onChange={(event) =>
            onChange(
              "operationIdleTimeoutSecs",
              event.target.checked ? "300" : "0",
            )
          }
        />
        <span>Cancel operations stalled with no progress</span>
      </label>
      <label className="fo-settings-field">
        <span>Inactivity timeout (seconds)</span>
        <input
          type="number"
          min={10}
          max={86400}
          value={preferences.operationIdleTimeoutSecs}
          disabled={preferences.operationIdleTimeoutSecs === 0}
          onChange={(event) =>
            onChange("operationIdleTimeoutSecs", event.target.value)
          }
        />
      </label>
    </section>
  );
}
