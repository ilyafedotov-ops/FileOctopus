import { useState, useRef } from "react";
import type { UserPreferencesDto } from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";
import {
  captureCurrentProfile,
  applyLayoutProfile,
  exportProfile,
  importProfile,
  parseLayoutProfiles,
  serializeLayoutProfiles,
  type LayoutProfile,
} from "../../utils/layoutProfiles";

interface SettingsLayoutProfilesProps {
  preferences: UserPreferencesDto;
  onChange: (key: string, value: string) => void;
}

export function SettingsLayoutProfiles({
  preferences,
  onChange,
}: SettingsLayoutProfilesProps) {
  const [profiles, setProfiles] = useState<LayoutProfile[]>(() =>
    parseLayoutProfiles(preferences.layoutProfiles),
  );
  const [newProfileName, setNewProfileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveProfile = () => {
    const name = newProfileName.trim();
    if (!name) return;
    const profile = captureCurrentProfile(preferences, name);
    const updated = [...profiles, profile];
    setProfiles(updated);
    onChange("layoutProfiles", serializeLayoutProfiles(updated));
    setNewProfileName("");
  };

  const handleApplyProfile = (profile: LayoutProfile) => {
    applyLayoutProfile(profile, (key, value) => onChange(key, value));
  };

  const handleDeleteProfile = (id: string) => {
    const updated = profiles.filter((p) => p.id !== id);
    setProfiles(updated);
    onChange("layoutProfiles", serializeLayoutProfiles(updated));
  };

  const handleExportProfile = (profile: LayoutProfile) => {
    const json = exportProfile(profile);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${profile.name.replace(/[^a-z0-9]/gi, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const json = e.target?.result as string;
      const profile = importProfile(json);
      if (profile) {
        const updated = [...profiles, profile];
        setProfiles(updated);
        onChange("layoutProfiles", serializeLayoutProfiles(updated));
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  return (
    <section className="fo-settings-section">
      <h3>Layout Profiles</h3>
      <div className="fo-settings-field">
        <span>Save and restore layout configurations</span>
        <p className="fo-settings-hint">
          Layout profiles capture sidebar width, split ratio, pane mode, toolbar
          customization, theme, density, and other layout settings.
        </p>
      </div>

      <div className="fo-settings-field">
        <span>Save current layout</span>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Profile name"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveProfile();
            }}
            style={{ flex: 1 }}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleSaveProfile}
            disabled={!newProfileName.trim()}
          >
            Save
          </Button>
        </div>
      </div>

      {profiles.length > 0 && (
        <div className="fo-layout-profiles-list">
          {profiles.map((profile) => (
            <div key={profile.id} className="fo-layout-profile-item">
              <div className="fo-layout-profile-info">
                <strong>{profile.name}</strong>
                <span className="fo-layout-profile-date">
                  {new Date(profile.createdAt).toLocaleDateString()}{" "}
                  {new Date(profile.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <div className="fo-layout-profile-actions">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleApplyProfile(profile)}
                >
                  Apply
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleExportProfile(profile)}
                >
                  Export
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteProfile(profile.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="fo-settings-field">
        <div style={{ display: "flex", gap: "8px" }}>
          <Button type="button" size="sm" onClick={handleImportClick}>
            Import profile…
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={handleImportFile}
          />
        </div>
      </div>
    </section>
  );
}
