import { useRef } from "react";
import { Button } from "@fileoctopus/ui";
import { useDialogEscape } from "../../hooks/useDialogEscape";
import { useFocusTrap } from "../../hooks/useFocusTrap";

interface ClearRecentLocationsDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ClearRecentLocationsDialog({
  open,
  onClose,
  onConfirm,
}: ClearRecentLocationsDialogProps) {
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
        className="fo-dialog fo-clear-recent-dialog"
        aria-labelledby="clear-recent-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <h2 id="clear-recent-title">Clear Recent Locations</h2>
        </header>
        <div className="fo-dialog-body">
          <p>
            This will clear your navigation history. Only the list of recently
            visited locations is removed — your files and folders are not
            affected.
          </p>
        </div>
        <footer className="fo-dialog-footer">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Clear Recent Locations
          </Button>
        </footer>
      </dialog>
    </div>
  );
}
