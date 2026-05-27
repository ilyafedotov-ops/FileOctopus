import { useState, useCallback, useRef, useEffect } from "react";
import type { UserPreferencesDto } from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";
import { COMMAND_REGISTRY } from "../../commands/registryData";
import {
  parseKeyCombo,
  serializeKeyCombo,
  formatKeyComboForDisplay,
  type KeyCombo,
} from "../../commands/keyCombo";
import { DEFAULT_KEY_BINDINGS } from "../../commands/defaultBindings";

interface SettingsKeyboardProps {
  preferences: UserPreferencesDto;
  onChange: (key: string, value: string) => void;
}

interface ShortcutEntry {
  commandId: string;
  label: string;
  group: string;
  combos: KeyCombo[];
  isCustom: boolean;
}

function getCustomShortcuts(json: string): Record<string, string[]> {
  if (!json) return {};
  try {
    return JSON.parse(json) as Record<string, string[]>;
  } catch {
    return {};
  }
}

function buildShortcutEntries(customJson: string): ShortcutEntry[] {
  const custom = getCustomShortcuts(customJson);
  const defaultMap = new Map<string, KeyCombo[]>();
  for (const binding of DEFAULT_KEY_BINDINGS) {
    defaultMap.set(binding.commandId, binding.combos);
  }

  const entries: ShortcutEntry[] = [];
  for (const cmd of COMMAND_REGISTRY) {
    const customCombos = custom[cmd.id];
    let combos: KeyCombo[];
    let isCustom = false;

    if (customCombos) {
      combos = customCombos
        .map((s) => parseKeyCombo(s))
        .filter((c): c is KeyCombo => c !== null);
      isCustom = true;
    } else {
      combos = defaultMap.get(cmd.id) ?? [];
    }

    if (combos.length > 0 || customCombos) {
      entries.push({
        commandId: cmd.id,
        label: cmd.label,
        group: cmd.group,
        combos,
        isCustom,
      });
    }
  }

  return entries;
}

function findConflicts(entries: ShortcutEntry[]): Map<string, string[]> {
  const comboToCommands = new Map<string, string[]>();
  for (const entry of entries) {
    for (const combo of entry.combos) {
      const key = serializeKeyCombo(combo);
      const existing = comboToCommands.get(key) ?? [];
      existing.push(entry.commandId);
      comboToCommands.set(key, existing);
    }
  }

  const conflicts = new Map<string, string[]>();
  for (const [comboKey, commandIds] of comboToCommands) {
    if (commandIds.length > 1) {
      conflicts.set(comboKey, commandIds);
    }
  }
  return conflicts;
}

const GROUP_LABELS: Record<string, string> = {
  navigation: "Navigation",
  creation: "Create",
  operation: "File operations",
  view: "View",
  clipboard: "Clipboard",
  selection: "Selection",
  app: "App",
};

const GROUP_ORDER = [
  "navigation",
  "operation",
  "view",
  "clipboard",
  "selection",
  "creation",
  "app",
];

