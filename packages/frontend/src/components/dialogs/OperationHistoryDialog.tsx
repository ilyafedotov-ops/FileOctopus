import type { OperationHistoryRecordDto } from "@fileoctopus/ts-api";
import { DialogShell } from "../DialogShell";
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
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title="Operation History"
      titleId="operation-history-title"
      subtitle="Recent file operations recorded by the job runtime."
      className="fo-operation-history-dialog"
    >
      <OperationHistoryList
        history={history}
        onRefresh={onRefresh}
        onClear={onClear}
      />
    </DialogShell>
  );
}
