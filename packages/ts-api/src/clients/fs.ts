import { IPC_ERROR_CODES } from "../types";
import type {
  ComputeHashRequest,
  ComputeHashResponse,
  CompareFilesRequest,
  CompareFilesResponse,
  ContentSearchCompletedEventDto,
  ContentSearchJobResponse,
  ContentSearchMatchEventDto,
  ContentSearchRequest,
  ContentSearchResponse,
  DirectoryBatchEventDto,
  DiscoverVolumesResponse,
  EjectVolumeRequest,
  EjectVolumeResponse,
  FolderSizeCompletedEventDto,
  FolderSizeJobResponse,
  FolderSizeRequest,
  FolderSizeResponse,
  IpcError,
  IpcTransport,
  ListDirectoriesRequest,
  ListDirectoriesResponse,
  ListArchiveRequest,
  ListArchiveResponse,
  ListStartRequest,
  ListStartResponse,
  OkResponse,
  OpenTerminalRequest,
  OpenTerminalResponse,
  PathPropertiesRequest,
  PathPropertiesResponse,
  PathRequest,
  ReadFileAsDataUriRequest,
  ReadFileAsDataUriResponse,
  ReadImageAsDataUriRequest,
  ReadImageAsDataUriResponse,
  ReadFileRangeRequest,
  ReadFileRangeResponse,
  ReadTextFileRequest,
  ReadTextFileResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
  RecursiveSearchCompletedEventDto,
  RecursiveSearchJobResponse,
  RecursiveSearchMatchEventDto,
  RecursiveSearchRequest,
  RecursiveSearchResponse,
  StandardLocationsResponse,
  StatRequest,
  StatResponse,
  UnlistenFn,
  WatchEventDto,
  WatchStartRequest,
  GetAclRequest,
  GetAclResponse,
  SetAclRequest,
  SetAclResponse,
} from "../types";
import {
  DIRECTORY_BATCH_EVENT,
  CONTENT_SEARCH_COMPLETED_EVENT,
  CONTENT_SEARCH_MATCH_EVENT,
  FOLDER_SIZE_COMPLETED_EVENT,
  RECURSIVE_SEARCH_COMPLETED_EVENT,
  RECURSIVE_SEARCH_MATCH_EVENT,
  WATCH_CHANGED_EVENT,
} from "../events";
import { normalizeIpcError } from "../normalizeError";
import { requireListen } from "../requireListen";

export class FsClient {
  constructor(private readonly transport: IpcTransport) {}

