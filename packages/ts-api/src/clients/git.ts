import type {
  GitDiffFileRequest,
  GitDiffFileResponse,
  GitDiscoverRequest,
  GitDiscoverResponse,
  GitStatusForDirectoryRequest,
  GitStatusForDirectoryResponse,
  GitStatusForRepositoryRequest,
  GitStatusForRepositoryResponse,
  IpcTransport,
} from "../types";

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

  async diffFile(request: GitDiffFileRequest): Promise<GitDiffFileResponse> {
    return this.transport.invoke<GitDiffFileResponse>("git.diffFile", {
      request,
    });
  }
}
