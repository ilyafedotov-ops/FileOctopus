import { useRef } from "react";
import type { OperationHistoryRecordDto } from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";
import { useDialogEscape } from "../../hooks/useDialogEscape";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { OperationHistoryList } from "../../jobs/OperationHistoryList";

interface OperationHistoryDialogProps {
  open: boolean;
  history: OperationHistoryRecordDto[];
  onClose: () => void;
  onRefresh: () => void;
  onClear: () => void;
}

export function OperationHistoryDialog({
  open,
  history,
  onClose,
  onRefresh,
  onClear,
}: OperationHistoryDialogProps) {
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
        className="fo-dialog fo-operation-history-dialog"
        aria-labelledby="operation-history-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <div>
            <h2 id="operation-history-title">Operation History</h2>
            <p>Recent file operations recorded by the job runtime.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>
        <OperationHistoryList
          history={history}
          onRefresh={onRefresh}
          onClear={onClear}
        />
      </dialog>
    </div>
  );
}
