import type { UserPreferencesDto } from "@fileoctopus/ts-api";

interface SettingsAdvancedProps {
  preferences: UserPreferencesDto;
  onChange: (key: string, value: string) => void;
}

export function SettingsAdvanced({
  preferences,
  onChange,
}: SettingsAdvancedProps) {
  return (
    <section
      className="fo-settings-section"
      role="region"
      aria-label="Advanced settings"
    >
      <h3>Advanced</h3>
      <label className="fo-settings-field">
        <span>Log level</span>
        <select
          value={preferences.logLevel}
          onChange={(event) => onChange("logLevel", event.target.value)}
        >
          <option value="error">Error</option>
          <option value="warn">Warn</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </select>
      </label>
      <p className="fo-settings-hint">
        Controls the verbosity of diagnostic log output. Use &ldquo;Debug&rdquo;
        only when troubleshooting issues.
      </p>
      <label className="fo-settings-checkbox">
        <input
          type="checkbox"
          checked={preferences.experimentalFeatures}
          onChange={(event) =>
            onChange(
              "experimentalFeatures",
              event.target.checked ? "true" : "false",
            )
          }
        />
        <span>Enable experimental features</span>
      </label>
      <p className="fo-settings-hint">
        Features under development may be unstable or incomplete.
      </p>
      <label className="fo-settings-field">
        <span>Cache size limit (MB)</span>
        <input
          type="number"
          aria-label="Cache size limit in MB"
          value={preferences.cacheSizeLimit}
          min={16}
          max={4096}
          onChange={(event) => onChange("cacheSizeLimit", event.target.value)}
        />
      </label>
      <p className="fo-settings-hint">
        Maximum disk space for cached thumbnails and metadata. Range: 16–4096
        MB.
      </p>
      <label className="fo-settings-field">
        <span>File operation threads</span>
        <input
          type="number"
          aria-label="File operation thread count"
          value={preferences.fileOperationThreads}
          min={1}
          max={32}
          onChange={(event) =>
            onChange("fileOperationThreads", event.target.value)
          }
        />
      </label>
      <p className="fo-settings-hint">
        Number of parallel threads for file copy, move, and delete operations.
        Range: 1–32.
      </p>
    </section>
  );
}
