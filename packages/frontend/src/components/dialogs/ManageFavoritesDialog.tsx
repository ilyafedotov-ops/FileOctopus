import { useMemo, useState } from "react";
import type { FavoriteEntryDto } from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";
import { useDialogEscape } from "../../hooks/useDialogEscape";
import { localPathFromUri } from "../../utils/paneUtils";

interface ManageFavoritesDialogProps {
  open: boolean;
  favorites: FavoriteEntryDto[];
  onClose: () => void;
  onNavigate: (uri: string) => void;
  onRemove: (id: number) => void;
  onRename: (id: number, label: string) => void;
}

export function ManageFavoritesDialog({
  open,
  favorites,
  onClose,
  onNavigate,
  onRemove,
  onRename,
}: ManageFavoritesDialogProps) {
  useDialogEscape(open, onClose);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return favorites;
    }
    return favorites.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        localPathFromUri(item.uri).toLowerCase().includes(q),
    );
  }, [favorites, query]);

  if (!open) {
    return null;
  }

  return (
    <div className="fo-dialog-backdrop" role="presentation" onClick={onClose}>
      <dialog
        open
        role="dialog"
        className="fo-dialog fo-manage-favorites-dialog"
        aria-labelledby="manage-favorites-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <div>
            <h2 id="manage-favorites-title">Manage Favorites</h2>
            <p>Rename, remove, or open pinned locations.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>
        <label className="fo-dialog-field">
          <span>Search</span>
          <input
            aria-label="Search favorites"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by name or path"
          />
        </label>
        <ul className="fo-favorites-manage-list">
          {filtered.length === 0 ? (
            <li className="fo-favorites-manage-empty">No favorites match.</li>
          ) : (
            filtered.map((item) => (
              <li key={item.id} className="fo-favorites-manage-item">
                {editingId === item.id ? (
                  <input
                    aria-label="Favorite label"
                    value={editLabel}
                    onChange={(event) => setEditLabel(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        const label = editLabel.trim();
                        if (label) {
                          onRename(item.id, label);
                        }
                        setEditingId(null);
                      }
                      if (event.key === "Escape") {
                        setEditingId(null);
                      }
                    }}
                    onBlur={() => {
                      const label = editLabel.trim();
                      if (label && label !== item.label) {
                        onRename(item.id, label);
                      }
                      setEditingId(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="fo-favorites-manage-open"
                    onClick={() => {
                      onNavigate(item.uri);
                      onClose();
                    }}
                  >
                    <span className="fo-favorites-manage-label">
                      {item.label}
                    </span>
                    <span className="fo-favorites-manage-path">
                      {localPathFromUri(item.uri)}
                    </span>
                  </button>
                )}
                <div className="fo-favorites-manage-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingId(item.id);
                      setEditLabel(item.label);
                    }}
                  >
                    Rename
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(item.id)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))
          )}
        </ul>
      </dialog>
    </div>
  );
}
