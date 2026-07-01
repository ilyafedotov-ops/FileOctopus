import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TitleBar } from "../src/shell/TitleBar";
import type { MenuBarProps } from "../src/shell/MenuBar";
import { buildTitleBarStatus } from "../src/shell/titleBarStatus";

vi.mock("../src/shell/MenuBar", () => ({
  MenuBar: () => <div role="menubar" />,
}));

describe("title bar status", () => {
  it("builds a dirty git status item for local repositories", () => {
    expect(
      buildTitleBarStatus({
        activeUri: "local:///repo",
        gitRepo: {
          rootUri: "local:///repo",
          branch: "main",
          headShort: "abcdef1",
          isDirty: true,
        },
        networkStatuses: [],
        operationError: null,
      }),
    ).toEqual([
      {
        key: "git",
        label: "Git: main",
        title: "Git branch main with changes",
        tone: "warning",
      },
    ]);
  });

  it("builds a remote connection status item for active remote panes", () => {
    expect(
      buildTitleBarStatus({
        activeUri: "sftp://profile-1/work",
        gitRepo: null,
        networkStatuses: [
          {
            profileId: "profile-1",
            status: "connected",
            message: null,
          },
        ],
        operationError: null,
      }),
    ).toEqual([
      {
        key: "remote",
        label: "Remote: connected",
        title: "Remote profile profile-1 is connected",
        tone: "ok",
      },
    ]);
  });

  it("renders status items in the title bar", () => {
    render(
      <TitleBar
        onSettings={() => undefined}
        statusItems={[
          {
            key: "git",
            label: "Git: main",
            title: "Git branch main with changes",
            tone: "warning",
          },
          {
            key: "health",
            label: "Attention",
            title: "Last operation reported a problem",
            tone: "danger",
          },
        ]}
      />,
    );

    expect(screen.getByTitle("Git branch main with changes")).toBeTruthy();
    expect(screen.getByTitle("Last operation reported a problem")).toBeTruthy();
  });

  it("hides the in-window menu bar when the native menu is active", () => {
    render(
      <TitleBar
        onSettings={() => undefined}
        menuBarProps={{} as MenuBarProps}
        nativeMenuActive
      />,
    );

    expect(screen.queryByRole("menubar")).toBeNull();
  });
});
