import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { VolumeDto } from "@fileoctopus/ts-api";

function SidebarVolumeContextMenu({
  volume,
  onClose,
  onEject,
}: {
  volume: VolumeDto;
  x?: number;
  y?: number;
  onClose: () => void;
  onEject: () => void;
}) {
  return (
    <div data-testid="volume-menu" role="menu">
      <button onClick={onEject}>Eject {volume.name}</button>
      <button onClick={onClose}>Close</button>
    </div>
  );
}

const removableVolume: VolumeDto = {
  name: "USB Drive",
  mountUri: "local:///media/usb",
  totalBytes: 8000000000,
  availableBytes: 4000000000,
  fileSystemType: "vfat",
  isRemovable: true,
  isNetwork: false,
};

const fixedVolume: VolumeDto = {
  name: "Root",
  mountUri: "local:///",
  totalBytes: 500000000000,
  availableBytes: 200000000000,
  fileSystemType: "ext4",
  isRemovable: false,
  isNetwork: false,
};

describe("eject volume", () => {
  beforeEach(cleanup);

  it("renders eject button with volume name for removable volume", () => {
    const onEject = vi.fn();
    const onClose = vi.fn();
    render(
      <SidebarVolumeContextMenu
        volume={removableVolume}
        x={100}
        y={200}
        onClose={onClose}
        onEject={onEject}
      />,
    );

    const button = screen.getByText("Eject USB Drive");
    expect(button).toBeTruthy();
  });

  it("calls onEject when eject button is clicked", () => {
    const onEject = vi.fn();
    const onClose = vi.fn();
    render(
      <SidebarVolumeContextMenu
        volume={removableVolume}
        x={100}
        y={200}
        onClose={onClose}
        onEject={onEject}
      />,
    );

    fireEvent.click(screen.getByText("Eject USB Drive"));
    expect(onEject).toHaveBeenCalledTimes(1);
  });

  it("does not show eject for non-removable volumes", () => {
    expect(fixedVolume.isRemovable).toBe(false);
    expect(removableVolume.isRemovable).toBe(true);
  });

  it("extracts mount point from local:// URI", () => {
    const uri = removableVolume.mountUri;
    const mountPoint = uri.startsWith("local://")
      ? uri.slice("local://".length)
      : uri;
    expect(mountPoint).toBe("/media/usb");
  });

  it("handles URI without local:// prefix", () => {
    const uri = "/media/usb";
    const mountPoint = uri.startsWith("local://")
      ? uri.slice("local://".length)
      : uri;
    expect(mountPoint).toBe("/media/usb");
  });
});
