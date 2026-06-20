import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { AclEditor } from "../src/components/dialogs/AclEditor";
import type {
  FsClient,
  GetAclResponse,
  SetAclResponse,
} from "@fileoctopus/ts-api";

afterEach(cleanup);

function setAclResponse(): SetAclResponse {
  const now = new Date().toISOString();

  return {
    success: true,
    job: {
      jobId: "set-permissions-job",
      operationKind: "setPermissions",
      status: "completed",
      currentItem: "local:///tmp/test.txt",
      completedItems: 1,
      totalItems: 1,
      completedBytes: 0,
      totalBytes: null,
      errorCode: null,
      message: null,
      startedAt: now,
      updatedAt: now,
    },
  };
}

function createMockFs(aclResponse?: Partial<GetAclResponse>) {
  const mock: Partial<FsClient> = {
    getAcl: vi.fn<() => Promise<GetAclResponse>>().mockResolvedValue({
      owner: "user",
      group: "user",
      entries: [
        { principal: "owner", read: true, write: true, execute: false },
        { principal: "group", read: true, write: false, execute: false },
        { principal: "other", read: true, write: false, execute: false },
      ],
      octal: "644",
      ...aclResponse,
    }),
    setAcl: vi
      .fn<() => Promise<SetAclResponse>>()
      .mockResolvedValue(setAclResponse()),
  };
  return mock as FsClient;
}

describe("AclEditor", () => {
  it("renders loading state initially", () => {
    const fs = createMockFs();
    render(
      <AclEditor uri="local:///tmp/test.txt" fs={fs} isDirectory={false} />,
    );
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("renders permission matrix after loading", async () => {
    const fs = createMockFs();
    render(
      <AclEditor uri="local:///tmp/test.txt" fs={fs} isDirectory={false} />,
    );

    const ownerRead = await screen.findByLabelText("owner read");
    expect(ownerRead).toBeTruthy();
    expect((ownerRead as HTMLInputElement).checked).toBe(true);

    const ownerWrite = await screen.findByLabelText("owner write");
    expect((ownerWrite as HTMLInputElement).checked).toBe(true);

    const ownerExecute = await screen.findByLabelText("owner execute");
    expect((ownerExecute as HTMLInputElement).checked).toBe(false);
  });

  it("renders owner and group info", async () => {
    const fs = createMockFs();
    render(
      <AclEditor uri="local:///tmp/test.txt" fs={fs} isDirectory={false} />,
    );

    await screen.findByLabelText("owner read");
    expect(screen.getByText("Owner: user")).toBeTruthy();
    expect(screen.getByText("Group: user")).toBeTruthy();
  });

  it("renders octal input", async () => {
    const fs = createMockFs();
    render(
      <AclEditor uri="local:///tmp/test.txt" fs={fs} isDirectory={false} />,
    );

    const input = await screen.findByLabelText("Permission octal notation");
    expect((input as HTMLInputElement).value).toBe("644");
  });

  it("does not show recursive checkbox for files", async () => {
    const fs = createMockFs();
    render(
      <AclEditor uri="local:///tmp/test.txt" fs={fs} isDirectory={false} />,
    );

    await screen.findByLabelText("owner read");
    expect(screen.queryByText("Apply recursively")).toBeNull();
  });

  it("shows recursive checkbox for directories", async () => {
    const fs = createMockFs();
    render(<AclEditor uri="local:///tmp/mydir" fs={fs} isDirectory={true} />);

    const label = await screen.findByText("Apply recursively");
    expect(label).toBeTruthy();
  });

  it("toggling a checkbox marks editor as dirty", async () => {
    const fs = createMockFs();
    render(
      <AclEditor uri="local:///tmp/test.txt" fs={fs} isDirectory={false} />,
    );

    const ownerExecute = await screen.findByLabelText("owner execute");
    expect((ownerExecute as HTMLInputElement).checked).toBe(false);

    fireEvent.click(ownerExecute);

    expect((ownerExecute as HTMLInputElement).checked).toBe(true);

    const applyBtn = screen.getByText("Apply");
    expect((applyBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("updating octal input updates checkboxes", async () => {
    const fs = createMockFs();
    render(
      <AclEditor uri="local:///tmp/test.txt" fs={fs} isDirectory={false} />,
    );

    const input = await screen.findByLabelText("Permission octal notation");
    fireEvent.change(input, { target: { value: "755" } });

    const ownerExecute = await screen.findByLabelText("owner execute");
    expect((ownerExecute as HTMLInputElement).checked).toBe(true);
  });

  it("calls setAcl on Apply click", async () => {
    const fs = createMockFs();
    render(
      <AclEditor uri="local:///tmp/test.txt" fs={fs} isDirectory={false} />,
    );

    const ownerExecute = await screen.findByLabelText("owner execute");
    fireEvent.click(ownerExecute);

    const applyBtn = screen.getByText("Apply");
    fireEvent.click(applyBtn);

    expect(fs.setAcl).toHaveBeenCalledWith({
      uri: "local:///tmp/test.txt",
      octal: "744",
      recursive: false,
    });
  });

  it("shows error when getAcl fails", async () => {
    const mockFs = {
      getAcl: vi
        .fn<() => Promise<GetAclResponse>>()
        .mockRejectedValue(new Error("Permission denied")),
      setAcl: vi
        .fn<() => Promise<SetAclResponse>>()
        .mockResolvedValue(setAclResponse()),
    } as unknown as FsClient;

    render(
      <AclEditor uri="local:///tmp/test.txt" fs={mockFs} isDirectory={false} />,
    );

    const error = await screen.findByText("Permission denied");
    expect(error).toBeTruthy();
  });

  it("shows ipc error messages when getAcl fails", async () => {
    const mockFs = {
      getAcl: vi.fn<() => Promise<GetAclResponse>>().mockRejectedValue({
        code: "permission_denied",
        message: "cannot stat: Permission denied",
      }),
      setAcl: vi
        .fn<() => Promise<SetAclResponse>>()
        .mockResolvedValue(setAclResponse()),
    } as unknown as FsClient;

    render(
      <AclEditor uri="local:///tmp/test.txt" fs={mockFs} isDirectory={false} />,
    );

    const error = await screen.findByText("cannot stat: Permission denied");
    expect(error).toBeTruthy();
  });

  it("does not call getAcl for non-local resources", async () => {
    const fs = createMockFs();
    render(
      <AclEditor
        uri="sftp://profile-id/tmp/test.txt"
        fs={fs}
        isDirectory={false}
      />,
    );

    const error = await screen.findByText(
      "Permissions management is only available for local files.",
    );
    expect(error).toBeTruthy();
    expect(fs.getAcl).not.toHaveBeenCalled();
  });
});
