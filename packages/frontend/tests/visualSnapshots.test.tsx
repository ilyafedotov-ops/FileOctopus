import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderVisualState } from "./visualFixtures";
import { VisualShellFixture } from "./visualShellFixture";

describe("visual regression snapshots", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-density");
  });

  it("matches the shell chrome structure in light theme", () => {
    const view = renderVisualState(<VisualShellFixture />);

    expect(screen.getByText("FileOctopus")).toBeTruthy();
    expect(screen.getByLabelText("File workspace preview")).toBeTruthy();
    expect(screen.getByLabelText("Activity and terminal")).toBeTruthy();
    expect(document.querySelector(".fo-dual-pane")).toBeTruthy();
    expect(view.container.querySelector(".fo-shell-frame")).toMatchSnapshot();
    view.restore();
  });

  it("matches the shell chrome structure in dark theme", () => {
    const view = renderVisualState(<VisualShellFixture />, { theme: "dark" });

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(view.container.querySelector(".fo-shell-frame")).toMatchSnapshot();
    view.restore();
  });
});
