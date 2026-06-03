import type { UserPreferencesDto } from "@fileoctopus/ts-api";
import { PathBrowseField } from "../PathBrowseField";
import {
  pickLocalPath as defaultPickLocalPath,
  SSH_KEY_FILTERS,
  type LocalPathPicker,
} from "../../utils/pathPicker";

interface SettingsNetworkProps {
  preferences: UserPreferencesDto;
  onChange: (key: string, value: string) => void;
  pickLocalPath?: LocalPathPicker;
}

export function SettingsNetwork({
  preferences,
  onChange,
  pickLocalPath = defaultPickLocalPath,
}: SettingsNetworkProps) {
  async function browseSshKeyPath() {
    const selected = await pickLocalPath({
      kind: "file",
      currentPath: preferences.networkSshKeyPath ?? "",
      title: "Choose default SSH key",
      filters: SSH_KEY_FILTERS,
    });
    if (selected) {
      onChange("networkSshKeyPath", selected);
    }
  }

  return (
    <section
      className="fo-settings-section"
      role="region"
      aria-label="Network settings"
    >
      <h3>Network</h3>
      <p className="fo-settings-description">
        Connection timeout, auto-reconnect, and SSH keys.
      </p>
      <label className="fo-settings-field">
        <span>Connection timeout (seconds)</span>
        <input
          type="number"
          aria-label="Connection timeout in seconds"
          value={preferences.networkConnectionTimeout}
          min={5}
          max={300}
          onChange={(event) =>
            onChange("networkConnectionTimeout", event.target.value)
          }
        />
      </label>
      <p className="fo-settings-hint">
        Default timeout for establishing network connections. Range: 5–300
        seconds.
      </p>
      <label className="fo-settings-checkbox">
        <input
          type="checkbox"
          aria-label="Auto-reconnect on disconnect"
          checked={preferences.networkAutoReconnect}
          onChange={(event) =>
            onChange(
              "networkAutoReconnect",
              event.target.checked ? "true" : "false",
            )
          }
        />
        <span>Auto-reconnect on disconnect</span>
      </label>
      <p className="fo-settings-hint">
        Automatically attempt to reconnect when a network connection drops.
      </p>
      <label className="fo-settings-field">
        <span>Default protocol</span>
        <select
          aria-label="Default protocol"
          value={preferences.networkDefaultProtocol}
          onChange={(event) =>
            onChange("networkDefaultProtocol", event.target.value)
          }
        >
          <option value="sftp">SFTP</option>
          <option value="smb">SMB</option>
          <option value="s3">S3</option>
          <option value="webdav">WebDAV</option>
        </select>
      </label>
      <p className="fo-settings-hint">
        Default protocol when creating new network connections.
      </p>
      <PathBrowseField
        className="fo-settings-field"
        label="Default SSH key path"
        value={preferences.networkSshKeyPath ?? ""}
        placeholder="~/.ssh/id_rsa"
        browseLabel="Browse default SSH key path"
        onChange={(value) => onChange("networkSshKeyPath", value)}
        onBrowse={() => void browseSshKeyPath()}
      />
      <p className="fo-settings-hint">
        Default path to the SSH private key for SFTP and SSH connections.
      </p>
    </section>
  );
}
