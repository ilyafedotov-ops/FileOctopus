import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import type { FsClient, SyncDirectoriesResponse } from "@fileoctopus/ts-api";
import { SyncDirectoriesDialog } from "../src/components/dialogs/SyncDirectoriesDialog";

afterEach(cleanup);

function createMockFs() {
  const response: SyncDirectoriesResponse = {
    leftUri: "local:///left",
    rightUri: "local:///right",
    recursive: false,
    entries: [],
  };

  return {
    syncDirectories: vi.fn().mockResolvedValue(response),
  } as unknown as FsClient;
}

describe("SyncDirectoriesDialog", () => {
  it("uses the requested initial comparison on the opening render", async () => {
    const fs = createMockFs();
    const { rerender } = render(
      <SyncDirectoriesDialog
        open={false}
        leftUri="local:///left"
        rightUri="local:///right"
        fs={fs}
        initialComparison="size"
        onClose={() => {}}
      />,
    );

    rerender(
      <SyncDirectoriesDialog
        open={true}
        leftUri="local:///left"
        rightUri="local:///right"
        fs={fs}
        initialComparison="name"
        onClose={() => {}}
      />,
    );

    await waitFor(() => {
      expect(fs.syncDirectories).toHaveBeenCalledWith({
        leftUri: "local:///left",
        rightUri: "local:///right",
        comparison: "name",
        recursive: false,
      });
    });
    expect(fs.syncDirectories).toHaveBeenCalledTimes(1);
  });
});
