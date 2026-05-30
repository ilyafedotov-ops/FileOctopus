import { useMemo, useState } from "react";
import type { RecentEntryDto } from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";
import { DialogShell } from "../DialogShell";
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

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title="Recent Locations"
      titleId="recent-locations-title"
      subtitle="Folders you recently visited. Open one to navigate there, or remove entries you no longer need."
      className="fo-recent-locations-dialog"
      footer={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={entries.length === 0}
          onClick={onClearAll}
        >
          Clear All…
        </Button>
      }
    >
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
    </DialogShell>
  );
}
