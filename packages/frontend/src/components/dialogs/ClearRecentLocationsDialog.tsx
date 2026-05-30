import { Button } from "@fileoctopus/ui";
import { DialogShell } from "../DialogShell";

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
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title="Clear Recent Locations"
      titleId="clear-recent-title"
      className="fo-clear-recent-dialog"
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Clear Recent Locations
          </Button>
        </>
      }
    >
      <div className="fo-dialog-body">
        <p>
          This will clear your navigation history. Only the list of recently
          visited locations is removed — your files and folders are not
          affected.
        </p>
      </div>
    </DialogShell>
  );
}
