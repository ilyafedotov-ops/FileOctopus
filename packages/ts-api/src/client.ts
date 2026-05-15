import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen } from "@tauri-apps/api/event";
import type {
  AppInfoResponse,
  AppDataHealthResponse,
  CancelJobRequest,
  ClearOperationHistoryResponse,
  DirectoryBatchEventDto,
  CreateFileRequest,
  CreateFileResponse,
  ExportDiagnosticsBundleRequest,
  ExportDiagnosticsBundleResponse,
  DeletePermanentlyRequest,
  FolderSizeCompletedEventDto,
  FolderSizeJobResponse,
  FolderSizeRequest,
  FolderSizeResponse,
  JobCancelledEvent,
  JobCompletedEvent,
  JobFailedEvent,
  JobProgressEvent,
  JobStartedEvent,
  JobStatusRequest,
  JobStatusResponse,
  IpcError,
  IpcTransport,
  ListRecentOperationsRequest,
  ListRecentOperationsResponse,
  ListStartRequest,
  ListStartResponse,
  NavigationAddFavoriteRequest,
  NavigationFavoriteResponse,
  NavigationIsStarredRequest,
  NavigationIsStarredResponse,
  NavigationListFavoritesResponse,
  NavigationListRecentRequest,
  NavigationListRecentResponse,
  NavigationListStarredResponse,
  NavigationRecordVisitRequest,
  NavigationRemoveFavoriteRequest,
  NavigationRenameFavoriteRequest,
  NavigationToggleStarredRequest,
  NavigationToggleStarredResponse,
  GetPreferencesResponse,
  SetPreferenceRequest,
  SetPreferenceResponse,
  OkResponse,
  PathPropertiesRequest,
  PathPropertiesResponse,
  PathRequest,
  PlanFileOperationRequest,
  PlanFileOperationResponse,
  RecursiveSearchCompletedEventDto,
  RecursiveSearchJobResponse,
  RecursiveSearchMatchEventDto,
  RecursiveSearchRequest,
  RecursiveSearchResponse,
  StatRequest,
  StatResponse,
  StartFileOperationRequest,
  StartFileOperationResponse,
  StandardLocationsResponse,
  UnlistenFn,
  WatchEventDto,
  WatchStartRequest,
} from "./types";

export const DIRECTORY_BATCH_EVENT = "directory:batch";
export const JOB_STARTED_EVENT = "fileOperation:job:started";
export const JOB_PROGRESS_EVENT = "fileOperation:job:progress";
export const JOB_COMPLETED_EVENT = "fileOperation:job:completed";
export const JOB_FAILED_EVENT = "fileOperation:job:failed";
export const JOB_CANCELLED_EVENT = "fileOperation:job:cancelled";
export const WATCH_CHANGED_EVENT = "fs:watch:changed";
export const FOLDER_SIZE_COMPLETED_EVENT = "fs:folderSize:completed";
export const RECURSIVE_SEARCH_MATCH_EVENT = "fs:recursiveSearch:match";
export const RECURSIVE_SEARCH_COMPLETED_EVENT = "fs:recursiveSearch:completed";

const commandMap: Record<string, string> = {
  "app.get_info": "app_get_info",
  "fs.stat": "fs_stat",
  "fs.list_start": "fs_list_start",
  "fs.standard_locations": "fs_standard_locations",
  "fs.open_default": "fs_open_default",
  "fs.reveal": "fs_reveal",
  "fs.create_file": "fs_create_file",
  "fs.delete_permanently": "fs_delete_permanently",
  "fs.properties": "fs_properties",
  "fs.folder_size": "fs_folder_size",
  "fs.folder_size_start": "fs_folder_size_start",
  "fs.recursive_search": "fs_recursive_search",
  "fs.recursive_search_start": "fs_recursive_search_start",
  "fs.watch_start": "fs_watch_start",
  "fs.watch_stop": "fs_watch_stop",
  "fileOperation.plan": "plan_file_operation",
  "fileOperation.start": "start_file_operation",
  "job.cancel": "cancel_job",
  "job.status": "get_job_status",
  "operationHistory.listRecent": "list_recent_operations",
  "operationHistory.clear": "clear_operation_history",
  "diagnostics.appDataHealth": "diagnostics_app_data_health",
  "diagnostics.exportBundle": "export_diagnostics_bundle",
  "preferences.get": "get_preferences",
  "preferences.set": "set_preference",
  "navigation.recordVisit": "navigation_record_visit",
  "navigation.listFavorites": "navigation_list_favorites",
  "navigation.addFavorite": "navigation_add_favorite",
  "navigation.removeFavorite": "navigation_remove_favorite",
  "navigation.renameFavorite": "navigation_rename_favorite",
  "navigation.listRecent": "navigation_list_recent",
  "navigation.listStarred": "navigation_list_starred",
  "navigation.toggleStarred": "navigation_toggle_starred",
  "navigation.isStarred": "navigation_is_starred",
};

