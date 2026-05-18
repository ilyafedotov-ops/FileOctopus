import { useMemo, useRef, useState } from "react";
import type { RecentEntryDto } from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";
import { useDialogEscape } from "../../hooks/useDialogEscape";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { localPathFromUri } from "../../utils/paneUtils";

interface RecentLocationsDialogProps {
  open: boolean;
  entries: RecentEntryDto[];
  onClose: () => void;
  onOpen: (uri: string) => void;
  onRemove: (uri: string) => void;
  onClearAll: () => void;
}

export function RecentLocationsDialog({
  open,
  entries,
  onClose,
  onOpen,
  onRemove,
  onClearAll,
}: RecentLocationsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogEscape(open, onClose);
  useFocusTrap(dialogRef, open);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return entries;
    }
    return entries.filter(
      (item) =>
        item.label.toLowerCase().indexOf(q) !== -1 ||
        localPathFromUri(item.uri).toLowerCase().indexOf(q) !== -1,
    );
  }, [entries, query]);

  if (!open) {
    return null;
  }

  return (
    <div className="fo-dialog-backdrop" role="presentation" onClick={onClose}>
      <dialog
        ref={dialogRef}
        open
        role="dialog"
        className="fo-dialog fo-recent-locations-dialog"
        aria-labelledby="recent-locations-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <div>
            <h2 id="recent-locations-title">Recent Locations</h2>
            <p>
              Folders you recently visited. Open one to navigate there, or
              remove entries you no longer need.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>
        <div className="fo-dialog-body">
          <label className="fo-dialog-field">
            <span>Search</span>
            <input
              aria-label="Search recent locations"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by name or path"
            />
          </label>
          <ul className="fo-recent-locations-list">
            {filtered.length === 0 ? (
              <li className="fo-recent-locations-empty">
                No recent locations match.
              </li>
            ) : (
              filtered.map((item) => (
                <li key={item.uri} className="fo-recent-locations-item">
                  <button
                    type="button"
                    className="fo-recent-locations-open"
                    onClick={() => {
                      onOpen(item.uri);
                      onClose();
                    }}
                  >
                    <span className="fo-recent-locations-label">
                      {item.label}
                    </span>
                    <span className="fo-recent-locations-path">
                      {localPathFromUri(item.uri)}
                    </span>
                    {item.visitedAt && (
                      <span className="fo-recent-locations-time">
                        {item.visitedAt}
                      </span>
                    )}
                  </button>
                  <div className="fo-recent-locations-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(item.uri)}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
        <footer className="fo-dialog-footer">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={entries.length === 0}
            onClick={onClearAll}
          >
            Clear All…
          </Button>
        </footer>
      </dialog>
    </div>
  );
}
