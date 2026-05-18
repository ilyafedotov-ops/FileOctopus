import { useRef } from "react";
import { Button } from "@fileoctopus/ui";
import { useDialogEscape } from "../../hooks/useDialogEscape";
import { useFocusTrap } from "../../hooks/useFocusTrap";

interface ErrorDetailsDialogProps {
  open: boolean;
  message: string | null;
  onClose: () => void;
  onClear: () => void;
}

export function ErrorDetailsDialog({
  open,
  message,
  onClose,
  onClear,
}: ErrorDetailsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogEscape(open, onClose);
  useFocusTrap(dialogRef, open);

  if (!open || !message) {
    return null;
  }

  return (
    <div className="fo-dialog-backdrop" role="presentation" onClick={onClose}>
      <dialog
        ref={dialogRef}
        open
        role="dialog"
        className="fo-dialog fo-error-details-dialog"
        aria-labelledby="error-details-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <div>
            <h2 id="error-details-title">Operation Error</h2>
            <p>The last filesystem operation reported a problem.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>
        <div className="fo-dialog-body">
          <pre className="fo-error-details-body">{message}</pre>
          <div className="fo-dialog-footer">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void navigator.clipboard.writeText(message)}
            >
              Copy
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onClear();
                onClose();
              }}
            >
              Dismiss
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
