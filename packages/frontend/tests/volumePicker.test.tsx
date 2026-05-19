import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { VolumePickerDialog } from "../src/components/dialogs/VolumePickerDialog";
import type {
  FsClient,
  NetworkProfileDto,
  VolumeDto,
} from "@fileoctopus/ts-api";

afterEach(cleanup);

function makeVolume(overrides: Partial<VolumeDto> = {}): VolumeDto {
  return {
    name: "root",
    mountUri: "local:///",
    totalBytes: null,
    availableBytes: null,
    fileSystemType: "ext4",
    isRemovable: false,
    isNetwork: false,
    ...overrides,
  };
}

function makeVolumes(): VolumeDto[] {
  return [
    makeVolume({ name: "root", mountUri: "local:///", fileSystemType: "ext4" }),
    makeVolume({
      name: "USB Drive",
      mountUri: "local:///media/user/usb",
      fileSystemType: "vfat",
      isRemovable: true,
    }),
    makeVolume({
      name: "nas",
      mountUri: "local:///mnt/nas",
      fileSystemType: "nfs4",
      isNetwork: true,
    }),
  ];
}

function createMockFs(volumes?: VolumeDto[], error?: Error): FsClient {
  return {
    discoverVolumes: vi
      .fn<() => Promise<{ volumes: VolumeDto[] }>>()
      .mockImplementation(() => {
        if (error) return Promise.reject(error);
        return Promise.resolve({ volumes: volumes ?? makeVolumes() });
      }),
  } as unknown as FsClient;
}

describe("VolumePickerDialog", () => {
  it("renders nothing when open is false", () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    const { container } = render(
      <VolumePickerDialog
        open={false}
        fs={createMockFs()}
        onClose={onClose}
        onSelect={onSelect}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders dialog with title when open", async () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(
      <VolumePickerDialog
        open={true}
        fs={createMockFs()}
        onClose={onClose}
        onSelect={onSelect}
      />,
    );
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(screen.getByText("Volumes")).toBeTruthy();
  });

  it("shows loading state then volumes", async () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(
      <VolumePickerDialog
        open={true}
        fs={createMockFs()}
        onClose={onClose}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByText("Loading…")).toBeTruthy();
    await screen.findByText("root");
    expect(screen.getByText("USB Drive")).toBeTruthy();
    expect(screen.getByText("nas")).toBeTruthy();
  });

  it("shows error message", async () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(
      <VolumePickerDialog
        open={true}
        fs={createMockFs(undefined, new Error("Failed to discover volumes"))}
        onClose={onClose}
        onSelect={onSelect}
      />,
    );
    await screen.findByText("Failed to discover volumes");
  });

  it("shows empty state when no volumes", async () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(
      <VolumePickerDialog
        open={true}
        fs={createMockFs([])}
        onClose={onClose}
        onSelect={onSelect}
      />,
    );
    await screen.findByText("No volumes found");
  });

  it("shows filesystem type for each volume", async () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(
      <VolumePickerDialog
        open={true}
        fs={createMockFs()}
        onClose={onClose}
        onSelect={onSelect}
      />,
    );
    await screen.findByText("ext4");
    expect(screen.getByText("vfat")).toBeTruthy();
    expect(screen.getByText("nfs4")).toBeTruthy();
  });

  it("calls onSelect with volume mountUri when a volume is clicked", async () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(
      <VolumePickerDialog
        open={true}
        fs={createMockFs()}
        onClose={onClose}
        onSelect={onSelect}
      />,
    );
    await screen.findByText("USB Drive");
    fireEvent.click(screen.getByText("USB Drive"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("local:///media/user/usb");
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(
      <VolumePickerDialog
        open={true}
        fs={createMockFs()}
        onClose={onClose}
        onSelect={onSelect}
      />,
    );
    await screen.findByRole("dialog");
    const closeBtn = screen.getByLabelText("Close");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows removable badge for removable volumes", async () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(
      <VolumePickerDialog
        open={true}
        fs={createMockFs()}
        onClose={onClose}
        onSelect={onSelect}
      />,
    );
    await screen.findByTitle("Removable");
  });

  it("lists network profiles when discoverVolumes returns empty", async () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    const profile: NetworkProfileDto = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      label: "Prod",
      scheme: "sftp",
      host: "prod.example.com",
      port: 22,
      username: "deploy",
      authKind: "password",
      privateKeyPath: null,
      defaultPath: "/",
      defaultUri: "sftp://550e8400-e29b-41d4-a716-446655440000/",
      hostKeyFingerprint: null,
      sortOrder: 0,
      lastConnectedAt: null,
      lastError: null,
      hasStoredSecret: true,
      createdAt: "2026-05-19T00:00:00Z",
      updatedAt: "2026-05-19T00:00:00Z",
    };

    render(
      <VolumePickerDialog
        open={true}
        fs={createMockFs([])}
        networkProfiles={[profile]}
        onClose={onClose}
        onSelect={onSelect}
      />,
    );

    await screen.findByText("Prod");
    expect(screen.getByText("sftp")).toBeTruthy();
    expect(screen.queryByText("No volumes found")).toBeNull();
  });

  it("shows network badge for network volumes", async () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(
      <VolumePickerDialog
        open={true}
        fs={createMockFs()}
        onClose={onClose}
        onSelect={onSelect}
      />,
    );
    await screen.findByTitle("Network");
  });
});
