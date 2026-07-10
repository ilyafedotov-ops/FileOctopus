import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MultiRenameDialog } from "../src/components/MultiRenameDialog";

afterEach(cleanup);

const entry = {
  uri: "local:///tmp/test.txt",
  name: "test.txt",
  kind: "file",
} as FileEntryDto;

describe("MultiRenameDialog", () => {
  it("stays open and shows the backend error when planning fails", async () => {
    const onClose = vi.fn();
    const onExecute = vi.fn().mockResolvedValue("Destination already exists.");
    render(
      <MultiRenameDialog
        open
        entries={[entry]}
        onClose={onClose}
        onExecute={onExecute}
      />,
    );
    fireEvent.change(screen.getByLabelText("Pattern"), {
      target: { value: "[N]-new" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rename 1 files" }));

    await waitFor(() => expect(onExecute).toHaveBeenCalledTimes(1));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Destination already exists.",
    );
    expect(screen.getByRole("dialog")).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes only after the batch job starts successfully", async () => {
    const onClose = vi.fn();
    const onExecute = vi.fn().mockResolvedValue(null);
    render(
      <MultiRenameDialog
        open
        entries={[entry]}
        onClose={onClose}
        onExecute={onExecute}
      />,
    );
    fireEvent.change(screen.getByLabelText("Pattern"), {
      target: { value: "[N]-new" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rename 1 files" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onExecute).toHaveBeenCalledTimes(1);
  });
});
