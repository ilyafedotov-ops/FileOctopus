import { describe, it, expect, vi, afterEach } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  act,
} from "@testing-library/react";
import { FolderTree } from "../src/dialogs/FolderTree";
import type { FsClient } from "@fileoctopus/ts-api";

function createMockFs(
  directories: Record<string, Array<{ name: string; uri: string }>>,
) {
  return {
    listDirectories: vi.fn((req: { uri: string }) => {
      const dirs = directories[req.uri] ?? [];
      return Promise.resolve({ directories: dirs });
    }),
  } as unknown as FsClient;
}

describe("FolderTree", () => {
  afterEach(cleanup);

  it("renders the root directory label", () => {
    const fs = createMockFs({});
    render(
      <FolderTree
        fs={fs}
        rootUri="local:///home/user"
        rootLabel="Home"
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("Home")).toBeTruthy();
  });

  it("calls onSelect when a directory label is clicked", () => {
    const fs = createMockFs({});
    const onSelect = vi.fn();
    render(
      <FolderTree
        fs={fs}
        rootUri="local:///home/user"
        rootLabel="Home"
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByText("Home"));
    expect(onSelect).toHaveBeenCalledWith("local:///home/user");
  });

  it("loads child directories when expand arrow is clicked", async () => {
    const fs = createMockFs({
      "local:///home/user": [
        { name: "Documents", uri: "local:///home/user/Documents" },
        { name: "Downloads", uri: "local:///home/user/Downloads" },
      ],
    });
    render(
      <FolderTree
        fs={fs}
        rootUri="local:///home/user"
        rootLabel="Home"
        onSelect={() => {}}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /expand/i }));
    });

    expect(screen.getByText("Documents")).toBeTruthy();
    expect(screen.getByText("Downloads")).toBeTruthy();
  });

  it("selects a child directory and calls onSelect", async () => {
    const fs = createMockFs({
      "local:///home/user": [
        { name: "Documents", uri: "local:///home/user/Documents" },
      ],
    });
    const onSelect = vi.fn();
    render(
      <FolderTree
        fs={fs}
        rootUri="local:///home/user"
        rootLabel="Home"
        onSelect={onSelect}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /expand/i }));
    });

    fireEvent.click(screen.getByText("Documents"));
    expect(onSelect).toHaveBeenCalledWith("local:///home/user/Documents");
  });

  it("collapses children when expand arrow is clicked again", async () => {
    const fs = createMockFs({
      "local:///home/user": [
        { name: "Documents", uri: "local:///home/user/Documents" },
      ],
    });
    render(
      <FolderTree
        fs={fs}
        rootUri="local:///home/user"
        rootLabel="Home"
        onSelect={() => {}}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /expand/i }));
    });

    expect(screen.getByText("Documents")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /collapse/i }));
    expect(screen.queryByText("Documents")).toBeNull();
  });

  it("shows empty state when directory has no subdirectories", async () => {
    const fs = createMockFs({
      "local:///home/user": [],
    });
    render(
      <FolderTree
        fs={fs}
        rootUri="local:///home/user"
        rootLabel="Home"
        onSelect={() => {}}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /expand/i }));
    });

    expect(screen.getByText(/empty/i)).toBeTruthy();
  });
});
