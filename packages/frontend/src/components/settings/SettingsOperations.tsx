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
    <section className="fo-settings-section">
      <h3>Operations</h3>
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
    </section>
  );
}
