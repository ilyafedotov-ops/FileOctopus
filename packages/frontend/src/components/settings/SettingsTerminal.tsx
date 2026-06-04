import { useEffect, useMemo, useState } from "react";
import type {
  TerminalCapabilitiesResponse,
  TerminalClient,
  TerminalProfileDto,
  TerminalProfileInputDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import { PathBrowseField } from "../PathBrowseField";
import {
  pickLocalPath as defaultPickLocalPath,
  type LocalPathPicker,
} from "../../utils/pathPicker";

interface SettingsTerminalProps {
  preferences: UserPreferencesDto;
  onChange: (key: string, value: string) => void;
  pickLocalPath?: LocalPathPicker;
  terminalClient?: Pick<
    TerminalClient,
    | "capabilities"
    | "listProfiles"
    | "addProfile"
    | "updateProfile"
    | "deleteProfile"
    | "setDefaultProfile"
  >;
}

const fallbackCapabilities: TerminalCapabilitiesResponse = {
  defaultShell: "",
  defaultArgs: [],
  discoveredShells: [],
  supportsSsh: false,
  cursorStyles: ["block", "bar", "underline"],
  themeIds: ["system", "dark", "light"],
};

function profileFromPreferences(
  preferences: UserPreferencesDto,
): TerminalProfileDto {
  const now = new Date(0).toISOString();
  return {
    id: "legacy-default",
    name: "Default",
    scope: "local",
    shell: preferences.terminalShell,
    args: preferences.terminalArgs,
    env: "",
    workingDirectoryMode: "currentPane",
    customCwdUri: "",
    networkProfileId: null,
    remoteCwd: "",
    initialCommand: "",
    fontFamily: "monospace",
    fontSize: 13,
    lineHeight: 1.2,
    cursorStyle: "block",
    cursorBlink: true,
    scrollback: 5000,
    themeId: "system",
    themeOverrides: "",
    copyOnSelect: false,
    rightClickAction: "contextMenu",
    pasteConfirmation: true,
    linkHandling: "openExternal",
    sortOrder: 0,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };
}

function toInput(profile: TerminalProfileDto): TerminalProfileInputDto {
  return {
    name: profile.name,
    scope: profile.scope,
    shell: profile.shell,
    args: profile.args,
    env: profile.env,
    workingDirectoryMode: profile.workingDirectoryMode,
    customCwdUri: profile.customCwdUri,
    networkProfileId: profile.networkProfileId ?? null,
    remoteCwd: profile.remoteCwd,
    initialCommand: profile.initialCommand,
    fontFamily: profile.fontFamily,
    fontSize: profile.fontSize,
    lineHeight: profile.lineHeight,
    cursorStyle: profile.cursorStyle,
    cursorBlink: profile.cursorBlink,
    scrollback: profile.scrollback,
    themeId: profile.themeId,
    themeOverrides: profile.themeOverrides,
    copyOnSelect: profile.copyOnSelect,
    rightClickAction: profile.rightClickAction,
    pasteConfirmation: profile.pasteConfirmation,
    linkHandling: profile.linkHandling,
  };
}

export function SettingsTerminal({
  preferences,
  onChange,
  pickLocalPath = defaultPickLocalPath,
  terminalClient,
}: SettingsTerminalProps) {
  const fallbackProfile = useMemo(
    () => profileFromPreferences(preferences),
    [preferences],
  );
  const [capabilities, setCapabilities] =
    useState<TerminalCapabilitiesResponse>(fallbackCapabilities);
  const [profiles, setProfiles] = useState<TerminalProfileDto[]>([
    fallbackProfile,
  ]);
  const [activeProfileId, setActiveProfileId] = useState(fallbackProfile.id);
  const [draft, setDraft] = useState<TerminalProfileInputDto>(
    toInput(fallbackProfile),
  );
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!terminalClient) {
      setProfiles([fallbackProfile]);
      setActiveProfileId(fallbackProfile.id);
      setDraft(toInput(fallbackProfile));
      return;
    }

    let cancelled = false;
    void Promise.all([
      terminalClient.capabilities(),
      terminalClient.listProfiles(),
    ])
      .then(([nextCapabilities, response]) => {
        if (cancelled) {
          return;
        }
        const nextProfiles =
          response.profiles.length > 0 ? response.profiles : [fallbackProfile];
        const active =
          response.defaultProfileId ??
          nextProfiles.find((profile) => profile.isDefault)?.id ??
          nextProfiles[0]?.id ??
          fallbackProfile.id;
        setCapabilities(nextCapabilities);
        setProfiles(nextProfiles);
        setActiveProfileId(active);
        setDraft(
          toInput(
            nextProfiles.find((item) => item.id === active) ?? nextProfiles[0],
          ),
        );
      })
      .catch((error) => {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : String(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fallbackProfile, terminalClient]);

  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];

  const updateDraft = <K extends keyof TerminalProfileInputDto>(
    key: K,
    value: TerminalProfileInputDto[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  async function browseShellProgram() {
    const selected = await pickLocalPath({
      kind: "file",
      currentPath: preferences.terminalShell,
      title: "Choose shell program",
    });
    if (selected) {
      onChange("terminalShell", selected);
    }
  }

  const saveProfile = async () => {
    if (!terminalClient || !activeProfile) {
      setStatus("Terminal profile API is unavailable in this context.");
      return;
    }
    const response =
      activeProfile.id === "new"
        ? await terminalClient.addProfile({ profile: draft })
        : await terminalClient.updateProfile({
            id: activeProfile.id,
            profile: draft,
          });
    setProfiles((current) => {
      const exists = current.some(
        (profile) => profile.id === response.profile.id,
      );
      return exists
        ? current.map((profile) =>
            profile.id === response.profile.id ? response.profile : profile,
          )
        : [
            ...current.filter((profile) => profile.id !== "new"),
            response.profile,
          ];
    });
    setActiveProfileId(response.profile.id);
    setDraft(toInput(response.profile));
    setStatus("Saved.");
  };

  const addProfile = () => {
    const profile: TerminalProfileDto = {
      ...fallbackProfile,
      id: "new",
      name: "New Profile",
      isDefault: false,
      sortOrder: profiles.length,
    };
    setProfiles((current) => [
      ...current.filter((item) => item.id !== "new"),
      profile,
    ]);
    setActiveProfileId(profile.id);
    setDraft(toInput(profile));
    setStatus(null);
  };

  const deleteProfile = async () => {
    if (!terminalClient || !activeProfile || activeProfile.isDefault) {
      return;
    }
    await terminalClient.deleteProfile({ id: activeProfile.id });
    const next = profiles.filter((profile) => profile.id !== activeProfile.id);
    setProfiles(next);
    const replacement = next[0] ?? fallbackProfile;
    setActiveProfileId(replacement.id);
    setDraft(toInput(replacement));
    setStatus("Deleted.");
  };

  const makeDefault = async () => {
    if (!terminalClient || !activeProfile) {
      return;
    }
    const response = await terminalClient.setDefaultProfile({
      id: activeProfile.id,
    });
    setProfiles((current) =>
      current.map((profile) => ({
        ...profile,
        isDefault: profile.id === response.profile.id,
      })),
    );
    setStatus("Default profile updated.");
  };

  return (
    <section
      className="fo-settings-section"
      role="region"
      aria-label="Terminal settings"
    >
      <h3>Terminal</h3>
      <p className="fo-settings-description">
        Profiles, shell startup, appearance, and pane terminal behavior.
      </p>

      <fieldset className="fo-settings-fieldset">
        <legend>Global defaults</legend>
        <PathBrowseField
          className="fo-settings-field"
          label="Shell program"
          value={preferences.terminalShell}
          placeholder="Use OS default"
          browseLabel="Browse shell program"
          onChange={(value) => onChange("terminalShell", value)}
          onBrowse={() => void browseShellProgram()}
        />
        <datalist id="terminal-shells">
          {capabilities.discoveredShells.map((shell) => (
            <option key={shell} value={shell} />
          ))}
        </datalist>
        <label className="fo-settings-field">
          <span>Launch arguments</span>
          <textarea
            value={preferences.terminalArgs}
            placeholder={capabilities.defaultArgs.join("\n") || "-l"}
            rows={3}
            onChange={(event) => onChange("terminalArgs", event.target.value)}
          />
        </label>
      </fieldset>

      <fieldset className="fo-settings-fieldset">
        <legend>Profiles</legend>
        <label className="fo-settings-field">
          <span>Active profile</span>
          <select
            value={activeProfileId}
            onChange={(event) => {
              const next = profiles.find(
                (profile) => profile.id === event.target.value,
              );
              if (!next) {
                return;
              }
              setActiveProfileId(next.id);
              setDraft(toInput(next));
              setStatus(null);
            }}
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
                {profile.isDefault ? " (default)" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="fo-settings-actions">
          <button type="button" onClick={addProfile}>
            New profile
          </button>
          <button
            type="button"
            onClick={() => void makeDefault()}
            disabled={!terminalClient || activeProfile?.isDefault}
          >
            Set default
          </button>
          <button
            type="button"
            onClick={() => void deleteProfile()}
            disabled={!terminalClient || activeProfile?.isDefault}
          >
            Delete
          </button>
        </div>
      </fieldset>

      <fieldset className="fo-settings-fieldset">
        <legend>Launch</legend>
        <label className="fo-settings-field">
          <span>Profile name</span>
          <input
            value={draft.name}
            onChange={(event) => updateDraft("name", event.target.value)}
          />
        </label>
        <label className="fo-settings-field">
          <span>Profile scope</span>
          <select
            value={draft.scope}
            onChange={(event) =>
              updateDraft("scope", event.target.value as "local" | "ssh")
            }
          >
            <option value="local">Local</option>
            <option value="ssh" disabled={!capabilities.supportsSsh}>
              SSH
            </option>
          </select>
        </label>
        <label className="fo-settings-field">
          <span>Profile shell</span>
          <input
            value={draft.shell}
            placeholder={capabilities.defaultShell || "Use OS default"}
            list="terminal-shells"
            onChange={(event) => updateDraft("shell", event.target.value)}
          />
        </label>
        <label className="fo-settings-field">
          <span>Profile arguments</span>
          <textarea
            value={draft.args}
            rows={3}
            onChange={(event) => updateDraft("args", event.target.value)}
          />
        </label>
        <label className="fo-settings-field">
          <span>Environment</span>
          <textarea
            value={draft.env}
            rows={3}
            placeholder="KEY=value"
            onChange={(event) => updateDraft("env", event.target.value)}
          />
        </label>
        <label className="fo-settings-field">
          <span>Initial command</span>
          <input
            value={draft.initialCommand}
            onChange={(event) =>
              updateDraft("initialCommand", event.target.value)
            }
          />
        </label>
        <label className="fo-settings-field">
          <span>Working directory</span>
          <select
            value={draft.workingDirectoryMode}
            onChange={(event) =>
              updateDraft("workingDirectoryMode", event.target.value)
            }
          >
            <option value="currentPane">Current pane</option>
            <option value="home">Home</option>
            <option value="custom">Custom URI</option>
          </select>
        </label>
        <label className="fo-settings-field">
          <span>Custom cwd URI</span>
          <input
            value={draft.customCwdUri}
            placeholder="local:///Users/me/project"
            onChange={(event) =>
              updateDraft("customCwdUri", event.target.value)
            }
          />
        </label>
      </fieldset>

      <fieldset className="fo-settings-fieldset">
        <legend>Appearance</legend>
        <label className="fo-settings-field">
          <span>Font family</span>
          <input
            value={draft.fontFamily}
            onChange={(event) => updateDraft("fontFamily", event.target.value)}
          />
        </label>
        <label className="fo-settings-field">
          <span>Font size</span>
          <input
            type="number"
            min={8}
            max={32}
            value={draft.fontSize}
            onChange={(event) =>
              updateDraft("fontSize", Number(event.target.value))
            }
          />
        </label>
        <label className="fo-settings-field">
          <span>Line height</span>
          <input
            type="number"
            min={1}
            max={2}
            step={0.05}
            value={draft.lineHeight}
            onChange={(event) =>
              updateDraft("lineHeight", Number(event.target.value))
            }
          />
        </label>
        <label className="fo-settings-field">
          <span>Cursor style</span>
          <select
            value={draft.cursorStyle}
            onChange={(event) => updateDraft("cursorStyle", event.target.value)}
          >
            {capabilities.cursorStyles.map((style) => (
              <option key={style} value={style}>
                {style}
              </option>
            ))}
          </select>
        </label>
        <label className="fo-settings-field">
          <span>Theme</span>
          <select
            value={draft.themeId}
            onChange={(event) => updateDraft("themeId", event.target.value)}
          >
            {capabilities.themeIds.map((theme) => (
              <option key={theme} value={theme}>
                {theme}
              </option>
            ))}
          </select>
        </label>
        <label className="fo-settings-field">
          <span>Scrollback</span>
          <input
            type="number"
            min={100}
            max={100000}
            value={draft.scrollback}
            onChange={(event) =>
              updateDraft("scrollback", Number(event.target.value))
            }
          />
        </label>
      </fieldset>

      <fieldset className="fo-settings-fieldset">
        <legend>Behavior</legend>
        <label className="fo-settings-checkbox">
          <input
            type="checkbox"
            checked={preferences.paneTerminalDefaultOpen}
            onChange={(event) =>
              onChange(
                "paneTerminalDefaultOpen",
                event.target.checked ? "true" : "false",
              )
            }
          />
          <span>Open pane terminal expanded when started</span>
        </label>
        <label className="fo-settings-checkbox">
          <input
            type="checkbox"
            checked={preferences.terminalCdOnNavigate}
            onChange={(event) =>
              onChange(
                "terminalCdOnNavigate",
                event.target.checked ? "true" : "false",
              )
            }
          />
          <span>
            Change directory when the file pane navigates (local only)
          </span>
        </label>
        <label className="fo-settings-checkbox">
          <input
            type="checkbox"
            checked={preferences.confirmClosePaneWithTerminal}
            onChange={(event) =>
              onChange(
                "confirmClosePaneWithTerminal",
                event.target.checked ? "true" : "false",
              )
            }
          />
          <span>
            Confirm before hiding a pane with a running embedded terminal
          </span>
        </label>
        <label className="fo-settings-checkbox">
          <input
            type="checkbox"
            checked={draft.cursorBlink}
            onChange={(event) =>
              updateDraft("cursorBlink", event.target.checked)
            }
          />
          <span>Blink cursor</span>
        </label>
        <label className="fo-settings-checkbox">
          <input
            type="checkbox"
            checked={draft.copyOnSelect}
            onChange={(event) =>
              updateDraft("copyOnSelect", event.target.checked)
            }
          />
          <span>Copy on selection</span>
        </label>
        <label className="fo-settings-checkbox">
          <input
            type="checkbox"
            checked={draft.pasteConfirmation}
            onChange={(event) =>
              updateDraft("pasteConfirmation", event.target.checked)
            }
          />
          <span>Confirm multi-line paste</span>
        </label>
      </fieldset>

      <div className="fo-settings-actions">
        <button
          type="button"
          onClick={() => void saveProfile()}
          disabled={!terminalClient}
        >
          Save profile
        </button>
        {status ? <span className="fo-settings-hint">{status}</span> : null}
      </div>
    </section>
  );
}
