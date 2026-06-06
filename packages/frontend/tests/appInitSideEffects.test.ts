import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import { activeTab, createInitialState } from "../src/panelStore";
import { useFileSystemWatchers } from "../src/hooks/useFileSystemWatchers";
import { useMetadataEventListeners } from "../src/hooks/useMetadataEventListeners";
import { useNetworkStatusEvents } from "../src/hooks/useNetworkStatusEvents";
import { useSelectedFileHash } from "../src/hooks/useSelectedFileHash";

afterEach(cleanup);

const fileEntry = {
  name: "report.txt",
  uri: "local:///home/tester/report.txt",
  kind: "file",
  size: 128,
  extension: "txt",
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
} satisfies FileEntryDto;

function createState(uri = "local:///home/tester") {
  return createInitialState(uri, "local:///home/tester/Documents");
}

function addSelectedEntry(state: ReturnType<typeof createInitialState>) {
  const tab = activeTab(state.panels.left);
  tab.entriesById[fileEntry.uri] = fileEntry;
  tab.orderedEntryIds.push(fileEntry.uri);
  tab.selectedId = fileEntry.uri;
  tab.selectedIds = [fileEntry.uri];
  return state;
}

describe("app init side-effect hooks", () => {
  it("subscribes to directory batches and refreshes the active watched uri", async () => {
    const directoryUnlisten = vi.fn();
    const watchUnlisten = vi.fn();
    let directoryBatchHandler: ((event: unknown) => void) | null = null;
    let watchChangedHandler: ((event: { uri: string }) => void) | null = null;
    const client = {
      fs: {
        onDirectoryBatch: vi.fn(async (handler) => {
          directoryBatchHandler = handler;
          return directoryUnlisten;
        }),
        onWatchChanged: vi.fn(async (handler) => {
          watchChangedHandler = handler;
          return watchUnlisten;
        }),
        startWatching: vi.fn(async () => undefined),
        stopWatching: vi.fn(async () => undefined),
      },
    };
    const state = createState();
    const left = activeTab(state.panels.left);
    const right = activeTab(state.panels.right);
    const dispatch = vi.fn();
    const refreshPanel = vi.fn();

    const { unmount } = renderHook(() =>
      useFileSystemWatchers({
        client: client as never,
        state,
        left,
        right,
        dispatch,
        refreshPanel,
      }),
    );

    await waitFor(() =>
      expect(client.fs.startWatching).toHaveBeenCalledWith({ uri: left.uri }),
    );
    const batch = { requestId: "request-1", entries: [] };
    directoryBatchHandler?.(batch);
    watchChangedHandler?.({ uri: left.uri });

    expect(dispatch).toHaveBeenCalledWith({ type: "applyBatch", batch });
    expect(refreshPanel).toHaveBeenCalledWith("left", {
      replace: true,
      softRefresh: true,
      backgroundRefresh: true,
    });

    unmount();

    expect(directoryUnlisten).toHaveBeenCalled();
    expect(watchUnlisten).toHaveBeenCalled();
    expect(client.fs.stopWatching).toHaveBeenCalled();
  });

  it("does not start filesystem watching for non-local active uris", () => {
    const state = createState("sftp://profile/projects");
    const left = activeTab(state.panels.left);
    const right = activeTab(state.panels.right);
    const client = {
      fs: {
        onDirectoryBatch: vi.fn(async () => vi.fn()),
        onWatchChanged: vi.fn(async () => vi.fn()),
        startWatching: vi.fn(async () => undefined),
        stopWatching: vi.fn(async () => undefined),
      },
    };

    renderHook(() =>
      useFileSystemWatchers({
        client: client as never,
        state,
        left,
        right,
        dispatch: vi.fn(),
        refreshPanel: vi.fn(),
      }),
    );

    expect(client.fs.startWatching).not.toHaveBeenCalled();
  });

  it("forwards metadata and search events and cleans up listeners", async () => {
    const unlisteners = [vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn()];
    const handlers: Array<(event: unknown) => void> = [];
    const client = {
      fs: {
        onFolderSizeCompleted: vi.fn(async (handler) => {
          handlers.push(handler);
          return unlisteners[0];
        }),
        onRecursiveSearchMatch: vi.fn(async (handler) => {
          handlers.push(handler);
          return unlisteners[1];
        }),
        onRecursiveSearchCompleted: vi.fn(async (handler) => {
          handlers.push(handler);
          return unlisteners[2];
        }),
        onContentSearchMatch: vi.fn(async (handler) => {
          handlers.push(handler);
          return unlisteners[3];
        }),
        onContentSearchCompleted: vi.fn(async (handler) => {
          handlers.push(handler);
          return unlisteners[4];
        }),
      },
    };
    const applyFolderSizeCompleted = vi.fn();
    const applyRecursiveSearchMatch = vi.fn();
    const applyRecursiveSearchCompleted = vi.fn();
    const applyContentSearchMatch = vi.fn();
    const applyContentSearchCompleted = vi.fn();

    const { unmount } = renderHook(() =>
      useMetadataEventListeners({
        client: client as never,
        applyFolderSizeCompleted,
        applyRecursiveSearchMatch,
        applyRecursiveSearchCompleted,
        applyContentSearchMatch,
        applyContentSearchCompleted,
      }),
    );

    await waitFor(() => expect(handlers).toHaveLength(5));
    handlers[0]?.({ jobId: "folder-size" });
    handlers[1]?.({ jobId: "recursive-match" });
    handlers[2]?.({ jobId: "recursive-completed" });
    handlers[3]?.({ jobId: "content-match" });
    handlers[4]?.({ jobId: "content-completed" });

    expect(applyFolderSizeCompleted).toHaveBeenCalledWith({
      jobId: "folder-size",
    });
    expect(applyRecursiveSearchMatch).toHaveBeenCalledWith({
      jobId: "recursive-match",
    });
    expect(applyRecursiveSearchCompleted).toHaveBeenCalledWith({
      jobId: "recursive-completed",
    });
    expect(applyContentSearchMatch).toHaveBeenCalledWith({
      jobId: "content-match",
    });
    expect(applyContentSearchCompleted).toHaveBeenCalledWith({
      jobId: "content-completed",
    });

    unmount();

    for (const unlisten of unlisteners) {
      expect(unlisten).toHaveBeenCalled();
    }
  });

  it("subscribes to network status events only when networking is enabled", async () => {
    let statusHandler:
      | ((event: {
          profileId: string;
          status: string;
          message: string;
        }) => void)
      | null = null;
    const unlisten = vi.fn();
    const client = {
      network: {
        subscribeStatusEvents: vi.fn(async (handler) => {
          statusHandler = handler;
          return unlisten;
        }),
      },
    };
    let statuses = [{ profileId: "old", status: "connected", message: "" }];
    const setNetworkStatuses = vi.fn((updater) => {
      statuses = updater(statuses);
    });

    const { unmount } = renderHook(() =>
      useNetworkStatusEvents({
        client: client as never,
        networkEnabled: true,
        setNetworkStatuses,
      }),
    );

    await waitFor(() =>
      expect(client.network.subscribeStatusEvents).toHaveBeenCalled(),
    );
    statusHandler?.({
      profileId: "new",
      status: "connecting",
      message: "Dialing",
    });

    expect(statuses).toEqual([
      { profileId: "old", status: "connected", message: "" },
      { profileId: "new", status: "connecting", message: "Dialing" },
    ]);

    unmount();

    expect(unlisten).toHaveBeenCalled();
  });

  it("computes a selected file hash and dispatches hash states", async () => {
    const state = addSelectedEntry(createState());
    const left = activeTab(state.panels.left);
    const right = activeTab(state.panels.right);
    const client = {
      fs: {
        computeHash: vi.fn(async () => ({ hash: "sha256:abc123" })),
      },
    };
    const dispatch = vi.fn();

    renderHook(() =>
      useSelectedFileHash({
        client: client as never,
        state,
        left,
        right,
        dispatch,
      }),
    );

    expect(dispatch).toHaveBeenCalledWith({
      type: "setHash",
      panelId: "left",
      entryId: fileEntry.uri,
      hashState: "computing",
    });
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith({
        type: "setHash",
        panelId: "left",
        entryId: fileEntry.uri,
        hashState: "sha256:abc123",
      }),
    );
  });
});