export class FileOctopusClient {
  readonly fs: FsClient;
  readonly fileOperations: FileOperationsClient;
  readonly jobs: JobsClient;
  readonly operationHistory: OperationHistoryClient;
  readonly diagnostics: DiagnosticsClient;
  readonly preferences: PreferencesClient;
  readonly navigation: NavigationClient;

  constructor(private readonly transport: IpcTransport) {
    this.fs = new FsClient(transport);
    this.fileOperations = new FileOperationsClient(transport);
    this.jobs = new JobsClient(transport);
    this.operationHistory = new OperationHistoryClient(transport);
    this.diagnostics = new DiagnosticsClient(transport);
    this.preferences = new PreferencesClient(transport);
    this.navigation = new NavigationClient(transport);
  }

  getAppInfo(): Promise<AppInfoResponse> {
    return this.transport.invoke<AppInfoResponse>("app.get_info");
  }
}

export class FileOperationsClient {
  constructor(private readonly transport: IpcTransport) {}

  async planFileOperation(
    request: PlanFileOperationRequest,
  ): Promise<PlanFileOperationResponse> {
    try {
      return await this.transport.invoke<PlanFileOperationResponse>(
        "fileOperation.plan",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async startFileOperation(
    request: StartFileOperationRequest,
  ): Promise<StartFileOperationResponse> {
    try {
      return await this.transport.invoke<StartFileOperationResponse>(
        "fileOperation.start",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  onJobStarted(handler: (event: JobStartedEvent) => void): Promise<UnlistenFn> {
    return requireListen(this.transport, JOB_STARTED_EVENT, handler);
  }

  onJobProgress(
    handler: (event: JobProgressEvent) => void,
  ): Promise<UnlistenFn> {
    return requireListen(this.transport, JOB_PROGRESS_EVENT, handler);
  }

  onJobCompleted(
    handler: (event: JobCompletedEvent) => void,
  ): Promise<UnlistenFn> {
    return requireListen(this.transport, JOB_COMPLETED_EVENT, handler);
  }

  onJobFailed(handler: (event: JobFailedEvent) => void): Promise<UnlistenFn> {
    return requireListen(this.transport, JOB_FAILED_EVENT, handler);
  }

  onJobCancelled(
    handler: (event: JobCancelledEvent) => void,
  ): Promise<UnlistenFn> {
    return requireListen(this.transport, JOB_CANCELLED_EVENT, handler);
  }
}

export class JobsClient {
  constructor(private readonly transport: IpcTransport) {}

  async cancelJob(request: CancelJobRequest): Promise<JobStatusResponse> {
    try {
      return await this.transport.invoke<JobStatusResponse>("job.cancel", {
        request,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async getJobStatus(request: JobStatusRequest): Promise<JobStatusResponse> {
    try {
      return await this.transport.invoke<JobStatusResponse>("job.status", {
        request,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }
}

export class OperationHistoryClient {
  constructor(private readonly transport: IpcTransport) {}

  async listRecentOperations(
    request: ListRecentOperationsRequest = {},
  ): Promise<ListRecentOperationsResponse> {
    try {
      return await this.transport.invoke<ListRecentOperationsResponse>(
        "operationHistory.listRecent",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async clearOperationHistory(): Promise<ClearOperationHistoryResponse> {
    try {
      return await this.transport.invoke<ClearOperationHistoryResponse>(
        "operationHistory.clear",
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }
}

export class DiagnosticsClient {
  constructor(private readonly transport: IpcTransport) {}

  async appDataHealth(): Promise<AppDataHealthResponse> {
    try {
      return await this.transport.invoke<AppDataHealthResponse>(
        "diagnostics.appDataHealth",
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async exportBundle(
    request: ExportDiagnosticsBundleRequest,
  ): Promise<ExportDiagnosticsBundleResponse> {
    try {
      return await this.transport.invoke<ExportDiagnosticsBundleResponse>(
        "diagnostics.exportBundle",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }
}

export class PreferencesClient {
  constructor(private readonly transport: IpcTransport) {}

  async get(): Promise<GetPreferencesResponse> {
    try {
      return await this.transport.invoke<GetPreferencesResponse>("preferences.get");
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async set(request: SetPreferenceRequest): Promise<SetPreferenceResponse> {
    try {
      return await this.transport.invoke<SetPreferenceResponse>("preferences.set", {
        request,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }
}

export class NavigationClient {
  constructor(private readonly transport: IpcTransport) {}

  async recordVisit(request: NavigationRecordVisitRequest): Promise<OkResponse> {
    try {
      return await this.transport.invoke("navigation.recordVisit", { request });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async listFavorites(): Promise<NavigationListFavoritesResponse> {
    try {
      return await this.transport.invoke("navigation.listFavorites");
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async addFavorite(
    request: NavigationAddFavoriteRequest,
  ): Promise<NavigationFavoriteResponse> {
    try {
      return await this.transport.invoke("navigation.addFavorite", { request });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async removeFavorite(request: NavigationRemoveFavoriteRequest): Promise<OkResponse> {
    try {
      return await this.transport.invoke("navigation.removeFavorite", { request });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async renameFavorite(
    request: NavigationRenameFavoriteRequest,
  ): Promise<NavigationFavoriteResponse> {
    try {
      return await this.transport.invoke("navigation.renameFavorite", { request });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async listRecent(
    request: NavigationListRecentRequest,
  ): Promise<NavigationListRecentResponse> {
    try {
      return await this.transport.invoke("navigation.listRecent", { request });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async listStarred(): Promise<NavigationListStarredResponse> {
    try {
      return await this.transport.invoke("navigation.listStarred");
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async toggleStarred(
    request: NavigationToggleStarredRequest,
  ): Promise<NavigationToggleStarredResponse> {
    try {
      return await this.transport.invoke("navigation.toggleStarred", { request });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async isStarred(
    request: NavigationIsStarredRequest,
  ): Promise<NavigationIsStarredResponse> {
    try {
      return await this.transport.invoke("navigation.isStarred", { request });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }
}

export class FsClient {
  constructor(private readonly transport: IpcTransport) {}

  async stat(request: StatRequest): Promise<StatResponse> {
    try {
      return await this.transport.invoke<StatResponse>("fs.stat", { request });
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

  async standardLocations(): Promise<StandardLocationsResponse> {
    try {
      return await this.transport.invoke<StandardLocationsResponse>(
        "fs.standard_locations",
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

  async createFile(request: CreateFileRequest): Promise<CreateFileResponse> {
    try {
      return await this.transport.invoke<CreateFileResponse>("fs.create_file", {
        request,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async deletePermanently(
    request: DeletePermanentlyRequest,
  ): Promise<OkResponse> {
    try {
      return await this.transport.invoke<OkResponse>("fs.delete_permanently", {
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
        code: "unsupported_transport",
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
        code: "unsupported_transport",
        message: "Transport does not support event subscriptions",
      } satisfies IpcError);
    }

    return this.transport.listen<DirectoryBatchEventDto>(
      DIRECTORY_BATCH_EVENT,
      handler,
    );
  }
}

export function createTauriTransport(): IpcTransport {
  return {
    invoke<TResponse>(command: string, args?: Record<string, unknown>) {
      return tauriInvoke<TResponse>(commandMap[command] ?? command, args);
    },
    async listen<TPayload>(
      event: string,
      handler: (payload: TPayload) => void,
    ) {
      return tauriListen<TPayload>(event, (tauriEvent) =>
        handler(tauriEvent.payload),
      );
    },
  };
}

export function createPreviewTransport(): IpcTransport {
  let sessionIndex = 0;
  const batchHandlers = new Set<(payload: DirectoryBatchEventDto) => void>();
  const folderSizeHandlers = new Set<
    (payload: FolderSizeCompletedEventDto) => void
  >();
  const recursiveSearchCompletedHandlers = new Set<
    (payload: RecursiveSearchCompletedEventDto) => void
  >();

  return {
    async invoke<TResponse>(command: string, args?: Record<string, unknown>) {
      if (command === "app.get_info") {
        return {
          name: "FileOctopus",
          version: "0.1.0",
          buildProfile: "preview",
          commitSha: null,
          targetOs: "browser",
        } as TResponse;
      }

      if (command === "diagnostics.appDataHealth") {
        return {
          configDir: "~/.fileoctopus/config",
          dataDir: "~/.fileoctopus",
          logDir: "~/.fileoctopus/logs",
          databasePath: "~/.fileoctopus/operation-history.sqlite",
          databaseExists: false,
          schemaVersion: 0,
          missingDirectories: [],
          startupRecoveryCount: 0,
        } as TResponse;
      }

      if (command === "operationHistory.clear") {
        return { deletedCount: 0 } as TResponse;
      }

      if (command === "diagnostics.exportBundle") {
        return {
          path: "preview-diagnostics.zip",
          files: ["app-info.json", "app-data-health.json"],
        } as TResponse;
      }

      if (command === "fs.standard_locations") {
        return {
          locations: [
            {
              id: "home",
              name: "Home",
              uri: "local:///Users/ilya",
              section: "Favorites",
            },
            {
              id: "documents",
              name: "Documents",
              uri: "local:///Users/ilya/Documents",
              section: "User folders",
            },
          ],
        } as TResponse;
      }

      if (
        command === "fs.open_default" ||
        command === "fs.reveal" ||
        command === "fs.delete_permanently" ||
        command === "fs.watch_start" ||
        command === "fs.watch_stop"
      ) {
        return { ok: true } as TResponse;
      }

      if (command === "fs.create_file") {
        const request = args?.request as Partial<CreateFileRequest> | undefined;
        return {
          entry: {
            uri: request?.uri ?? "local:///Users/ilya/New File.txt",
            name: "New File.txt",
            kind: "file",
            size: 0,
            isHidden: false,
            isSymlink: false,
            providerId: "local",
            canRead: true,
            canList: false,
            canWrite: true,
            canDelete: true,
            canRename: true,
          },
        } as TResponse;
      }

      if (command === "fs.properties") {
        const request = args?.request as
          | Partial<PathPropertiesRequest>
          | undefined;
        const uri = request?.uri ?? "local:///Users/ilya";
        return {
          properties: {
            uri,
            name: uri.split("/").filter(Boolean).slice(-1)[0] ?? uri,
            kind: "directory",
            size: null,
            totalSize: 0,
            itemCount: 0,
            fileCount: 0,
            directoryCount: 0,
            modifiedAt: null,
            createdAt: null,
            accessedAt: null,
            isHidden: false,
            isSymlink: false,
            symlinkTarget: null,
            readonly: false,
            warnings: [],
          },
        } as TResponse;
      }

      if (command === "fs.folder_size") {
        return {
          summary: {
            totalSize: 0,
            itemCount: 0,
            fileCount: 0,
            directoryCount: 0,
            warnings: [],
            incomplete: false,
          },
        } as TResponse;
      }

      if (command === "fs.folder_size_start") {
        const request = args?.request as Partial<FolderSizeRequest> | undefined;
        const now = new Date().toISOString();
        const jobId = `preview-folder-size-${Date.now()}`;
        const summary = {
          totalSize: 0,
          itemCount: 0,
          fileCount: 0,
          directoryCount: 0,
          warnings: [],
          incomplete: false,
        };

        globalThis.setTimeout(() => {
          for (const handler of folderSizeHandlers) {
            handler({
              jobId,
              uri: request?.uri ?? "local:///Users/ilya",
              summary,
            });
          }
        }, 0);

        return {
          job: {
            jobId,
            operationKind: "folderSize",
            status: "running",
            completedItems: 0,
            totalItems: 0,
            completedBytes: 0,
            totalBytes: null,
            startedAt: now,
            updatedAt: now,
          },
        } as TResponse;
      }

      if (command === "fs.recursive_search") {
        return {
          result: {
            matches: [],
            warnings: [],
            incomplete: false,
          },
        } as TResponse;
      }

      if (command === "fs.recursive_search_start") {
        const request = args?.request as
          | Partial<RecursiveSearchRequest>
          | undefined;
        const now = new Date().toISOString();
        const jobId = `preview-recursive-search-${Date.now()}`;
        const result = {
          matches: [],
          warnings: [],
          incomplete: false,
        };

        globalThis.setTimeout(() => {
          for (const handler of recursiveSearchCompletedHandlers) {
            handler({
              jobId,
              uri: request?.uri ?? "local:///Users/ilya",
              query: request?.query ?? "",
              result,
            });
          }
        }, 0);

        return {
          job: {
            jobId,
            operationKind: "recursiveSearch",
            status: "running",
            completedItems: 0,
            totalItems: 0,
            completedBytes: 0,
            totalBytes: null,
            startedAt: now,
            updatedAt: now,
          },
        } as TResponse;
      }

      if (command === "fs.list_start") {
        sessionIndex += 1;
        const sessionId = `preview-${sessionIndex}`;
        const request = args?.request as Partial<ListStartRequest> | undefined;

        const requestId = request?.requestId ?? `preview-${sessionIndex}`;

        globalThis.setTimeout(() => {
          for (const handler of batchHandlers) {
            handler({
              sessionId,
              requestId,
              uri: request?.uri ?? "local:///",
              entries: [],
              batchIndex: 0,
              isComplete: true,
              totalHint: 0,
              error: null,
            });
          }
        }, 0);

        return { sessionId, requestId } as TResponse;
      }

      throw {
        code: "tauri_unavailable",
        message: "Tauri IPC is unavailable in browser preview",
      } satisfies IpcError;
    },
    async listen<TPayload>(
      event: string,
      handler: (payload: TPayload) => void,
    ) {
      if (event === FOLDER_SIZE_COMPLETED_EVENT) {
        const typedHandler = handler as (
          payload: FolderSizeCompletedEventDto,
        ) => void;

        folderSizeHandlers.add(typedHandler);

        return () => folderSizeHandlers.delete(typedHandler);
      }

      if (event === RECURSIVE_SEARCH_COMPLETED_EVENT) {
        const typedHandler = handler as (
          payload: RecursiveSearchCompletedEventDto,
        ) => void;

        recursiveSearchCompletedHandlers.add(typedHandler);

        return () => recursiveSearchCompletedHandlers.delete(typedHandler);
      }

      if (event !== DIRECTORY_BATCH_EVENT) {
        return () => undefined;
      }

      const typedHandler = handler as (payload: DirectoryBatchEventDto) => void;

      batchHandlers.add(typedHandler);

      return () => batchHandlers.delete(typedHandler);
    },
  };
}

function requireListen<TPayload>(
  transport: IpcTransport,
  event: string,
  handler: (payload: TPayload) => void,
): Promise<UnlistenFn> {
  if (!transport.listen) {
    return Promise.reject({
      code: "unsupported_transport",
      message: "Transport does not support event subscriptions",
    } satisfies IpcError);
  }

  return transport.listen<TPayload>(event, handler);
}

export function createFileOctopusClient(
  transport: IpcTransport = isTauriRuntime()
    ? createTauriTransport()
    : createPreviewTransport(),
) {
  return new FileOctopusClient(transport);
}

export function normalizeIpcError(error: unknown): IpcError {
  if (isIpcError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return {
      code: "unknown",
      message: error.message,
    };
  }

  if (typeof error === "string") {
    return {
      code: "unknown",
      message: error,
    };
  }

  return {
    code: "unknown",
    message: "Unexpected IPC error",
  };
}

function isIpcError(error: unknown): error is IpcError {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as Partial<IpcError>;

  return (
    typeof candidate.code === "string" && typeof candidate.message === "string"
  );
}

function isTauriRuntime(): boolean {
  return typeof globalThis === "object" && "__TAURI_INTERNALS__" in globalThis;
}
