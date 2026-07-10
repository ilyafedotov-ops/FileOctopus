import type { IpcTransport } from "../types";
import type {
  GitBranchesRequest,
  GitBranchesResponse,
  GitDiffFileRequest,
  GitDiffFileResponse,
  GitDiscoverRequest,
  GitDiscoverResponse,
  GitHistoryRequest,
  GitHistoryResponse,
  GitRevisionDiffRequest,
  GitRevisionDiffResponse,
  GitRevisionFilesRequest,
  GitRevisionFilesResponse,
  GitStatusForDirectoryRequest,
  GitStatusForDirectoryResponse,
  GitStatusForRepositoryRequest,
  GitStatusForRepositoryResponse,
  GitWorktreesRequest,
  GitWorktreesResponse,
} from "../generated/ipc";
import type { IpcInput } from "../input";

export class GitClient {
  constructor(private readonly transport: IpcTransport) {}

  async discover(request: GitDiscoverRequest): Promise<GitDiscoverResponse> {
    return this.transport.invoke<GitDiscoverResponse>("git.discover", {
      request,
    });
  }

  async statusForDirectory(
    request: GitStatusForDirectoryRequest,
  ): Promise<GitStatusForDirectoryResponse> {
    return this.transport.invoke<GitStatusForDirectoryResponse>(
      "git.statusForDirectory",
      { request },
    );
  }

  async statusForRepository(
    request: GitStatusForRepositoryRequest,
  ): Promise<GitStatusForRepositoryResponse> {
    return this.transport.invoke<GitStatusForRepositoryResponse>(
      "git.statusForRepository",
      { request },
    );
  }

  async diffFile(
    request: IpcInput<GitDiffFileRequest>,
  ): Promise<GitDiffFileResponse> {
    return this.transport.invoke<GitDiffFileResponse>("git.diffFile", {
      request,
    });
  }

  async history(
    request: IpcInput<GitHistoryRequest>,
  ): Promise<GitHistoryResponse> {
    return this.transport.invoke<GitHistoryResponse>("git.history", {
      request,
    });
  }

  async branches(request: GitBranchesRequest): Promise<GitBranchesResponse> {
    return this.transport.invoke<GitBranchesResponse>("git.branches", {
      request,
    });
  }

  async worktrees(request: GitWorktreesRequest): Promise<GitWorktreesResponse> {
    return this.transport.invoke<GitWorktreesResponse>("git.worktrees", {
      request,
    });
  }

  async revisionDiff(
    request: IpcInput<GitRevisionDiffRequest>,
  ): Promise<GitRevisionDiffResponse> {
    return this.transport.invoke<GitRevisionDiffResponse>("git.revisionDiff", {
      request,
    });
  }

  async revisionFiles(
    request: IpcInput<GitRevisionFilesRequest>,
  ): Promise<GitRevisionFilesResponse> {
    return this.transport.invoke<GitRevisionFilesResponse>(
      "git.revisionFiles",
      { request },
    );
  }
}
