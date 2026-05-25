import { IPC_ERROR_CODES } from "../types";
import type {
  ComputeHashRequest,
  ComputeHashResponse,
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
  ListStartRequest,
  ListStartResponse,
  OkResponse,
  OpenTerminalRequest,
  OpenTerminalResponse,
  PathPropertiesRequest,
  PathPropertiesResponse,
  PathRequest,
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
} from "../types";
import {
  DIRECTORY_BATCH_EVENT,
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
}
