import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  GitDiffFileResponse,
  FileEntryDto,
  GitStatusForRepositoryResponse,
  GitStatusForDirectoryResponse,
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

  it("renders the active repository branch in the pane header", () => {
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

    fireEvent.click(screen.getByLabelText("Git branch main with changes"));

    expect(onOpenGitReview).toHaveBeenCalledTimes(1);
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

  it("loads whole-repository changes grouped by folder and defaults to unified diff", async () => {
    const git = {
      statusForRepository: vi.fn(async () => repositoryStatus()),
      diffFile: vi.fn(async () => fileDiff()),
    };
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
    const git = {
      statusForRepository: vi.fn(async () => repositoryStatus()),
      diffFile: vi.fn(async () => fileDiff()),
    };
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
    const git = {
      statusForRepository: vi.fn(async () => repositoryStatus()),
      diffFile: vi.fn(async () => fileDiff()),
    };
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
    const git = {
      statusForRepository: vi.fn(async () => ({
        repo: null,
        files: [],
      })),
      diffFile: vi.fn(async () => fileDiff()),
    };
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
    const git = {
      statusForRepository: vi.fn(async () => repositoryStatus()),
      diffFile: vi.fn(async () => binaryDiff()),
    };
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
    const git = {
      statusForRepository: vi.fn(async () => repositoryStatus()),
      diffFile: vi.fn(async () => fileDiff()),
    };
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
    const git = {
      statusForRepository: vi.fn(async () => repositoryStatus()),
      diffFile: vi.fn(async () => fileDiff()),
    };
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
    const git = {
      statusForRepository: vi.fn(async () => deletedStatus),
      diffFile: vi.fn(async () => ({
        ...fileDiff(),
        file: deletedStatus.files[0],
      })),
    };
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
