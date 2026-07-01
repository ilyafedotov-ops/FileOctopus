import { useEffect, useMemo, useState } from "react";
import type {
  FsClient,
  SyncDirectoriesResponse,
  SyncEntryDto,
} from "@fileoctopus/ts-api";
import { DialogShell } from "../DialogShell";

interface SyncDirectoriesDialogProps {
  open: boolean;
  leftUri: string;
  rightUri: string;
  fs: FsClient;
  initialComparison?: SyncComparisonMode;
  onClose: () => void;
}

export type SyncComparisonMode = "name" | "size" | "date";

function statusLabel(status: string): string {
  switch (status) {
    case "onlyLeft":
      return "← Only left";
    case "onlyRight":
      return "→ Only right";
    case "same":
      return "= Same";
    case "newerLeft":
      return "← Newer";
    case "newerRight":
      return "→ Newer";
    case "different":
      return "≠ Different";
    default:
      return status;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "onlyLeft":
      return "var(--fo-accent)";
    case "onlyRight":
      return "var(--fo-accent)";
    case "same":
      return "var(--fo-muted-text)";
    case "newerLeft":
      return "var(--fo-warning-text, var(--fo-warning, #e8a317))";
    case "newerRight":
      return "var(--fo-warning-text, var(--fo-warning, #e8a317))";
    case "different":
      return "var(--fo-danger)";
    default:
      return "var(--fo-text)";
  }
}

export function SyncDirectoriesDialog({
  open,
  leftUri,
  rightUri,
  fs,
  initialComparison = "size",
  onClose,
}: SyncDirectoriesDialogProps) {
  const [comparisonState, setComparisonState] = useState({
    seed: initialComparison,
    value: initialComparison,
  });
  const [recursive, setRecursive] = useState(false);
  const [result, setResult] = useState<SyncDirectoriesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const comparison =
    comparisonState.seed === initialComparison
      ? comparisonState.value
      : initialComparison;

  useEffect(() => {
    if (!open) return;
    setComparisonState({ seed: initialComparison, value: initialComparison });
  }, [open, initialComparison]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);
    fs.syncDirectories({
      leftUri,
      rightUri,
      comparison,
      recursive,
    })
      .then((res) => {
        if (!cancelled) {
          setResult(res);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message || "Unknown error");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, leftUri, rightUri, comparison, recursive, fs]);

  const stats = useMemo(() => {
    if (!result) return null;
    let onlyLeft = 0;
    let onlyRight = 0;
    let same = 0;
    let different = 0;
    for (const entry of result.entries) {
      if (entry.status === "onlyLeft") onlyLeft++;
      else if (entry.status === "onlyRight") onlyRight++;
      else if (entry.status === "same") same++;
      else different++;
    }
    return {
      onlyLeft,
      onlyRight,
      same,
      different,
      total: result.entries.length,
    };
  }, [result]);

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title="Directory Sync"
      className="fo-sync-dialog"
    >
      <div className="fo-sync-controls">
        <div className="fo-sync-paths">
          <div className="fo-sync-path" title={leftUri}>
            <span className="fo-sync-path-label">Left:</span>
            <span className="fo-sync-path-value">
              {localPathFromUri(leftUri)}
            </span>
          </div>
          <div className="fo-sync-path" title={rightUri}>
            <span className="fo-sync-path-label">Right:</span>
            <span className="fo-sync-path-value">
              {localPathFromUri(rightUri)}
            </span>
          </div>
        </div>

        <div className="fo-sync-options">
          <label>
            Compare by:{" "}
            <select
              value={comparison}
              onChange={(e) =>
                setComparisonState({
                  seed: initialComparison,
                  value: e.target.value as SyncComparisonMode,
                })
              }
            >
              <option value="name">Name</option>
              <option value="size">Size</option>
              <option value="date">Date</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={recursive}
              onChange={(e) => setRecursive(e.target.checked)}
            />{" "}
            Recursive
          </label>
        </div>
      </div>

      {loading && <div className="fo-sync-loading">Comparing directories…</div>}
      {error && <div className="fo-sync-error">Error: {error}</div>}

      {stats && (
        <div className="fo-sync-stats">
          <span>
            {stats.total} entries: {stats.same} same, {stats.onlyLeft} left
            only, {stats.onlyRight} right only, {stats.different} different
          </span>
        </div>
      )}

      {result && result.entries.length > 0 && (
        <div className="fo-sync-results">
          <table className="fo-sync-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Left Size</th>
                <th>Right Size</th>
                <th>Left Modified</th>
                <th>Right Modified</th>
              </tr>
            </thead>
            <tbody>
              {result.entries.map((entry: SyncEntryDto) => (
                <tr
                  key={entry.name}
                  className={`fo-sync-row fo-sync-${entry.status}`}
                >
                  <td>
                    {entry.leftIsDir || entry.rightIsDir ? "📁 " : ""}
                    {entry.name}
                  </td>
                  <td style={{ color: statusColor(entry.status) }}>
                    {statusLabel(entry.status)}
                  </td>
                  <td>{formatSize(entry.leftSize)}</td>
                  <td>{formatSize(entry.rightSize)}</td>
                  <td>{formatDate(entry.leftModified)}</td>
                  <td>{formatDate(entry.rightModified)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result && result.entries.length === 0 && !loading && (
        <div className="fo-sync-empty">
          Directories are identical — no differences found.
        </div>
      )}
    </DialogShell>
  );
}

function localPathFromUri(uri: string): string {
  try {
    if (uri.startsWith("local://")) {
      return uri.slice("local://".length);
    }
    return uri;
  } catch {
    return uri;
  }
}

function formatSize(size: number | null): string {
  if (size === null) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024)
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString();
  } catch {
    return dateStr;
  }
}
