import type { UserPreferencesDto } from "@fileoctopus/ts-api";
import { selectableThemes } from "../../themeRegistry";
import { SettingsPreview } from "./SettingsPreview";

interface SettingsDisplayProps {
  preferences: UserPreferencesDto;
  onChange: (key: string, value: string) => void;
}

export function SettingsDisplay({
  preferences,
  onChange,
}: SettingsDisplayProps) {
  return (
    <section
      className="fo-settings-section"
      role="region"
      aria-label="Display settings"
    >
      <h3>Display</h3>
      <p className="fo-settings-description">
        Theme, density, font size, and icon size.
      </p>
      <SettingsPreview caption="Preview" />
      <label className="fo-settings-field">
        <span>Theme</span>
        <select
          value={preferences.theme}
          onChange={(event) => onChange("theme", event.target.value)}
        >
          {selectableThemes().map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.label}
            </option>
          ))}
        </select>
      </label>
      <label className="fo-settings-field">
        <span>Density</span>
        <select
          value={preferences.density}
          onChange={(event) => onChange("density", event.target.value)}
        >
          <option value="compact">Compact</option>
          <option value="comfortable">Comfortable</option>
          <option value="spacious">Spacious</option>
        </select>
      </label>
      <fieldset className="fo-settings-fieldset">
        <legend>Font size</legend>
        <div className="fo-segmented" role="radiogroup" aria-label="Font size">
          {(["small", "medium", "large"] as const).map((scale) => (
            <label key={scale}>
              <input
                type="radio"
                name="fontScale"
                value={scale}
                checked={preferences.fontScale === scale}
                onChange={() => onChange("fontScale", scale)}
              />
              <span>
                {scale === "small"
                  ? "Small"
                  : scale === "large"
                    ? "Large"
                    : "Medium"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="fo-settings-fieldset">
        <legend>Icon size</legend>
        <div className="fo-segmented" role="radiogroup" aria-label="Icon size">
          {(["small", "medium", "large"] as const).map((scale) => (
            <label key={scale}>
              <input
                type="radio"
                name="iconScale"
                value={scale}
                checked={preferences.iconScale === scale}
                onChange={() => onChange("iconScale", scale)}
              />
              <span>
                {scale === "small"
                  ? "Small"
                  : scale === "large"
                    ? "Large"
                    : "Medium"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
