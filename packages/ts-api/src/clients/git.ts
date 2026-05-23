import type {
  GitDiscoverRequest,
  GitDiscoverResponse,
  GitStatusForDirectoryRequest,
  GitStatusForDirectoryResponse,
  IpcTransport,
} from "../types";
import { normalizeIpcError } from "../normalizeError";

export class GitClient {
  constructor(private readonly transport: IpcTransport) {}

  async discover(request: GitDiscoverRequest): Promise<GitDiscoverResponse> {
    try {
      return await this.transport.invoke<GitDiscoverResponse>("git.discover", {
        request,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async statusForDirectory(
    request: GitStatusForDirectoryRequest,
  ): Promise<GitStatusForDirectoryResponse> {
    try {
      return await this.transport.invoke<GitStatusForDirectoryResponse>(
        "git.statusForDirectory",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }
}
