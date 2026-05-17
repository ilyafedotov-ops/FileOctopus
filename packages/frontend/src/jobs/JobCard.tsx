import type { JobSnapshot } from "@fileoctopus/ts-api";
import { Button, Icons } from "@fileoctopus/ui";
import type { ReactNode } from "react";
import { jobProgressMeta, jobTitle, progressPercent } from "./jobCardUtils";

interface JobMetrics {
  speedLabel: string | null;
  etaLabel: string | null;
}

export interface JobCardProps {
  job: JobSnapshot;
  metrics?: JobMetrics;
  onCancel?: () => void;
}

export function JobCard({ job, metrics, onCancel }: JobCardProps) {
  const percent = progressPercent(job);
  const tone =
    job.status === "failed"
      ? "failed"
      : job.status === "completed"
        ? "completed"
        : job.status === "queued"
          ? "queued"
          : "running";
  const cancellable = job.status === "running" || job.status === "queued";

  return (
    <article className={`fo-job-card fo-job-card-${tone}`}>
      <div className="fo-job-card-title">
        <span className="fo-job-card-heading">
          {operationIcon(job.operationKind)}
          <span>{jobTitle(job)}</span>
        </span>
        <span className="fo-job-card-percent">{percent}%</span>
      </div>
      {job.currentItem ? (
        <p className="fo-job-card-item" title={job.currentItem}>
          {basename(job.currentItem)}
        </p>
      ) : null}
      <div
        className="fo-job-card-bar"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div style={{ width: `${percent}%` }} />
      </div>
      <p className="fo-job-card-meta">{jobProgressMeta(job, metrics)}</p>
      {job.status === "failed" && job.message ? (
        <p className="fo-job-card-error">{job.message}</p>
      ) : null}
      {cancellable && onCancel ? (
        <div className="fo-job-card-actions">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function operationIcon(kind: JobSnapshot["operationKind"]): ReactNode {
  switch (kind) {
    case "copy":
      return Icons.copy();
    case "move":
      return Icons.move();
    case "deleteToTrash":
      return Icons.trash();
    case "rename":
      return Icons.pencil();
    default:
      return Icons.file();
  }
}

function basename(path: string): string {
  const normalized = path.replace(/\/+$/, "");
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(index + 1) : normalized;
}
