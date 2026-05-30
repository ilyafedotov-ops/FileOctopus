import { Button } from "@fileoctopus/ui";
import { DialogShell } from "../DialogShell";

interface ClosePaneTerminalDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ClosePaneTerminalDialog({
  open,
  onClose,
  onConfirm,
}: ClosePaneTerminalDialogProps) {
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title="Hide pane with running terminal?"
      titleId="close-pane-terminal-title"
      className="fo-close-pane-terminal-dialog"
      footer={
        <>
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
            Switch to single pane
          </Button>
        </>
      }
    >
      <div className="fo-dialog-body">
        <p>
          The right pane has a running embedded terminal. Switching to single
          pane hides that pane; the shell keeps running in the background.
        </p>
      </div>
    </DialogShell>
  );
}