  async stat(request: StatRequest): Promise<StatResponse> {
    try {
      return await this.transport.invoke<StatResponse>("fs.stat", { request });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async readTextFile(
    request: ReadTextFileRequest,
  ): Promise<ReadTextFileResponse> {
    try {
      return await this.transport.invoke<ReadTextFileResponse>(
        "fs.read_text_file",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async readFileRange(
    request: ReadFileRangeRequest,
  ): Promise<ReadFileRangeResponse> {
    try {
      return await this.transport.invoke<ReadFileRangeResponse>(
        "fs.read_file_range",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async writeTextFile(
    request: WriteTextFileRequest,
  ): Promise<WriteTextFileResponse> {
    try {
      return await this.transport.invoke<WriteTextFileResponse>(
        "fs.write_text_file",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async readImageAsDataUri(
    request: ReadImageAsDataUriRequest,
  ): Promise<ReadImageAsDataUriResponse> {
    try {
      return await this.transport.invoke<ReadImageAsDataUriResponse>(
        "fs.read_image_as_data_uri",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async readFileAsDataUri(
    request: ReadFileAsDataUriRequest,
  ): Promise<ReadFileAsDataUriResponse> {
    try {
      return await this.transport.invoke<ReadFileAsDataUriResponse>(
        "fs.read_file_as_data_uri",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async computeHash(request: ComputeHashRequest): Promise<ComputeHashResponse> {
    try {
      return await this.transport.invoke<ComputeHashResponse>(
        "fs.compute_hash",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async openTerminal(
    request: OpenTerminalRequest,
  ): Promise<OpenTerminalResponse> {
    try {
      return await this.transport.invoke<OpenTerminalResponse>(
        "fs.open_terminal",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async listStart(request: ListStartRequest): Promise<ListStartResponse> {
    try {
      return await this.transport.invoke<ListStartResponse>("fs.list_start", {
        request,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async listDirectories(
    request: ListDirectoriesRequest,
  ): Promise<ListDirectoriesResponse> {
    try {
      return await this.transport.invoke<ListDirectoriesResponse>(
        "fs.list_directories",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async listArchive(request: ListArchiveRequest): Promise<ListArchiveResponse> {
    try {
      return await this.transport.invoke<ListArchiveResponse>(
        "fs.list_archive",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async standardLocations(): Promise<StandardLocationsResponse> {
    try {
      return await this.transport.invoke<StandardLocationsResponse>(
        "fs.standard_locations",
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async discoverVolumes(): Promise<DiscoverVolumesResponse> {
    try {
      return await this.transport.invoke<DiscoverVolumesResponse>(
        "fs.discover_volumes",
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async ejectVolume(request: EjectVolumeRequest): Promise<EjectVolumeResponse> {
    try {
      return await this.transport.invoke<EjectVolumeResponse>(
        "fs.eject_volume",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async diffText(
    request: import("../types").DiffTextRequest,
  ): Promise<import("../types").DiffTextResponse> {
    try {
      return await this.transport.invoke<import("../types").DiffTextResponse>(
        "fs.diff_text",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async openPathWithDefaultApp(request: PathRequest): Promise<OkResponse> {
    try {
      return await this.transport.invoke<OkResponse>("fs.open_default", {
        request,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async revealPathInFileManager(request: PathRequest): Promise<OkResponse> {
    try {
      return await this.transport.invoke<OkResponse>("fs.reveal", {
        request,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async properties(
    request: PathPropertiesRequest,
  ): Promise<PathPropertiesResponse> {
    try {
      return await this.transport.invoke<PathPropertiesResponse>(
        "fs.properties",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async folderSize(request: FolderSizeRequest): Promise<FolderSizeResponse> {
    try {
      return await this.transport.invoke<FolderSizeResponse>("fs.folder_size", {
        request,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async startFolderSizeJob(
    request: FolderSizeRequest,
  ): Promise<FolderSizeJobResponse> {
    try {
      return await this.transport.invoke<FolderSizeJobResponse>(
        "fs.folder_size_start",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async recursiveSearch(
    request: RecursiveSearchRequest,
  ): Promise<RecursiveSearchResponse> {
    try {
      return await this.transport.invoke<RecursiveSearchResponse>(
        "fs.recursive_search",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async startRecursiveSearchJob(
    request: RecursiveSearchRequest,
  ): Promise<RecursiveSearchJobResponse> {
    try {
      return await this.transport.invoke<RecursiveSearchJobResponse>(
        "fs.recursive_search_start",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async contentSearch(
    request: ContentSearchRequest,
  ): Promise<ContentSearchResponse> {
    try {
      return await this.transport.invoke<ContentSearchResponse>(
        "fs.content_search",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async startContentSearchJob(
    request: ContentSearchRequest,
  ): Promise<ContentSearchJobResponse> {
    try {
      return await this.transport.invoke<ContentSearchJobResponse>(
        "fs.content_search_start",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  onFolderSizeCompleted(
    handler: (event: FolderSizeCompletedEventDto) => void,
  ): Promise<UnlistenFn> {
    return requireListen(this.transport, FOLDER_SIZE_COMPLETED_EVENT, handler);
  }

  onRecursiveSearchMatch(
    handler: (event: RecursiveSearchMatchEventDto) => void,
  ): Promise<UnlistenFn> {
    return requireListen(this.transport, RECURSIVE_SEARCH_MATCH_EVENT, handler);
  }

  onRecursiveSearchCompleted(
    handler: (event: RecursiveSearchCompletedEventDto) => void,
  ): Promise<UnlistenFn> {
    return requireListen(
      this.transport,
      RECURSIVE_SEARCH_COMPLETED_EVENT,
      handler,
    );
  }

  onContentSearchMatch(
    handler: (event: ContentSearchMatchEventDto) => void,
  ): Promise<UnlistenFn> {
    return requireListen(this.transport, CONTENT_SEARCH_MATCH_EVENT, handler);
  }

  onContentSearchCompleted(
    handler: (event: ContentSearchCompletedEventDto) => void,
  ): Promise<UnlistenFn> {
    return requireListen(
      this.transport,
      CONTENT_SEARCH_COMPLETED_EVENT,
      handler,
    );
  }

  async startWatching(request: WatchStartRequest): Promise<OkResponse> {
    try {
      return await this.transport.invoke<OkResponse>("fs.watch_start", {
        request,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async stopWatching(): Promise<OkResponse> {
    try {
      return await this.transport.invoke<OkResponse>("fs.watch_stop");
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  onWatchChanged(handler: (event: WatchEventDto) => void): Promise<UnlistenFn> {
    if (!this.transport.listen) {
      return Promise.reject({
        code: IPC_ERROR_CODES.UNSUPPORTED_TRANSPORT,
        message: "Transport does not support event subscriptions",
      } satisfies IpcError);
    }

    return this.transport.listen<WatchEventDto>(WATCH_CHANGED_EVENT, handler);
  }

  onDirectoryBatch(
    handler: (event: DirectoryBatchEventDto) => void,
  ): Promise<UnlistenFn> {
    if (!this.transport.listen) {
      return Promise.reject({
        code: IPC_ERROR_CODES.UNSUPPORTED_TRANSPORT,
        message: "Transport does not support event subscriptions",
      } satisfies IpcError);
    }

    return this.transport.listen<DirectoryBatchEventDto>(
      DIRECTORY_BATCH_EVENT,
      handler,
    );
  }

  async getAcl(request: GetAclRequest): Promise<GetAclResponse> {
    return await this.transport.invoke<GetAclResponse>("fs.get_acl", {
      request,
    });
  }

  async setAcl(request: SetAclRequest): Promise<SetAclResponse> {
    return await this.transport.invoke<SetAclResponse>("fs.set_acl", {
      request,
    });
  }

  async compareFiles(
    request: CompareFilesRequest,
  ): Promise<CompareFilesResponse> {
    return await this.transport.invoke<CompareFilesResponse>(
      "fs.compare_files",
      { request },
    );
  }
}
