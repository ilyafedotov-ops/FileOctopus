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
  SyncDirectoriesRequest,
  SyncDirectoriesResponse,
  TerminalProfileDto,
  TerminalSessionDto,
  TerminalSessionEventDto,
  TerminalOutputEvent,
  UserPreferencesDto,
} from "../types";
import { preferenceValue } from "../clients/preferences";
import {
  DIRECTORY_BATCH_EVENT,
  FOLDER_SIZE_COMPLETED_EVENT,
  RECURSIVE_SEARCH_COMPLETED_EVENT,
  TERMINAL_SESSION_EVENT,
  TERMINAL_OUTPUT_EVENT,
} from "../events";

type PreviewPlatform = "mac" | "windows" | "linux";

function previewPlatform(): PreviewPlatform {
  const platform = globalThis.navigator?.platform ?? "";
  if (platform.startsWith("Mac")) return "mac";
  if (platform.startsWith("Win")) return "windows";
  return "linux";
}

function previewHomeUri(): string {
  switch (previewPlatform()) {
    case "mac":
      return "local:///Users/preview";
    case "windows":
      return "local://C:/Users/Preview";
    case "linux":
      return "local:///home/preview";
  }
}

function previewHomePath(): string {
  switch (previewPlatform()) {
    case "mac":
      return "/Users/preview";
    case "windows":
      return "C:\\Users\\Preview";
    case "linux":
      return "/home/preview";
  }
}

function previewPathUri(...parts: string[]): string {
  return [previewHomeUri(), ...parts.map(encodeURIComponent)].join("/");
}

function previewFsPath(...parts: string[]): string {
  const separator = previewPlatform() === "windows" ? "\\" : "/";
  return [previewHomePath(), ...parts].join(separator);
}

function previewDiagnosticsPath(): string {
  if (previewPlatform() === "windows") {
    return previewFsPath(
      "AppData",
      "Local",
      "Temp",
      "fileoctopus-diagnostics.zip",
    );
  }
  return previewFsPath(".cache", "fileoctopus-diagnostics.zip");
}

function previewDefaultShell(): string {
  return previewPlatform() === "windows" ? "powershell.exe" : "/bin/bash";
}

function previewDefaultShellArgs(): string[] {
  return previewPlatform() === "windows" ? ["-NoLogo"] : ["-l"];
}

