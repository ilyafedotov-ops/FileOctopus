import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  GitDiffFileResponse,
  FileEntryDto,
  GitStatusForRepositoryResponse,
  GitStatusForDirectoryResponse,
  GitHistoryResponse,
  GitBranchesResponse,
  GitWorktreesResponse,
  GitRevisionDiffResponse,
  GitRevisionFilesResponse,
  GitClient,
} from "@fileoctopus/ts-api";
import { FileRow } from "../src/pane/FileRow";
import { GitReviewTab } from "../src/components/git/GitReviewTab";
import { PaneHeader } from "../src/pane/PaneHeader";
import { usePaneGitStatus } from "../src/pane/usePaneGitStatus";

afterEach(() => {
  localStorage.clear();
  cleanup();
  vi.unstubAllGlobals();
});

const baseEntry: FileEntryDto = {
  name: "changed.ts",
  uri: "local:///repo/changed.ts",
  kind: "file",
  size: 128,
  extension: "ts",
  modifiedAt: "2026-05-23T08:00:00Z",
  createdAt: null,
  accessedAt: null,
  permissions: null,
  owner: null,
  canRead: true,
  canWrite: true,
  canDelete: true,
  canRename: true,
  canList: true,
  isHidden: false,
  isSymlink: false,
  providerId: "local",
};

