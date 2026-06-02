import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TerminalCommandDialog } from "../src/components/dialogs/TerminalCommandDialog";

afterEach(cleanup);

describe("TerminalCommandDialog", () => {
  it("renders nothing when closed", () => {
    render(
      <TerminalCommandDialog
        open={false}
        title="Run Command in Terminal"
        submitLabel="Run"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("submits a trimmed command", () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(
      <TerminalCommandDialog
        open
        title="Run Command in Terminal"
        submitLabel="Run"
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Terminal command"), {
      target: { value: "  pnpm test  " },
    });
    fireEvent.click(screen.getByText("Run"));

    expect(onSubmit).toHaveBeenCalledWith("pnpm test");
    expect(onClose).toHaveBeenCalled();
  });

  it("does not submit an empty command", () => {
    const onSubmit = vi.fn();
    render(
      <TerminalCommandDialog
        open
        title="Run Command in Terminal"
        submitLabel="Run"
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const runButton = screen.getByText("Run") as HTMLButtonElement;
    expect(runButton.disabled).toBe(true);
    fireEvent.click(runButton);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("closes without submitting", () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    render(
      <TerminalCommandDialog
        open
        title="Run Command in Terminal"
        submitLabel="Run"
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByText("Cancel"));

    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
