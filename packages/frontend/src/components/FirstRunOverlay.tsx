import { useRef } from "react";
import { Button } from "@fileoctopus/ui";
import { useDialogEscape } from "../hooks/useDialogEscape";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface FirstRunOverlayProps {
  open: boolean;
  onDismiss: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onOpenNetwork: () => void;
}

export function FirstRunOverlay({
  open,
  onDismiss,
  onOpenSettings,
  onOpenShortcuts,
  onOpenNetwork,
}: FirstRunOverlayProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogEscape(open, onDismiss);
  useFocusTrap(dialogRef, open);

  if (!open) {
    return null;
  }

  const run = (action?: () => void) => {
    onDismiss();
    action?.();
  };

  return (
    <div className="fo-dialog-backdrop" role="presentation" onClick={onDismiss}>
      <dialog
        ref={dialogRef}
        open
        role="dialog"
        className="fo-dialog fo-first-run-dialog"
        aria-labelledby="first-run-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <div>
            <h2 id="first-run-title">Welcome to FileOctopus</h2>
            <p>Dual-pane workspace, local and remote locations, and jobs.</p>
          </div>
        </header>
        <div className="fo-dialog-body fo-first-run-body">
          <div className="fo-first-run-grid">
            <button
              type="button"
              aria-label="Settings"
              onClick={() => run(onOpenSettings)}
            >
              <strong>Settings</strong>
              <span>Theme, layout, operations, terminal.</span>
            </button>
            <button
              type="button"
              aria-label="Shortcuts"
              onClick={() => run(onOpenShortcuts)}
            >
              <strong>Shortcuts</strong>
              <span>Keyboard reference for fast navigation.</span>
            </button>
            <button
              type="button"
              aria-label="Network"
              onClick={() => run(onOpenNetwork)}
            >
              <strong>Network</strong>
              <span>Saved SFTP and SSH profiles.</span>
            </button>
          </div>
        </div>
        <footer className="fo-dialog-footer">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => run()}
          >
            Start
          </Button>
        </footer>
      </dialog>
    </div>
  );
}
