import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DialogShell } from "../src/components/DialogShell";

afterEach(() => {
  cleanup();
});

describe("DialogShell (UPP-E1)", () => {
  it("renders nothing when closed", () => {
    render(
      <DialogShell open={false} onClose={() => {}} title="Hidden">
        <p>body</p>
      </DialogShell>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders an accessible modal with title, subtitle, and footer", () => {
    render(
      <DialogShell
        open
        onClose={() => {}}
        title="Rename"
        subtitle="Choose a new name"
        footer={<button type="button">Save</button>}
      >
        <p>body</p>
      </DialogShell>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    // Heading is wired to aria-labelledby.
    const heading = screen.getByRole("heading", { name: "Rename" });
    expect(dialog.getAttribute("aria-labelledby")).toBe(heading.id);
    expect(screen.getByText("Choose a new name")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Save" })).not.toBeNull();
  });

  it("closes via the header close button and the Escape key", () => {
    const onClose = vi.fn();
    render(
      <DialogShell open onClose={onClose} title="Confirm">
        <p>body</p>
      </DialogShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("hides the close button when showClose is false", () => {
    render(
      <DialogShell open onClose={() => {}} title="NoClose" showClose={false}>
        <p>body</p>
      </DialogShell>,
    );
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("applies a size modifier class", () => {
    render(
      <DialogShell open onClose={() => {}} title="Sized" size="lg">
        <p>body</p>
      </DialogShell>,
    );
    expect(screen.getByRole("dialog").className).toContain("fo-dialog--lg");
  });
});
