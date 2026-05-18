import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { FileTable } from "../src/pane/FileTable";
import { createParentDirectoryEntry } from "../src/utils/parentEntry";

afterEach(cleanup);

describe("parent directory row", () => {
  it("renders .. as the first row for nested folders", () => {
    const parent = createParentDirectoryEntry("local:///tmp/nested")!;
    const onEntryActivate = vi.fn();

    render(
      <FileTable
        entries={[parent]}
        currentUri="local:///tmp/nested"
        loadState="loaded"
        rowHeight={32}
        selectedId={null}
        selectedIds={[]}
        focusedId={null}
        sortField="name"
        sortDirection="asc"
        viewMode="details"
        onSelect={vi.fn()}
        onEntrySelect={vi.fn()}
        onMove={vi.fn()}
        onSort={vi.fn()}
        onActivate={vi.fn()}
        onEntryActivate={onEntryActivate}
        onContextMenu={vi.fn()}
      />,
    );

    expect(screen.getByText("..")).toBeTruthy();

    fireEvent.dblClick(screen.getByText(".."));

    expect(onEntryActivate).toHaveBeenCalledWith(
      expect.objectContaining({ uri: "local:///tmp", name: ".." }),
    );
  });
});
