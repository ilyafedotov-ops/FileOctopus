import { formatShortcut, shortcutEntries } from "../shortcuts";

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fo-dialog-backdrop" role="presentation" onClick={onClose}>
      <dialog
        open
        className="fo-dialog fo-shortcuts-dialog"
        aria-labelledby="shortcuts-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <h2 id="shortcuts-title">Keyboard shortcuts</h2>
          <button type="button" className="fo-dialog-close" onClick={onClose}>
            Close
          </button>
        </header>
        <table className="fo-shortcuts-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Shortcut</th>
            </tr>
          </thead>
          <tbody>
            {shortcutEntries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.label}</td>
                <td>
                  <kbd>{formatShortcut(entry)}</kbd>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </dialog>
    </div>
  );
}
