import type { UserPreferencesDto } from "@fileoctopus/ts-api";

interface SettingsEditorProps {
  preferences: UserPreferencesDto;
  onChange: (key: string, value: string) => void;
}

export function SettingsEditor({ preferences, onChange }: SettingsEditorProps) {
  return (
    <section
      className="fo-settings-section"
      role="region"
      aria-label="Editor settings"
    >
      <h3>Editor</h3>
      <p className="fo-settings-description">
        Font, tabs, word wrap, and syntax highlighting.
      </p>
      <label className="fo-settings-field">
        <span>Font family</span>
        <input
          type="text"
          aria-label="Font family"
          value={preferences.editorFontFamily}
          placeholder="monospace"
          onChange={(event) => onChange("editorFontFamily", event.target.value)}
        />
      </label>
      <p className="fo-settings-hint">
        Font family used in the built-in text editor (F4).
      </p>
      <label className="fo-settings-field">
        <span>Font size</span>
        <input
          type="number"
          aria-label="Font size"
          value={preferences.editorFontSize}
          min={8}
          max={72}
          onChange={(event) => onChange("editorFontSize", event.target.value)}
        />
      </label>
      <p className="fo-settings-hint">
        Font size in pixels for the built-in editor. Range: 8–72.
      </p>
      <label className="fo-settings-field">
        <span>Tab size</span>
        <input
          type="number"
          aria-label="Tab size"
          value={preferences.editorTabSize}
          min={1}
          max={16}
          onChange={(event) => onChange("editorTabSize", event.target.value)}
        />
      </label>
      <p className="fo-settings-hint">Number of spaces per tab. Range: 1–16.</p>
      <label className="fo-settings-checkbox">
        <input
          type="checkbox"
          aria-label="Word wrap"
          checked={preferences.editorWordWrap}
          onChange={(event) =>
            onChange("editorWordWrap", event.target.checked ? "true" : "false")
          }
        />
        <span>Word wrap</span>
      </label>
      <p className="fo-settings-hint">Wrap long lines in the editor.</p>
      <label className="fo-settings-checkbox">
        <input
          type="checkbox"
          aria-label="Auto-save"
          checked={preferences.editorAutoSave}
          onChange={(event) =>
            onChange("editorAutoSave", event.target.checked ? "true" : "false")
          }
        />
        <span>Auto-save</span>
      </label>
      <p className="fo-settings-hint">
        Automatically save changes when switching focus away from the editor.
      </p>
      <label className="fo-settings-checkbox">
        <input
          type="checkbox"
          aria-label="Syntax highlighting"
          checked={preferences.editorSyntaxHighlighting}
          onChange={(event) =>
            onChange(
              "editorSyntaxHighlighting",
              event.target.checked ? "true" : "false",
            )
          }
        />
        <span>Syntax highlighting</span>
      </label>
      <p className="fo-settings-hint">
        Enable syntax highlighting for supported file types.
      </p>
      <label className="fo-settings-checkbox">
        <input
          type="checkbox"
          aria-label="Line numbers"
          checked={preferences.editorLineNumbers}
          onChange={(event) =>
            onChange(
              "editorLineNumbers",
              event.target.checked ? "true" : "false",
            )
          }
        />
        <span>Line numbers</span>
      </label>
      <p className="fo-settings-hint">
        Show line numbers in the left gutter of the editor.
      </p>
    </section>
  );
}
