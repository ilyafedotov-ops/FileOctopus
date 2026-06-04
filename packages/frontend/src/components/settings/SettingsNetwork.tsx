import type {
  NetworkProviderCapabilityDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
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
  providers?: NetworkProviderCapabilityDto[];
}

const DEFAULT_PROVIDERS: NetworkProviderCapabilityDto[] = [
  {
    scheme: "sftp",
    label: "SFTP",
    category: "server",
    defaultPort: 22,
    authKinds: ["password", "privateKey"],
    fileCapable: true,
    terminalCapable: true,
    status: "available",
    missingDependency: null,
    supportedOptions: ["useAgent", "sshConfigHost", "proxyJump"],
  },
  {
    scheme: "ssh",
    label: "SSH",
    category: "server",
    defaultPort: 22,
    authKinds: ["password", "privateKey"],
    fileCapable: false,
    terminalCapable: true,
    status: "available",
    missingDependency: null,
    supportedOptions: ["useAgent", "sshConfigHost", "proxyJump"],
  },
  {
    scheme: "smb",
    label: "SMB / CIFS",
    category: "server",
    defaultPort: 445,
    authKinds: ["password"],
    fileCapable: true,
    terminalCapable: false,
    status: "available",
    missingDependency: null,
    supportedOptions: ["workgroup", "sharePath"],
  },
  {
    scheme: "s3",
    label: "S3",
    category: "server",
    defaultPort: 443,
    authKinds: ["accessKey"],
    fileCapable: true,
    terminalCapable: false,
    status: "available",
    missingDependency: null,
    supportedOptions: ["region", "pathStyle"],
  },
  {
    scheme: "webdav",
    label: "WebDAV",
    category: "server",
    defaultPort: 443,
    authKinds: ["password"],
    fileCapable: false,
    terminalCapable: false,
    status: "unavailable",
    missingDependency: "WebDAV provider is not registered yet.",
    supportedOptions: [],
  },
];

function providerCapabilityLabel(
  provider: NetworkProviderCapabilityDto,
): string {
  if (provider.fileCapable && provider.terminalCapable) {
    return "Files + terminal";
  }
  if (provider.fileCapable) {
    return "Files";
  }
  if (provider.terminalCapable) {
    return "Terminal";
  }
  return "Unavailable";
}

export function SettingsNetwork({
  preferences,
  onChange,
  pickLocalPath = defaultPickLocalPath,
  providers = DEFAULT_PROVIDERS,
}: SettingsNetworkProps) {
  const defaultProtocolProviders = providers.filter(
    (provider) => provider.fileCapable || provider.scheme === "webdav",
  );

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
      <h3>Network &amp; Connections</h3>
      <p className="fo-settings-description">
        Provider availability, connection defaults, SSH keys, and login
        behavior.
      </p>
      <div className="fo-settings-field">
        <span>Provider availability</span>
        <div className="fo-settings-provider-list">
          {providers.map((provider) => (
            <div key={provider.scheme} className="fo-settings-provider-row">
              <strong>{provider.label}</strong>
              <span>{providerCapabilityLabel(provider)}</span>
              <span>
                {provider.status === "available"
                  ? `Port ${provider.defaultPort ?? "-"}`
                  : provider.missingDependency}
              </span>
            </div>
          ))}
        </div>
      </div>
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
        <span>Reconnect attempts</span>
        <input
          type="number"
          aria-label="Reconnect attempts"
          value={preferences.networkAutoReconnect ? 3 : 0}
          min={0}
          max={10}
          onChange={(event) =>
            onChange(
              "networkAutoReconnect",
              Number(event.target.value) > 0 ? "true" : "false",
            )
          }
        />
      </label>
      <label className="fo-settings-field">
        <span>Default protocol</span>
        <select
          aria-label="Default protocol"
          value={preferences.networkDefaultProtocol}
          onChange={(event) =>
            onChange("networkDefaultProtocol", event.target.value)
          }
        >
          {defaultProtocolProviders.map((provider) => (
            <option
              key={provider.scheme}
              value={provider.scheme}
              disabled={
                provider.status !== "available" || !provider.fileCapable
              }
            >
              {provider.label}
            </option>
          ))}
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
      <label className="fo-settings-checkbox">
        <input
          type="checkbox"
          aria-label="Use SSH agent by default"
          checked={preferences.networkUseSshAgent}
          onChange={(event) =>
            onChange(
              "networkUseSshAgent",
              event.target.checked ? "true" : "false",
            )
          }
        />
        <span>Use SSH agent by default</span>
      </label>
      <p className="fo-settings-hint">
        Per-profile SSH agent, ssh_config host, ProxyJump, and keepalive options
        are configured in the connection wizard.
      </p>
    </section>
  );
}
