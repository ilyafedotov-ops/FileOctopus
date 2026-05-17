import type { OperationHistoryRecordDto } from "@fileoctopus/ts-api";
import { Button, Icons } from "@fileoctopus/ui";
import { formatDate } from "../pane/fileTableUtils";

interface OperationHistoryListProps {
  history: OperationHistoryRecordDto[];
  limit?: number;
  onRefresh: () => void;
  onClear: () => void;
  showActions?: boolean;
}

export function OperationHistoryList({
  history,
  limit,
  onRefresh,
  onClear,
  showActions = true,
}: OperationHistoryListProps) {
  const rows = limit != null ? history.slice(0, limit) : history;

  return (
    <section className="fo-history" aria-label="Operation history">
      {showActions ? (
        <header>
          <h3 className="fo-activity-section-title">History</h3>
          <div className="fo-history-actions">
            <Button type="button" variant="ghost" size="sm" onClick={onRefresh}>
              {Icons.refresh()}
              Refresh
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              Clear
            </Button>
          </div>
        </header>
      ) : null}
      {rows.length === 0 ? (
        <div className="fo-empty-inline">No recent operations</div>
      ) : (
        rows.map((item) => (
          <div className="fo-history-row" key={item.jobId}>
            <span className="fo-history-kind">{item.operationKind}</span>
            <span
              className={`fo-history-status fo-history-status-${item.status}`}
            >
              {item.status}
            </span>
            <span
              className="fo-history-path"
              title={item.representativeSourcePath ?? ""}
            >
              {item.representativeSourcePath ?? "—"}
            </span>
            <span className="fo-history-time">
              {formatDate(item.completedAt ?? item.startedAt)}
            </span>
          </div>
        ))
      )}
    </section>
  );
}
