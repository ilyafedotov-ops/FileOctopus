import { Button } from "@fileoctopus/ui";
import type { NetworkProfileDto } from "@fileoctopus/ts-api";
import { DialogShell } from "../DialogShell";

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
  if (!profile) {
    return null;
  }

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title="Remove Server"
      titleId="remove-server-title"
      className="fo-remove-server-dialog"
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
            Remove Server
          </Button>
        </>
      }
    >
      <div className="fo-dialog-body">
        <p>
          Remove <strong>{profile.label}</strong> (
          <code>
            {profile.username}@{profile.host}:{profile.port}
          </code>
          )?
        </p>
        <p>
          Saved credentials in the keychain will also be deleted. Folders on the
          remote server are not affected.
        </p>
      </div>
    </DialogShell>
  );
}
