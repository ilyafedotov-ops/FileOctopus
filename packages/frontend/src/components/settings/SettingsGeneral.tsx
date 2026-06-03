import type {
  AutostartStatusDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import { PathBrowseField } from "../PathBrowseField";
import {
  pickLocalPath as defaultPickLocalPath,
  type LocalPathPicker,
} from "../../utils/pathPicker";

interface SettingsGeneralProps {
  preferences: UserPreferencesDto;
  autostart: AutostartStatusDto | null;
  onChange: (key: string, value: string) => void;
  onSetAutostart: (enabled: boolean) => Promise<void>;
  pickLocalPath?: LocalPathPicker;
}

export function SettingsGeneral({
  preferences,
  autostart,
  onChange,
  onSetAutostart,
  pickLocalPath = defaultPickLocalPath,
}: SettingsGeneralProps) {
  async function browseDiagnosticsPath() {
    const selected = await pickLocalPath({
      kind: "save",
      currentPath: preferences.diagnosticsExportPath,
      title: "Choose diagnostics export path",
    });
    if (selected) {
      onChange("diagnosticsExportPath", selected);
    }
  }

  return (
    <section
      className="fo-settings-section"
      role="region"
      aria-label="General settings"
    >
      <h3>General</h3>
      <p className="fo-settings-description">
        Startup behavior, autostart, and diagnostics.
      </p>
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
      <PathBrowseField
        className="fo-settings-field"
        label="Diagnostics export path"
        value={preferences.diagnosticsExportPath}
        browseLabel="Browse diagnostics export path"
        onChange={(value) => onChange("diagnosticsExportPath", value)}
        onBrowse={() => void browseDiagnosticsPath()}
      />
    </section>
  );
}
