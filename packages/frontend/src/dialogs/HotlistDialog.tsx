import { useEffect, useState } from "react";
import { type HotlistEntry, parseHotlistEntries } from "../utils/hotlist";

const STORAGE_KEY = "fileoctopus_hotlist";

interface HotlistDialogProps {
  open: boolean;
  onNavigate: (uri: string) => void;
  onManage: () => void;
  onClose: () => void;
  onAddCurrent: (label: string, uri: string) => void;
  currentUri: string;
}

export function HotlistDialog({
  open,
  onNavigate,
  onManage,
  onClose,
  onAddCurrent,
  currentUri,
}: HotlistDialogProps) {
  const [entries, setEntries] = useState<HotlistEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    const raw = localStorage.getItem(STORAGE_KEY) ?? "";
    setEntries(parseHotlistEntries(raw));
    setSelectedIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, entries.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && entries[selectedIndex]) {
        e.preventDefault();
        onNavigate(entries[selectedIndex].uri);
        onClose();
        return;
      }
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9 && entries[num - 1]) {
        e.preventDefault();
        onNavigate(entries[num - 1].uri);
        onClose();
        return;
      }
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, entries, selectedIndex, onNavigate, onClose]);

  if (!open) return null;

  const pathFromUri = (uri: string) => {
    if (uri.startsWith("local://")) return uri.slice("local://".length);
    return uri;
  };

  return (
    <div className="fo-dialog-backdrop" onClick={onClose}>
      <div
        className="fo-dialog fo-hotlist-dialog"
        role="dialog"
        aria-label="Directory Hotlist"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fo-dialog-header">
          <h2>Directory Hotlist</h2>
          <button
            type="button"
            className="fo-ui-icon-btn"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <ul className="fo-hotlist-entries" role="listbox">
          {entries.length === 0 && (
            <li className="fo-hotlist-empty">
              No entries. Add directories to get started.
            </li>
          )}
          {entries.map((entry, index) => (
            <li
              key={entry.id}
              className={`fo-hotlist-entry${index === selectedIndex ? " fo-hotlist-entry-selected" : ""}`}
              role="option"
              aria-selected={index === selectedIndex}
              onClick={() => {
                onNavigate(entry.uri);
                onClose();
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="fo-hotlist-shortcut">
                {index < 9 ? String(index + 1) : "·"}
              </span>
              <span className="fo-hotlist-label">{entry.label}</span>
              <span className="fo-hotlist-path" title={entry.uri}>
                {pathFromUri(entry.uri)}
              </span>
            </li>
          ))}
        </ul>

        <div className="fo-dialog-footer">
          <button
            type="button"
            className="fo-ui-btn fo-ui-btn--sm"
            onClick={() => {
              const label =
                pathFromUri(currentUri).split("/").filter(Boolean).pop() ??
                "Directory";
              onAddCurrent(label, currentUri);
            }}
          >
            Add Current
          </button>
          <button
            type="button"
            className="fo-ui-btn fo-ui-btn--sm"
            onClick={() => {
              onClose();
              onManage();
            }}
          >
            Manage…
          </button>
          <button
            type="button"
            className="fo-ui-btn fo-ui-btn--sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