function previewDiscoveredShells(): string[] {
  return previewPlatform() === "windows"
    ? ["powershell.exe", "pwsh.exe", "cmd.exe"]
    : ["/bin/bash", "/bin/zsh"];
}

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
    useTrashByDefault: false,
    defaultConflictPolicy: "fail",
    accentColor: "blue",
    fontScale: "medium",
    iconScale: "medium",
    confirmOverwrite: true,
    sidebarVisible: true,
    statusBarVisible: true,
    toolbarVisible: true,
    toolbarEntries: "",
    popupNotifications: false,
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
    diagnosticsExportPath: previewDiagnosticsPath(),
    customShortcuts: "",
    fileTypeColorRules: "",
    layoutProfiles: "",
    columnPresets: "",
    tabSessions: "",
    hotlistEntries: "",
    leftDefaultViewMode: "details",
    rightDefaultViewMode: "details",
    leftDefaultSortField: "name",
    rightDefaultSortField: "name",
    logLevel: "warn",
    experimentalFeatures: false,
    cacheSizeLimit: 256,
    fileOperationThreads: 4,
    operationIdleTimeoutSecs: 300,
    networkConnectionTimeout: 30,
    networkAutoReconnect: true,
    networkDefaultProtocol: "sftp",
    networkSshKeyPath: "",
    networkUseSshAgent: false,
    editorFontFamily: "monospace",
    editorFontSize: 14,
    editorTabSize: 4,
    editorWordWrap: true,
    editorAutoSave: false,
    editorSyntaxHighlighting: true,
    editorLineNumbers: true,
    viewerDefaultViewMode: "text",
    viewerImageZoom: "fit",
    viewerMediaAutoplay: false,
    viewerMaxPreviewSize: 10,
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
  const terminalSessionHandlers = new Set<
    (payload: TerminalSessionEventDto) => void
  >();
  const terminalOutputBuffer: TerminalOutputEvent[] = [];
  const now = "2026-06-01T00:00:00.000Z";
  let previewTerminalProfiles: TerminalProfileDto[] = [
    {
      id: "preview-default-terminal-profile",
      name: "Default",
      scope: "local",
      shell: "",
      args: "",
      env: "",
      workingDirectoryMode: "currentPane",
      customCwdUri: "",
      networkProfileId: null,
      remoteCwd: "",
      initialCommand: "",
      fontFamily: "monospace",
      fontSize: 13,
      lineHeight: 1.2,
      cursorStyle: "block",
      cursorBlink: true,
      scrollback: 5000,
      themeId: "system",
      themeOverrides: "",
      copyOnSelect: false,
      rightClickAction: "contextMenu",
      pasteConfirmation: true,
      linkHandling: "openExternal",
      sortOrder: 0,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
  const previewTerminalSessions = new Map<string, TerminalSessionDto>();

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

  const emitTerminalSession = (payload: TerminalSessionEventDto) => {
    for (const handler of terminalSessionHandlers) {
      handler(payload);
    }
  };

  return {
    async invoke<TResponse>(command: string, args?: Record<string, unknown>) {
      if (command === "app.get_info") {
        return {
          name: "FileOctopus",
          version: "0.1.2",
          buildProfile: "preview",
          commitSha: null,
          targetOs: "browser",
          dataDir: previewFsPath(".fileoctopus"),
          networkEnabled: true,
        } as TResponse;
      }

      if (command === "diagnostics.appDataHealth") {
        return {
          configDir: previewFsPath(".fileoctopus", "config"),
          dataDir: previewFsPath(".fileoctopus"),
          logDir: previewFsPath(".fileoctopus", "logs"),
          databasePath: previewFsPath(
            ".fileoctopus",
            "operation-history.sqlite",
          ),
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

      if (command === "git.discover") {
        const request = args?.request as { uri?: string } | undefined;
        return {
          repo: {
            rootUri: request?.uri ?? previewPathUri("Documents"),
            branch: "main",
            headShort: "preview",
            isDirty: true,
          },
        } as TResponse;
      }

      if (command === "git.statusForDirectory") {
        const request = args?.request as { uri?: string } | undefined;
        const rootUri = request?.uri ?? previewPathUri("Documents");
        return {
          repo: {
            rootUri,
            branch: "main",
            headShort: "preview",
            isDirty: true,
          },
          entries: {
            [`${rootUri}/README.md`]: "modified",
          },
        } as TResponse;
      }

      if (command === "git.statusForRepository") {
        const request = args?.request as { uri?: string } | undefined;
        const rootUri = request?.uri ?? previewPathUri("Documents");
        return {
          repo: {
            rootUri,
            branch: "main",
            headShort: "preview",
            isDirty: true,
          },
          files: [
            {
              uri: `${rootUri}/README.md`,
              repoRelativePath: "README.md",
              status: "modified",
              previousUri: null,
              previousRepoRelativePath: null,
            },
          ],
        } as TResponse;
      }

      if (command === "git.diffFile") {
        const request = args?.request as { uri?: string } | undefined;
        const uri = request?.uri ?? previewPathUri("Documents", "README.md");
        return {
          repo: {
            rootUri: uri.replace(/\/[^/]*$/, ""),
            branch: "main",
            headShort: "preview",
            isDirty: true,
          },
          file: {
            uri,
            repoRelativePath: uri.split("/").pop() ?? "README.md",
            status: "modified",
            previousUri: null,
            previousRepoRelativePath: null,
          },
          oldLabel: "HEAD",
          newLabel: "Worktree",
          hunks: [
            {
              oldStart: 1,
              oldCount: 2,
              newStart: 1,
              newCount: 2,
              lines: [
                {
                  kind: "equal",
                  content: "# FileOctopus\n",
                  oldLine: 1,
                  newLine: 1,
                },
                {
                  kind: "delete",
                  content: "Preview diff\n",
                  oldLine: 2,
                  newLine: null,
                },
                {
                  kind: "insert",
                  content: "Preview Git Review diff\n",
                  oldLine: null,
                  newLine: 2,
                },
              ],
            },
          ],
          oldLineCount: 2,
          newLineCount: 2,
          oldTruncated: false,
          newTruncated: false,
          binary: false,
          unsupportedReason: null,
        } as TResponse;
      }

      if (command === "git.history") {
        const request = args?.request as { uri?: string } | undefined;
        const rootUri = request?.uri ?? previewPathUri("Documents");
        return {
          repo: {
            rootUri,
            branch: "main",
            headShort: "preview",
            isDirty: true,
          },
          commits: [
            {
              hash: "abcdef1234567890",
              shortHash: "abcdef1",
              parents: ["1234567"],
              parentCount: 1,
              authorName: "FileOctopus Preview",
              authorEmail: "preview@example.invalid",
              authoredAt: now,
              subject: "Preview Git history",
              body: "Preview Git history",
            },
            {
              hash: "1234567890abcdef",
              shortHash: "1234567",
              parents: [],
              parentCount: 0,
              authorName: "FileOctopus Preview",
              authorEmail: "preview@example.invalid",
              authoredAt: now,
              subject: "Initial preview commit",
              body: "Initial preview commit",
            },
          ],
        } as TResponse;
      }

      if (command === "git.branches") {
        const request = args?.request as { uri?: string } | undefined;
        const rootUri = request?.uri ?? previewPathUri("Documents");
        return {
          repo: {
            rootUri,
            branch: "main",
            headShort: "preview",
            isDirty: true,
          },
          branches: [
            {
              fullName: "refs/heads/main",
              name: "main",
              kind: "local",
              isCurrent: true,
              head: "abcdef1",
              upstream: "origin/main",
              lastCommitAt: now,
              subject: "Preview Git history",
            },
            {
              fullName: "refs/remotes/origin/main",
              name: "origin/main",
              kind: "remote",
              isCurrent: false,
              head: "abcdef1",
              upstream: null,
              lastCommitAt: now,
              subject: "Preview Git history",
            },
          ],
        } as TResponse;
      }

      if (command === "git.worktrees") {
        const request = args?.request as { uri?: string } | undefined;
        const rootUri = request?.uri ?? previewPathUri("Documents");
        return {
          repo: {
            rootUri,
            branch: "main",
            headShort: "preview",
            isDirty: true,
          },
          worktrees: [
            {
              pathUri: rootUri,
              branch: "main",
              head: "abcdef1234567890",
              detached: false,
              bare: false,
              prunable: false,
              prunableReason: null,
            },
          ],
        } as TResponse;
      }

      if (command === "git.revisionDiff") {
        const request = args?.request as
          | { uri?: string; base?: string; head?: string }
          | undefined;
        const rootUri = request?.uri ?? previewPathUri("Documents");
        return {
          repo: {
            rootUri,
            branch: "main",
            headShort: "preview",
            isDirty: true,
          },
          base: request?.base ?? "HEAD~1",
          head: request?.head ?? "HEAD",
          files: [
            {
              repo: null,
              file: {
                uri: `${rootUri}/README.md`,
                repoRelativePath: "README.md",
                status: "modified",
                previousUri: null,
                previousRepoRelativePath: null,
              },
              oldLabel: `${request?.base ?? "HEAD~1"}:README.md`,
              newLabel: `${request?.head ?? "HEAD"}:README.md`,
              hunks: [
                {
                  oldStart: 1,
                  oldCount: 1,
                  newStart: 1,
                  newCount: 1,
                  lines: [
                    {
                      kind: "delete",
                      content: "Preview Git workspace\n",
                      oldLine: 1,
                      newLine: null,
                    },
                    {
                      kind: "insert",
                      content: "Preview advanced Git workspace\n",
                      oldLine: null,
                      newLine: 1,
                    },
                  ],
                },
              ],
              oldLineCount: 1,
              newLineCount: 1,
              oldTruncated: false,
              newTruncated: false,
              binary: false,
              unsupportedReason: null,
            },
          ],
        } as TResponse;
      }

      if (command === "git.revisionFiles") {
        const request = args?.request as
          | { uri?: string; revision?: string | null }
          | undefined;
        const rootUri = request?.uri ?? previewPathUri("Documents");
        return {
          repo: {
            rootUri,
            branch: "main",
            headShort: "preview",
            isDirty: true,
          },
          revision: request?.revision ?? "HEAD",
          files: [
            {
              uri: `${rootUri}/README.md`,
              repoRelativePath: "README.md",
            },
            {
              uri: `${rootUri}/src/app.ts`,
              repoRelativePath: "src/app.ts",
            },
          ],
        } as TResponse;
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
              options: defaultNetworkOptions(),
              createdAt: "2026-01-01T00:00:00Z",
              updatedAt: "2026-01-01T00:00:00Z",
            },
          ],
        } as TResponse;
      }

      if (command === "network.providersList") {
        return { providers: previewNetworkProviders() } as TResponse;
      }

      if (command === "network.profileTest") {
        const request = args?.request as
          | { id?: string; draft?: { scheme?: string; defaultPath?: string } }
          | undefined;
        const scheme = request?.draft?.scheme ?? "sftp";
        const path = request?.draft?.defaultPath ?? "/home/deploy";
        return {
          ok: true,
          status: "success",
          message: request?.id
            ? "Preview profile test succeeded."
            : "Preview draft validation succeeded.",
          durationMs: 42,
          resolvedUri: `${scheme}://preview${path.startsWith("/") ? path : `/${path}`}`,
          observedFingerprint:
            scheme === "sftp" || scheme === "ssh"
              ? "SHA256:previewfingerprint"
              : null,
          trustState:
            scheme === "sftp" || scheme === "ssh"
              ? "untrusted"
              : "notApplicable",
          warnings: ["Preview transport does not open sockets."],
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
            options: defaultNetworkOptions(),
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
        command === "network.profileTrustFingerprint" ||
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
              uri: previewHomeUri(),
              section: "Favorites",
            },
            {
              id: "documents",
              name: "Documents",
              uri: previewPathUri("Documents"),
              section: "User folders",
            },
            {
              id: "desktop",
              name: "Desktop",
              uri: previewPathUri("Desktop"),
              section: "User folders",
            },
            {
              id: "downloads",
              name: "Downloads",
              uri: previewPathUri("Downloads"),
              section: "User folders",
            },
            {
              id: "pictures",
              name: "Pictures",
              uri: previewPathUri("Pictures"),
              section: "User folders",
            },
            {
              id: "macintosh-hd",
              name: previewPlatform() === "windows" ? "Windows (C:)" : "Root",
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
        const uri = request?.uri ?? previewPathUri("Documents", "manual.pdf");
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
        const uri = request?.uri ?? previewHomeUri();
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

      if (command === "fs.sync_directories") {
        const request = args?.request as
          | Partial<SyncDirectoriesRequest>
          | undefined;
        return previewSyncDirectories(request) as TResponse;
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
              uri: request?.uri ?? previewHomeUri(),
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
              uri: request?.uri ?? previewHomeUri(),
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

      if (command === "fs.read_text_file") {
        const request = args?.request as
          | { uri?: string; maxBytes?: number }
          | undefined;
        const content = previewTextForUri(request?.uri ?? "");
        const encoded = new TextEncoder().encode(content);
        const maxBytes = request?.maxBytes ?? encoded.length;
        const sliced = encoded.slice(0, maxBytes);
        const truncated = sliced.length < encoded.length;
        return {
          content: new TextDecoder().decode(sliced),
          truncated,
          byteSize: encoded.length,
        } as TResponse;
      }

      if (command === "fs.read_file_range") {
        const request = args?.request as
          | { uri?: string; offset?: number; length?: number }
          | undefined;
        const content = previewTextForUri(request?.uri ?? "");
        const encoded = new TextEncoder().encode(content);
        const offset = Math.max(0, request?.offset ?? 0);
        const length = Math.max(0, request?.length ?? 0);
        const bytes = encoded.slice(offset, offset + length);
        return {
          bytesBase64: bytesToBase64(bytes),
          bytesRead: bytes.length,
          byteSize: encoded.length,
          eof: offset + bytes.length >= encoded.length,
        } as TResponse;
      }

      if (command === "terminal.spawn") {
        const sessionId = `preview-terminal-${++sessionIndex}`;
        const request = args?.request as
          | {
              uri?: string;
              terminalProfileId?: string | null;
              cols?: number;
              rows?: number;
              title?: string | null;
            }
          | undefined;
        const session: TerminalSessionDto = {
          sessionId,
          status: "running",
          title: request?.title ?? "Preview Terminal",
          cwdUri: request?.uri ?? "local:///",
          terminalProfileId:
            request?.terminalProfileId ??
            previewTerminalProfiles[0]?.id ??
            null,
          transport: "local",
          cols: request?.cols ?? 80,
          rows: request?.rows ?? 24,
          exitCode: null,
        };
        previewTerminalSessions.set(sessionId, session);
        emitTerminalSession({ ...session, kind: "started" });
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

      if (
        command === "terminal.sendText" ||
        command === "terminal.runCommand"
      ) {
        const request = args?.request as
          | { sessionId?: string; text?: string; command?: string }
          | undefined;
        if (request?.sessionId) {
          const text = request.text ?? request.command ?? "";
          globalThis.setTimeout(() => {
            emitTerminalOutput({
              sessionId: request.sessionId ?? "",
              data: btoa(text),
            });
          }, 0);
        }
        return { success: true } as TResponse;
      }

      if (command === "terminal.spawnAndRun") {
        const request = args?.request as
          | {
              uri?: string;
              terminalProfileId?: string | null;
              cols?: number;
              rows?: number;
              command?: string;
              title?: string | null;
            }
          | undefined;
        const sessionId = `preview-terminal-${++sessionIndex}`;
        const session: TerminalSessionDto = {
          sessionId,
          status: "running",
          title: request?.title ?? "Preview Command",
          cwdUri: request?.uri ?? "local:///",
          terminalProfileId:
            request?.terminalProfileId ??
            previewTerminalProfiles[0]?.id ??
            null,
          transport: "local",
          cols: request?.cols ?? 80,
          rows: request?.rows ?? 24,
          exitCode: null,
        };
        previewTerminalSessions.set(sessionId, session);
        emitTerminalSession({ ...session, kind: "started" });
        globalThis.setTimeout(() => {
          emitTerminalOutput({
            sessionId,
            data: btoa(`${request?.command ?? ""}\n`),
          });
        }, 0);
        return { sessionId } as TResponse;
      }

      if (command === "terminal.resize" || command === "terminal.kill") {
        return { success: true } as TResponse;
      }

      if (command === "terminal.capabilities") {
        return {
          defaultShell: previewDefaultShell(),
          defaultArgs: previewDefaultShellArgs(),
          discoveredShells: previewDiscoveredShells(),
          supportsSsh: true,
          cursorStyles: ["block", "bar", "underline"],
          themeIds: ["system", "dark", "light"],
        } as TResponse;
      }

      if (command === "terminal.profilesList") {
        return {
          profiles: previewTerminalProfiles,
          defaultProfileId:
            previewTerminalProfiles.find((profile) => profile.isDefault)?.id ??
            null,
        } as TResponse;
      }

      if (command === "terminal.profileAdd") {
        const request = args?.request as
          | {
              profile?: Omit<
                TerminalProfileDto,
                "id" | "sortOrder" | "isDefault" | "createdAt" | "updatedAt"
              >;
            }
          | undefined;
        const profile: TerminalProfileDto = {
          ...(request?.profile ?? previewTerminalProfiles[0]),
          id: `preview-terminal-profile-${++sessionIndex}`,
          sortOrder: previewTerminalProfiles.length,
          isDefault: false,
          createdAt: now,
          updatedAt: now,
        } as TerminalProfileDto;
        previewTerminalProfiles = [...previewTerminalProfiles, profile];
        return { profile } as TResponse;
      }

      if (command === "terminal.profileUpdate") {
        const request = args?.request as
          | { id?: string; profile?: TerminalProfileDto }
          | undefined;
        const existing = previewTerminalProfiles.find(
          (profile) => profile.id === request?.id,
        );
        const profile = {
          ...(existing ?? previewTerminalProfiles[0]),
          ...(request?.profile ?? {}),
          id: request?.id ?? existing?.id ?? "preview-default-terminal-profile",
          updatedAt: now,
        } as TerminalProfileDto;
        previewTerminalProfiles = previewTerminalProfiles.map((item) =>
          item.id === profile.id ? profile : item,
        );
        return { profile } as TResponse;
      }

      if (command === "terminal.profileDelete") {
        const request = args?.request as { id?: string } | undefined;
        previewTerminalProfiles = previewTerminalProfiles.filter(
          (profile) => profile.id !== request?.id || profile.isDefault,
        );
        return { success: true } as TResponse;
      }

      if (command === "terminal.profileSetDefault") {
        const request = args?.request as { id?: string } | undefined;
        previewTerminalProfiles = previewTerminalProfiles.map((profile) => ({
          ...profile,
          isDefault: profile.id === request?.id,
        }));
        return {
          profile:
            previewTerminalProfiles.find(
              (profile) => profile.id === request?.id,
            ) ?? previewTerminalProfiles[0],
        } as TResponse;
      }

      if (command === "terminal.sessionsList") {
        return {
          sessions: Array.from(previewTerminalSessions.values()),
        } as TResponse;
      }

      if (command === "fs.open_terminal") {
        return { success: true } as TResponse;
      }

      if (command === "plugin.list") {
        return { plugins: [] } as TResponse;
      }

      if (command === "plugin.install") {
        return {
          plugin: {
            manifest: {
              id: "preview",
              name: "Preview Plugin",
              version: "0.0.1",
              description: "Preview mock",
              author: "FileOctopus",
              entryPoint: "main.js",
              permissions: [],
            },
            installPath: "/tmp/preview-plugin",
            enabled: true,
          },
        } as TResponse;
      }

      if (command === "plugin.uninstall") {
        return { ok: true } as TResponse;
      }

      if (command === "plugin.toggle") {
        return {
          plugin: {
            manifest: {
              id: "preview",
              name: "Preview Plugin",
              version: "0.0.1",
              description: "Preview mock",
              author: "FileOctopus",
              entryPoint: "main.js",
              permissions: [],
            },
            installPath: "/tmp/preview-plugin",
            enabled:
              (args?.request as Record<string, unknown>)?.enabled ?? true,
          },
        } as TResponse;
      }

      if (command === "fs.get_acl") {
        return {
          owner: "user",
          group: "user",
          entries: [
            { principal: "owner", read: true, write: true, execute: false },
            { principal: "group", read: true, write: false, execute: false },
            { principal: "other", read: true, write: false, execute: false },
          ],
          octal: "644",
        } as TResponse;
      }

      if (command === "fs.set_acl") {
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

      if (event === TERMINAL_SESSION_EVENT) {
        const typedHandler = handler as (
          payload: TerminalSessionEventDto,
        ) => void;
        terminalSessionHandlers.add(typedHandler);
        return () => terminalSessionHandlers.delete(typedHandler);
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

function previewTextForUri(uri: string): string {
  const name = uri.split("/").pop() ?? "README.md";

  if (name === "App.tsx") {
    return `import { useMemo, useState } from "react";
import { GitBranch, Search, TerminalSquare } from "lucide-react";

type PaneMode = "details" | "columns" | "preview";

export function App() {
  const [mode, setMode] = useState<PaneMode>("details");
  const visibleTools = useMemo(
    () => ["Git review", "Network", "Terminal"].filter(Boolean),
    [],
  );

  return (
    <main className="workspace" data-mode={mode}>
      <header className="toolbar">
        <Search aria-hidden />
        <GitBranch aria-hidden />
        <TerminalSquare aria-hidden />
      </header>
      <section className="pane">
        {visibleTools.map((tool) => (
          <button key={tool} onClick={() => setMode("preview")}>
            {tool}
          </button>
        ))}
      </section>
    </main>
  );
}
`;
  }

  if (name === "main.rs") {
    return `use fileoctopus_app_core::runtime::Runtime;

fn main() -> anyhow::Result<()> {
    let runtime = Runtime::new()?;
    runtime.run()
}
`;
  }

  if (name === "package.json") {
    return `{
  "name": "fileoctopus-preview",
  "version": "0.1.2",
  "private": true,
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build"
  }
}
`;
  }

  if (name === "Notes.txt") {
    return "Preview note\n\nUse FileOctopus to review local files, Git state, remote connections, and terminal sessions from one workspace.\n";
  }

  return `# FileOctopus

FileOctopus is a Tauri v2 desktop file manager with a Rust-owned filesystem
boundary and a React TypeScript frontend.

## Interface areas

- Dual-pane local and remote browsing
- Syntax-highlighted text viewer and editor
- Git review with worktree diffs, history, branches, and worktrees
- Integrated terminal sessions scoped to the active pane

\`\`\`ts
const resourceUri = "${previewPathUri("Projects", "FileOctopus", "src", "App.tsx")}";
await fs.readTextFile({ uri: resourceUri, maxBytes: 10 * 1024 * 1024 });
\`\`\`
`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
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

  if (uri.includes("/FileOctopus/src")) {
    return [
      entry("App.tsx", "file", 740, "tsx"),
      entry("main.tsx", "file", 260, "tsx"),
      entry("components", "directory", null),
      entry("styles.css", "file", 1800, "css"),
    ];
  }

  if (uri.includes("/FileOctopus")) {
    return [
      entry("src", "directory", null),
      entry("src-tauri", "directory", null),
      entry("crates", "directory", null),
      entry("packages", "directory", null),
      entry("README.md", "file", 1900, "md"),
      entry("package.json", "file", 160, "json"),
      entry("main.rs", "file", 120, "rs"),
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

function previewSyncDirectories(
  request: Partial<SyncDirectoriesRequest> | undefined,
): SyncDirectoriesResponse {
  const leftUri = request?.leftUri ?? previewPathUri("Documents");
  const rightUri = request?.rightUri ?? previewPathUri("Pictures");
  const comparison = request?.comparison ?? "size";
  const leftEntries = previewEntriesForUri(leftUri);
  const rightEntries = previewEntriesForUri(rightUri);
  const leftByName = new Map(leftEntries.map((entry) => [entry.name, entry]));
  const rightByName = new Map(rightEntries.map((entry) => [entry.name, entry]));
  const names = Array.from(
    new Set([...leftByName.keys(), ...rightByName.keys()]),
  ).sort((left, right) => left.localeCompare(right));

  return {
    leftUri,
    rightUri,
    recursive: request?.recursive ?? false,
    entries: names.map((name) => {
      const left = leftByName.get(name) ?? null;
      const right = rightByName.get(name) ?? null;
      return {
        name,
        leftUri: left?.uri ?? null,
        rightUri: right?.uri ?? null,
        leftSize: left?.size ?? null,
        rightSize: right?.size ?? null,
        leftModified: left?.modifiedAt ?? null,
        rightModified: right?.modifiedAt ?? null,
        leftIsDir: left?.kind === "directory",
        rightIsDir: right?.kind === "directory",
        status: previewSyncStatus(left, right, comparison),
      };
    }),
  };
}

function previewSyncStatus(
  left: FileEntryDto | null,
  right: FileEntryDto | null,
  comparison: SyncDirectoriesRequest["comparison"],
): string {
  if (!left) return "onlyRight";
  if (!right) return "onlyLeft";
  if (comparison === "name") return "same";
  if (comparison === "date") {
    if (left.modifiedAt === right.modifiedAt) return "same";
    if (!right.modifiedAt) return "newerLeft";
    if (!left.modifiedAt) return "newerRight";
    return left.modifiedAt > right.modifiedAt ? "newerLeft" : "newerRight";
  }
  return left.size === right.size && left.kind === right.kind
    ? "same"
    : "different";
}

function defaultNetworkOptions() {
  return {
    ssh: {
      terminalEnv: [],
    },
    smb: {},
    s3: {},
  };
}

function previewNetworkProviders() {
  return [
    {
      scheme: "sftp",
      label: "SFTP",
      category: "server",
      defaultPort: 22,
      authKinds: ["password", "privateKey"],
      fileCapable: true,
      terminalCapable: true,
      status: "available",
      missingDependency: null,
      supportedOptions: [
        "useAgent",
        "sshConfigHost",
        "proxyJump",
        "proxyCommand",
        "keepaliveSecs",
        "compression",
        "addressFamily",
      ],
    },
    {
      scheme: "ssh",
      label: "SSH",
      category: "server",
      defaultPort: 22,
      authKinds: ["password", "privateKey"],
      fileCapable: false,
      terminalCapable: true,
      status: "available",
      missingDependency: null,
      supportedOptions: [
        "useAgent",
        "sshConfigHost",
        "proxyJump",
        "proxyCommand",
        "keepaliveSecs",
        "compression",
        "addressFamily",
        "terminalInitialCommand",
        "terminalEnv",
      ],
    },
    {
      scheme: "smb",
      label: "SMB / CIFS",
      category: "server",
      defaultPort: 445,
      authKinds: ["password"],
      fileCapable: true,
      terminalCapable: false,
      status: "available",
      missingDependency: null,
      supportedOptions: [
        "workgroup",
        "minProtocol",
        "signingMode",
        "sharePath",
      ],
    },
    {
      scheme: "s3",
      label: "S3",
      category: "server",
      defaultPort: 443,
      authKinds: ["accessKey"],
      fileCapable: true,
      terminalCapable: false,
      status: "available",
      missingDependency: null,
      supportedOptions: ["region", "useTls", "pathStyle", "rootPrefix"],
    },
    {
      scheme: "webdav",
      label: "WebDAV",
      category: "server",
      defaultPort: 443,
      authKinds: ["password"],
      fileCapable: false,
      terminalCapable: false,
      status: "unavailable",
      missingDependency: "WebDAV provider is not registered yet.",
      supportedOptions: [],
    },
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
        previewPathUri("Cloud", "Google Drive"),
        "cloud",
      ),
      entry(
        "network:///cloud/onedrive",
        "OneDrive",
        "cloudDrive",
        previewPathUri("Cloud", "OneDrive"),
        "cloud",
      ),
      entry(
        "network:///cloud/icloud",
        "iCloud Drive",
        "cloudDrive",
        previewPathUri("Cloud", "iCloud Drive"),
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
