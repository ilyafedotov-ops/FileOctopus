import { IPC_ERROR_CODES } from "../types";
import type { IpcError, IpcTransport, UnlistenFn } from "../types";
import type {
  CompareFilesRequest,
  CompareFilesResponse,
  ComputeHashRequest,
  ComputeHashResponse,
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
  GetAclRequest,
  GetAclResponse,
  ListArchiveRequest,
  ListArchiveResponse,
  ListDirectoriesRequest,
  ListDirectoriesResponse,
  ListStartRequest,
  ListStartResponse,
  OpenTerminalRequest,
  OpenTerminalResponse,
  OkResponse,
  PathPropertiesRequest,
  PathPropertiesResponse,
  PathRequest,
  ReadFileAsDataUriRequest,
  ReadFileAsDataUriResponse,
  ReadFileRangeRequest,
  ReadFileRangeResponse,
  ReadImageAsDataUriRequest,
  ReadImageAsDataUriResponse,
  ReadTextFileRequest,
  ReadTextFileResponse,
  RecursiveSearchCompletedEventDto,
  RecursiveSearchJobResponse,
  RecursiveSearchMatchEventDto,
  RecursiveSearchRequest,
  RecursiveSearchResponse,
  SetAclRequest,
  SetAclResponse,
  StandardLocationsResponse,
  StatRequest,
  StatResponse,
  SyncDirectoriesRequest,
  SyncDirectoriesResponse,
  WatchEventDto,
  WatchStartRequest,
  WriteTextFileRequest,
  WriteTextFileResponse,
  DiffTextRequest,
  DiffTextResponse,
} from "../generated/ipc";
import type { IpcInput } from "../input";
import {
  DIRECTORY_BATCH_EVENT,
  CONTENT_SEARCH_COMPLETED_EVENT,
  CONTENT_SEARCH_MATCH_EVENT,
  FOLDER_SIZE_COMPLETED_EVENT,
  RECURSIVE_SEARCH_COMPLETED_EVENT,
  RECURSIVE_SEARCH_MATCH_EVENT,
  WATCH_CHANGED_EVENT,
} from "../events";
import { requireListen } from "../requireListen";

export class FsClient {
  constructor(private readonly transport: IpcTransport) {}

  async stat(request: StatRequest): Promise<StatResponse> {
    return this.transport.invoke<StatResponse>("fs.stat", { request });
  }

  async readTextFile(
    request: IpcInput<ReadTextFileRequest>,
  ): Promise<ReadTextFileResponse> {
    return this.transport.invoke<ReadTextFileResponse>("fs.read_text_file", {
      request,
    });
  }

  async readFileRange(
    request: ReadFileRangeRequest,
  ): Promise<ReadFileRangeResponse> {
    return this.transport.invoke<ReadFileRangeResponse>("fs.read_file_range", {
      request,
    });
  }

  async writeTextFile(
    request: IpcInput<WriteTextFileRequest>,
  ): Promise<WriteTextFileResponse> {
    return this.transport.invoke<WriteTextFileResponse>("fs.write_text_file", {
      request,
    });
  }

  async readImageAsDataUri(
    request: ReadImageAsDataUriRequest,
  ): Promise<ReadImageAsDataUriResponse> {
    return this.transport.invoke<ReadImageAsDataUriResponse>(
      "fs.read_image_as_data_uri",
      { request },
    );
  }

  async readFileAsDataUri(
    request: IpcInput<ReadFileAsDataUriRequest>,
  ): Promise<ReadFileAsDataUriResponse> {
    return this.transport.invoke<ReadFileAsDataUriResponse>(
      "fs.read_file_as_data_uri",
      { request },
    );
  }

  async computeHash(request: ComputeHashRequest): Promise<ComputeHashResponse> {
    return this.transport.invoke<ComputeHashResponse>("fs.compute_hash", {
      request,
    });
  }

  async openTerminal(
    request: OpenTerminalRequest,
  ): Promise<OpenTerminalResponse> {
    return this.transport.invoke<OpenTerminalResponse>("fs.open_terminal", {
      request,
    });
  }

