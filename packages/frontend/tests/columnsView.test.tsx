import {
  cleanup,
  fireEvent,
  render,
  screen,
  act,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { ColumnsView } from "../src/pane/ColumnsView";
import type { FileEntryDto } from "@fileoctopus/ts-api";

const listStart = vi.fn();
let batchHandler: ((event: Record<string, unknown>) => void) | null = null;
const onDirectoryBatch = vi.fn(
  async (handler: (event: Record<string, unknown>) => void) => {
    batchHandler = handler;
    return () => {
      batchHandler = null;
    };
  },
);

function mockClient() {
  return {
    fs: {
      listStart,
      onDirectoryBatch,
    },
  } as unknown as import("@fileoctopus/ts-api").FileOctopusClient;
}

vi.mock("@fileoctopus/ts-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fileoctopus/ts-api")>();
  return {
    ...actual,
    isRemoteUri: (uri: string) =>
      uri.startsWith("sftp://") || uri.startsWith("smb://"),
    uriScheme: (uri: string) => {
      const idx = uri.indexOf("://");
      return idx > 0 ? uri.slice(0, idx) : null;
    },
    profileIdFromRemoteUri: () => "profile-1",
    buildRemoteUri: (scheme: string, profileId: string, path: string) =>
      `${scheme}://${profileId}${path}`,
    remotePathFromUri: (uri: string) => {
      const idx = uri.indexOf("/", uri.indexOf("://") + 3);
      return idx >= 0 ? uri.slice(idx) : "/";
    },
  };
});

vi.mock("../src/paneTypes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/paneTypes")>();
  let counter = 0;
  return {
    ...actual,
    createRequestId: () => `test-request-id-${counter++}`,
  };
});

function makeDirEntry(name: string, uri: string): FileEntryDto {
  return {
    uri,
    name,
    kind: "directory",
    isHidden: false,
    isSymlink: false,
    providerId: "local",
    canRead: true,
    canList: true,
    canWrite: true,
    canDelete: true,
    canRename: true,
  };
}

function makeFileEntry(name: string, uri: string): FileEntryDto {
  return {
    uri,
    name,
    kind: "file",
    size: 100,
    isHidden: false,
    isSymlink: false,
    providerId: "local",
    canRead: true,
    canList: false,
    canWrite: true,
    canDelete: true,
    canRename: true,
  };
}

afterEach(cleanup);

