import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DiffHunk,
  DiffLine,
  FsClient,
  GitBranchesResponse,
  GitChangedFileDto,
  GitClient,
  GitDiffFileResponse,
  GitHistoryResponse,
  GitStatusForRepositoryResponse,
  GitWorktreesResponse,
} from "@fileoctopus/ts-api";
import { normalizeIpcError } from "@fileoctopus/ts-api";

type DiffMode = "unified" | "side-by-side";
type GitSubTab = "changes" | "history" | "branches" | "worktrees";

const DIFF_MODE_KEY = "fileoctopus.gitDiffMode";
const GIT_SUB_TABS: Array<{ id: GitSubTab; label: string }> = [
  { id: "changes", label: "Changes" },
  { id: "history", label: "History" },
  { id: "branches", label: "Branches" },
  { id: "worktrees", label: "Worktrees" },
];

interface GitReviewTabProps {
  repoRootUri: string;
  sourceUri: string;
  repoLabel: string;
  refreshToken: number;
  git: Pick<
    GitClient,
    "statusForRepository" | "diffFile" | "history" | "branches" | "worktrees"
  >;
  fs: Pick<FsClient, "openPathWithDefaultApp" | "revealPathInFileManager">;
  onNavigate?: (uri: string) => void;
}

export function GitReviewTab({
  repoRootUri,
  sourceUri,
  repoLabel,
  refreshToken,
  git,
  fs,
  onNavigate,
}: GitReviewTabProps) {
  const [activeTab, setActiveTab] = useState<GitSubTab>("changes");
  const [status, setStatus] = useState<GitStatusForRepositoryResponse | null>(
    null,
  );
  const [history, setHistory] = useState<GitHistoryResponse | null>(null);
  const [branches, setBranches] = useState<GitBranchesResponse | null>(null);
  const [worktrees, setWorktrees] = useState<GitWorktreesResponse | null>(null);
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [diff, setDiff] = useState<GitDiffFileResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingWorktrees, setLoadingWorktrees] = useState(false);
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

  const loadHistory = useCallback(() => {
    let cancelled = false;
    setLoadingHistory(true);
    setError(null);
    void git
      .history({ uri: repoRootUri, maxCount: 100 })
      .then((response) => {
        if (!cancelled) setHistory(response);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(normalizeIpcError(err).message);
          setHistory(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [git, repoRootUri]);

  const loadBranches = useCallback(() => {
    let cancelled = false;
    setLoadingBranches(true);
    setError(null);
    void git
      .branches({ uri: repoRootUri })
      .then((response) => {
        if (!cancelled) setBranches(response);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(normalizeIpcError(err).message);
          setBranches(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingBranches(false);
      });
    return () => {
      cancelled = true;
    };
  }, [git, repoRootUri]);

  const loadWorktrees = useCallback(() => {
    let cancelled = false;
    setLoadingWorktrees(true);
    setError(null);
    void git
      .worktrees({ uri: repoRootUri })
      .then((response) => {
        if (!cancelled) setWorktrees(response);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(normalizeIpcError(err).message);
          setWorktrees(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingWorktrees(false);
      });
    return () => {
      cancelled = true;
    };
  }, [git, repoRootUri]);

  useEffect(() => {
    switch (activeTab) {
      case "changes":
        return loadStatus();
      case "history":
        return loadHistory();
      case "branches":
        return loadBranches();
      case "worktrees":
        return loadWorktrees();
    }
  }, [
    activeTab,
    loadBranches,
    loadHistory,
    loadStatus,
    loadWorktrees,
    refreshToken,
  ]);

  useEffect(() => {
    if (activeTab !== "changes" || !selectedFile) {
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
  }, [activeTab, git, selectedFile]);

  const updateDiffMode = (mode: DiffMode) => {
    setDiffMode(mode);
    localStorage.setItem(DIFF_MODE_KEY, mode);
  };

  const refreshActiveTab = () => {
    switch (activeTab) {
      case "changes":
        loadStatus();
        return;
      case "history":
        loadHistory();
        return;
      case "branches":
        loadBranches();
        return;
      case "worktrees":
        loadWorktrees();
    }
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

  const copyCommitHash = (hash: string) => {
    void navigator.clipboard?.writeText(hash);
  };

  const revealWorktree = (uri: string) => {
    void fs.revealPathInFileManager({ uri }).catch(() => {});
  };

  return (
    <div className="fo-git-review">
      <header className="fo-git-review-header">
        <div className="fo-git-review-title">
          <span className="fo-git-review-kicker">Git Review</span>
          <span className="fo-git-review-repo" title={repoLabel}>
            Repo {repoLabel}
          </span>
        </div>
        <nav className="fo-git-review-tabs" aria-label="Git workspace">
          {GIT_SUB_TABS.map((tab) => (
            <button
              type="button"
              key={tab.id}
              className="fo-git-review-button"
              aria-pressed={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="fo-git-review-actions">
          <button
            type="button"
            className="fo-git-review-button"
            onClick={refreshActiveTab}
            aria-label="Refresh Git changes"
          >
            Refresh
          </button>
          {activeTab === "changes" ? (
            <>
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
            </>
          ) : null}
        </div>
      </header>
      {activeTab === "changes" ? (
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
      ) : null}
      {activeTab === "history" ? (
        <GitHistoryPanel
          response={history}
          loading={loadingHistory}
          error={error}
          onCopyHash={copyCommitHash}
        />
      ) : null}
      {activeTab === "branches" ? (
        <GitBranchesPanel
          response={branches}
          loading={loadingBranches}
          error={error}
        />
      ) : null}
      {activeTab === "worktrees" ? (
        <GitWorktreesPanel
          response={worktrees}
          loading={loadingWorktrees}
          error={error}
          onNavigate={onNavigate}
          onReveal={revealWorktree}
        />
      ) : null}
    </div>
  );
}

function GitHistoryPanel({
  response,
  loading,
  error,
  onCopyHash,
}: {
  response: GitHistoryResponse | null;
  loading: boolean;
  error: string | null;
  onCopyHash: (hash: string) => void;
}) {
  const commits = response?.commits ?? [];
  return (
    <main className="fo-git-review-panel" aria-label="Git history">
      {loading ? (
        <div className="fo-git-review-empty">Loading history...</div>
      ) : null}
      {!loading && error ? (
        <div className="fo-git-review-error">{error}</div>
      ) : null}
      {!loading && !error && commits.length === 0 ? (
        <div className="fo-git-review-empty">No commits</div>
      ) : null}
      {!loading && !error && commits.length > 0 ? (
        <div className="fo-git-review-records">
          {commits.map((commit) => (
            <article className="fo-git-review-record" key={commit.hash}>
              <div className="fo-git-review-record-main">
                <div className="fo-git-review-record-title">
                  {commit.subject || "(no subject)"}
                </div>
                <div className="fo-git-review-record-meta">
                  <span>{commit.shortHash}</span>
                  <span>{commit.authorName}</span>
                  <span>{parentCountLabel(commit.parentCount)}</span>
                  <span>{commit.authoredAt}</span>
                </div>
              </div>
              <button
                type="button"
                className="fo-git-review-button"
                aria-label="Copy commit hash"
                onClick={() => onCopyHash(commit.hash)}
              >
                Copy
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </main>
  );
}

function GitBranchesPanel({
  response,
  loading,
  error,
}: {
  response: GitBranchesResponse | null;
  loading: boolean;
  error: string | null;
}) {
  const branches = response?.branches ?? [];
  const groups = [
    {
      label: "Local",
      branches: branches.filter((branch) => branch.kind === "local"),
    },
    {
      label: "Remote",
      branches: branches.filter((branch) => branch.kind === "remote"),
    },
  ];
  return (
    <main className="fo-git-review-panel" aria-label="Git branches">
      {loading ? (
        <div className="fo-git-review-empty">Loading branches...</div>
      ) : null}
      {!loading && error ? (
        <div className="fo-git-review-error">{error}</div>
      ) : null}
      {!loading && !error && branches.length === 0 ? (
        <div className="fo-git-review-empty">No branches</div>
      ) : null}
      {!loading && !error && branches.length > 0 ? (
        <div className="fo-git-review-records">
          {groups.map((group) =>
            group.branches.length > 0 ? (
              <section className="fo-git-review-group" key={group.label}>
                <div className="fo-git-review-group-title">{group.label}</div>
                {group.branches.map((branch) => (
                  <article
                    className="fo-git-review-record"
                    key={branch.fullName}
                  >
                    <div className="fo-git-review-record-main">
                      <div className="fo-git-review-record-title">
                        <span>{branch.name}</span>
                        {branch.isCurrent ? (
                          <span className="fo-git-review-pill">current</span>
                        ) : null}
                      </div>
                      <div className="fo-git-review-record-meta">
                        {branch.upstream ? (
                          <span>upstream {branch.upstream}</span>
                        ) : null}
                        <span>{branch.head}</span>
                        {branch.lastCommitAt ? (
                          <span>{branch.lastCommitAt}</span>
                        ) : null}
                        {branch.subject ? <span>{branch.subject}</span> : null}
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            ) : null,
          )}
        </div>
      ) : null}
    </main>
  );
}

function GitWorktreesPanel({
  response,
  loading,
  error,
  onNavigate,
  onReveal,
}: {
  response: GitWorktreesResponse | null;
  loading: boolean;
  error: string | null;
  onNavigate?: (uri: string) => void;
  onReveal: (uri: string) => void;
}) {
  const worktrees = response?.worktrees ?? [];
  return (
    <main className="fo-git-review-panel" aria-label="Git worktrees">
      {loading ? (
        <div className="fo-git-review-empty">Loading worktrees...</div>
      ) : null}
      {!loading && error ? (
        <div className="fo-git-review-error">{error}</div>
      ) : null}
      {!loading && !error && worktrees.length === 0 ? (
        <div className="fo-git-review-empty">No worktrees</div>
      ) : null}
      {!loading && !error && worktrees.length > 0 ? (
        <div className="fo-git-review-records">
          {worktrees.map((worktree) => (
            <article className="fo-git-review-record" key={worktree.pathUri}>
              <div className="fo-git-review-record-main">
                <div className="fo-git-review-record-title">
                  {worktree.pathUri}
                </div>
                <div className="fo-git-review-record-meta">
                  <span>{worktree.branch ?? worktreeStateLabel(worktree)}</span>
                  {worktree.head ? (
                    <span>{shortHash(worktree.head)}</span>
                  ) : null}
                  {worktree.bare ? <span>bare</span> : null}
                  {worktree.prunable ? (
                    <span>
                      {worktree.prunableReason
                        ? `prunable ${worktree.prunableReason}`
                        : "prunable"}
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                className="fo-git-review-button"
                aria-label="Open worktree"
                disabled={!onNavigate}
                onClick={() => onNavigate?.(worktree.pathUri)}
              >
                Open
              </button>
              <button
                type="button"
                className="fo-git-review-button"
                aria-label="Reveal worktree"
                onClick={() => onReveal(worktree.pathUri)}
              >
                Reveal
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </main>
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

function parentCountLabel(count: number): string {
  return count === 1 ? "1 parent" : `${count} parents`;
}

function shortHash(hash: string): string {
  return hash.length > 7 ? hash.slice(0, 7) : hash;
}

function worktreeStateLabel(worktree: { detached: boolean }): string {
  return worktree.detached ? "detached" : "no branch";
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
