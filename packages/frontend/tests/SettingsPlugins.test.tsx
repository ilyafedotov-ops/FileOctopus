import { describe, expect, it, vi, afterEach } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import { SettingsPlugins } from "../src/components/settings/SettingsPlugins";

function makePlugin(overrides: Record<string, unknown> = {}) {
  return {
    manifest: {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      description: "A test plugin",
      author: "Test Author",
      permissions: ["fs.read"],
      ...overrides,
    },
    enabled: true,
  };
}

function makeClient({
  listResult = { plugins: [] },
}: {
  listResult?: { plugins: unknown[] };
} = {}) {
  return {
    list: vi.fn(async () => listResult),
    uninstall: vi.fn(async () => {}),
    toggle: vi.fn(async () => {}),
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SettingsPlugins", () => {
  it("renders loading state initially", () => {
    const client = makeClient();
    client.list.mockReturnValue(new Promise(() => {}));
    render(
      <SettingsPlugins
        pluginClient={client as unknown as Record<string, unknown>}
      />,
    );
    expect(screen.getByText("Loading plugins…")).toBeTruthy();
  });

  it("renders empty state when no plugins installed", async () => {
    const client = makeClient();
    render(
      <SettingsPlugins
        pluginClient={client as unknown as Record<string, unknown>}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("No plugins installed")).toBeTruthy();
    });
    expect(
      screen.getByText(/installation is disabled until signed Wasm packages/),
    ).toBeTruthy();
  });

  it("renders plugin list with details", async () => {
    const plugin = makePlugin();
    const client = makeClient({ listResult: { plugins: [plugin] } });
    render(
      <SettingsPlugins
        pluginClient={client as unknown as Record<string, unknown>}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Test Plugin")).toBeTruthy();
    });
    expect(screen.getByText("1.0.0")).toBeTruthy();
    expect(screen.getByText("A test plugin")).toBeTruthy();
    expect(screen.getByText(/by Test Author/)).toBeTruthy();
    expect(screen.getByText("Enabled")).toBeTruthy();
    expect(screen.getByText("fs.read")).toBeTruthy();
  });

  it("renders Disabled status when plugin is disabled", async () => {
    const plugin = makePlugin();
    plugin.enabled = false;
    const client = makeClient({ listResult: { plugins: [plugin] } });
    render(
      <SettingsPlugins
        pluginClient={client as unknown as Record<string, unknown>}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Disabled")).toBeTruthy();
    });
  });

  it("hides permissions section when no permissions", async () => {
    const plugin = makePlugin();
    plugin.manifest.permissions = [];
    const client = makeClient({ listResult: { plugins: [plugin] } });
    render(
      <SettingsPlugins
        pluginClient={client as unknown as Record<string, unknown>}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Test Plugin")).toBeTruthy();
    });
    expect(screen.queryByText("fs.read")).toBeNull();
  });

  it("calls toggle when Enable/Disable button clicked", async () => {
    const plugin = makePlugin();
    const client = makeClient({ listResult: { plugins: [plugin] } });
    render(
      <SettingsPlugins
        pluginClient={client as unknown as Record<string, unknown>}
      />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("Disable")).toBeTruthy();
    });
    fireEvent.click(screen.getByLabelText("Disable"));
    expect(client.toggle).toHaveBeenCalledWith({
      pluginId: "test-plugin",
      enabled: false,
    });
  });

  it("calls uninstall when Uninstall button clicked", async () => {
    const plugin = makePlugin();
    const client = makeClient({ listResult: { plugins: [plugin] } });
    render(
      <SettingsPlugins
        pluginClient={client as unknown as Record<string, unknown>}
      />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("Uninstall")).toBeTruthy();
    });
    fireEvent.click(screen.getByLabelText("Uninstall"));
    expect(client.uninstall).toHaveBeenCalledWith({ pluginId: "test-plugin" });
  });

  it("shows error when list fails", async () => {
    const client = makeClient();
    client.list.mockRejectedValue(new Error("Network error"));
    render(
      <SettingsPlugins
        pluginClient={client as unknown as Record<string, unknown>}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Network error");
    });
  });

  it("shows generic error when list fails with non-Error", async () => {
    const client = makeClient();
    client.list.mockRejectedValue("string error");
    render(
      <SettingsPlugins
        pluginClient={client as unknown as Record<string, unknown>}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "Failed to load plugins",
      );
    });
  });

  it("shows error when uninstall fails", async () => {
    const plugin = makePlugin();
    const client = makeClient({ listResult: { plugins: [plugin] } });
    client.uninstall.mockRejectedValue(new Error("Uninstall failed"));
    render(
      <SettingsPlugins
        pluginClient={client as unknown as Record<string, unknown>}
      />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("Uninstall")).toBeTruthy();
    });
    fireEvent.click(screen.getByLabelText("Uninstall"));
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "Uninstall failed",
      );
    });
  });

  it("shows error when toggle fails", async () => {
    const plugin = makePlugin();
    const client = makeClient({ listResult: { plugins: [plugin] } });
    client.toggle.mockRejectedValue(new Error("Toggle failed"));
    render(
      <SettingsPlugins
        pluginClient={client as unknown as Record<string, unknown>}
      />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("Disable")).toBeTruthy();
    });
    fireEvent.click(screen.getByLabelText("Disable"));
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Toggle failed");
    });
  });

  it("renders multiple plugins", async () => {
    const plugins = [
      makePlugin({ id: "p1", name: "Plugin 1" }),
      makePlugin({ id: "p2", name: "Plugin 2" }),
    ];
    const client = makeClient({ listResult: { plugins } });
    render(
      <SettingsPlugins
        pluginClient={client as unknown as Record<string, unknown>}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Plugin 1")).toBeTruthy();
      expect(screen.getByText("Plugin 2")).toBeTruthy();
    });
  });

  it("reloads plugin list after successful uninstall", async () => {
    const plugin = makePlugin();
    const client = makeClient({ listResult: { plugins: [plugin] } });
    render(
      <SettingsPlugins
        pluginClient={client as unknown as Record<string, unknown>}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Test Plugin")).toBeTruthy();
    });
    fireEvent.click(screen.getByLabelText("Uninstall"));
    await waitFor(() => {
      expect(client.list).toHaveBeenCalledTimes(2);
    });
  });
});