describe("ColumnsView", () => {
  let sessionCounter = 0;
  beforeEach(() => {
    sessionCounter = 0;
    listStart.mockReset();
    onDirectoryBatch.mockReset();
    batchHandler = null;
    listStart.mockImplementation((req: { requestId: string }) =>
      Promise.resolve({
        requestId: req.requestId,
        sessionId: `s${sessionCounter++}`,
      }),
    );
    onDirectoryBatch.mockImplementation(
      async (handler: (event: Record<string, unknown>) => void) => {
        batchHandler = handler;
        return () => {
          batchHandler = null;
        };
      },
    );
  });

  it("renders the columns container with role=list", () => {
    render(
      <ColumnsView
        client={mockClient()}
        rootUri="local:///"
        activeUri="local:///home"
        showHidden={false}
        onNavigate={vi.fn()}
        onOpen={vi.fn()}
        fileIcon={() => <span>icon</span>}
      />,
    );
    expect(screen.getByRole("list")).toBeTruthy();
  });

  it("renders column sections for each stack URI", async () => {
    render(
      <ColumnsView
        client={mockClient()}
        rootUri="local:///"
        activeUri="local:///home/user"
        showHidden={false}
        onNavigate={vi.fn()}
        onOpen={vi.fn()}
        fileIcon={() => <span>icon</span>}
      />,
    );

    await waitFor(() => expect(listStart).toHaveBeenCalled());

    const sections = document.querySelectorAll(".fo-columns-column");
    expect(sections.length).toBe(3);
  });

  it("starts listing for each column URI", async () => {
    render(
      <ColumnsView
        client={mockClient()}
        rootUri="local:///"
        activeUri="local:///home/user"
        showHidden={false}
        onNavigate={vi.fn()}
        onOpen={vi.fn()}
        fileIcon={() => <span>icon</span>}
      />,
    );

    await waitFor(() => expect(listStart).toHaveBeenCalledTimes(3));

    const calledUris = listStart.mock.calls.map(
      (call: unknown[]) => call[0].uri as string,
    );
    expect(calledUris).toContain("local:///");
    expect(calledUris).toContain("local:///home");
    expect(calledUris).toContain("local:///home/user");
  });

  it("renders entries in columns when batch completes", async () => {
    render(
      <ColumnsView
        client={mockClient()}
        rootUri="local:///"
        activeUri="local:///home"
        showHidden={false}
        onNavigate={vi.fn()}
        onOpen={vi.fn()}
        fileIcon={() => <span>icon</span>}
      />,
    );

    await waitFor(() => expect(listStart).toHaveBeenCalled());

    await act(async () => {
      batchHandler?.({
        requestId: "test-request-id",
        sessionId: "s1",
        entries: [
          makeDirEntry("Documents", "local:///home/Documents"),
          makeFileEntry("readme.txt", "local:///home/readme.txt"),
        ],
        isComplete: true,
        error: null,
      });
    });

    expect(screen.getByText("Documents")).toBeTruthy();
    expect(screen.getByText("readme.txt")).toBeTruthy();
  });

  it("renders entries sorted alphabetically", async () => {
    render(
      <ColumnsView
        client={mockClient()}
        rootUri="local:///"
        activeUri="local:///home"
        showHidden={false}
        onNavigate={vi.fn()}
        onOpen={vi.fn()}
        fileIcon={() => <span>icon</span>}
      />,
    );

    await waitFor(() => expect(listStart).toHaveBeenCalled());

    await act(async () => {
      batchHandler?.({
        requestId: "test-request-id",
        sessionId: "s1",
        entries: [
          makeDirEntry("Zebra", "local:///home/Zebra"),
          makeDirEntry("Apple", "local:///home/Apple"),
        ],
        isComplete: true,
        error: null,
      });
    });

    const buttons = screen.getAllByRole("button");
    const names = buttons.map((b) => b.textContent).filter(Boolean);
    const appleIdx = names.findIndex((n) => n!.includes("Apple"));
    const zebraIdx = names.findIndex((n) => n!.includes("Zebra"));
    expect(appleIdx).toBeLessThan(zebraIdx);
  });

  it("calls onNavigate when a directory entry is clicked", async () => {
    const onNavigate = vi.fn();
    render(
      <ColumnsView
        client={mockClient()}
        rootUri="local:///"
        activeUri="local:///home"
        showHidden={false}
        onNavigate={onNavigate}
        onOpen={vi.fn()}
        fileIcon={() => <span>icon</span>}
      />,
    );

    await waitFor(() => expect(listStart).toHaveBeenCalled());

    await act(async () => {
      batchHandler?.({
        requestId: "test-request-id",
        sessionId: "s1",
        entries: [makeDirEntry("Documents", "local:///home/Documents")],
        isComplete: true,
        error: null,
      });
    });

    fireEvent.click(screen.getByText("Documents"));
    expect(onNavigate).toHaveBeenCalledWith("local:///home/Documents");
  });

  it("calls onOpen when a file entry is clicked", async () => {
    const onOpen = vi.fn();
    render(
      <ColumnsView
        client={mockClient()}
        rootUri="local:///"
        activeUri="local:///home"
        showHidden={false}
        onNavigate={vi.fn()}
        onOpen={onOpen}
        fileIcon={() => <span>icon</span>}
      />,
    );

    await waitFor(() => expect(listStart).toHaveBeenCalled());

    await act(async () => {
      batchHandler?.({
        requestId: "test-request-id",
        sessionId: "s1",
        entries: [makeFileEntry("readme.txt", "local:///home/readme.txt")],
        isComplete: true,
        error: null,
      });
    });

    fireEvent.click(screen.getByText("readme.txt"));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0][0].name).toBe("readme.txt");
  });

  it("applies active class to entries that are in the navigation stack", async () => {
    render(
      <ColumnsView
        client={mockClient()}
        rootUri="local:///"
        activeUri="local:///home/user"
        showHidden={false}
        onNavigate={vi.fn()}
        onOpen={vi.fn()}
        fileIcon={() => <span>icon</span>}
      />,
    );

    await waitFor(() => expect(listStart).toHaveBeenCalled());

    // "home" entry lives in the root column (local:///), which gets sessionId "s0"
    await act(async () => {
      batchHandler?.({
        requestId: "test-request-id-0",
        sessionId: "s0",
        entries: [makeDirEntry("home", "local:///home")],
        isComplete: true,
        error: null,
      });
    });

    const homeButton = screen.getByText("home").closest("button");
    expect(homeButton?.className).toContain("fo-columns-active");
  });

  it("handles batch error by clearing entries", async () => {
    render(
      <ColumnsView
        client={mockClient()}
        rootUri="local:///"
        activeUri="local:///home"
        showHidden={false}
        onNavigate={vi.fn()}
        onOpen={vi.fn()}
        fileIcon={() => <span>icon</span>}
      />,
    );

    await waitFor(() => expect(listStart).toHaveBeenCalled());

    await act(async () => {
      batchHandler?.({
        requestId: "test-request-id",
        sessionId: "s1",
        entries: [],
        isComplete: false,
        error: { code: "not_found", message: "Not found" },
      });
    });

    const buttons = document.querySelectorAll(
      ".fo-columns-column:first-child button",
    );
    expect(buttons.length).toBe(0);
  });

  it("limits to MAX_COLUMNS (4) columns", async () => {
    render(
      <ColumnsView
        client={mockClient()}
        rootUri="local:///"
        activeUri="local:///a/b/c/d/e"
        showHidden={false}
        onNavigate={vi.fn()}
        onOpen={vi.fn()}
        fileIcon={() => <span>icon</span>}
      />,
    );

    await waitFor(() => expect(listStart).toHaveBeenCalled());

    const sections = document.querySelectorAll(".fo-columns-column");
    expect(sections.length).toBeLessThanOrEqual(4);
  });

  it("handles listStart rejection gracefully", async () => {
    listStart.mockRejectedValue(new Error("Network error"));

    render(
      <ColumnsView
        client={mockClient()}
        rootUri="local:///"
        activeUri="local:///home"
        showHidden={false}
        onNavigate={vi.fn()}
        onOpen={vi.fn()}
        fileIcon={() => <span>icon</span>}
      />,
    );

    await waitFor(() => expect(listStart).toHaveBeenCalled());

    const buttons = document.querySelectorAll(
      ".fo-columns-column:first-child button",
    );
    expect(buttons.length).toBe(0);
  });

  it("renders file icons via fileIcon callback", async () => {
    const fileIcon = vi.fn(() => <span data-testid="custom-icon">📁</span>);
    render(
      <ColumnsView
        client={mockClient()}
        rootUri="local:///"
        activeUri="local:///home"
        showHidden={false}
        onNavigate={vi.fn()}
        onOpen={vi.fn()}
        fileIcon={fileIcon}
      />,
    );

    await waitFor(() => expect(listStart).toHaveBeenCalled());

    await act(async () => {
      batchHandler?.({
        requestId: "test-request-id",
        sessionId: "s1",
        entries: [makeFileEntry("test.txt", "local:///home/test.txt")],
        isComplete: true,
        error: null,
      });
    });

    expect(fileIcon).toHaveBeenCalled();
  });

  it("accumulates entries across multiple batches", async () => {
    render(
      <ColumnsView
        client={mockClient()}
        rootUri="local:///"
        activeUri="local:///home"
        showHidden={false}
        onNavigate={vi.fn()}
        onOpen={vi.fn()}
        fileIcon={() => <span>icon</span>}
      />,
    );

    await waitFor(() => expect(listStart).toHaveBeenCalled());

    // First incomplete batch — entries accumulate in inflight but no re-render
    await act(async () => {
      batchHandler?.({
        requestId: "test-request-id-1",
        sessionId: "s1",
        entries: [makeDirEntry("Alpha", "local:///home/Alpha")],
        isComplete: false,
        error: null,
      });
    });

    // Second (complete) batch triggers setColumns with all accumulated entries
    await act(async () => {
      batchHandler?.({
        requestId: "test-request-id-1",
        sessionId: "s1",
        entries: [makeDirEntry("Beta", "local:///home/Beta")],
        isComplete: true,
        error: null,
      });
    });

    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
  });
});
