import {
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  FileEntryDto,
  GitStatusForDirectoryResponse,
} from "@fileoctopus/ts-api";
import { FileRow } from "../src/pane/FileRow";
import { PaneHeader } from "../src/pane/PaneHeader";
import { usePaneGitStatus } from "../src/pane/usePaneGitStatus";

afterEach(cleanup);

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
    render(
      <PaneHeader
        uri="local:///repo"
        pathError={null}
        pathFocusToken={0}
        gitBranch="main"
        gitDirty
        onNavigate={() => {}}
      />,
    );

    expect(screen.getByLabelText("Git branch main with changes")).toBeTruthy();
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
});