  async listStart(
    request: IpcInput<ListStartRequest>,
  ): Promise<ListStartResponse> {
    return this.transport.invoke<ListStartResponse>("fs.list_start", {
      request,
    });
  }

  async listDirectories(
    request: ListDirectoriesRequest,
  ): Promise<ListDirectoriesResponse> {
    return this.transport.invoke<ListDirectoriesResponse>(
      "fs.list_directories",
      { request },
    );
  }

  async listArchive(request: ListArchiveRequest): Promise<ListArchiveResponse> {
    return this.transport.invoke<ListArchiveResponse>("fs.list_archive", {
      request,
    });
  }

  async standardLocations(): Promise<StandardLocationsResponse> {
    return this.transport.invoke<StandardLocationsResponse>(
      "fs.standard_locations",
    );
  }

  async discoverVolumes(): Promise<DiscoverVolumesResponse> {
    return this.transport.invoke<DiscoverVolumesResponse>(
      "fs.discover_volumes",
    );
  }

  async ejectVolume(request: EjectVolumeRequest): Promise<EjectVolumeResponse> {
    return this.transport.invoke<EjectVolumeResponse>("fs.eject_volume", {
      request,
    });
  }

  async diffText(
    request: IpcInput<DiffTextRequest>,
  ): Promise<DiffTextResponse> {
    return this.transport.invoke<DiffTextResponse>("fs.diff_text", {
      request,
    });
  }

  async openPathWithDefaultApp(request: PathRequest): Promise<OkResponse> {
    return this.transport.invoke<OkResponse>("fs.open_default", {
      request,
    });
  }

  async revealPathInFileManager(request: PathRequest): Promise<OkResponse> {
    return this.transport.invoke<OkResponse>("fs.reveal", {
      request,
    });
  }

  async properties(
    request: IpcInput<PathPropertiesRequest>,
  ): Promise<PathPropertiesResponse> {
    return this.transport.invoke<PathPropertiesResponse>("fs.properties", {
      request,
    });
  }

  async folderSize(request: FolderSizeRequest): Promise<FolderSizeResponse> {
    return this.transport.invoke<FolderSizeResponse>("fs.folder_size", {
      request,
    });
  }

  async startFolderSizeJob(
    request: FolderSizeRequest,
  ): Promise<FolderSizeJobResponse> {
    return this.transport.invoke<FolderSizeJobResponse>(
      "fs.folder_size_start",
      { request },
    );
  }

  async recursiveSearch(
    request: IpcInput<RecursiveSearchRequest>,
  ): Promise<RecursiveSearchResponse> {
    return this.transport.invoke<RecursiveSearchResponse>(
      "fs.recursive_search",
      { request },
    );
  }

  async startRecursiveSearchJob(
    request: IpcInput<RecursiveSearchRequest>,
  ): Promise<RecursiveSearchJobResponse> {
    return this.transport.invoke<RecursiveSearchJobResponse>(
      "fs.recursive_search_start",
      { request },
    );
  }

  async contentSearch(
    request: IpcInput<ContentSearchRequest>,
  ): Promise<ContentSearchResponse> {
    return this.transport.invoke<ContentSearchResponse>("fs.content_search", {
      request,
    });
  }

  async startContentSearchJob(
    request: IpcInput<ContentSearchRequest>,
  ): Promise<ContentSearchJobResponse> {
    return this.transport.invoke<ContentSearchJobResponse>(
      "fs.content_search_start",
      { request },
    );
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
    return this.transport.invoke<OkResponse>("fs.watch_start", {
      request,
    });
  }

  async stopWatching(): Promise<OkResponse> {
    return this.transport.invoke<OkResponse>("fs.watch_stop");
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

  async syncDirectories(
    request: SyncDirectoriesRequest,
  ): Promise<SyncDirectoriesResponse> {
    return await this.transport.invoke<SyncDirectoriesResponse>(
      "fs.sync_directories",
      { request },
    );
  }
}
