import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PathBar } from "../src/pane/PanePathBar";

vi.mock("@fileoctopus/ts-api", () => ({
  isRemoteUri: (uri: string) =>
    uri.startsWith("sftp://") || uri.startsWith("smb://"),
  uriScheme: (uri: string) => {
    const idx = uri.indexOf("://");
    return idx > 0 ? uri.slice(0, idx) : null;
  },
  breadcrumbSegmentsFromUri: (uri: string) => {
    const parts = uri
      .replace(/^local:\/\//, "")
      .replace(/^sftp:\/\//, "")
      .split("/")
      .filter(Boolean);
    let path = uri.startsWith("sftp://") ? "sftp://" : "local://";
    if (uri.startsWith("sftp://")) {
      return parts.map((p, i) => {
        const segmentPath =
          i === 0 ? `sftp://${p}` : `${path}${parts.slice(0, i + 1).join("/")}`;
        path = i === 0 ? `sftp://${p}/` : path;
        return { label: p, uri: segmentPath };
      });
    }
    return parts.map((p, i) => ({
      label: p,
      uri: `local:///${parts.slice(0, i + 1).join("/")}`,
    }));
  },
}));

vi.mock("@fileoctopus/ui", () => ({
  BreadcrumbPath: ({
    segments,
    onNavigate,
    onEditPath,
    onSegmentContextMenu,
    leading,
  }: {
    segments: Array<{ label: string; path: string }>;
    onNavigate: (path: string) => void;
    onEditPath: () => void;
    onSegmentContextMenu?: (
      segment: { label: string; path: string },
      e: React.MouseEvent,
    ) => void;
    leading?: React.ReactNode;
  }) => (
    <div data-testid="breadcrumb">
      {leading}
      {segments.map((seg) => (
        <button
          key={seg.path}
          data-testid={`segment-${seg.label}`}
          onClick={() => onNavigate(seg.path)}
          onContextMenu={
            onSegmentContextMenu
              ? (e) => onSegmentContextMenu(seg, e)
              : undefined
          }
        >
          {seg.label}
        </button>
      ))}
      <button data-testid="edit-path" onClick={onEditPath}>
        Edit
      </button>
    </div>
  ),
  Icons: {
    server: () => <span data-testid="server-icon">Server</span>,
  },
}));

afterEach(cleanup);

describe("PathBar", () => {
  it("renders breadcrumb view by default for local paths", () => {
    render(
      <PathBar
        value="local:///home/user/docs"
        error={null}
        focusToken={0}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByTestId("breadcrumb")).toBeTruthy();
  });

  it("displays error class when error prop is set", () => {
    const { container } = render(
      <PathBar
        value="local:///home/user/docs"
        error="Not found"
        focusToken={0}
        onSubmit={vi.fn()}
      />,
    );
    const wrap = container.firstElementChild!;
    expect(wrap.className).toContain("fo-path-error-wrap");
  });

  it("does not set error class when error is null", () => {
    const { container } = render(
      <PathBar
        value="local:///home/user/docs"
        error={null}
        focusToken={0}
        onSubmit={vi.fn()}
      />,
    );
    const wrap = container.firstElementChild!;
    expect(wrap.className).not.toContain("fo-path-error-wrap");
  });

  it("switches to input mode on double-click of breadcrumb container", () => {
    const { container } = render(
      <PathBar
        value="local:///home/user/docs"
        error={null}
        focusToken={0}
        onSubmit={vi.fn()}
      />,
    );
    const wrap = container.firstElementChild!;
    fireEvent.doubleClick(wrap);
    const input = screen.getByLabelText("Current path");
    expect(input).toBeTruthy();
  });

  it("switches to input mode when onEditPath is triggered from breadcrumb", () => {
    render(
      <PathBar
        value="local:///home/user/docs"
        error={null}
        focusToken={0}
        onSubmit={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("edit-path"));
    const input = screen.getByLabelText("Current path");
    expect(input).toBeTruthy();
  });

  it("submits path on Enter key in input mode", () => {
    const onSubmit = vi.fn();
    render(
      <PathBar
        value="local:///home/user/docs"
        error={null}
        focusToken={0}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.doubleClick(screen.getByTestId("breadcrumb").parentElement!);
    const input = screen.getByLabelText("Current path");
    fireEvent.change(input, {
      target: { value: "local:///home/user/projects" },
    });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("local:///home/user/projects");
  });

  it("cancels editing on Escape key and restores original value", () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <PathBar
        value="local:///home/user/docs"
        error={null}
        focusToken={0}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.doubleClick(screen.getByTestId("breadcrumb").parentElement!);
    const input = screen.getByLabelText("Current path");
    fireEvent.change(input, { target: { value: "local:///changed" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onSubmit).not.toHaveBeenCalled();

    rerender(
      <PathBar
        value="local:///home/user/docs"
        error={null}
        focusToken={0}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByTestId("breadcrumb")).toBeTruthy();
  });

  it("cancels editing on blur and restores original value", () => {
    const onSubmit = vi.fn();
    render(
      <PathBar
        value="local:///home/user/docs"
        error={null}
        focusToken={0}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.doubleClick(screen.getByTestId("breadcrumb").parentElement!);
    const input = screen.getByLabelText("Current path");
    fireEvent.change(input, { target: { value: "local:///changed" } });
    fireEvent.blur(input);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sets focusToken to enter edit mode", () => {
    const { rerender } = render(
      <PathBar
        value="local:///home/user/docs"
        error={null}
        focusToken={0}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByTestId("breadcrumb")).toBeTruthy();

    rerender(
      <PathBar
        value="local:///home/user/docs"
        error={null}
        focusToken={1}
        onSubmit={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("Current path");
    expect(input).toBeTruthy();
    expect(document.activeElement).toBe(input);
  });

  it("calls onSubmit when breadcrumb segment is clicked", () => {
    const onSubmit = vi.fn();
    render(
      <PathBar
        value="local:///home/user/docs"
        error={null}
        focusToken={0}
        onSubmit={onSubmit}
      />,
    );
    const segmentButton = screen.getByTestId("segment-home");
    fireEvent.click(segmentButton);
    expect(onSubmit).toHaveBeenCalled();
  });

  it("renders remote label for remote URIs", () => {
    render(
      <PathBar
        value="sftp://server/home/user"
        error={null}
        focusToken={0}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByTestId("server-icon")).toBeTruthy();
  });

  it("does not render remote label for local URIs", () => {
    render(
      <PathBar
        value="local:///home/user/docs"
        error={null}
        focusToken={0}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("server-icon")).toBeNull();
  });

  it("shows title attribute on breadcrumb wrapper", () => {
    const { container } = render(
      <PathBar
        value="local:///home/user/docs"
        error={null}
        focusToken={0}
        onSubmit={vi.fn()}
      />,
    );
    const wrap = container.firstElementChild!;
    expect(wrap.getAttribute("title")).toBe("local:///home/user/docs");
  });

  it("shows error styling in input mode when error is present", () => {
    const { container } = render(
      <PathBar
        value="local:///home/user/docs"
        error="Permission denied"
        focusToken={1}
        onSubmit={vi.fn()}
      />,
    );
    const input = container.querySelector("input");
    expect(input?.className).toContain("fo-path-error");
  });

  it("calls onBreadcrumbContextMenu when provided", () => {
    const onCtx = vi.fn();
    render(
      <PathBar
        value="local:///home/user/docs"
        error={null}
        focusToken={0}
        onSubmit={vi.fn()}
        onBreadcrumbContextMenu={onCtx}
      />,
    );
    const segmentButton = screen.getByTestId("segment-home");
    fireEvent.contextMenu(segmentButton);
    expect(onCtx).toHaveBeenCalledTimes(1);
  });

  it("updates draft when value changes while not editing", () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <PathBar
        value="local:///home/user/docs"
        error={null}
        focusToken={0}
        onSubmit={onSubmit}
      />,
    );

    rerender(
      <PathBar
        value="local:///home/user/projects"
        error={null}
        focusToken={0}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.doubleClick(screen.getByTestId("breadcrumb").parentElement!);
    const input = screen.getByLabelText("Current path") as HTMLInputElement;
    expect(input.value).toBe("local:///home/user/projects");
  });
});
