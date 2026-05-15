import type { JobSnapshot, OperationHistoryRecordDto } from "@fileoctopus/ts-api";
import { useMemo } from "react";

interface JobMetrics {
  speedLabel: string | null;
  etaLabel: string | null;
}

interface ActivityPanelProps {
  jobs: JobSnapshot[];
  history: OperationHistoryRecordDto[];
  error: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onCancel: (jobId: string) => void;
  onRefreshHistory: () => void;
  onClearHistory: () => void;
  jobMetrics: Record<string, JobMetrics>;
}

export function ActivityPanel({
  jobs,
  history,
  error,
  collapsed,
  onToggleCollapsed,
  onCancel,
  onRefreshHistory,
  onClearHistory,
  jobMetrics,
}: ActivityPanelProps) {
  const activeJobs = jobs.filter(
    (job) => job.status === "queued" || job.status === "running",
  );
  const recentJobs = jobs
    .filter((job) => job.status !== "queued" && job.status !== "running")
    .slice(-5);

  const cards = useMemo(
    () => [...activeJobs, ...recentJobs],
    [activeJobs, recentJobs],
  );

  if (collapsed) {
    return (
      <aside className="fo-activity fo-activity-collapsed" aria-label="Job activity">
        <button type="button" onClick={onToggleCollapsed}>
          Activity
        </button>
      </aside>
    );
  }

  return (
    <aside className="fo-activity" aria-label="Job activity">
      <header className="fo-activity-header">
        <div>
          <h2>Jobs & Activity</h2>
          <p>Current operations and recent history</p>
        </div>
        <button type="button" onClick={onToggleCollapsed} aria-label="Collapse activity panel">
          −
        </button>
      </header>
      {error ? <div className="fo-operation-error">{error}</div> : null}
      <div className="fo-activity-cards">
        {cards.length === 0 ? (
          <div className="fo-empty-inline">No active jobs</div>
        ) : (
          cards.map((job) => {
            const jobId = jobIdValue(job.jobId);
            const percent = progressPercent(job);
            const metrics = jobMetrics[jobId];
            const tone =
              job.status === "failed"
                ? "failed"
                : job.status === "completed"
                  ? "completed"
                  : job.status === "queued"
                    ? "queued"
                    : "running";

            return (
              <article className={`fo-job-card fo-job-card-${tone}`} key={jobId}>
                <div className="fo-job-card-title">
                  <span>
                    {job.operationKind} {job.status}
                  </span>
                  <span>{percent}%</span>
                </div>
                <div className="fo-job-card-bar">
                  <div style={{ width: `${percent}%` }} />
                </div>
                <p className="fo-job-card-meta">
                  {job.completedItems}/{job.totalItems} items
                  {metrics?.speedLabel ? ` · ${metrics.speedLabel}` : ""}
                  {metrics?.etaLabel ? ` · ${metrics.etaLabel}` : ""}
                </p>
                {job.status === "running" || job.status === "queued" ? (
                  <button type="button" onClick={() => onCancel(jobId)}>
                    Cancel
                  </button>
                ) : null}
              </article>
            );
          })
        )}
      </div>
      <section className="fo-history" aria-label="Operation history">
        <header>
          <strong>History</strong>
          <div>
            <button type="button" onClick={onRefreshHistory}>
              Refresh
            </button>
            <button type="button" onClick={onClearHistory}>
              Clear
            </button>
          </div>
        </header>
        {history.length === 0 ? (
          <div className="fo-empty-inline">No recent operations</div>
        ) : (
          history.slice(0, 8).map((item) => (
            <div className="fo-history-row" key={item.jobId}>
              <span>{item.operationKind}</span>
              <span>{item.status}</span>
              <span>{item.representativeSourcePath ?? ""}</span>
            </div>
          ))
        )}
      </section>
    </aside>
  );
}

function jobIdValue(jobId: JobSnapshot["jobId"]): string {
  return typeof jobId === "string" ? jobId : String(jobId.value ?? "");
}

function progressPercent(job: JobSnapshot): number {
  if (job.totalBytes && job.totalBytes > 0) {
    return Math.min(100, Math.round((job.completedBytes / job.totalBytes) * 100));
  }
  if (job.totalItems > 0) {
    return Math.min(100, Math.round((job.completedItems / job.totalItems) * 100));
  }
  return 0;
}
