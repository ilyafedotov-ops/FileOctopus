import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { DestinationChooser } from "../src/dialogs/DestinationChooser";
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

describe("DestinationChooser with FolderTree", () => {
  afterEach(cleanup);

  it("renders Browse section when fs is provided and home location exists", () => {
    const fs = createMockFs({});
    render(
      <DestinationChooser
        locations={[
          {
            id: "home",
            name: "Home",
            uri: "local:///home/user",
            section: "places",
          },
        ]}
        favorites={[]}
        recent={[]}
        fs={fs}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("Browse")).toBeTruthy();
  });

  it("does not render Browse section when fs is not provided", () => {
    render(
      <DestinationChooser
        locations={[
          {
            id: "home",
            name: "Home",
            uri: "local:///home/user",
            section: "places",
          },
        ]}
        favorites={[]}
        recent={[]}
        onSelect={() => {}}
      />,
    );
    expect(screen.queryByText("Browse")).toBeNull();
  });

  it("does not render Browse section when no home location exists", () => {
    const fs = createMockFs({});
    render(
      <DestinationChooser
        locations={[
          {
            id: "documents",
            name: "Documents",
            uri: "local:///home/user/Documents",
            section: "places",
          },
        ]}
        favorites={[]}
        recent={[]}
        fs={fs}
        onSelect={() => {}}
      />,
    );
    expect(screen.queryByText("Browse")).toBeNull();
  });

  it("tree selection calls onSelect", async () => {
    const fs = createMockFs({});
    const onSelect = vi.fn();
    render(
      <DestinationChooser
        locations={[
          {
            id: "home",
            name: "Home",
            uri: "local:///home/user",
            section: "places",
          },
        ]}
        favorites={[]}
        recent={[]}
        fs={fs}
        onSelect={onSelect}
      />,
    );

    const treeLabel = screen
      .getAllByText("Home")
      .find((el) => el.classList.contains("fo-folder-tree-label"));
    expect(treeLabel).toBeTruthy();
    fireEvent.click(treeLabel!);
    expect(onSelect).toHaveBeenCalledWith("local:///home/user");
  });

  it("renders Locations section alongside Browse", () => {
    const fs = createMockFs({});
    render(
      <DestinationChooser
        locations={[
          {
            id: "home",
            name: "Home",
            uri: "local:///home/user",
            section: "places",
          },
          {
            id: "documents",
            name: "Documents",
            uri: "local:///home/user/Documents",
            section: "places",
          },
        ]}
        favorites={[]}
        recent={[]}
        fs={fs}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("Browse")).toBeTruthy();
    expect(screen.getByText("Locations")).toBeTruthy();
    expect(screen.getByText("Documents")).toBeTruthy();
  });
});
