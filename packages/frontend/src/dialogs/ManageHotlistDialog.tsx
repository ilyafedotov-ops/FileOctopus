import { useCallback, useEffect, useState } from "react";
import {
  type HotlistEntry,
  createHotlistEntry,
  parseHotlistEntries,
  serializeHotlistEntries,
} from "../utils/hotlist";

const STORAGE_KEY = "fileoctopus_hotlist";

interface ManageHotlistDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ManageHotlistDialog({
  open,
  onClose,
}: ManageHotlistDialogProps) {
  const [entries, setEntries] = useState<HotlistEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editUri, setEditUri] = useState("");

  const loadEntries = useCallback(() => {
    const raw = localStorage.getItem(STORAGE_KEY) ?? "";
    setEntries(parseHotlistEntries(raw));
  }, []);

  useEffect(() => {
    if (!open) return;
    loadEntries();
    setEditingId(null);
  }, [open, loadEntries]);

  function save(entries: HotlistEntry[]) {
    localStorage.setItem(STORAGE_KEY, serializeHotlistEntries(entries));
    setEntries(entries);
  }

  function handleRemove(id: string) {
    save(entries.filter((e) => e.id !== id));
  }

  function handleMoveUp(index: number) {
    if (index === 0) return;
    const next = [...entries];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    save(next);
  }

  function handleMoveDown(index: number) {
    if (index >= entries.length - 1) return;
    const next = [...entries];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    save(next);
  }

  function startEdit(entry: HotlistEntry) {
    setEditingId(entry.id);
    setEditLabel(entry.label);
    setEditUri(entry.uri);
  }

  function commitEdit() {
    if (!editingId) return;
    const trimmed = editLabel.trim();
    const trimmedUri = editUri.trim();
    if (!trimmed || !trimmedUri) return;
    save(
      entries.map((e) =>
        e.id === editingId ? { ...e, label: trimmed, uri: trimmedUri } : e,
      ),
    );
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function handleAddNew() {
    const entry = createHotlistEntry("New Entry", "local:///");
    save([...entries, entry]);
    setEditingId(entry.id);
    setEditLabel(entry.label);
    setEditUri(entry.uri);
  }

  const pathFromUri = (uri: string) => {
    if (uri.startsWith("local://")) return uri.slice("local://".length);
    return uri;
  };

  if (!open) return null;

  return (
    <div className="fo-dialog-backdrop" onClick={onClose}>
      <div
        className="fo-dialog fo-manage-hotlist-dialog"
        role="dialog"
        aria-label="Manage Directory Hotlist"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fo-dialog-header">
          <h2>Manage Directory Hotlist</h2>
          <button
            type="button"
            className="fo-ui-icon-btn"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="fo-manage-hotlist-list">
          {entries.length === 0 && (
            <div className="fo-manage-hotlist-empty">
              No hotlist entries yet. Click "Add" to create one.
            </div>
          )}
          {entries.map((entry, index) => (
            <div key={entry.id} className="fo-manage-hotlist-row">
              {editingId === entry.id ? (
                <div className="fo-manage-hotlist-edit">
                  <input
                    type="text"
                    className="fo-ui-input"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    placeholder="Label"
                    aria-label="Entry label"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                  />
                  <input
                    type="text"
                    className="fo-ui-input"
                    value={editUri}
                    onChange={(e) => setEditUri(e.target.value)}
                    placeholder="URI (local:///path/to/dir)"
                    aria-label="Entry URI"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                  />
                  <button
                    type="button"
                    className="fo-ui-btn fo-ui-btn--sm"
                    onClick={commitEdit}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    className="fo-ui-btn fo-ui-btn--sm"
                    onClick={cancelEdit}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <span className="fo-manage-hotlist-index">
                    {index < 9 ? String(index + 1) : ""}
                  </span>
                  <span className="fo-manage-hotlist-label">{entry.label}</span>
                  <span className="fo-manage-hotlist-path" title={entry.uri}>
                    {pathFromUri(entry.uri)}
                  </span>
                  <div className="fo-manage-hotlist-actions">
                    <button
                      type="button"
                      className="fo-ui-icon-btn"
                      aria-label="Move up"
                      disabled={index === 0}
                      onClick={() => handleMoveUp(index)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="fo-ui-icon-btn"
                      aria-label="Move down"
                      disabled={index >= entries.length - 1}
                      onClick={() => handleMoveDown(index)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="fo-ui-icon-btn"
                      aria-label="Edit"
                      onClick={() => startEdit(entry)}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="fo-ui-icon-btn"
                      aria-label="Remove"
                      onClick={() => handleRemove(entry.id)}
                    >
                      ✕
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="fo-dialog-footer">
          <button
            type="button"
            className="fo-ui-btn fo-ui-btn--sm"
            onClick={handleAddNew}
          >
            Add
          </button>
          <button
            type="button"
            className="fo-ui-btn fo-ui-btn--md"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
