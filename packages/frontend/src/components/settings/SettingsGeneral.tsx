import type {
  AutostartStatusDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";

interface SettingsGeneralProps {
  preferences: UserPreferencesDto;
  autostart: AutostartStatusDto | null;
  onChange: (key: string, value: string) => void;
  onSetAutostart: (enabled: boolean) => Promise<void>;
}

export function SettingsGeneral({
  preferences,
  autostart,
  onChange,
  onSetAutostart,
}: SettingsGeneralProps) {
  return (
    <section className="fo-settings-section">
      <h3>General</h3>
      <label className="fo-settings-checkbox">
        <input
          type="checkbox"
          checked={autostart?.enabled === true}
          disabled={!autostart || autostart.supported === false}
          onChange={(event) => void onSetAutostart(event.target.checked)}
        />
        <span>Start automatically at login</span>
      </label>
      {autostart && !autostart.supported && (
        <p className="fo-settings-hint">
          Autostart is not supported on this platform.
        </p>
      )}
      <label className="fo-settings-field">
        <span>Diagnostics export path</span>
        <input
          type="text"
          value={preferences.diagnosticsExportPath}
          onChange={(event) =>
            onChange("diagnosticsExportPath", event.target.value)
          }
          aria-label="Diagnostics export path"
        />
      </label>
    </section>
  );
}
