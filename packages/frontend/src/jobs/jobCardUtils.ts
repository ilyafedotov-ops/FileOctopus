import type { FileOperationKind, JobSnapshot } from "@fileoctopus/ts-api";

export function jobIdValue(jobId: JobSnapshot["jobId"]): string {
  return jobId;
}

export function progressPercent(job: JobSnapshot): number {
  if (job.totalBytes && job.totalBytes > 0) {
    return Math.min(
      100,
      Math.round((job.completedBytes / job.totalBytes) * 100),
    );
  }
  if (job.totalItems > 0) {
    return Math.min(
      100,
      Math.round((job.completedItems / job.totalItems) * 100),
    );
  }
  return 0;
}

export function formatJobBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function operationVerb(kind: FileOperationKind): string {
  switch (kind) {
    case "copy":
      return "Copying";
    case "move":
      return "Moving";
    case "deleteToTrash":
      return "Moving to Trash";
    case "rename":
      return "Renaming";
    case "writeTextFile":
      return "Saving";
    default:
      return "Processing";
  }
}

function operationPastTense(kind: FileOperationKind): string {
  switch (kind) {
    case "copy":
      return "Copied";
    case "move":
      return "Moved";
    case "deleteToTrash":
      return "Moved to Trash";
    case "rename":
      return "Renamed";
    case "writeTextFile":
      return "Saved";
    default:
      return "Completed";
  }
}

export function jobTitle(job: JobSnapshot): string {
  const verb =
    job.status === "completed" ||
    job.status === "failed" ||
    job.status === "cancelled"
      ? operationPastTense(job.operationKind)
      : operationVerb(job.operationKind);
  if (job.totalItems > 1) {
    return `${verb} ${job.totalItems} items`;
  }
  if (job.currentItem) {
    return `${verb} ${basename(job.currentItem)}`;
  }
  return verb;
}

export function jobProgressMeta(
  job: JobSnapshot,
  metrics?: { speedLabel: string | null; etaLabel: string | null },
): string {
  const parts: string[] = [];

  if (job.totalBytes && job.totalBytes > 0) {
    parts.push(
      `${formatJobBytes(job.completedBytes)} / ${formatJobBytes(job.totalBytes)}`,
    );
  } else if (job.totalItems > 0) {
    parts.push(`${job.completedItems}/${job.totalItems} items`);
  }

  if (metrics?.speedLabel) {
    parts.push(metrics.speedLabel);
  }
  if (metrics?.etaLabel) {
    parts.push(metrics.etaLabel);
  }

  return parts.join(" · ");
}

function basename(path: string): string {
  const normalized = path.replace(/\/+$/, "");
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(index + 1) : normalized;
}
