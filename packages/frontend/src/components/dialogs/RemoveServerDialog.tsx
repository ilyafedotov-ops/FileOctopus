import { useRef } from "react";
import { Button } from "@fileoctopus/ui";
import type { NetworkProfileDto } from "@fileoctopus/ts-api";
import { useDialogEscape } from "../../hooks/useDialogEscape";
import { useFocusTrap } from "../../hooks/useFocusTrap";

interface RemoveServerDialogProps {
  open: boolean;
  profile: NetworkProfileDto | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function RemoveServerDialog({
  open,
  profile,
  onClose,
  onConfirm,
}: RemoveServerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogEscape(open, onClose);
  useFocusTrap(dialogRef, open);

  if (!open || !profile) {
    return null;
  }

  return (
    <div className="fo-dialog-backdrop" role="presentation" onClick={onClose}>
      <dialog
        ref={dialogRef}
        open
        role="dialog"
        className="fo-dialog fo-remove-server-dialog"
        aria-labelledby="remove-server-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <h2 id="remove-server-title">Remove Server</h2>
        </header>
        <div className="fo-dialog-body">
          <p>
            Remove <strong>{profile.label}</strong> (
            <code>
              {profile.username}@{profile.host}:{profile.port}
            </code>
            )?
          </p>
          <p>
            Saved credentials in the keychain will also be deleted. Folders on
            the remote server are not affected.
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
            Remove Server
          </Button>
        </footer>
      </dialog>
    </div>
  );
}
