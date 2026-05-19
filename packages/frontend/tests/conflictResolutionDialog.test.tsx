import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ConflictResolutionDialog } from "../src/components/dialogs/ConflictResolutionDialog";
import type {
  FileOperationConflictDto,
  FileEntryDto,
} from "@fileoctopus/ts-api";

afterEach(cleanup);

function makeEntry(overrides: Partial<FileEntryDto> = {}): FileEntryDto {
  return {
    name: "report.pdf",
    uri: "local:///home/user/docs/report.pdf",
    kind: "file",
    size: 2048,
    extension: "pdf",
    modifiedAt: "2026-05-10T12:00:00Z",
    createdAt: "2026-05-01T08:00:00Z",
    ...overrides,
  };
}

function makeConflict(
  overrides: Partial<FileOperationConflictDto> = {},
): FileOperationConflictDto {
  return {
    source: "local:///home/user/docs/report.pdf",
    destination: "local:///home/user/backup/report.pdf",
    ...overrides,
  };
}

describe("ConflictResolutionDialog", () => {
  it("renders conflict items with source and destination names", () => {
    const conflicts = [
      makeConflict({
        source: "local:///home/user/docs/report.pdf",
        destination: "local:///home/user/backup/report.pdf",
      }),
    ];
    const entries = [makeEntry()];

    render(
      <ConflictResolutionDialog
        conflicts={conflicts}
        entries={entries}
        onBack={vi.fn()}
        onResolve={vi.fn()}
      />,
    );

    expect(screen.getByText("Resolve Conflicts")).toBeTruthy();
    expect(screen.getAllByText("report.pdf").length >= 1).toBe(true);
  });

  it("renders multiple conflicts", () => {
    const conflicts = [
      makeConflict({
        source: "local:///home/user/docs/a.txt",
        destination: "local:///home/user/backup/a.txt",
      }),
      makeConflict({
        source: "local:///home/user/docs/b.txt",
        destination: "local:///home/user/backup/b.txt",
      }),
    ];
    const entries = [
      makeEntry({ name: "a.txt", uri: "local:///home/user/docs/a.txt" }),
      makeEntry({ name: "b.txt", uri: "local:///home/user/docs/b.txt" }),
    ];

    render(
      <ConflictResolutionDialog
        conflicts={conflicts}
        entries={entries}
        onBack={vi.fn()}
        onResolve={vi.fn()}
      />,
    );

    expect(screen.getAllByText("a.txt").length >= 1).toBe(true);
    expect(screen.getAllByText("b.txt").length >= 1).toBe(true);
  });

  it("shows action buttons: Replace, Skip, Keep Both, Cancel", () => {
    const conflicts = [makeConflict()];
    const entries = [makeEntry()];

    render(
      <ConflictResolutionDialog
        conflicts={conflicts}
        entries={entries}
        onBack={vi.fn()}
        onResolve={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Replace").length >= 1).toBe(true);
    expect(screen.getAllByText("Skip").length >= 1).toBe(true);
    expect(screen.getAllByText("Keep Both").length >= 1).toBe(true);
    expect(screen.getByText("Cancel Operation")).toBeTruthy();
  });

  it("defaults to Skip as safe default action", () => {
    const conflicts = [makeConflict()];
    const entries = [makeEntry()];

    render(
      <ConflictResolutionDialog
        conflicts={conflicts}
        entries={entries}
        onBack={vi.fn()}
        onResolve={vi.fn()}
      />,
    );

    const radios = screen.getAllByRole("radio");
    const skipRadio = radios.find(
      (r) => r.getAttribute("value") === "skip" && r.checked,
    );
    expect(skipRadio).toBeTruthy();
  });

  it("has Apply to all checkbox", () => {
    const conflicts = [makeConflict()];
    const entries = [makeEntry()];

    render(
      <ConflictResolutionDialog
        conflicts={conflicts}
        entries={entries}
        onBack={vi.fn()}
        onResolve={vi.fn()}
      />,
    );

    const checkbox = screen.getByRole("checkbox", {
      name: /apply to all/i,
    });
    expect(checkbox).toBeTruthy();
  });

  it("calls onResolve with skip action when Skip is clicked with applyToAll", () => {
    const onResolve = vi.fn();
    const conflicts = [makeConflict()];
    const entries = [makeEntry()];

    render(
      <ConflictResolutionDialog
        conflicts={conflicts}
        entries={entries}
        onBack={vi.fn()}
        onResolve={onResolve}
      />,
    );

    const checkbox = screen.getByRole("checkbox", {
      name: /apply to all/i,
    });
    fireEvent.click(checkbox);

    const skipBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent === "Skip");
    expect(skipBtn).toBeTruthy();
    fireEvent.click(skipBtn!);

    expect(onResolve).toHaveBeenCalledWith({
      action: "skip",
      applyToAll: true,
    });
  });

  it("calls onResolve with overwrite action when Replace is clicked", () => {
    const onResolve = vi.fn();
    const conflicts = [makeConflict()];
    const entries = [makeEntry()];

    render(
      <ConflictResolutionDialog
        conflicts={conflicts}
        entries={entries}
        onBack={vi.fn()}
        onResolve={onResolve}
      />,
    );

    const replaceBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent === "Replace");
    expect(replaceBtn).toBeTruthy();
    fireEvent.click(replaceBtn!);

    expect(onResolve).toHaveBeenCalledWith({
      action: "overwrite",
      applyToAll: false,
    });
  });

  it("calls onBack when Cancel Operation is clicked", () => {
    const onBack = vi.fn();
    const conflicts = [makeConflict()];
    const entries = [makeEntry()];

    render(
      <ConflictResolutionDialog
        conflicts={conflicts}
        entries={entries}
        onBack={onBack}
        onResolve={vi.fn()}
      />,
    );

    const cancelBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent === "Cancel Operation");
    expect(cancelBtn).toBeTruthy();
    fireEvent.click(cancelBtn!);

    expect(onBack).toHaveBeenCalled();
  });

  it("shows source file size when available", () => {
    const conflicts = [
      makeConflict({
        source: "local:///home/user/docs/report.pdf",
        destination: "local:///home/user/backup/report.pdf",
      }),
    ];
    const entries = [
      makeEntry({
        uri: "local:///home/user/docs/report.pdf",
        size: 128,
      }),
    ];

    render(
      <ConflictResolutionDialog
        conflicts={conflicts}
        entries={entries}
        onBack={vi.fn()}
        onResolve={vi.fn()}
      />,
    );

    expect(screen.getByText("128 B")).toBeTruthy();
  });

  it("shows destination size and date when destinationByUri is provided", () => {
    const conflicts = [
      makeConflict({
        source: "local:///home/user/docs/report.pdf",
        destination: "local:///home/user/backup/report.pdf",
      }),
    ];
    const entries = [
      makeEntry({
        uri: "local:///home/user/docs/report.pdf",
        size: 128,
      }),
    ];

    render(
      <ConflictResolutionDialog
        conflicts={conflicts}
        entries={entries}
        destinationByUri={{
          "local:///home/user/backup/report.pdf": {
            size: 4096,
            modifiedAt: "2026-04-01T10:00:00Z",
          },
        }}
        onBack={vi.fn()}
        onResolve={vi.fn()}
      />,
    );

    expect(screen.getByText("128 B")).toBeTruthy();
    expect(screen.getByText("4 KB")).toBeTruthy();
    expect(screen.getByText(/Apr 1, 2026/)).toBeTruthy();
  });

  it("shows source modified date when available", () => {
    const conflicts = [makeConflict()];
    const entries = [makeEntry({ modifiedAt: "2026-05-10T12:00:00Z" })];

    render(
      <ConflictResolutionDialog
        conflicts={conflicts}
        entries={entries}
        onBack={vi.fn()}
        onResolve={vi.fn()}
      />,
    );

    expect(screen.getByText(/2026/)).toBeTruthy();
  });
});
