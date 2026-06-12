import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DiffHunk,
  DiffLine,
  FsClient,
  GitChangedFileDto,
  GitClient,
  GitDiffFileResponse,
  GitStatusForRepositoryResponse,
} from "@fileoctopus/ts-api";
import { normalizeIpcError } from "@fileoctopus/ts-api";

type DiffMode = "unified" | "side-by-side";

const DIFF_MODE_KEY = "fileoctopus.gitDiffMode";

interface GitReviewTabProps {
  repoRootUri: string;
  sourceUri: string;
  repoLabel: string;
  refreshToken: number;
  git: Pick<GitClient, "statusForRepository" | "diffFile">;
  fs: Pick<FsClient, "openPathWithDefaultApp" | "revealPathInFileManager">;
}

export function GitReviewTab({
  repoRootUri,
  sourceUri,
  repoLabel,
  refreshToken,
  git,
  fs,
}: GitReviewTabProps) {
  const [status, setStatus] = useState<GitStatusForRepositoryResponse | null>(
    null,
  );
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [diff, setDiff] = useState<GitDiffFileResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffMode, setDiffMode] = useState<DiffMode>(() => storedDiffMode());

  const selectedFile = useMemo(
    () => status?.files.find((file) => file.uri === selectedUri) ?? null,
    [selectedUri, status?.files],
  );

  const groups = useMemo(() => groupFiles(status?.files ?? []), [status]);

  const loadStatus = useCallback(() => {
    let cancelled = false;
    setLoadingStatus(true);
    setError(null);
    void git
      .statusForRepository({ uri: repoRootUri })
      .then((response) => {
        if (cancelled) return;
        setStatus(response);
        setSelectedUri((current) => {
          if (current && response.files.some((file) => file.uri === current)) {
            return current;
          }
          return response.files[0]?.uri ?? null;
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(normalizeIpcError(err).message);
          setStatus(null);
          setSelectedUri(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, [git, repoRootUri]);

  useEffect(() => loadStatus(), [loadStatus, refreshToken]);

  useEffect(() => {
    if (!selectedFile) {
      setDiff(null);
      return;
    }

    let cancelled = false;
    setLoadingDiff(true);
    setError(null);
    setDiff(null);
    void git
      .diffFile({ uri: selectedFile.uri })
      .then((response) => {
        if (!cancelled) setDiff(response);
      })
      .catch((err) => {
        if (!cancelled) setError(normalizeIpcError(err).message);
      })
      .finally(() => {
        if (!cancelled) setLoadingDiff(false);
      });

    return () => {
      cancelled = true;
    };
  }, [git, selectedFile]);

  const updateDiffMode = (mode: DiffMode) => {
    setDiffMode(mode);
    localStorage.setItem(DIFF_MODE_KEY, mode);
  };

  const openSelected = () => {
    if (!selectedFile || selectedFile.status === "deleted") return;
    void fs.openPathWithDefaultApp({ uri: selectedFile.uri }).catch(() => {});
  };

  const revealSelected = () => {
    if (!selectedFile) return;
    void fs.revealPathInFileManager({ uri: selectedFile.uri }).catch(() => {});
  };

  const copySelectedPath = () => {
    if (!selectedFile) return;
    void navigator.clipboard?.writeText(selectedFile.repoRelativePath);
  };

  return (
    <div className="fo-git-review">
      <header className="fo-git-review-header">
        <div className="fo-git-review-title">
          <span className="fo-git-review-kicker">Git Review</span>
          <span className="fo-git-review-repo">{repoLabel}</span>
        </div>
        <div className="fo-git-review-actions">
          <button
            type="button"
            className="fo-git-review-button"
            onClick={loadStatus}
            aria-label="Refresh Git changes"
          >
            Refresh
          </button>
          <button
            type="button"
            className="fo-git-review-button"
            onClick={() => updateDiffMode("unified")}
            aria-label="Unified diff"
            aria-pressed={diffMode === "unified"}
          >
            Unified
          </button>
          <button
            type="button"
            className="fo-git-review-button"
            onClick={() => updateDiffMode("side-by-side")}
            aria-label="Side-by-side diff"
            aria-pressed={diffMode === "side-by-side"}
          >
            Side-by-side
          </button>
        </div>
      </header>
      <div className="fo-git-review-body">
        <aside className="fo-git-review-list" aria-label="Changed files">
          <div className="fo-git-review-source" title={sourceUri}>
            {sourceUri}
          </div>
          {loadingStatus ? (
            <div className="fo-git-review-empty">Loading changes...</div>
          ) : null}
          {!loadingStatus && status?.files.length === 0 ? (
            <div className="fo-git-review-empty">No reviewable changes</div>
          ) : null}
          {groups.map((group) => (
            <section className="fo-git-review-group" key={group.folder}>
              <div className="fo-git-review-group-title">{group.folder}</div>
              {group.files.map((file) => (
                <button
                  type="button"
                  key={file.uri}
                  className={
                    file.uri === selectedUri
                      ? "fo-git-review-file fo-git-review-file-active"
                      : "fo-git-review-file"
                  }
                  onClick={() => setSelectedUri(file.uri)}
                >
                  <span
                    className={`fo-git-review-status fo-git-review-status-${file.status}`}
                    aria-label={`Git status: ${file.status}`}
                  >
                    {gitStatusLabel(file.status)}
                  </span>
                  <span className="fo-git-review-file-name">
                    {fileName(file.repoRelativePath)}
                  </span>
                </button>
              ))}
            </section>
          ))}
        </aside>
        <main className="fo-git-review-diff">
          <div className="fo-git-review-toolbar">
            <span className="fo-git-review-path">
              {selectedFile?.repoRelativePath ?? "No file selected"}
            </span>
            <button
              type="button"
              className="fo-git-review-button"
              onClick={openSelected}
              disabled={!selectedFile || selectedFile.status === "deleted"}
              aria-label="Open file"
            >
              Open
            </button>
            <button
              type="button"
              className="fo-git-review-button"
              onClick={revealSelected}
              disabled={!selectedFile}
              aria-label="Reveal file"
            >
              Reveal
            </button>
            <button
              type="button"
              className="fo-git-review-button"
              onClick={copySelectedPath}
              disabled={!selectedFile}
              aria-label="Copy Git path"
            >
              Copy Path
            </button>
          </div>
          {error ? <div className="fo-git-review-error">{error}</div> : null}
          {loadingDiff ? (
            <div className="fo-git-review-empty">Loading diff...</div>
          ) : null}
          {!loadingDiff && diff ? (
            <GitDiffView diff={diff} mode={diffMode} />
          ) : null}
        </main>
      </div>
    </div>
  );
}

function GitDiffView({
  diff,
  mode,
}: {
  diff: GitDiffFileResponse;
  mode: DiffMode;
}) {
  if (diff.binary || diff.unsupportedReason) {
    return (
      <div className="fo-git-review-empty">
        {diff.binary ? "Binary file" : "Diff unavailable"}:{" "}
        {diff.unsupportedReason ?? "summary only"}
      </div>
    );
  }

  if (diff.hunks.length === 0) {
    return <div className="fo-git-review-empty">No differences</div>;
  }

  return mode === "side-by-side" ? (
    <SideBySideDiff hunks={diff.hunks} />
  ) : (
    <UnifiedDiff hunks={diff.hunks} />
  );
}

function UnifiedDiff({ hunks }: { hunks: DiffHunk[] }) {
  return (
    <div
      className="fo-git-review-unified"
      data-testid="git-review-diff-unified"
    >
      {hunks.map((hunk, index) => (
        <div className="fo-git-review-hunk" key={index}>
          <div className="fo-git-review-hunk-header">
            @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount}{" "}
            @@
          </div>
          {hunk.lines.map((line, lineIndex) => (
            <DiffLineRow line={line} key={lineIndex} />
          ))}
        </div>
      ))}
    </div>
  );
}

function SideBySideDiff({ hunks }: { hunks: DiffHunk[] }) {
  return (
    <div
      className="fo-git-review-side-by-side"
      data-testid="git-review-diff-side-by-side"
    >
      <div className="fo-git-review-side-header">
        <span>HEAD</span>
        <span>Worktree</span>
      </div>
      {hunks.map((hunk, index) => (
        <div className="fo-git-review-hunk" key={index}>
          <div className="fo-git-review-hunk-header">
            @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount}{" "}
            @@
          </div>
          {pairedLines(hunk.lines).map((pair, pairIndex) => (
            <div className="fo-git-review-side-row" key={pairIndex}>
              <SideCell line={pair.left} />
              <SideCell line={pair.right} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function DiffLineRow({ line }: { line: DiffLine }) {
  const marker =
    line.kind === "delete" ? "-" : line.kind === "insert" ? "+" : " ";
  return (
    <div className={`fo-git-review-line fo-git-review-line-${line.kind}`}>
      <span className="fo-git-review-num">{line.oldLine ?? ""}</span>
      <span className="fo-git-review-num">{line.newLine ?? ""}</span>
      <span className="fo-git-review-marker">{marker}</span>
      <span className="fo-git-review-code">{trimLine(line.content)}</span>
    </div>
  );
}

function SideCell({ line }: { line: DiffLine | null }) {
  return (
    <div
      className={
        line
          ? `fo-git-review-side-cell fo-git-review-line-${line.kind}`
          : "fo-git-review-side-cell"
      }
    >
      <span className="fo-git-review-num">
        {line?.oldLine ?? line?.newLine ?? ""}
      </span>
      <span className="fo-git-review-code">
        {line ? trimLine(line.content) : ""}
      </span>
    </div>
  );
}

function pairedLines(lines: DiffLine[]) {
  const pairs: Array<{ left: DiffLine | null; right: DiffLine | null }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = lines[index + 1];
    if (line.kind === "delete" && next?.kind === "insert") {
      pairs.push({ left: line, right: next });
      index += 1;
      continue;
    }
    if (line.kind === "delete") {
      pairs.push({ left: line, right: null });
      continue;
    }
    if (line.kind === "insert") {
      pairs.push({ left: null, right: line });
      continue;
    }
    pairs.push({ left: line, right: line });
  }
  return pairs;
}

function groupFiles(files: GitChangedFileDto[]) {
  const groups = new Map<string, GitChangedFileDto[]>();
  for (const file of files) {
    const folder = folderName(file.repoRelativePath);
    groups.set(folder, [...(groups.get(folder) ?? []), file]);
  }
  return [...groups.entries()].map(([folder, files]) => ({ folder, files }));
}

function storedDiffMode(): DiffMode {
  return localStorage.getItem(DIFF_MODE_KEY) === "side-by-side"
    ? "side-by-side"
    : "unified";
}

function folderName(path: string): string {
  const parts = path.split("/");
  if (parts.length <= 1) return ".";
  return parts.slice(0, -1).join("/");
}

function fileName(path: string): string {
  return path.split("/").pop() ?? path;
}

function trimLine(content: string): string {
  return content.endsWith("\n") ? content.slice(0, -1) : content;
}

function gitStatusLabel(status: GitChangedFileDto["status"]): string {
  switch (status) {
    case "modified":
      return "M";
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    case "untracked":
      return "?";
    case "ignored":
      return "I";
    case "conflicted":
      return "U";
    case "unknown":
      return "!";
    case "clean":
      return "";
  }
}
