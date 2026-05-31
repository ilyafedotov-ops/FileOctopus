import type {
  JobSnapshot,
  OperationHistoryRecordDto,
} from "@fileoctopus/ts-api";
import {
  Badge,
  Button,
  IconButton,
  Icons,
  SegmentedControl,
} from "@fileoctopus/ui";
import { useMemo, useState } from "react";
import { JobCard } from "./JobCard";
import { OperationHistoryList } from "./OperationHistoryList";
import { jobIdValue } from "./jobCardUtils";

type ActivityTab = "activity" | "history";

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
  onPause?: (jobId: string) => void;
  onResume?: (jobId: string) => void;
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
  onPause,
  onResume,
  onRefreshHistory,
  onClearHistory,
  jobMetrics,
}: ActivityPanelProps) {
  const [tab, setTab] = useState<ActivityTab>("activity");

  const activeJobs = jobs.filter(
    (job) =>
      job.status === "queued" ||
      job.status === "running" ||
      job.status === "paused",
  );
  const recentJobs = jobs
    .filter(
      (job) =>
        job.status !== "queued" &&
        job.status !== "running" &&
        job.status !== "paused",
    )
    .slice(-5)
    .reverse();

  const activityCards = useMemo(
    () => [...activeJobs, ...recentJobs],
    [activeJobs, recentJobs],
  );

  if (collapsed) {
    return (
      <aside
        className="fo-activity fo-activity-rail fo-activity-collapsed"
        aria-label="Job activity"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="fo-activity-collapsed-btn"
          aria-label={
            activeJobs.length > 0
              ? `Expand Jobs and Activity panel (${activeJobs.length} active)`
              : "Expand Jobs and Activity panel"
          }
          title="Jobs & Activity"
          onClick={onToggleCollapsed}
        >
          {Icons.activity()}
          {activeJobs.length > 0 ? (
            <Badge tone="accent">{activeJobs.length}</Badge>
          ) : null}
        </Button>
      </aside>
    );
  }

  return (
    <aside className="fo-activity fo-activity-rail" aria-label="Job activity">
      <header className="fo-activity-header">
        <div>
          <h2>
            Jobs & Activity
            {activeJobs.length > 0 ? (
              <Badge tone="accent">{activeJobs.length}</Badge>
            ) : null}
          </h2>
          <p>Operations and history</p>
        </div>
        <IconButton
          label="Collapse activity panel"
          size="sm"
          onClick={onToggleCollapsed}
        >
          −
        </IconButton>
      </header>
      {error ? <div className="fo-operation-error">{error}</div> : null}
      <SegmentedControl
        aria-label="Activity views"
        className="fo-activity-segmented"
        value={tab}
        options={[
          { value: "activity", label: "Activity" },
          { value: "history", label: "History" },
        ]}
        onChange={setTab}
      />
      <div className="fo-activity-body">
        {tab === "activity" ? (
          <section
            className="fo-activity-cards"
            aria-label="Active jobs"
            aria-live="polite"
          >
            <h3 className="fo-activity-section-title">Active Jobs</h3>
            {activityCards.length === 0 ? (
              <div className="fo-empty-inline">No active jobs</div>
            ) : (
              activityCards.map((job) => {
                const jobId = jobIdValue(job.jobId);
                return (
                  <JobCard
                    key={jobId}
                    job={job}
                    metrics={jobMetrics[jobId]}
                    onCancel={
                      job.status === "running" ||
                      job.status === "queued" ||
                      job.status === "paused"
                        ? () => onCancel(jobId)
                        : undefined
                    }
                    onPause={
                      job.status === "running" && onPause
                        ? () => onPause(jobId)
                        : undefined
                    }
                    onResume={
                      job.status === "paused" && onResume
                        ? () => onResume(jobId)
                        : undefined
                    }
                  />
                );
              })
            )}
          </section>
        ) : (
          <OperationHistoryList
            history={history}
            limit={12}
            onRefresh={onRefreshHistory}
            onClear={onClearHistory}
          />
        )}
      </div>
    </aside>
  );
}
