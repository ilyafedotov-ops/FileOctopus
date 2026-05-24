import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StorageGauge } from "../src/components/StorageGauge";
import type { FileOctopusClient, VolumeDto } from "@fileoctopus/ts-api";

function createMockClient(volumes: VolumeDto[]): FileOctopusClient {
  return {
    fs: {
      discoverVolumes: vi.fn<() => Promise<{ volumes: VolumeDto[] }>>(() =>
        Promise.resolve({ volumes }),
      ),
    },
  } as unknown as FileOctopusClient;
}

afterEach(() => {
  cleanup();
});

describe("StorageGauge", () => {
  it("renders nothing when no volumes match", async () => {
    const client = createMockClient([]);
    const { container } = render(
      <StorageGauge uri="local:///home/user" client={client} />,
    );
    await waitFor(() => {
      expect(container.querySelector(".fo-storage-gauge")).toBeNull();
    });
  });

  it("renders gauge for matching volume", async () => {
    const client = createMockClient([
      {
        name: "Home",
        mountUri: "local:///home",
        totalBytes: 100_000_000_000,
        availableBytes: 60_000_000_000,
        fileSystemType: "ext4",
        isRemovable: false,
        isNetwork: false,
      },
    ]);
    render(<StorageGauge uri="local:///home/user" client={client} />);
    await waitFor(() => {
      expect(screen.getByText("Home")).toBeTruthy();
    });
    const fill = document.querySelector(
      ".fo-storage-gauge-fill",
    ) as HTMLElement;
    expect(fill.style.width).toBe("40%");
  });

  it("picks the longest matching mount prefix", async () => {
    const client = createMockClient([
      {
        name: "Root",
        mountUri: "local:///",
        totalBytes: 500_000_000_000,
        availableBytes: 250_000_000_000,
        fileSystemType: "ext4",
        isRemovable: false,
        isNetwork: false,
      },
      {
        name: "Data",
        mountUri: "local:///mnt/data",
        totalBytes: 200_000_000_000,
        availableBytes: 50_000_000_000,
        fileSystemType: "ext4",
        isRemovable: false,
        isNetwork: false,
      },
    ]);
    render(<StorageGauge uri="local:///mnt/data/projects" client={client} />);
    await waitFor(() => {
      expect(screen.getByText("Data")).toBeTruthy();
    });
    const fill = document.querySelector(
      ".fo-storage-gauge-fill",
    ) as HTMLElement;
    expect(fill.style.width).toBe("75%");
  });

  it("renders nothing when totalBytes is null", async () => {
    const client = createMockClient([
      {
        name: "Home",
        mountUri: "local:///home",
        totalBytes: null,
        availableBytes: 60_000_000_000,
        fileSystemType: "ext4",
        isRemovable: false,
        isNetwork: false,
      },
    ]);
    const { container } = render(
      <StorageGauge uri="local:///home/user" client={client} />,
    );
    await waitFor(() => {
      expect(container.querySelector(".fo-storage-gauge")).toBeNull();
    });
  });

  it("re-fetches when uri changes", async () => {
    const volumes: VolumeDto[] = [
      {
        name: "Home",
        mountUri: "local:///home",
        totalBytes: 100_000_000_000,
        availableBytes: 60_000_000_000,
        fileSystemType: "ext4",
        isRemovable: false,
        isNetwork: false,
      },
    ];
    const client = createMockClient(volumes);
    const { rerender } = render(
      <StorageGauge uri="local:///home/user" client={client} />,
    );
    await waitFor(() => {
      expect(screen.getByText("Home")).toBeTruthy();
    });
    expect(client.fs.discoverVolumes).toHaveBeenCalledTimes(1);

    rerender(<StorageGauge uri="local:///tmp" client={client} />);
    expect(client.fs.discoverVolumes).toHaveBeenCalledTimes(2);
  });
});
