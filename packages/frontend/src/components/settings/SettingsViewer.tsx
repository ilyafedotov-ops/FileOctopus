import type { UserPreferencesDto } from "@fileoctopus/ts-api";

interface SettingsViewerProps {
  preferences: UserPreferencesDto;
  onChange: (key: string, value: string) => void;
}

export function SettingsViewer({ preferences, onChange }: SettingsViewerProps) {
  return (
    <section
      className="fo-settings-section"
      role="region"
      aria-label="Viewer settings"
    >
      <h3>Viewer</h3>
      <label className="fo-settings-field">
        <span>Default view mode</span>
        <select
          aria-label="Default view mode"
          value={preferences.viewerDefaultViewMode}
          onChange={(event) =>
            onChange("viewerDefaultViewMode", event.target.value)
          }
        >
          <option value="text">Text</option>
          <option value="hex">Hex</option>
        </select>
      </label>
      <p className="fo-settings-hint">
        Default view mode when opening files in the built-in viewer (F3).
      </p>
      <label className="fo-settings-field">
        <span>Image zoom behavior</span>
        <select
          aria-label="Image zoom behavior"
          value={preferences.viewerImageZoom}
          onChange={(event) => onChange("viewerImageZoom", event.target.value)}
        >
          <option value="fit">Fit to window</option>
          <option value="fill">Fill window</option>
          <option value="actual">Actual size (100%)</option>
        </select>
      </label>
      <p className="fo-settings-hint">
        Default zoom behavior when previewing image files.
      </p>
      <label className="fo-settings-checkbox">
        <input
          type="checkbox"
          aria-label="Media autoplay"
          checked={preferences.viewerMediaAutoplay}
          onChange={(event) =>
            onChange(
              "viewerMediaAutoplay",
              event.target.checked ? "true" : "false",
            )
          }
        />
        <span>Media autoplay</span>
      </label>
      <p className="fo-settings-hint">
        Automatically play audio and video files when opened in the viewer.
      </p>
      <label className="fo-settings-field">
        <span>Max preview file size (MB)</span>
        <input
          type="number"
          aria-label="Max preview file size in MB"
          value={preferences.viewerMaxPreviewSize}
          min={1}
          max={1024}
          onChange={(event) =>
            onChange("viewerMaxPreviewSize", event.target.value)
          }
        />
      </label>
      <p className="fo-settings-hint">
        Maximum file size for inline preview. Files larger than this will show
        metadata only. Range: 1–1024 MB.
      </p>
    </section>
  );
}
