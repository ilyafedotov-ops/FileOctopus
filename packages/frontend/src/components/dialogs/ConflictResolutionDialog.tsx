import { Button } from "@fileoctopus/ui";

interface ConflictResolutionDialogProps {
  onBack: () => void;
  onOverwrite: () => void;
}

export function ConflictResolutionDialog({
  onBack,
  onOverwrite,
}: ConflictResolutionDialogProps) {
  return (
    <section className="fo-dialog-section">
      <h3>Confirm overwrite</h3>
      <p>
        The conflict policy is set to overwrite. Files at the destination with
        the same name will be replaced. Continue?
      </p>
      <div className="fo-dialog-actions">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
        <Button type="button" variant="danger" size="sm" onClick={onOverwrite}>
          Overwrite
        </Button>
      </div>
    </section>
  );
}