describe("Git pane status", () => {
  it("renders a compact file status badge on rows", () => {
    render(
      <FileRow
        entry={baseEntry}
        gitStatus="modified"
        top={0}
        rowHeight={28}
        viewMode="details"
        selected={false}
        multiSelected={false}
        focused={false}
        onSelect={() => {}}
        onEntrySelect={() => {}}
        onEntryActivate={() => {}}
        onContextMenu={() => {}}
      />,
    );

    expect(screen.getByLabelText("Git status: modified")).toBeTruthy();
  });

  it("renders a visible Git Review action in the pane header", () => {
    const onOpenGitReview = vi.fn();

    render(
      <PaneHeader
        uri="local:///repo"
        pathError={null}
        pathFocusToken={0}
        gitBranch="main"
        gitDirty
        onNavigate={() => {}}
        onOpenGitReview={onOpenGitReview}
      />,
    );

    const reviewButton = screen.getByRole("button", {
      name: "Open Git Review for branch main with changes",
    });
    fireEvent.click(reviewButton);

    expect(onOpenGitReview).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Git Review")).toBeTruthy();
    expect(screen.getByText("main")).toBeTruthy();
  });

  it("loads local git status without querying remote URIs", async () => {
    const status: GitStatusForDirectoryResponse = {
      repo: {
        rootUri: "local:///repo",
        branch: "main",
        headShort: "abcdef1",
        isDirty: true,
      },
      entries: {
        "local:///repo/changed.ts": "modified",
      },
    };
    const statusForDirectory = vi.fn(async () => status);
    const client = {
      git: { statusForDirectory },
    };

    const { result, rerender } = renderHook(
      ({ uri }) => usePaneGitStatus(client, uri),
      { initialProps: { uri: "local:///repo" } },
    );

    await waitFor(() => expect(result.current.repo?.branch).toBe("main"));
    expect(result.current.entries["local:///repo/changed.ts"]).toBe("modified");
    expect(statusForDirectory).toHaveBeenCalledWith({ uri: "local:///repo" });

    rerender({ uri: "sftp://profile/repo" });

    await waitFor(() => expect(result.current.repo).toBeNull());
    expect(statusForDirectory).toHaveBeenCalledTimes(1);
  });

  it("keeps the Git client method bound when loading pane status", async () => {
    const status: GitStatusForDirectoryResponse = {
      repo: {
        rootUri: "local:///repo-bound",
        branch: "main",
        headShort: "abcdef1",
        isDirty: true,
      },
      entries: {},
    };
    const client = {
      git: {
        status,
        async statusForDirectory(this: {
          status: GitStatusForDirectoryResponse;
        }) {
          return this.status;
        },
      },
    };

    const { result } = renderHook(() =>
      usePaneGitStatus(client, "local:///repo-bound"),
    );

    await waitFor(() => expect(result.current.repo?.branch).toBe("main"));
  });

  it("loads pane Git status under React StrictMode", async () => {
    const status: GitStatusForDirectoryResponse = {
      repo: {
        rootUri: "local:///repo-strict",
        branch: "main",
        headShort: "abcdef1",
        isDirty: true,
      },
      entries: {},
    };
    const client = {
      git: {
        statusForDirectory: vi.fn(async () => status),
      },
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    );

    const { result } = renderHook(
      () => usePaneGitStatus(client, "local:///repo-strict"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.repo?.branch).toBe("main"));
  });

  it("reuses cached git status for the same local directory", async () => {
    const uri = "local:///repo-cache";
    const status: GitStatusForDirectoryResponse = {
      repo: {
        rootUri: uri,
        branch: "main",
        headShort: "abcdef1",
        isDirty: false,
      },
      entries: {},
    };
    const statusForDirectory = vi.fn(async () => status);
    const client = {
      git: { statusForDirectory },
    };

    const first = renderHook(() => usePaneGitStatus(client, uri));
    await waitFor(() => expect(first.result.current.repo?.branch).toBe("main"));
    first.unmount();

    const second = renderHook(() => usePaneGitStatus(client, uri));
    await waitFor(() =>
      expect(second.result.current.repo?.branch).toBe("main"),
    );

    expect(statusForDirectory).toHaveBeenCalledTimes(1);
  });

  it("refreshes cached git status when a watched directory changes", async () => {
    const uri = "local:///repo-watch";
    const cleanStatus: GitStatusForDirectoryResponse = {
      repo: {
        rootUri: uri,
        branch: "main",
        headShort: "abcdef1",
        isDirty: false,
      },
      entries: {},
    };
    const dirtyStatus: GitStatusForDirectoryResponse = {
      repo: {
        rootUri: uri,
        branch: "main",
        headShort: "abcdef1",
        isDirty: true,
      },
      entries: {
        [`${uri}/changed.ts`]: "modified",
      },
    };
    const statusForDirectory = vi
      .fn()
      .mockResolvedValueOnce(cleanStatus)
      .mockResolvedValueOnce(dirtyStatus);
    let watchHandler: ((event: { uri: string }) => void) | null = null;
    const client = {
      git: { statusForDirectory },
      fs: {
        onWatchChanged: vi.fn(
          async (handler: (event: { uri: string }) => void) => {
            watchHandler = handler;
            return () => {
              watchHandler = null;
            };
          },
        ),
      },
    };

    const { result } = renderHook(() => usePaneGitStatus(client, uri));

    await waitFor(() => expect(result.current.repo?.isDirty).toBe(false));
    watchHandler?.({ uri });

    await waitFor(() => expect(result.current.repo?.isDirty).toBe(true));
    expect(result.current.entries[`${uri}/changed.ts`]).toBe("modified");
    expect(statusForDirectory).toHaveBeenCalledTimes(2);
  });
});

