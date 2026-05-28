import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from "@testing-library/react";
import { DiffDialog } from "../src/components/diff/DiffDialog";
import type { DiffTextResponse, FsClient } from "@fileoctopus/ts-api";

afterEach(cleanup);

function createMockFs(diffResponse?: Partial<DiffTextResponse>) {
  return {
    diffText: vi.fn<() => Promise<DiffTextResponse>>().mockResolvedValue({
      hunks: [],
      leftLineCount: 0,
      rightLineCount: 0,
      leftTruncated: false,
      rightTruncated: false,
      ...diffResponse,
    }),
  } as unknown as FsClient;
}

describe("DiffDialog", () => {
  it("renders nothing when closed", () => {
    const fs = createMockFs();
    render(
      <DiffDialog
        open={false}
        leftUri="local:///tmp/a.txt"
        rightUri="local:///tmp/b.txt"
        leftName="a.txt"
        rightName="b.txt"
        fs={fs}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders dialog with file names when open", () => {
    const fs = createMockFs();
    render(
      <DiffDialog
        open={true}
        leftUri="local:///tmp/a.txt"
        rightUri="local:///tmp/b.txt"
        leftName="a.txt"
        rightName="b.txt"
        fs={fs}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("a.txt")).toBeTruthy();
    expect(screen.getByText("b.txt")).toBeTruthy();
  });

  it("calls fs.diffText on open", async () => {
    const fs = createMockFs();
    render(
      <DiffDialog
        open={true}
        leftUri="local:///tmp/left.txt"
        rightUri="local:///tmp/right.txt"
        leftName="left.txt"
        rightName="right.txt"
        fs={fs}
        onClose={() => {}}
      />,
    );
    await waitFor(() => {
      expect(fs.diffText).toHaveBeenCalledWith({
        leftUri: "local:///tmp/left.txt",
        rightUri: "local:///tmp/right.txt",
      });
    });
  });

  it("shows loading state", () => {
    const fs = {
      diffText: vi.fn().mockReturnValue(new Promise(() => {})),
    } as unknown as FsClient;
    render(
      <DiffDialog
        open={true}
        leftUri="local:///tmp/a.txt"
        rightUri="local:///tmp/b.txt"
        leftName="a.txt"
        rightName="b.txt"
        fs={fs}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Loading diff…")).toBeTruthy();
  });

  it("shows error on diff failure", async () => {
    const fs = {
      diffText: vi.fn().mockRejectedValue(new Error("file not found")),
    } as unknown as FsClient;
    render(
      <DiffDialog
        open={true}
        leftUri="local:///tmp/a.txt"
        rightUri="local:///tmp/b.txt"
        leftName="a.txt"
        rightName="b.txt"
        fs={fs}
        onClose={() => {}}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeTruthy();
    });
  });

  it("renders diff hunks with added/removed lines", async () => {
    const fs = createMockFs({
      hunks: [
        {
          oldStart: 1,
          oldCount: 3,
          newStart: 1,
          newCount: 4,
          lines: [
            { kind: "equal", content: "aaa\n", oldLine: 1, newLine: 1 },
            { kind: "delete", content: "bbb\n", oldLine: 2, newLine: null },
            { kind: "insert", content: "BBB\n", oldLine: null, newLine: 2 },
            { kind: "insert", content: "NEW\n", oldLine: null, newLine: 3 },
            { kind: "equal", content: "ccc\n", oldLine: 3, newLine: 4 },
          ],
        },
      ],
      leftLineCount: 3,
      rightLineCount: 4,
      leftTruncated: false,
      rightTruncated: false,
    });
    render(
      <DiffDialog
        open={true}
        leftUri="local:///tmp/a.txt"
        rightUri="local:///tmp/b.txt"
        leftName="a.txt"
        rightName="b.txt"
        fs={fs}
        onClose={() => {}}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("aaa")).toBeTruthy();
    });
    expect(screen.getByText("bbb")).toBeTruthy();
    expect(screen.getByText("BBB")).toBeTruthy();
    expect(screen.getByText("NEW")).toBeTruthy();
    expect(screen.getByText("ccc")).toBeTruthy();
  });

  it("shows truncation warning when files are truncated", async () => {
    const fs = createMockFs({
      hunks: [],
      leftLineCount: 100,
      rightLineCount: 100,
      leftTruncated: true,
      rightTruncated: false,
    });
    render(
      <DiffDialog
        open={true}
        leftUri="local:///tmp/a.txt"
        rightUri="local:///tmp/b.txt"
        leftName="a.txt"
        rightName="b.txt"
        fs={fs}
        onClose={() => {}}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/truncated/i)).toBeTruthy();
    });
  });

  it("shows no-differences message for identical files", async () => {
    const fs = createMockFs({
      hunks: [],
      leftLineCount: 5,
      rightLineCount: 5,
    });
    render(
      <DiffDialog
        open={true}
        leftUri="local:///tmp/a.txt"
        rightUri="local:///tmp/b.txt"
        leftName="a.txt"
        rightName="b.txt"
        fs={fs}
        onClose={() => {}}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/No differences/)).toBeTruthy();
    });
  });

  it("calls onClose when close button clicked", async () => {
    const fs = createMockFs();
    const onClose = vi.fn();
    render(
      <DiffDialog
        open={true}
        leftUri="local:///tmp/a.txt"
        rightUri="local:///tmp/b.txt"
        leftName="a.txt"
        rightName="b.txt"
        fs={fs}
        onClose={onClose}
      />,
    );
    const closeBtn = screen.getByLabelText("Close diff viewer");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
