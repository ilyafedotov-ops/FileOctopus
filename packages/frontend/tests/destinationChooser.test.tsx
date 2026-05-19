import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import {
  DestinationChooser,
  localPathFromUri,
} from "../src/dialogs/DestinationChooser";
import type {
  StandardLocationDto,
  FavoriteEntryDto,
  RecentEntryDto,
} from "@fileoctopus/ts-api";

afterEach(cleanup);

function makeLocation(
  overrides: Partial<StandardLocationDto> = {},
): StandardLocationDto {
  return {
    id: "home",
    name: "Home",
    uri: "local:///home/user",
    section: "places",
    ...overrides,
  };
}

function makeFavorite(
  overrides: Partial<FavoriteEntryDto> = {},
): FavoriteEntryDto {
  return {
    id: 1,
    uri: "local:///home/user/projects",
    label: "Projects",
    ...overrides,
  };
}

function makeRecent(overrides: Partial<RecentEntryDto> = {}): RecentEntryDto {
  return {
    uri: "local:///home/user/downloads",
    label: "Downloads",
    visitedAt: "2026-05-18T10:00:00Z",
    ...overrides,
  };
}

const noop = () => {};

describe("DestinationChooser", () => {
  it("renders section headings for locations, favorites, and recent", () => {
    render(
      <DestinationChooser
        locations={[makeLocation()]}
        favorites={[makeFavorite()]}
        recent={[makeRecent()]}
        onSelect={noop}
      />,
    );

    expect(screen.getByRole("heading", { name: /locations/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /favorites/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /recent/i })).toBeTruthy();
  });

  it("renders location items as clickable buttons", () => {
    const onSelect = vi.fn();
    render(
      <DestinationChooser
        locations={[
          makeLocation({ id: "home", name: "Home", uri: "local:///home/user" }),
          makeLocation({
            id: "docs",
            name: "Documents",
            uri: "local:///home/user/Documents",
          }),
        ]}
        favorites={[]}
        recent={[]}
        onSelect={onSelect}
      />,
    );

    const homeBtn = screen.getByRole("button", { name: /home/i });
    expect(homeBtn).toBeTruthy();

    fireEvent.click(homeBtn);
    expect(onSelect).toHaveBeenCalledWith("local:///home/user");
  });

  it("renders favorite items as clickable buttons", () => {
    const onSelect = vi.fn();
    render(
      <DestinationChooser
        locations={[]}
        favorites={[
          makeFavorite({
            id: 1,
            uri: "local:///home/user/code",
            label: "Code",
          }),
        ]}
        recent={[]}
        onSelect={onSelect}
      />,
    );

    const codeBtn = screen.getByRole("button", { name: /code/i });
    expect(codeBtn).toBeTruthy();

    fireEvent.click(codeBtn);
    expect(onSelect).toHaveBeenCalledWith("local:///home/user/code");
  });

  it("renders recent items as clickable buttons", () => {
    const onSelect = vi.fn();
    render(
      <DestinationChooser
        locations={[]}
        favorites={[]}
        recent={[
          makeRecent({
            uri: "local:///tmp",
            label: "tmp",
            visitedAt: "2026-05-18T12:00:00Z",
          }),
        ]}
        onSelect={onSelect}
      />,
    );

    const tmpBtn = screen.getByRole("button", { name: /tmp/i });
    expect(tmpBtn).toBeTruthy();

    fireEvent.click(tmpBtn);
    expect(onSelect).toHaveBeenCalledWith("local:///tmp");
  });

  it("hides sections with no items", () => {
    render(
      <DestinationChooser
        locations={[makeLocation()]}
        favorites={[]}
        recent={[]}
        onSelect={noop}
      />,
    );

    expect(screen.queryByRole("heading", { name: /favorites/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /recent/i })).toBeNull();
    expect(screen.getByRole("heading", { name: /locations/i })).toBeTruthy();
  });

  it("renders with all empty lists without error", () => {
    const { container } = render(
      <DestinationChooser
        locations={[]}
        favorites={[]}
        recent={[]}
        onSelect={noop}
      />,
    );

    expect(container).toBeTruthy();
  });
});

describe("localPathFromUri", () => {
  it("extracts path from local:// URI", () => {
    expect(localPathFromUri("local:///home/user/docs")).toBe("/home/user/docs");
  });

  it("returns the string as-is if not a local:// URI", () => {
    expect(localPathFromUri("/home/user/docs")).toBe("/home/user/docs");
  });

  it("extracts remote path from sftp URIs", () => {
    expect(
      localPathFromUri("sftp://77ac077d-d721-480f-9ee0-bb22403f0fd5/home/ilya"),
    ).toBe("/home/ilya");
  });
});
