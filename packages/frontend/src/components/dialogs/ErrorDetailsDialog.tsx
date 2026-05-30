import { Button } from "@fileoctopus/ui";
import { DialogShell } from "../DialogShell";

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
  if (!message) {
    return null;
  }

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title="Operation Error"
      titleId="error-details-title"
      subtitle="The last filesystem operation reported a problem."
      className="fo-error-details-dialog"
      footer={
        <>
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
        </>
      }
    >
      <div className="fo-dialog-body">
        <pre className="fo-error-details-body">{message}</pre>
      </div>
    </DialogShell>
  );
}