describe("GitReviewTab", () => {
  function repositoryStatus(): GitStatusForRepositoryResponse {
    return {
      repo: {
        rootUri: "local:///repo",
        branch: "main",
        headShort: "abcdef1",
        isDirty: true,
      },
      files: [
        {
          uri: "local:///repo/src/app.ts",
          repoRelativePath: "src/app.ts",
          status: "modified",
          previousUri: null,
          previousRepoRelativePath: null,
        },
        {
          uri: "local:///repo/docs/readme.md",
          repoRelativePath: "docs/readme.md",
          status: "untracked",
          previousUri: null,
          previousRepoRelativePath: null,
        },
      ],
    };
  }

  function fileDiff(): GitDiffFileResponse {
    return {
      repo: null,
      file: {
        uri: "local:///repo/src/app.ts",
        repoRelativePath: "src/app.ts",
        status: "modified",
        previousUri: null,
        previousRepoRelativePath: null,
      },
      oldLabel: "HEAD:src/app.ts",
      newLabel: "Worktree:src/app.ts",
      hunks: [
        {
          oldStart: 1,
          oldCount: 2,
          newStart: 1,
          newCount: 2,
          lines: [
            { kind: "equal", content: "one\n", oldLine: 1, newLine: 1 },
            { kind: "delete", content: "two\n", oldLine: 2, newLine: null },
            { kind: "insert", content: "TWO\n", oldLine: null, newLine: 2 },
          ],
        },
      ],
      oldLineCount: 2,
      newLineCount: 2,
      oldTruncated: false,
      newTruncated: false,
      binary: false,
      unsupportedReason: null,
    };
  }

  function binaryDiff(): GitDiffFileResponse {
    return {
      ...fileDiff(),
      hunks: [],
      oldLineCount: 0,
      newLineCount: 0,
      binary: true,
    };
  }

  function revisionDiff(): GitRevisionDiffResponse {
    return {
      repo: {
        rootUri: "local:///repo",
        branch: "main",
        headShort: "abcdef1",
        isDirty: true,
      },
      base: "1234567",
      head: "abcdef1234567890",
      files: [
        {
          ...fileDiff(),
          file: {
            uri: "local:///repo/src/commit.ts",
            repoRelativePath: "src/commit.ts",
            status: "modified",
            previousUri: null,
            previousRepoRelativePath: null,
          },
          oldLabel: "1234567:src/commit.ts",
          newLabel: "abcdef1:src/commit.ts",
        },
      ],
    };
  }

  function revisionFiles(): GitRevisionFilesResponse {
    return {
      repo: {
        rootUri: "local:///repo",
        branch: "main",
        headShort: "abcdef1",
        isDirty: true,
      },
      revision: "HEAD",
      files: [
        {
          uri: "local:///repo/src/app.ts",
          repoRelativePath: "src/app.ts",
        },
        {
          uri: "local:///repo/packages/frontend/src/App.tsx",
          repoRelativePath: "packages/frontend/src/App.tsx",
        },
      ],
    };
  }

  function history(): GitHistoryResponse {
    return {
      repo: {
        rootUri: "local:///repo",
        branch: "main",
        headShort: "abcdef1",
        isDirty: true,
      },
      commits: [
        {
          hash: "abcdef1234567890",
          shortHash: "abcdef1",
          parents: ["1234567"],
          parentCount: 1,
          authorName: "FileOctopus Test",
          authorEmail: "test@example.invalid",
          authoredAt: "2026-06-12T12:00:00+00:00",
          subject: "Add Git workspace",
          body: "Add Git workspace",
        },
      ],
    };
  }

  function branches(): GitBranchesResponse {
    return {
      repo: {
        rootUri: "local:///repo",
        branch: "main",
        headShort: "abcdef1",
        isDirty: true,
      },
      branches: [
        {
          fullName: "refs/heads/main",
          name: "main",
          kind: "local",
          isCurrent: true,
          head: "abcdef1",
          upstream: "origin/main",
          lastCommitAt: "2026-06-12T12:00:00+00:00",
          subject: "Add Git workspace",
        },
        {
          fullName: "refs/remotes/origin/main",
          name: "origin/main",
          kind: "remote",
          isCurrent: false,
          head: "abcdef1",
          upstream: null,
          lastCommitAt: "2026-06-12T12:00:00+00:00",
          subject: "Add Git workspace",
        },
      ],
    };
  }

  function worktrees(): GitWorktreesResponse {
    return {
      repo: {
        rootUri: "local:///repo",
        branch: "main",
        headShort: "abcdef1",
        isDirty: true,
      },
      worktrees: [
        {
          pathUri: "local:///repo",
          branch: "main",
          head: "abcdef1234567890",
          detached: false,
          bare: false,
          prunable: false,
          prunableReason: null,
        },
      ],
    };
  }

  function gitClient(
    overrides: Partial<
      Pick<
        GitClient,
        | "statusForRepository"
        | "diffFile"
        | "history"
        | "branches"
        | "worktrees"
        | "revisionDiff"
        | "revisionFiles"
      >
    > = {},
  ) {
    return {
      statusForRepository: vi.fn(async () => repositoryStatus()),
      diffFile: vi.fn(async () => fileDiff()),
      history: vi.fn(async () => history()),
      branches: vi.fn(async () => branches()),
      worktrees: vi.fn(async () => worktrees()),
      revisionDiff: vi.fn(async () => revisionDiff()),
      revisionFiles: vi.fn(async () => revisionFiles()),
      ...overrides,
    };
  }

  it("loads whole-repository changes grouped by folder and defaults to unified diff", async () => {
    const git = gitClient();
    const fs = {
      openPathWithDefaultApp: vi.fn(),
      revealPathInFileManager: vi.fn(),
    };

    render(
      <GitReviewTab
        repoRootUri="local:///repo"
        repoLabel="main"
        sourceUri="local:///repo/src"
        refreshToken={0}
        git={git}
        fs={fs}
      />,
    );

    await waitFor(() => expect(screen.getByText("src")).toBeTruthy());

    expect(screen.getByText("docs")).toBeTruthy();
    expect(screen.getByText("app.ts")).toBeTruthy();
    expect(screen.getByText("readme.md")).toBeTruthy();
    expect(await screen.findByTestId("git-review-diff-unified")).toBeTruthy();
    expect(git.statusForRepository).toHaveBeenCalledWith({
      uri: "local:///repo",
    });
    expect(git.diffFile).toHaveBeenCalledWith({
      uri: "local:///repo/src/app.ts",
    });
  });

  it("switches to side-by-side diff and remembers the mode", async () => {
    const git = gitClient();
    const fs = {
      openPathWithDefaultApp: vi.fn(),
      revealPathInFileManager: vi.fn(),
    };

    render(
      <GitReviewTab
        repoRootUri="local:///repo"
        repoLabel="main"
        sourceUri="local:///repo/src"
        refreshToken={0}
        git={git}
        fs={fs}
      />,
    );

    await screen.findByTestId("git-review-diff-unified");
    fireEvent.click(screen.getByRole("button", { name: "Side-by-side diff" }));

    expect(screen.getByTestId("git-review-diff-side-by-side")).toBeTruthy();
    expect(localStorage.getItem("fileoctopus.gitDiffMode")).toBe(
      "side-by-side",
    );
  });

  it("opens and reveals the selected changed file", async () => {
    const git = gitClient();
    const fs = {
      openPathWithDefaultApp: vi.fn(async () => ({ ok: true })),
      revealPathInFileManager: vi.fn(async () => ({ ok: true })),
    };

    render(
      <GitReviewTab
        repoRootUri="local:///repo"
        repoLabel="main"
        sourceUri="local:///repo/src"
        refreshToken={0}
        git={git}
        fs={fs}
      />,
    );

    await waitFor(() => expect(screen.getByText("app.ts")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Open file" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal file" }));

    await waitFor(() =>
      expect(fs.openPathWithDefaultApp).toHaveBeenCalledWith({
        uri: "local:///repo/src/app.ts",
      }),
    );
    expect(fs.revealPathInFileManager).toHaveBeenCalledWith({
      uri: "local:///repo/src/app.ts",
    });
  });

  it("renders an empty review state without requesting a diff", async () => {
    const git = gitClient({
      statusForRepository: vi.fn(async () => ({
        repo: null,
        files: [],
      })),
      diffFile: vi.fn(async () => fileDiff()),
    });
    const fs = {
      openPathWithDefaultApp: vi.fn(),
      revealPathInFileManager: vi.fn(),
    };

    render(
      <GitReviewTab
        repoRootUri="local:///repo"
        repoLabel="main"
        sourceUri="local:///repo/src"
        refreshToken={0}
        git={git}
        fs={fs}
      />,
    );

    expect(await screen.findByText("No reviewable changes")).toBeTruthy();
    expect(git.diffFile).not.toHaveBeenCalled();
  });

  it("renders binary diff summaries", async () => {
    const git = gitClient({
      diffFile: vi.fn(async () => binaryDiff()),
    });
    const fs = {
      openPathWithDefaultApp: vi.fn(),
      revealPathInFileManager: vi.fn(),
    };

    render(
      <GitReviewTab
        repoRootUri="local:///repo"
        repoLabel="main"
        sourceUri="local:///repo/src"
        refreshToken={0}
        git={git}
        fs={fs}
      />,
    );

    expect(await screen.findByText("Binary file: summary only")).toBeTruthy();
  });

  it("refreshes repository status on demand", async () => {
    const git = gitClient();
    const fs = {
      openPathWithDefaultApp: vi.fn(),
      revealPathInFileManager: vi.fn(),
    };

    render(
      <GitReviewTab
        repoRootUri="local:///repo"
        repoLabel="main"
        sourceUri="local:///repo/src"
        refreshToken={0}
        git={git}
        fs={fs}
      />,
    );

    await screen.findByTestId("git-review-diff-unified");
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh Git changes" }),
    );

    await waitFor(() =>
      expect(git.statusForRepository).toHaveBeenCalledTimes(2),
    );
  });

  it("copies the selected repository path", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const git = gitClient();
    const fs = {
      openPathWithDefaultApp: vi.fn(),
      revealPathInFileManager: vi.fn(),
    };

    render(
      <GitReviewTab
        repoRootUri="local:///repo"
        repoLabel="main"
        sourceUri="local:///repo/src"
        refreshToken={0}
        git={git}
        fs={fs}
      />,
    );

    await screen.findByTestId("git-review-diff-unified");
    fireEvent.click(screen.getByRole("button", { name: "Copy Git path" }));

    expect(writeText).toHaveBeenCalledWith("src/app.ts");
  });

  it("defaults to the Changes sub-tab", async () => {
    const git = gitClient();
    const fs = {
      openPathWithDefaultApp: vi.fn(),
      revealPathInFileManager: vi.fn(),
    };

    render(
      <GitReviewTab
        repoRootUri="local:///repo"
        repoLabel="main"
        sourceUri="local:///repo/src"
        refreshToken={0}
        git={git}
        fs={fs}
      />,
    );

    expect(
      screen
        .getByRole("button", { name: "Changes" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    await screen.findByTestId("git-review-diff-unified");
    expect(git.history).not.toHaveBeenCalled();
  });

  it("renders history commits and copies the selected hash", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const git = gitClient();
    const fs = {
      openPathWithDefaultApp: vi.fn(),
      revealPathInFileManager: vi.fn(),
    };

    render(
      <GitReviewTab
        repoRootUri="local:///repo"
        repoLabel="main"
        sourceUri="local:///repo/src"
        refreshToken={0}
        git={git}
        fs={fs}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "History" }));

    expect(await screen.findByText("Add Git workspace")).toBeTruthy();
    expect(screen.getByText("abcdef1")).toBeTruthy();
    expect(screen.getByText("FileOctopus Test")).toBeTruthy();
    expect(screen.getByText("1 parent")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy commit hash" }));

    expect(git.history).toHaveBeenCalledWith({
      uri: "local:///repo",
      maxCount: 100,
    });
    expect(writeText).toHaveBeenCalledWith("abcdef1234567890");
  });

  it("shows changed files and a diff for a selected history commit", async () => {
    const git = gitClient();
    const fs = {
      openPathWithDefaultApp: vi.fn(),
      revealPathInFileManager: vi.fn(),
    };

    render(
      <GitReviewTab
        repoRootUri="local:///repo"
        repoLabel="main"
        sourceUri="local:///repo/src"
        refreshToken={0}
        git={git}
        fs={fs}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "History" }));

    await screen.findByText("Add Git workspace");
    fireEvent.click(
      screen.getByRole("button", { name: "View commit Add Git workspace" }),
    );

    expect(await screen.findByText("commit.ts")).toBeTruthy();
    expect(await screen.findByTestId("git-review-diff-unified")).toBeTruthy();
    expect(git.revisionDiff).toHaveBeenCalledWith({
      uri: "local:///repo",
      base: "1234567",
      head: "abcdef1234567890",
      maxBytes: 524288,
    });
  });

  it("renders local and remote branches with the active marker", async () => {
    const git = gitClient();
    const fs = {
      openPathWithDefaultApp: vi.fn(),
      revealPathInFileManager: vi.fn(),
    };

    render(
      <GitReviewTab
        repoRootUri="local:///repo"
        repoLabel="main"
        sourceUri="local:///repo/src"
        refreshToken={0}
        git={git}
        fs={fs}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Branches" }));

    expect(await screen.findByText("Local")).toBeTruthy();
    expect(screen.getByText("Remote")).toBeTruthy();
    expect(screen.getByText("main")).toBeTruthy();
    expect(screen.getByText("origin/main")).toBeTruthy();
    expect(screen.getByText("current")).toBeTruthy();
    expect(screen.getByText("upstream origin/main")).toBeTruthy();
  });

  it("shows branch changes and tracked files for a selected branch", async () => {
    const git = gitClient({
      revisionDiff: vi.fn(async () => ({
        ...revisionDiff(),
        files: [
          {
            ...fileDiff(),
            file: {
              uri: "local:///repo/src/branch.ts",
              repoRelativePath: "src/branch.ts",
              status: "modified",
              previousUri: null,
              previousRepoRelativePath: null,
            },
            oldLabel: "HEAD:src/branch.ts",
            newLabel: "refs/heads/main:src/branch.ts",
          },
        ],
      })),
    });
    const fs = {
      openPathWithDefaultApp: vi.fn(),
      revealPathInFileManager: vi.fn(),
    };

    render(
      <GitReviewTab
        repoRootUri="local:///repo"
        repoLabel="main"
        sourceUri="local:///repo/src"
        refreshToken={0}
        git={git}
        fs={fs}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Branches" }));

    await screen.findByText("Local");
    fireEvent.click(screen.getByRole("button", { name: "View branch main" }));

    expect(await screen.findByText("branch.ts")).toBeTruthy();
    expect(
      await screen.findByText("packages/frontend/src/App.tsx"),
    ).toBeTruthy();
    expect(git.revisionDiff).toHaveBeenCalledWith({
      uri: "local:///repo",
      base: "HEAD",
      head: "refs/heads/main",
      maxBytes: 524288,
    });
    expect(git.revisionFiles).toHaveBeenCalledWith({
      uri: "local:///repo",
      revision: "refs/heads/main",
      maxCount: 1000,
    });
  });

  it("renders worktrees and can navigate or reveal the selected path", async () => {
    const git = gitClient();
    const fs = {
      openPathWithDefaultApp: vi.fn(),
      revealPathInFileManager: vi.fn(async () => ({ ok: true })),
    };
    const onNavigate = vi.fn();

    render(
      <GitReviewTab
        repoRootUri="local:///repo"
        repoLabel="main"
        sourceUri="local:///repo/src"
        refreshToken={0}
        git={git}
        fs={fs}
        onNavigate={onNavigate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Worktrees" }));

    expect(await screen.findByText("local:///repo")).toBeTruthy();
    expect(screen.getByText("main")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open worktree" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal worktree" }));

    expect(onNavigate).toHaveBeenCalledWith("local:///repo");
    expect(fs.revealPathInFileManager).toHaveBeenCalledWith({
      uri: "local:///repo",
    });
  });

  it("shows changed files and diffs for a selected worktree", async () => {
    const linkedStatus: GitStatusForRepositoryResponse = {
      repo: {
        rootUri: "local:///linked",
        branch: "feature",
        headShort: "fedcba9",
        isDirty: true,
      },
      files: [
        {
          uri: "local:///linked/src/worktree.ts",
          repoRelativePath: "src/worktree.ts",
          status: "modified",
          previousUri: null,
          previousRepoRelativePath: null,
        },
      ],
    };
    const git = gitClient({
      worktrees: vi.fn(async () => ({
        repo: worktrees().repo,
        worktrees: [
          {
            pathUri: "local:///linked",
            branch: "feature",
            head: "fedcba9876543210",
            detached: false,
            bare: false,
            prunable: false,
            prunableReason: null,
          },
        ],
      })),
      statusForRepository: vi.fn(async ({ uri }) =>
        uri === "local:///linked" ? linkedStatus : repositoryStatus(),
      ),
      diffFile: vi.fn(async () => ({
        ...fileDiff(),
        file: linkedStatus.files[0],
      })),
    });
    const fs = {
      openPathWithDefaultApp: vi.fn(),
      revealPathInFileManager: vi.fn(),
    };

    render(
      <GitReviewTab
        repoRootUri="local:///repo"
        repoLabel="main"
        sourceUri="local:///repo/src"
        refreshToken={0}
        git={git}
        fs={fs}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Worktrees" }));

    expect(await screen.findByText("local:///linked")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "View worktree local:///linked" }),
    );

    expect(await screen.findByText("worktree.ts")).toBeTruthy();
    expect(await screen.findByTestId("git-review-diff-unified")).toBeTruthy();
    expect(git.statusForRepository).toHaveBeenCalledWith({
      uri: "local:///linked",
    });
    expect(git.diffFile).toHaveBeenCalledWith({
      uri: "local:///linked/src/worktree.ts",
    });
  });

  it("shows tracked files for the main project folder", async () => {
    const git = gitClient();
    const fs = {
      openPathWithDefaultApp: vi.fn(),
      revealPathInFileManager: vi.fn(),
    };

    render(
      <GitReviewTab
        repoRootUri="local:///repo"
        repoLabel="main"
        sourceUri="local:///repo/src"
        refreshToken={0}
        git={git}
        fs={fs}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Files" }));

    expect(
      await screen.findByText("packages/frontend/src/App.tsx"),
    ).toBeTruthy();
    expect(screen.getAllByText("src/app.ts").length).toBeGreaterThan(0);
    expect(git.revisionFiles).toHaveBeenCalledWith({
      uri: "local:///repo",
      revision: "HEAD",
      maxCount: 1000,
    });
  });

  it("does not open deleted files", async () => {
    const deletedStatus: GitStatusForRepositoryResponse = {
      repo: null,
      files: [
        {
          uri: "local:///repo/src/old.ts",
          repoRelativePath: "src/old.ts",
          status: "deleted",
          previousUri: null,
          previousRepoRelativePath: null,
        },
      ],
    };
    const git = gitClient({
      statusForRepository: vi.fn(async () => deletedStatus),
      diffFile: vi.fn(async () => ({
        ...fileDiff(),
        file: deletedStatus.files[0],
      })),
    });
    const fs = {
      openPathWithDefaultApp: vi.fn(),
      revealPathInFileManager: vi.fn(),
    };

    render(
      <GitReviewTab
        repoRootUri="local:///repo"
        repoLabel="main"
        sourceUri="local:///repo/src"
        refreshToken={0}
        git={git}
        fs={fs}
      />,
    );

    await screen.findByTestId("git-review-diff-unified");
    const openButton = screen.getByRole("button", { name: "Open file" });

    expect(openButton).toHaveProperty("disabled", true);
    fireEvent.click(openButton);
    expect(fs.openPathWithDefaultApp).not.toHaveBeenCalled();
  });
});