export function SettingsKeyboard({
  preferences,
  onChange,
}: SettingsKeyboardProps) {
  const [entries, setEntries] = useState(() =>
    buildShortcutEntries(preferences.customShortcuts),
  );
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const recordingRef = useRef<HTMLDivElement>(null);

  const conflicts = findConflicts(entries);
  const conflictedCommands = new Set<string>();
  for (const commandIds of conflicts.values()) {
    for (const id of commandIds) {
      conflictedCommands.add(id);
    }
  }

  const platform: "mac" | "windowsLinux" =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform)
      ? "mac"
      : "windowsLinux";

  useEffect(() => {
    setEntries(buildShortcutEntries(preferences.customShortcuts));
  }, [preferences.customShortcuts]);

  useEffect(() => {
    if (recordingId && recordingRef.current) {
      recordingRef.current.focus();
    }
  }, [recordingId]);

  const handleRecordKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!recordingId) return;
      event.preventDefault();
      event.stopPropagation();

      if (
        event.key === "Escape" ||
        event.key === "Tab" ||
        event.key === "Enter"
      ) {
        setRecordingId(null);
        return;
      }

      if (
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        !event.shiftKey
      ) {
        return;
      }

      const combo: KeyCombo = {
        key: event.key,
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
      };

      const custom = getCustomShortcuts(preferences.customShortcuts);
      custom[recordingId] = [serializeKeyCombo(combo)];
      onChange("customShortcuts", JSON.stringify(custom));
      setRecordingId(null);
    },
    [recordingId, preferences.customShortcuts, onChange],
  );

  const handleReset = useCallback(
    (commandId: string) => {
      const custom = getCustomShortcuts(preferences.customShortcuts);
      delete custom[commandId];
      onChange("customShortcuts", JSON.stringify(custom));
    },
    [preferences.customShortcuts, onChange],
  );

  const handleResetAll = useCallback(() => {
    onChange("customShortcuts", "");
  }, [onChange]);

  const filteredEntries = filter
    ? entries.filter(
        (e) =>
          e.label.toLowerCase().includes(filter.toLowerCase()) ||
          e.commandId.toLowerCase().includes(filter.toLowerCase()),
      )
    : entries;

  const grouped = new Map<string, ShortcutEntry[]>();
  for (const entry of filteredEntries) {
    const group = grouped.get(entry.group) ?? [];
    group.push(entry);
    grouped.set(entry.group, group);
  }

  return (
    <section
      className="fo-settings-section"
      role="region"
      aria-label="Keyboard settings"
    >
      <h3>Keyboard Shortcuts</h3>
      <p className="fo-settings-description">
        View and customize keyboard shortcuts.
      </p>
      <div className="fo-settings-field">
        <input
          type="text"
          placeholder="Filter shortcuts…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter shortcuts"
        />
      </div>
      {recordingId && (
        <div
          className="fo-shortcuts-recording"
          onKeyDown={handleRecordKeyDown}
          tabIndex={0}
          ref={recordingRef}
          role="status"
          aria-live="polite"
        >
          Press a key combination for{" "}
          <strong>
            {entries.find((e) => e.commandId === recordingId)?.label}
          </strong>
          … (Esc to cancel)
        </div>
      )}
      <div className="fo-shortcuts-groups fo-shortcuts-editable">
        {GROUP_ORDER.map((groupKey) => {
          const groupEntries = grouped.get(groupKey);
          if (!groupEntries || groupEntries.length === 0) return null;
          return (
            <div key={groupKey} className="fo-shortcuts-group">
              <h4>{GROUP_LABELS[groupKey] ?? groupKey}</h4>
              <table className="fo-shortcuts-table">
                <tbody>
                  {groupEntries.map((entry) => {
                    const hasConflict = conflictedCommands.has(entry.commandId);
                    return (
                      <tr
                        key={entry.commandId}
                        className={hasConflict ? "fo-shortcuts-conflict" : ""}
                      >
                        <td>
                          {entry.label}
                          {entry.isCustom && (
                            <span className="fo-shortcuts-custom-badge">
                              custom
                            </span>
                          )}
                        </td>
                        <td>
                          {entry.combos.map((combo, i) => (
                            <kbd key={i} role="presentation">
                              {formatKeyComboForDisplay(combo, platform)}
                            </kbd>
                          ))}
                          {entry.combos.length === 0 && (
                            <span className="fo-shortcuts-none">none</span>
                          )}
                        </td>
                        <td className="fo-shortcuts-actions">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setRecordingId(
                                recordingId === entry.commandId
                                  ? null
                                  : entry.commandId,
                              )
                            }
                          >
                            {recordingId === entry.commandId
                              ? "Recording…"
                              : "Edit"}
                          </Button>
                          {entry.isCustom && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleReset(entry.commandId)}
                            >
                              Reset
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
      {conflicts.size > 0 && (
        <div className="fo-shortcuts-conflicts">
          <strong>Conflicts detected:</strong>
          <ul>
            {Array.from(conflicts.entries()).map(([comboKey, commandIds]) => (
              <li key={comboKey}>
                <kbd>{comboKey}</kbd> is assigned to{" "}
                {commandIds
                  .map(
                    (id) =>
                      entries.find((e) => e.commandId === id)?.label ?? id,
                  )
                  .join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="fo-settings-field">
        <Button type="button" size="sm" onClick={handleResetAll}>
          Reset all to defaults
        </Button>
      </div>
    </section>
  );
}
