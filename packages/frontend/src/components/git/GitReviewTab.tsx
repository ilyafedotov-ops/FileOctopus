import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DiffHunk,
  DiffLine,
  FsClient,
  GitBranchesResponse,
  GitChangedFileDto,
  GitClient,
  GitCommitDto,
  GitDiffFileResponse,
  GitHistoryResponse,
  GitRevisionDiffResponse,
  GitRevisionFileDto,
  GitRevisionFilesResponse,
  GitStatusForRepositoryResponse,
  GitWorktreesResponse,
} from "@fileoctopus/ts-api";
import { normalizeIpcError } from "@fileoctopus/ts-api";

type DiffMode = "unified" | "side-by-side";
type GitSubTab = "changes" | "history" | "branches" | "worktrees" | "files";

const DIFF_MODE_KEY = "fileoctopus.gitDiffMode";
const MAX_DIFF_BYTES = 512 * 1024;
const MAX_TREE_FILES = 1000;
const GIT_SUB_TABS: Array<{ id: GitSubTab; label: string }> = [
  { id: "changes", label: "Changes" },
  { id: "history", label: "History" },
  { id: "branches", label: "Branches" },
  { id: "worktrees", label: "Worktrees" },
  { id: "files", label: "Files" },
];

interface GitReviewTabProps {
  repoRootUri: string;
  sourceUri: string;
  repoLabel: string;
  refreshToken: number;
  git: Pick<
    GitClient,
    | "statusForRepository"
    | "diffFile"
    | "history"
    | "branches"
    | "worktrees"
    | "revisionDiff"
    | "revisionFiles"
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
  const [repoFiles, setRepoFiles] = useState<GitRevisionFilesResponse | null>(
    null,
  );
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [selectedHistoryCommitHash, setSelectedHistoryCommitHash] = useState<
    string | null
  >(null);
  const [historyDiff, setHistoryDiff] =
    useState<GitRevisionDiffResponse | null>(null);
  const [selectedHistoryDiffUri, setSelectedHistoryDiffUri] = useState<
    string | null
  >(null);
  const [selectedBranchName, setSelectedBranchName] = useState<string | null>(
    null,
  );
  const [branchDiff, setBranchDiff] = useState<GitRevisionDiffResponse | null>(
    null,
  );
  const [branchFiles, setBranchFiles] =
    useState<GitRevisionFilesResponse | null>(null);
  const [selectedBranchDiffUri, setSelectedBranchDiffUri] = useState<
    string | null
  >(null);
  const [selectedBranchFileUri, setSelectedBranchFileUri] = useState<
    string | null
  >(null);
  const [selectedWorktreeUri, setSelectedWorktreeUri] = useState<string | null>(
    null,
  );
  const [worktreeStatus, setWorktreeStatus] =
    useState<GitStatusForRepositoryResponse | null>(null);
  const [worktreeDiff, setWorktreeDiff] = useState<GitDiffFileResponse | null>(
    null,
  );
  const [selectedWorktreeFileUri, setSelectedWorktreeFileUri] = useState<
    string | null
  >(null);
  const [selectedRepoFileUri, setSelectedRepoFileUri] = useState<string | null>(
    null,
  );
  const [diff, setDiff] = useState<GitDiffFileResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingHistoryDiff, setLoadingHistoryDiff] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingBranchDetail, setLoadingBranchDetail] = useState(false);
  const [loadingWorktrees, setLoadingWorktrees] = useState(false);
  const [loadingWorktreeStatus, setLoadingWorktreeStatus] = useState(false);
  const [loadingWorktreeDiff, setLoadingWorktreeDiff] = useState(false);
  const [loadingRepoFiles, setLoadingRepoFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffMode, setDiffMode] = useState<DiffMode>(() => storedDiffMode());

  const selectedFile = useMemo(
    () => status?.files.find((file) => file.uri === selectedUri) ?? null,
    [selectedUri, status?.files],
  );

  const groups = useMemo(() => groupFiles(status?.files ?? []), [status]);

  const selectedHistoryCommit = useMemo(
    () =>
      history?.commits.find(
        (commit) => commit.hash === selectedHistoryCommitHash,
      ) ?? null,
    [history?.commits, selectedHistoryCommitHash],
  );

  const selectedHistoryDiff = useMemo(
    () =>
      historyDiff?.files.find(
        (file) => file.file.uri === selectedHistoryDiffUri,
      ) ?? null,
    [historyDiff?.files, selectedHistoryDiffUri],
  );

  const selectedBranch = useMemo(
    () =>
      branches?.branches.find(
        (branch) => branch.fullName === selectedBranchName,
      ) ?? null,
    [branches?.branches, selectedBranchName],
  );

  const selectedBranchDiff = useMemo(
    () =>
      branchDiff?.files.find(
        (file) => file.file.uri === selectedBranchDiffUri,
      ) ?? null,
    [branchDiff?.files, selectedBranchDiffUri],
  );

  const selectedBranchFile = useMemo(
    () =>
      branchFiles?.files.find((file) => file.uri === selectedBranchFileUri) ??
      null,
    [branchFiles?.files, selectedBranchFileUri],
  );

  const selectedWorktree = useMemo(
    () =>
      worktrees?.worktrees.find(
        (worktree) => worktree.pathUri === selectedWorktreeUri,
      ) ?? null,
    [selectedWorktreeUri, worktrees?.worktrees],
  );

  const selectedWorktreeFile = useMemo(
    () =>
      worktreeStatus?.files.find(
        (file) => file.uri === selectedWorktreeFileUri,
      ) ?? null,
    [selectedWorktreeFileUri, worktreeStatus?.files],
  );

  const selectedRepoFile = useMemo(
    () =>
      repoFiles?.files.find((file) => file.uri === selectedRepoFileUri) ?? null,
    [repoFiles?.files, selectedRepoFileUri],
  );

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
        if (cancelled) return;
        setHistory(response);
        setSelectedHistoryCommitHash((current) => {
          if (
            current &&
            response.commits.some((commit) => commit.hash === current)
          ) {
            return current;
          }
          return response.commits[0]?.hash ?? null;
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(normalizeIpcError(err).message);
          setHistory(null);
          setSelectedHistoryCommitHash(null);
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
        if (cancelled) return;
        setBranches(response);
        setSelectedBranchName((current) => {
          if (
            current &&
            response.branches.some((branch) => branch.fullName === current)
          ) {
            return current;
          }
          return (
            response.branches.find((branch) => branch.isCurrent)?.fullName ??
            response.branches[0]?.fullName ??
            null
          );
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(normalizeIpcError(err).message);
          setBranches(null);
          setSelectedBranchName(null);
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
        if (cancelled) return;
        setWorktrees(response);
        setSelectedWorktreeUri((current) => {
          if (
            current &&
            response.worktrees.some((worktree) => worktree.pathUri === current)
          ) {
            return current;
          }
          return response.worktrees[0]?.pathUri ?? null;
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(normalizeIpcError(err).message);
          setWorktrees(null);
          setSelectedWorktreeUri(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingWorktrees(false);
      });
    return () => {
      cancelled = true;
    };
  }, [git, repoRootUri]);

  const loadRepoFiles = useCallback(() => {
    let cancelled = false;
    setLoadingRepoFiles(true);
    setError(null);
    void git
      .revisionFiles({
        uri: repoRootUri,
        revision: "HEAD",
        maxCount: MAX_TREE_FILES,
      })
      .then((response) => {
        if (cancelled) return;
        setRepoFiles(response);
        setSelectedRepoFileUri((current) => {
          if (current && response.files.some((file) => file.uri === current)) {
            return current;
          }
          return response.files[0]?.uri ?? null;
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(normalizeIpcError(err).message);
          setRepoFiles(null);
          setSelectedRepoFileUri(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRepoFiles(false);
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
      case "files":
        return loadRepoFiles();
    }
  }, [
    activeTab,
    loadBranches,
    loadHistory,
    loadRepoFiles,
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

  useEffect(() => {
    if (activeTab !== "history" || !selectedHistoryCommit) {
      setHistoryDiff(null);
      setSelectedHistoryDiffUri(null);
      return;
    }

    let cancelled = false;
    setLoadingHistoryDiff(true);
    setError(null);
    const base =
      selectedHistoryCommit.parents[0] ?? `${selectedHistoryCommit.hash}^`;
    void git
      .revisionDiff({
        uri: repoRootUri,
        base,
        head: selectedHistoryCommit.hash,
        maxBytes: MAX_DIFF_BYTES,
      })
      .then((response) => {
        if (cancelled) return;
        setHistoryDiff(response);
        setSelectedHistoryDiffUri((current) => {
          if (
            current &&
            response.files.some((file) => file.file.uri === current)
          ) {
            return current;
          }
          return response.files[0]?.file.uri ?? null;
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(normalizeIpcError(err).message);
          setHistoryDiff(null);
          setSelectedHistoryDiffUri(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingHistoryDiff(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, git, repoRootUri, selectedHistoryCommit]);

  useEffect(() => {
    if (activeTab !== "branches" || !selectedBranch) {
      setBranchDiff(null);
      setBranchFiles(null);
      setSelectedBranchDiffUri(null);
      setSelectedBranchFileUri(null);
      return;
    }

    let cancelled = false;
    setLoadingBranchDetail(true);
    setError(null);
    void Promise.all([
      git.revisionDiff({
        uri: repoRootUri,
        base: "HEAD",
        head: selectedBranch.fullName,
        maxBytes: MAX_DIFF_BYTES,
      }),
      git.revisionFiles({
        uri: repoRootUri,
        revision: selectedBranch.fullName,
        maxCount: MAX_TREE_FILES,
      }),
    ])
      .then(([diffResponse, filesResponse]) => {
        if (cancelled) return;
        setBranchDiff(diffResponse);
        setBranchFiles(filesResponse);
        setSelectedBranchDiffUri((current) => {
          if (
            current &&
            diffResponse.files.some((file) => file.file.uri === current)
          ) {
            return current;
          }
          return diffResponse.files[0]?.file.uri ?? null;
        });
        setSelectedBranchFileUri((current) => {
          if (
            current &&
            filesResponse.files.some((file) => file.uri === current)
          ) {
            return current;
          }
          return filesResponse.files[0]?.uri ?? null;
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(normalizeIpcError(err).message);
          setBranchDiff(null);
          setBranchFiles(null);
          setSelectedBranchDiffUri(null);
          setSelectedBranchFileUri(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingBranchDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, git, repoRootUri, selectedBranch]);

  useEffect(() => {
    if (activeTab !== "worktrees" || !selectedWorktree) {
      setWorktreeStatus(null);
      setSelectedWorktreeFileUri(null);
      return;
    }

    let cancelled = false;
    setLoadingWorktreeStatus(true);
    setError(null);
    void git
      .statusForRepository({ uri: selectedWorktree.pathUri })
      .then((response) => {
        if (cancelled) return;
        setWorktreeStatus(response);
        setSelectedWorktreeFileUri((current) => {
          if (current && response.files.some((file) => file.uri === current)) {
            return current;
          }
          return response.files[0]?.uri ?? null;
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(normalizeIpcError(err).message);
          setWorktreeStatus(null);
          setSelectedWorktreeFileUri(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingWorktreeStatus(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, git, selectedWorktree]);

  useEffect(() => {
    if (activeTab !== "worktrees" || !selectedWorktreeFile) {
      setWorktreeDiff(null);
      return;
    }

    let cancelled = false;
    setLoadingWorktreeDiff(true);
    setError(null);
    setWorktreeDiff(null);
    void git
      .diffFile({ uri: selectedWorktreeFile.uri })
      .then((response) => {
        if (!cancelled) setWorktreeDiff(response);
      })
      .catch((err) => {
        if (!cancelled) setError(normalizeIpcError(err).message);
      })
      .finally(() => {
        if (!cancelled) setLoadingWorktreeDiff(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, git, selectedWorktreeFile]);

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
        return;
      case "files":
        loadRepoFiles();
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

  const openRepoFile = () => {
    if (!selectedRepoFile) return;
    void fs
      .openPathWithDefaultApp({ uri: selectedRepoFile.uri })
      .catch(() => {});
  };

  const revealRepoFile = () => {
    if (!selectedRepoFile) return;
    void fs
      .revealPathInFileManager({ uri: selectedRepoFile.uri })
      .catch(() => {});
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
          loadingDiff={loadingHistoryDiff}
          error={error}
          selectedCommitHash={selectedHistoryCommitHash}
          selectedDiffUri={selectedHistoryDiffUri}
          diff={historyDiff}
          selectedDiff={selectedHistoryDiff}
          diffMode={diffMode}
          onSelectCommit={setSelectedHistoryCommitHash}
          onSelectDiff={setSelectedHistoryDiffUri}
          onCopyHash={copyCommitHash}
        />
      ) : null}
      {activeTab === "branches" ? (
        <GitBranchesPanel
          response={branches}
          loading={loadingBranches}
          loadingDetail={loadingBranchDetail}
          error={error}
          selectedBranchName={selectedBranchName}
          selectedDiffUri={selectedBranchDiffUri}
          diff={branchDiff}
          files={branchFiles}
          selectedDiff={selectedBranchDiff}
          selectedFile={selectedBranchFile}
          selectedFileUri={selectedBranchFileUri}
          diffMode={diffMode}
          onSelectBranch={setSelectedBranchName}
          onSelectDiff={setSelectedBranchDiffUri}
          onSelectFile={setSelectedBranchFileUri}
        />
      ) : null}
      {activeTab === "worktrees" ? (
        <GitWorktreesPanel
          response={worktrees}
          loading={loadingWorktrees}
          loadingStatus={loadingWorktreeStatus}
          loadingDiff={loadingWorktreeDiff}
          error={error}
          selectedWorktreeUri={selectedWorktreeUri}
          status={worktreeStatus}
          diff={worktreeDiff}
          selectedFileUri={selectedWorktreeFileUri}
          selectedFile={selectedWorktreeFile}
          diffMode={diffMode}
          onSelectWorktree={setSelectedWorktreeUri}
          onSelectFile={setSelectedWorktreeFileUri}
          onNavigate={onNavigate}
          onReveal={revealWorktree}
        />
      ) : null}
      {activeTab === "files" ? (
        <GitFilesPanel
          response={repoFiles}
          loading={loadingRepoFiles}
          error={error}
          selectedUri={selectedRepoFileUri}
          onSelectFile={setSelectedRepoFileUri}
          onOpen={openRepoFile}
          onReveal={revealRepoFile}
        />
      ) : null}
    </div>
  );
}

function GitHistoryPanel({
  response,
  loading,
  loadingDiff,
  error,
  selectedCommitHash,
  selectedDiffUri,
  diff,
  selectedDiff,
  diffMode,
  onSelectCommit,
  onSelectDiff,
  onCopyHash,
}: {
  response: GitHistoryResponse | null;
  loading: boolean;
  loadingDiff: boolean;
  error: string | null;
  selectedCommitHash: string | null;
  selectedDiffUri: string | null;
  diff: GitRevisionDiffResponse | null;
  selectedDiff: GitDiffFileResponse | null;
  diffMode: DiffMode;
  onSelectCommit: (hash: string) => void;
  onSelectDiff: (uri: string) => void;
  onCopyHash: (hash: string) => void;
}) {
  const commits = response?.commits ?? [];
  const selectedCommit =
    commits.find((commit) => commit.hash === selectedCommitHash) ?? null;
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
        <div className="fo-git-review-detail-body">
          <div className="fo-git-review-records" aria-label="Commits">
            {commits.map((commit) => (
              <article
                className={
                  commit.hash === selectedCommitHash
                    ? "fo-git-review-record fo-git-review-record-active"
                    : "fo-git-review-record"
                }
                key={commit.hash}
              >
                <div className="fo-git-review-record-main">
                  <div className="fo-git-review-record-title">
                    <span>{commit.subject || "(no subject)"}</span>
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
                  aria-label={`View commit ${commitTitle(commit)}`}
                  onClick={() => onSelectCommit(commit.hash)}
                >
                  View
                </button>
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
          <GitRevisionDiffDetail
            title={selectedCommit ? commitTitle(selectedCommit) : "Commit"}
            loading={loadingDiff}
            diff={diff}
            selectedDiff={selectedDiff}
            selectedUri={selectedDiffUri}
            diffMode={diffMode}
            emptyLabel="No files changed in this commit"
            onSelectDiff={onSelectDiff}
          />
        </div>
      ) : null}
    </main>
  );
}

function GitBranchesPanel({
  response,
  loading,
  loadingDetail,
  error,
  selectedBranchName,
  selectedDiffUri,
  diff,
  files,
  selectedDiff,
  selectedFile,
  selectedFileUri,
  diffMode,
  onSelectBranch,
  onSelectDiff,
  onSelectFile,
}: {
  response: GitBranchesResponse | null;
  loading: boolean;
  loadingDetail: boolean;
  error: string | null;
  selectedBranchName: string | null;
  selectedDiffUri: string | null;
  diff: GitRevisionDiffResponse | null;
  files: GitRevisionFilesResponse | null;
  selectedDiff: GitDiffFileResponse | null;
  selectedFile: GitRevisionFileDto | null;
  selectedFileUri: string | null;
  diffMode: DiffMode;
  onSelectBranch: (fullName: string) => void;
  onSelectDiff: (uri: string) => void;
  onSelectFile: (uri: string) => void;
}) {
  const branches = response?.branches ?? [];
  const selectedBranch =
    branches.find((branch) => branch.fullName === selectedBranchName) ?? null;
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
        <div className="fo-git-review-detail-body">
          <div className="fo-git-review-records" aria-label="Branches">
            {groups.map((group) =>
              group.branches.length > 0 ? (
                <section className="fo-git-review-group" key={group.label}>
                  <div className="fo-git-review-group-title">{group.label}</div>
                  {group.branches.map((branch) => (
                    <article
                      className={
                        branch.fullName === selectedBranchName
                          ? "fo-git-review-record fo-git-review-record-active"
                          : "fo-git-review-record"
                      }
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
                          {branch.subject ? (
                            <span>{branch.subject}</span>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="fo-git-review-button"
                        aria-label={`View branch ${branch.name}`}
                        onClick={() => onSelectBranch(branch.fullName)}
                      >
                        View
                      </button>
                    </article>
                  ))}
                </section>
              ) : null,
            )}
          </div>
          <div className="fo-git-review-stacked-detail">
            <GitRevisionDiffDetail
              title={
                selectedBranch ? `Changes in ${selectedBranch.name}` : "Branch"
              }
              loading={loadingDetail}
              diff={diff}
              selectedDiff={selectedDiff}
              selectedUri={selectedDiffUri}
              diffMode={diffMode}
              emptyLabel="No branch differences from HEAD"
              onSelectDiff={onSelectDiff}
            />
            <section
              className="fo-git-review-tree-panel"
              aria-label="Branch tracked files"
            >
              <div className="fo-git-review-toolbar">
                <span className="fo-git-review-path">
                  {selectedFile
                    ? selectedFile.repoRelativePath
                    : selectedBranch
                      ? `Tracked files in ${selectedBranch.name}`
                      : "Tracked files"}
                </span>
              </div>
              {loadingDetail ? (
                <div className="fo-git-review-empty">Loading files...</div>
              ) : null}
              {!loadingDetail && files?.files.length === 0 ? (
                <div className="fo-git-review-empty">No tracked files</div>
              ) : null}
              {!loadingDetail && files && files.files.length > 0 ? (
                <GitRevisionFilesList
                  files={files.files}
                  selectedUri={selectedFileUri}
                  onSelectFile={onSelectFile}
                />
              ) : null}
            </section>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function GitWorktreesPanel({
  response,
  loading,
  loadingStatus,
  loadingDiff,
  error,
  selectedWorktreeUri,
  status,
  diff,
  selectedFileUri,
  selectedFile,
  diffMode,
  onSelectWorktree,
  onSelectFile,
  onNavigate,
  onReveal,
}: {
  response: GitWorktreesResponse | null;
  loading: boolean;
  loadingStatus: boolean;
  loadingDiff: boolean;
  error: string | null;
  selectedWorktreeUri: string | null;
  status: GitStatusForRepositoryResponse | null;
  diff: GitDiffFileResponse | null;
  selectedFileUri: string | null;
  selectedFile: GitChangedFileDto | null;
  diffMode: DiffMode;
  onSelectWorktree: (uri: string) => void;
  onSelectFile: (uri: string) => void;
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
        <div className="fo-git-review-detail-body">
          <div className="fo-git-review-records" aria-label="Worktrees">
            {worktrees.map((worktree) => (
              <article
                className={
                  worktree.pathUri === selectedWorktreeUri
                    ? "fo-git-review-record fo-git-review-record-active"
                    : "fo-git-review-record"
                }
                key={worktree.pathUri}
              >
                <div className="fo-git-review-record-main">
                  <div className="fo-git-review-record-title">
                    {worktree.pathUri}
                  </div>
                  <div className="fo-git-review-record-meta">
                    <span>
                      {worktree.branch ?? worktreeStateLabel(worktree)}
                    </span>
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
                  aria-label={`View worktree ${worktree.pathUri}`}
                  onClick={() => onSelectWorktree(worktree.pathUri)}
                >
                  View
                </button>
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
          <GitWorktreeDetail
            status={status}
            diff={diff}
            selectedFile={selectedFile}
            selectedFileUri={selectedFileUri}
            loadingStatus={loadingStatus}
            loadingDiff={loadingDiff}
            diffMode={diffMode}
            onSelectFile={onSelectFile}
          />
        </div>
      ) : null}
    </main>
  );
}

function GitFilesPanel({
  response,
  loading,
  error,
  selectedUri,
  onSelectFile,
  onOpen,
  onReveal,
}: {
  response: GitRevisionFilesResponse | null;
  loading: boolean;
  error: string | null;
  selectedUri: string | null;
  onSelectFile: (uri: string) => void;
  onOpen: () => void;
  onReveal: () => void;
}) {
  const files = response?.files ?? [];
  const selectedFile = files.find((file) => file.uri === selectedUri) ?? null;
  return (
    <main className="fo-git-review-panel" aria-label="Git repository files">
      {loading ? (
        <div className="fo-git-review-empty">Loading files...</div>
      ) : null}
      {!loading && error ? (
        <div className="fo-git-review-error">{error}</div>
      ) : null}
      {!loading && !error && files.length === 0 ? (
        <div className="fo-git-review-empty">No tracked files</div>
      ) : null}
      {!loading && !error && files.length > 0 ? (
        <div className="fo-git-review-detail-body">
          <GitRevisionFilesList
            files={files}
            selectedUri={selectedUri}
            onSelectFile={onSelectFile}
          />
          <section className="fo-git-review-diff" aria-label="File details">
            <div className="fo-git-review-toolbar">
              <span className="fo-git-review-path">
                {selectedFile?.repoRelativePath ?? "No file selected"}
              </span>
              <button
                type="button"
                className="fo-git-review-button"
                aria-label="Open repository file"
                disabled={!selectedFile}
                onClick={onOpen}
              >
                Open
              </button>
              <button
                type="button"
                className="fo-git-review-button"
                aria-label="Reveal repository file"
                disabled={!selectedFile}
                onClick={onReveal}
              >
                Reveal
              </button>
            </div>
            <div className="fo-git-review-empty">
              {selectedFile
                ? selectedFile.repoRelativePath
                : "Select a tracked file"}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function GitRevisionDiffDetail({
  title,
  loading,
  diff,
  selectedDiff,
  selectedUri,
  diffMode,
  emptyLabel,
  onSelectDiff,
}: {
  title: string;
  loading: boolean;
  diff: GitRevisionDiffResponse | null;
  selectedDiff: GitDiffFileResponse | null;
  selectedUri: string | null;
  diffMode: DiffMode;
  emptyLabel: string;
  onSelectDiff: (uri: string) => void;
}) {
  const files = diff?.files.map((file) => file.file) ?? [];
  return (
    <section className="fo-git-review-diff" aria-label={title}>
      <div className="fo-git-review-toolbar">
        <span className="fo-git-review-path">
          {selectedDiff?.file.repoRelativePath ?? title}
        </span>
      </div>
      {loading ? (
        <div className="fo-git-review-empty">Loading diff...</div>
      ) : null}
      {!loading && diff && files.length === 0 ? (
        <div className="fo-git-review-empty">{emptyLabel}</div>
      ) : null}
      {!loading && diff && files.length > 0 ? (
        <div className="fo-git-review-detail-body">
          <ChangedFileButtons
            files={files}
            selectedUri={selectedUri}
            onSelectFile={onSelectDiff}
          />
          <div className="fo-git-review-diff">
            <div className="fo-git-review-source">
              {selectedDiff
                ? `${selectedDiff.oldLabel} -> ${selectedDiff.newLabel}`
                : "No file selected"}
            </div>
            {selectedDiff ? (
              <GitDiffView diff={selectedDiff} mode={diffMode} />
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function GitWorktreeDetail({
  status,
  diff,
  selectedFile,
  selectedFileUri,
  loadingStatus,
  loadingDiff,
  diffMode,
  onSelectFile,
}: {
  status: GitStatusForRepositoryResponse | null;
  diff: GitDiffFileResponse | null;
  selectedFile: GitChangedFileDto | null;
  selectedFileUri: string | null;
  loadingStatus: boolean;
  loadingDiff: boolean;
  diffMode: DiffMode;
  onSelectFile: (uri: string) => void;
}) {
  const files = status?.files ?? [];
  return (
    <section className="fo-git-review-diff" aria-label="Worktree changes">
      <div className="fo-git-review-toolbar">
        <span className="fo-git-review-path">
          {selectedFile?.repoRelativePath ?? "Worktree changes"}
        </span>
      </div>
      {loadingStatus ? (
        <div className="fo-git-review-empty">Loading changes...</div>
      ) : null}
      {!loadingStatus && status && files.length === 0 ? (
        <div className="fo-git-review-empty">No reviewable changes</div>
      ) : null}
      {!loadingStatus && status && files.length > 0 ? (
        <div className="fo-git-review-detail-body">
          <ChangedFileButtons
            files={files}
            selectedUri={selectedFileUri}
            onSelectFile={onSelectFile}
          />
          <div className="fo-git-review-diff">
            {loadingDiff ? (
              <div className="fo-git-review-empty">Loading diff...</div>
            ) : null}
            {!loadingDiff && diff ? (
              <GitDiffView diff={diff} mode={diffMode} />
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ChangedFileButtons({
  files,
  selectedUri,
  onSelectFile,
}: {
  files: GitChangedFileDto[];
  selectedUri: string | null;
  onSelectFile: (uri: string) => void;
}) {
  return (
    <aside className="fo-git-review-list" aria-label="Changed files">
      {groupFiles(files).map((group) => (
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
              onClick={() => onSelectFile(file.uri)}
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
  );
}

function GitRevisionFilesList({
  files,
  selectedUri,
  onSelectFile,
}: {
  files: GitRevisionFileDto[];
  selectedUri: string | null;
  onSelectFile: (uri: string) => void;
}) {
  return (
    <aside className="fo-git-review-list" aria-label="Tracked files">
      {groupPathFiles(files).map((group) => (
        <section className="fo-git-review-group" key={group.folder}>
          <div className="fo-git-review-group-title">{group.folder}</div>
          {group.files.map((file) => (
            <button
              type="button"
              key={file.uri}
              className={
                file.uri === selectedUri
                  ? "fo-git-review-file fo-git-review-file-tree fo-git-review-file-active"
                  : "fo-git-review-file fo-git-review-file-tree"
              }
              onClick={() => onSelectFile(file.uri)}
            >
              <span className="fo-git-review-file-name">
                {file.repoRelativePath}
              </span>
            </button>
          ))}
        </section>
      ))}
    </aside>
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
  return groupPathFiles(files);
}

function groupPathFiles<T extends { repoRelativePath: string }>(files: T[]) {
  const groups = new Map<string, T[]>();
  for (const file of files) {
    const folder = folderName(file.repoRelativePath);
    groups.set(folder, [...(groups.get(folder) ?? []), file]);
  }
  return [...groups.entries()].map(([folder, files]) => ({ folder, files }));
}

function commitTitle(commit: GitCommitDto): string {
  return commit.subject || commit.shortHash;
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
