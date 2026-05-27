import { IPC_ERROR_CODES } from "../types";
import type {
  DirectoryBatchEventDto,
  FileEntryDto,
  FolderSizeCompletedEventDto,
  FolderSizeRequest,
  IpcError,
  IpcTransport,
  ListStartRequest,
  PathPropertiesRequest,
  RecursiveSearchCompletedEventDto,
  RecursiveSearchRequest,
  SetPreferenceRequest,
  TerminalOutputEvent,
  UserPreferencesDto,
} from "../types";
import { preferenceValue } from "../clients/preferences";
import {
  DIRECTORY_BATCH_EVENT,
  FOLDER_SIZE_COMPLETED_EVENT,
  RECURSIVE_SEARCH_COMPLETED_EVENT,
  TERMINAL_OUTPUT_EVENT,
} from "../events";
export function createPreviewTransport(): IpcTransport {
  let sessionIndex = 0;
  let previewPreferences: UserPreferencesDto = {
    theme: "system",
    density: "comfortable",
    defaultViewMode: "details",
    showHiddenFiles: false,
    sidebarWidth: 240,
    splitRatio: 0.5,
    activityPanelVisible: false,
    activityPanelWidth: 288,
    confirmDelete: true,
    confirmPermanentDelete: true,
    useTrashByDefault: true,
    defaultConflictPolicy: "fail",
    accentColor: "blue",
    fontScale: "medium",
    iconScale: "medium",
    confirmOverwrite: true,
    sidebarVisible: true,
    statusBarVisible: true,
    toolbarVisible: true,
    toolbarEntries: "",
    paneMode: "dual",
    paneDirection: "horizontal",
    jobDrawerBehavior: "manual",
    showAdvancedCopyOptions: false,
    paneTerminalHeightLeft: 0.35,
    paneTerminalHeightRight: 0.35,
    paneTerminalDefaultOpen: false,
    terminalCdOnNavigate: false,
    confirmClosePaneWithTerminal: true,
    terminalShell: "",
    terminalArgs: "",
    rememberLastUsedPanes: true,
    diagnosticsExportPath: "/tmp/fileoctopus-diagnostics.zip",
    customShortcuts: "",
    fileTypeColorRules: "",
    layoutProfiles: "",
    columnPresets: "",
    tabSessions: "",
    logLevel: "warn",
    experimentalFeatures: false,
    cacheSizeLimit: 256,
    fileOperationThreads: 4,
    networkConnectionTimeout: 30,
    networkAutoReconnect: true,
    networkDefaultProtocol: "sftp",
    networkSshKeyPath: "",
  };
  const batchHandlers = new Set<(payload: DirectoryBatchEventDto) => void>();
  const folderSizeHandlers = new Set<
    (payload: FolderSizeCompletedEventDto) => void
  >();
  const recursiveSearchCompletedHandlers = new Set<
    (payload: RecursiveSearchCompletedEventDto) => void
  >();
  const terminalOutputHandlers = new Set<
    (payload: TerminalOutputEvent) => void
  >();
  const terminalOutputBuffer: TerminalOutputEvent[] = [];

  const emitTerminalOutput = (payload: TerminalOutputEvent) => {
    if (terminalOutputHandlers.size === 0) {
      terminalOutputBuffer.push(payload);
      if (terminalOutputBuffer.length > 100) {
        terminalOutputBuffer.splice(0, terminalOutputBuffer.length - 100);
      }
      return;
    }
    for (const handler of terminalOutputHandlers) {
      handler(payload);
    }
  };

  return {
    async invoke<TResponse>(command: string, args?: Record<string, unknown>) {
      if (command === "app.get_info") {
        return {
          name: "FileOctopus",
          version: "0.1.0",
          buildProfile: "preview",
          commitSha: null,
          targetOs: "browser",
          dataDir: "~/.fileoctopus",
          networkEnabled: true,
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

      if (command === "operationHistory.listRecent") {
        return { operations: [] } as TResponse;
      }

      if (command === "preferences.get") {
        return { preferences: previewPreferences } as TResponse;
      }

      if (command === "preferences.set") {
        const request = args?.request as
          | Partial<SetPreferenceRequest>
          | undefined;
        const value = request?.value ?? "";

        previewPreferences = {
          ...previewPreferences,
          [request?.key ?? ""]: preferenceValue(request?.key, value),
        };

        return { preferences: previewPreferences } as TResponse;
      }

      if (command === "autostart.get" || command === "autostart.set") {
        return { enabled: false, supported: false } as TResponse;
      }

      if (command === "navigation.listFavorites") {
        return { favorites: [] } as TResponse;
      }

      if (command === "navigation.listRecent") {
        return { entries: [] } as TResponse;
      }

      if (command === "navigation.listStarred") {
        return { entries: [] } as TResponse;
      }

      if (command === "network.profilesList") {
        return {
          profiles: [
            {
              id: "550e8400-e29b-41d4-a716-446655440000",
              label: "Preview SFTP",
              scheme: "sftp",
              host: "example.com",
              port: 22,
              username: "deploy",
              authKind: "password",
              privateKeyPath: null,
              defaultPath: "/home/deploy",
              defaultUri:
                "sftp://550e8400-e29b-41d4-a716-446655440000/home/deploy",
              hostKeyFingerprint: null,
              sortOrder: 0,
              lastConnectedAt: null,
              lastError: null,
              hasStoredSecret: false,
              createdAt: "2026-01-01T00:00:00Z",
              updatedAt: "2026-01-01T00:00:00Z",
            },
          ],
        } as TResponse;
      }

      if (command === "network.connectionStatus") {
        return {
          statuses: [
            {
              profileId: "550e8400-e29b-41d4-a716-446655440000",
              status: "disconnected",
              message: null,
            },
          ],
        } as TResponse;
      }

      if (command === "network.discoverNeighborhood") {
        const request = args?.request as { uri?: string } | undefined;
        return {
          uri: request?.uri ?? "network:///",
          entries: previewNetworkEntries(request?.uri ?? "network:///"),
        } as TResponse;
      }

      if (
        command === "network.profileAdd" ||
        command === "network.profileUpdate"
      ) {
        const request = args?.request as
          | { label?: string; id?: string }
          | undefined;
        return {
          profile: {
            id: request?.id ?? "550e8400-e29b-41d4-a716-446655440000",
            label: request?.label ?? "Preview SFTP",
            scheme: "sftp",
            host: "example.com",
            port: 22,
            username: "deploy",
            authKind: "password",
            privateKeyPath: null,
            defaultPath: "/home/deploy",
            defaultUri:
              "sftp://550e8400-e29b-41d4-a716-446655440000/home/deploy",
            hostKeyFingerprint: null,
            sortOrder: 0,
            lastConnectedAt: null,
            lastError: null,
            hasStoredSecret: false,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          },
        } as TResponse;
      }

      if (
        command === "navigation.recordVisit" ||
        command === "navigation.removeFavorite" ||
        command === "navigation.toggleStarred" ||
        command === "navigation.clearRecent" ||
        command === "navigation.removeRecent" ||
        command === "network.profileDelete" ||
        command === "network.profileSetSecret" ||
        command === "network.connect" ||
        command === "network.disconnect" ||
        command === "network.validateUri"
      ) {
        return { ok: true } as TResponse;
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
            {
              id: "desktop",
              name: "Desktop",
              uri: "local:///Users/ilya/Desktop",
              section: "User folders",
            },
            {
              id: "downloads",
              name: "Downloads",
              uri: "local:///Users/ilya/Downloads",
              section: "User folders",
            },
            {
              id: "pictures",
              name: "Pictures",
              uri: "local:///Users/ilya/Pictures",
              section: "User folders",
            },
            {
              id: "macintosh-hd",
              name: "Macintosh HD",
              uri: "local:///",
              section: "Devices/Volumes",
            },
          ],
        } as TResponse;
      }

      if (
        command === "fs.open_default" ||
        command === "fs.reveal" ||
        command === "fs.watch_start" ||
        command === "fs.watch_stop"
      ) {
        return { ok: true } as TResponse;
      }

      if (command === "fs.read_file_as_data_uri") {
        const request = args?.request as { uri?: string } | undefined;
        const uri = request?.uri ?? "local:///Users/ilya/Documents/manual.pdf";
        const lower = uri.toLowerCase();
        const mimeType = lower.endsWith(".png")
          ? "image/png"
          : lower.endsWith(".jpg") || lower.endsWith(".jpeg")
            ? "image/jpeg"
            : lower.endsWith(".mp3")
              ? "audio/mpeg"
              : lower.endsWith(".mp4")
                ? "video/mp4"
                : "application/pdf";
        return {
          dataUri: `data:${mimeType};base64,JVBERi0xLjQK`,
          byteSize: 1024,
          mimeType,
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
              entries: previewEntriesForUri(request?.uri ?? "local:///"),
              batchIndex: 0,
              isComplete: true,
              totalHint: previewEntriesForUri(request?.uri ?? "local:///")
                .length,
              error: null,
            });
          }
        }, 0);

        return { sessionId, requestId } as TResponse;
      }

      if (command === "terminal.spawn") {
        const sessionId = `preview-terminal-${++sessionIndex}`;
        globalThis.setTimeout(() => {
          const data = btoa("fileoctopus-preview % ");
          emitTerminalOutput({ sessionId, data });
        }, 0);
        return { sessionId } as TResponse;
      }

      if (command === "terminal.write") {
        const request = args?.request as
          | { sessionId?: string; data?: string }
          | undefined;
        if (request?.sessionId && request.data) {
          globalThis.setTimeout(() => {
            emitTerminalOutput({
              sessionId: request.sessionId ?? "",
              data: request.data ?? "",
            });
          }, 0);
        }
        return { success: true } as TResponse;
      }

      if (command === "terminal.resize" || command === "terminal.kill") {
        return { success: true } as TResponse;
      }

      if (command === "fs.open_terminal") {
        return { success: true } as TResponse;
      }

      throw {
        code: IPC_ERROR_CODES.TAURI_UNAVAILABLE,
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

      if (event === TERMINAL_OUTPUT_EVENT) {
        const typedHandler = handler as (payload: TerminalOutputEvent) => void;
        terminalOutputHandlers.add(typedHandler);
        if (terminalOutputBuffer.length > 0) {
          const pending = terminalOutputBuffer.splice(0);
          for (const payload of pending) {
            typedHandler(payload);
          }
        }
        return () => terminalOutputHandlers.delete(typedHandler);
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

function previewEntriesForUri(uri: string): FileEntryDto[] {
  const now = "2026-05-15T12:00:00.000Z";
  const base = uri.replace(/\/$/, "");

  const entry = (
    name: string,
    kind: FileEntryDto["kind"],
    size: number | null,
    extension: string | null = null,
  ): FileEntryDto => ({
    uri: `${base}/${name}`,
    name,
    extension,
    kind,
    size,
    modifiedAt: now,
    createdAt: now,
    accessedAt: now,
    isHidden: name.startsWith("."),
    isSymlink: false,
    symlinkTarget: null,
    providerId: "preview",
    canRead: true,
    canList: kind === "directory",
    canWrite: true,
    canDelete: true,
    canRename: true,
  });

  if (uri.includes("/Documents")) {
    return [
      entry("Projects", "directory", null),
      entry("Reports", "directory", null),
      entry("Invoices", "directory", null),
      entry("Budget.xlsx", "file", 245000, "xlsx"),
      entry("Notes.txt", "file", 3200, "txt"),
      entry("Presentation.pptx", "file", 5800000, "pptx"),
    ];
  }

  if (uri.includes("/Pictures")) {
    return [
      entry("Camera Roll", "directory", null),
      entry("Screenshots", "directory", null),
      entry("Wallpapers", "directory", null),
      entry("IMG_2024_0001.jpg", "file", 3200000, "jpg"),
      entry("photo_edit.psd", "file", 45600000, "psd"),
    ];
  }

  return [
    entry("Desktop", "directory", null),
    entry("Documents", "directory", null),
    entry("Downloads", "directory", null),
    entry("Pictures", "directory", null),
    entry("FileOctopus", "directory", null),
    entry("README.md", "file", 8200, "md"),
  ];
}

function previewNetworkEntries(uri: string): FileEntryDto[] {
  const entry = (
    uri: string,
    name: string,
    virtualKind: string,
    targetUri: string | null = null,
    protocol: string | null = null,
    status: string | null = "available",
    description: string | null = null,
  ): FileEntryDto => ({
    uri,
    name,
    extension: null,
    kind: virtualKind === "addConnection" ? "virtual" : "directory",
    size: null,
    modifiedAt: null,
    createdAt: null,
    accessedAt: null,
    isHidden: false,
    isSymlink: false,
    symlinkTarget: null,
    providerId: "network",
    canRead: targetUri !== null,
    canList: virtualKind !== "addConnection",
    canWrite: false,
    canDelete: false,
    canRename: false,
    targetUri,
    virtualKind,
    protocol,
    status,
    description,
  });

  if (uri === "network:///cloud") {
    return [
      entry(
        "network:///cloud/google-drive",
        "Google Drive",
        "cloudDrive",
        "local:///Users/you/Library/CloudStorage/GoogleDrive-user@example.com",
        "cloud",
      ),
      entry(
        "network:///cloud/onedrive",
        "OneDrive",
        "cloudDrive",
        "local:///Users/you/Library/CloudStorage/OneDrive-Personal",
        "cloud",
      ),
      entry(
        "network:///cloud/icloud",
        "iCloud Drive",
        "cloudDrive",
        "local:///Users/you/Library/Mobile Documents/com~apple~CloudDocs",
        "cloud",
      ),
    ];
  }

  if (uri === "network:///lan") {
    return [
      entry(
        "network:///lan/smb/fileserver",
        "fileserver.local",
        "discoveredService",
        null,
        "smb",
        "credentialsRequired",
        "SMB service discovered on the local network",
      ),
    ];
  }

  if (uri === "network:///saved") {
    return [
      entry(
        "network:///saved/550e8400-e29b-41d4-a716-446655440000",
        "Preview SFTP",
        "savedConnection",
        "sftp://550e8400-e29b-41d4-a716-446655440000/home/deploy",
        "sftp",
        "credentialsRequired",
      ),
    ];
  }

  return [
    entry("network:///cloud", "Cloud Storage", "group", null, "cloud"),
    entry("network:///lan", "Local Network", "group", null, "lan"),
    entry("network:///saved", "Saved Connections", "group", null, "profile"),
    entry("network:///add", "Add Connection", "addConnection"),
  ];
}
