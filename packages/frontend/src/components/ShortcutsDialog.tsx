import { useRef } from "react";
import { Button } from "@fileoctopus/ui";
import { useDialogEscape } from "../hooks/useDialogEscape";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { formatShortcut, shortcutGroups } from "../shortcuts";

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogEscape(open, onClose);
  useFocusTrap(dialogRef, open);

  if (!open) {
    return null;
  }

  return (
    <div className="fo-dialog-backdrop" role="presentation" onClick={onClose}>
      <dialog
        ref={dialogRef}
        open
        role="dialog"
        className="fo-dialog fo-shortcuts-dialog"
        aria-labelledby="shortcuts-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <div>
            <h2 id="shortcuts-title">Keyboard shortcuts</h2>
            <p>Quick reference for navigation and file actions.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>
        <div className="fo-dialog-body">
          <div className="fo-shortcuts-groups">
            {shortcutGroups.map((group) => (
              <section key={group.title} className="fo-shortcuts-group">
                <h3 className="fo-dialog-section-title">{group.title}</h3>
                <table className="fo-shortcuts-table">
                  <tbody>
                    {group.entries.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.label}</td>
                        <td>
                          <kbd>{formatShortcut(entry)}</kbd>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        </div>
      </dialog>
    </div>
  );
}
