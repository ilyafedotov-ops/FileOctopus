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
    diagnosticsExportPath: "/tmp/fileoctopus-diagnostics.zip",
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

      if (command === "git.discover") {
        const request = args?.request as { uri?: string } | undefined;
        return {
          repo: {
            rootUri: request?.uri ?? "local:///Users/ilya/Documents",
            branch: "main",
            headShort: "preview",
            isDirty: true,
          },
        } as TResponse;
      }

      if (command === "git.statusForDirectory") {
        const request = args?.request as { uri?: string } | undefined;
        const rootUri = request?.uri ?? "local:///Users/ilya/Documents";
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
        const rootUri = request?.uri ?? "local:///Users/ilya/Documents";
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
        const uri = request?.uri ?? "local:///Users/ilya/Documents/README.md";
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
          defaultShell: "/bin/bash",
          defaultArgs: ["-l"],
          discoveredShells: ["/bin/bash", "/bin/zsh"],
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
