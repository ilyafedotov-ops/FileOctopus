import { useEffect, useMemo, useState } from "react";
import type { DiffHunk, DiffTextResponse, FsClient } from "@fileoctopus/ts-api";

interface DiffDialogProps {
  open: boolean;
  leftUri: string;
  rightUri: string;
  leftName: string;
  rightName: string;
  fs: FsClient;
  onClose: () => void;
}

export function DiffDialog({
  open,
  leftUri,
  rightUri,
  leftName,
  rightName,
  fs,
  onClose,
}: DiffDialogProps) {
  const [result, setResult] = useState<DiffTextResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);
    fs.diffText({ leftUri, rightUri })
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
  }, [open, leftUri, rightUri, fs]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, onClose]);

  const stats = useMemo(() => {
    if (!result) return null;
    let added = 0;
    let removed = 0;
    for (const hunk of result.hunks) {
      for (const line of hunk.lines) {
        if (line.kind === "insert") added++;
        if (line.kind === "delete") removed++;
      }
    }
    return { added, removed };
  }, [result]);

  if (!open) return null;

  return (
    <div
      className="fo-diff-backdrop"
      role="dialog"
      aria-label="File diff viewer"
      aria-modal="true"
    >
      <div className="fo-diff-modal">
        <div className="fo-diff-header">
          <span className="fo-diff-title">
            <span className="fo-diff-name">{leftName}</span>
            <span className="fo-diff-arrow">→</span>
            <span className="fo-diff-name">{rightName}</span>
          </span>
          {stats && (
            <span className="fo-diff-stats">
              <span className="fo-diff-stat-added">+{stats.added}</span>
              <span className="fo-diff-stat-removed">−{stats.removed}</span>
            </span>
          )}
          <button
            className="fo-diff-close"
            onClick={onClose}
            title="Close diff viewer (Esc)"
            aria-label="Close diff viewer"
          >
            ✕
          </button>
        </div>
        <div className="fo-diff-body">
          {loading && <div className="fo-diff-loading">Loading diff…</div>}
          {error && <div className="fo-diff-error">Error: {error}</div>}
          {result && (result.leftTruncated || result.rightTruncated) && (
            <div className="fo-diff-warning">
              File{result.leftTruncated && result.rightTruncated ? "s" : ""}{" "}
              truncated — showing first 512 KB
            </div>
          )}
          {result && result.hunks.length === 0 && !loading && !error && (
            <div className="fo-diff-no-changes">
              No differences between files ({result.leftLineCount} lines)
            </div>
          )}
          {result && result.hunks.length > 0 && (
            <DiffView
              hunks={result.hunks}
              leftName={leftName}
              rightName={rightName}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DiffView({
  hunks,
  leftName,
  rightName,
}: {
  hunks: DiffHunk[];
  leftName: string;
  rightName: string;
}) {
  return (
    <div className="fo-diff-content">
      <div className="fo-diff-pane-header">
        <span className="fo-diff-pane-title">{leftName}</span>
        <span className="fo-diff-pane-title">{rightName}</span>
      </div>
      {hunks.map((hunk, hi) => (
        <DiffHunkView key={hi} hunk={hunk} />
      ))}
    </div>
  );
}

function DiffHunkView({ hunk }: { hunk: DiffHunk }) {
  return (
    <div className="fo-diff-hunk">
      <div className="fo-diff-hunk-header">
        @@ −{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
      </div>
      <div className="fo-diff-lines">
        {hunk.lines.map((line, li) => (
          <DiffLineView key={li} line={line} />
        ))}
      </div>
    </div>
  );
}

function DiffLineView({
  line,
}: {
  line: {
    kind: string;
    content: string;
    oldLine?: number | null;
    newLine?: number | null;
  };
}) {
  const cls =
    line.kind === "delete"
      ? "fo-diff-line fo-diff-line-delete"
      : line.kind === "insert"
        ? "fo-diff-line fo-diff-line-insert"
        : "fo-diff-line fo-diff-line-equal";

  const displayContent = line.content.endsWith("\n")
    ? line.content.slice(0, -1)
    : line.content;

  return (
    <div className={cls}>
      <span className="fo-diff-old-num">{line.oldLine ?? ""}</span>
      <span className="fo-diff-new-num">{line.newLine ?? ""}</span>
      <span className="fo-diff-marker">
        {line.kind === "delete" ? "−" : line.kind === "insert" ? "+" : " "}
      </span>
      <span className="fo-diff-text">{displayContent}</span>
    </div>
  );
}
