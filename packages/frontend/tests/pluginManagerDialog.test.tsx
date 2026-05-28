import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from "@testing-library/react";
import { PluginManagerDialog } from "../src/components/dialogs/PluginManagerDialog";
import type { PluginClient } from "@fileoctopus/ts-api";
import type { InstalledPluginDto } from "@fileoctopus/ts-api";

afterEach(cleanup);

function samplePlugin(
  overrides?: Partial<InstalledPluginDto>,
): InstalledPluginDto {
  return {
    manifest: {
      id: "com.example.test",
      name: "Test Plugin",
      version: "1.0.0",
      description: "A test plugin",
      author: "Test Author",
      entryPoint: "main.js",
      permissions: ["readFiles"],
      minAppVersion: null,
    },
    installPath: "/tmp/plugins/com.example.test",
    enabled: true,
    ...overrides,
  };
}

function createMockPluginClient(plugins: InstalledPluginDto[] = []) {
  return {
    list: vi
      .fn<() => Promise<{ plugins: InstalledPluginDto[] }>>()
      .mockResolvedValue({ plugins }),
    install: vi.fn(),
    uninstall: vi
      .fn<() => Promise<{ ok: boolean }>>()
      .mockResolvedValue({ ok: true }),
    toggle: vi.fn(),
  } as unknown as PluginClient;
}

describe("PluginManagerDialog", () => {
  it("renders nothing when closed", () => {
    const client = createMockPluginClient();
    render(
      <PluginManagerDialog
        open={false}
        pluginClient={client}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders dialog with heading when open", () => {
    const client = createMockPluginClient();
    render(
      <PluginManagerDialog
        open={true}
        pluginClient={client}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Plugin Manager")).toBeTruthy();
  });

  it("calls pluginClient.list on open", async () => {
    const client = createMockPluginClient();
    render(
      <PluginManagerDialog
        open={true}
        pluginClient={client}
        onClose={() => {}}
      />,
    );
    await waitFor(() => {
      expect(client.list).toHaveBeenCalled();
    });
  });

  it("shows empty state when no plugins installed", async () => {
    const client = createMockPluginClient([]);
    render(
      <PluginManagerDialog
        open={true}
        pluginClient={client}
        onClose={() => {}}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/no plugins installed/i)).toBeTruthy();
    });
  });

  it("renders plugin cards with name and version", async () => {
    const client = createMockPluginClient([samplePlugin()]);
    render(
      <PluginManagerDialog
        open={true}
        pluginClient={client}
        onClose={() => {}}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Test Plugin")).toBeTruthy();
      expect(screen.getByText("1.0.0")).toBeTruthy();
    });
  });

  it("renders plugin description and author", async () => {
    const client = createMockPluginClient([samplePlugin()]);
    render(
      <PluginManagerDialog
        open={true}
        pluginClient={client}
        onClose={() => {}}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("A test plugin")).toBeTruthy();
      expect(screen.getByText(/Test Author/)).toBeTruthy();
    });
  });

  it("uninstall button calls pluginClient.uninstall", async () => {
    const client = createMockPluginClient([samplePlugin()]);
    render(
      <PluginManagerDialog
        open={true}
        pluginClient={client}
        onClose={() => {}}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Test Plugin")).toBeTruthy();
    });
    const uninstallBtn = screen.getByRole("button", { name: /uninstall/i });
    fireEvent.click(uninstallBtn);
    await waitFor(() => {
      expect(client.uninstall).toHaveBeenCalledWith({
        pluginId: "com.example.test",
      });
    });
  });

  it("toggle button calls pluginClient.toggle to disable", async () => {
    const client = createMockPluginClient([samplePlugin()]);
    render(
      <PluginManagerDialog
        open={true}
        pluginClient={client}
        onClose={() => {}}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Test Plugin")).toBeTruthy();
    });
    const disableBtn = screen.getByRole("button", { name: /disable/i });
    fireEvent.click(disableBtn);
    await waitFor(() => {
      expect(client.toggle).toHaveBeenCalledWith({
        pluginId: "com.example.test",
        enabled: false,
      });
    });
  });

  it("toggle button calls pluginClient.toggle to enable", async () => {
    const client = createMockPluginClient([samplePlugin({ enabled: false })]);
    render(
      <PluginManagerDialog
        open={true}
        pluginClient={client}
        onClose={() => {}}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Test Plugin")).toBeTruthy();
    });
    const enableBtn = screen.getByRole("button", { name: /enable/i });
    fireEvent.click(enableBtn);
    await waitFor(() => {
      expect(client.toggle).toHaveBeenCalledWith({
        pluginId: "com.example.test",
        enabled: true,
      });
    });
  });

  it("shows multiple plugins", async () => {
    const plugins = [
      samplePlugin(),
      samplePlugin({
        manifest: {
          id: "com.other.plugin",
          name: "Other Plugin",
          version: "2.0.0",
          description: "Another plugin",
          author: "Other",
          entryPoint: "index.js",
          permissions: [],
          minAppVersion: null,
        },
        installPath: "/tmp/plugins/com.other.plugin",
        enabled: false,
      }),
    ];
    const client = createMockPluginClient(plugins);
    render(
      <PluginManagerDialog
        open={true}
        pluginClient={client}
        onClose={() => {}}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Test Plugin")).toBeTruthy();
      expect(screen.getByText("Other Plugin")).toBeTruthy();
    });
  });

  it("close button calls onClose", async () => {
    const onClose = vi.fn();
    const client = createMockPluginClient();
    render(
      <PluginManagerDialog
        open={true}
        pluginClient={client}
        onClose={onClose}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeTruthy();
    });
    const closeBtn = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
