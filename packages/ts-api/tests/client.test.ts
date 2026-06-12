import { describe, expect, it, vi } from "vitest";
import {
  DIAGNOSTICS_LOG_EVENT,
  DIRECTORY_BATCH_EVENT,
  FOLDER_SIZE_COMPLETED_EVENT,
  FileOctopusClient,
  IPC_ERROR_CODES,
  FILE_OPERATION_WARNING_CODES,
  NATIVE_MENU_COMMAND_EVENT,
  RECURSIVE_SEARCH_COMPLETED_EVENT,
  RECURSIVE_SEARCH_MATCH_EVENT,
  isKnownFileOperationWarningCode,
  isKnownIpcErrorCode,
  normalizeIpcError,
  createTauriTransport,
} from "../src";
import type { IpcTransport } from "../src/types";

const tauriMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: tauriMocks.invoke,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: tauriMocks.listen,
}));

describe("FileOctopusClient", () => {
  it("routes app info through the transport", async () => {
    const calls: string[] = [];
    const transport: IpcTransport = {
      async invoke<TResponse>(command: string) {
        calls.push(command);
        return {
          name: "FileOctopus",
          version: "0.1.0",
          buildProfile: "debug",
          commitSha: null,
          targetOs: "linux",
          dataDir: "/tmp/fileoctopus",
          networkEnabled: true,
        } as TResponse;
      },
    };

    const client = new FileOctopusClient(transport);
    const response = await client.getAppInfo();

    expect(response.name).toBe("FileOctopus");
    expect(response.targetOs).toBe("linux");
    expect(calls).toEqual(["app.get_info"]);
  });

  it("routes filesystem stat and list start through the fs client", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> =
      [];
    const transport: IpcTransport = {
      async invoke<TResponse>(command: string, args?: Record<string, unknown>) {
        calls.push({ command, args });

        if (command === "fs.stat") {
          return {
            entry: { uri: "local:///tmp", name: "tmp", kind: "directory" },
          } as TResponse;
        }

        return { sessionId: "session-1", requestId: "req-1" } as TResponse;
      },
    };

    const client = new FileOctopusClient(transport);

    await client.fs.stat({ uri: "local:///tmp" });
    const list = await client.fs.listStart({
      uri: "local:///tmp",
      requestId: "req-1",
      panelId: "left",
      batchSize: 128,
    });

    expect(list.sessionId).toBe("session-1");
    expect(list.requestId).toBe("req-1");
    expect(calls.map((call) => call.command)).toEqual([
      "fs.stat",
      "fs.list_start",
    ]);
    expect(calls[1]?.args).toMatchObject({
      request: {
        uri: "local:///tmp",
        requestId: "req-1",
        panelId: "left",
        batchSize: 128,
      },
    });
  });

  it("routes advanced terminal commands through the terminal client", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> =
      [];
    const subscribed: string[] = [];
    const transport: IpcTransport = {
      async invoke<TResponse>(command: string, args?: Record<string, unknown>) {
        calls.push({ command, args });
        if (command === "terminal.capabilities") {
          return {
            defaultShell: "/bin/bash",
            defaultArgs: ["-l"],
            discoveredShells: ["/bin/bash"],
            supportsSsh: true,
            cursorStyles: ["block"],
            themeIds: ["system"],
          } as TResponse;
        }
        if (command === "terminal.profilesList") {
          return { profiles: [], defaultProfileId: null } as TResponse;
        }
        if (command === "terminal.sessionsList") {
          return { sessions: [] } as TResponse;
        }
        if (command === "terminal.spawnAndRun") {
          return { sessionId: "terminal-1" } as TResponse;
        }
        return { success: true } as TResponse;
      },
      async listen(event) {
        subscribed.push(event);
        return () => {};
      },
    };
    const client = new FileOctopusClient(transport);

    await client.terminal.capabilities();
    await client.terminal.listProfiles();
    await client.terminal.listSessions();
    await client.terminal.sendText({ sessionId: "terminal-1", text: "pwd" });
    await client.terminal.runCommand({
      sessionId: "terminal-1",
      command: "pwd",
      appendNewline: true,
      focus: true,
    });
    await client.terminal.spawnAndRun({
      uri: "local:///tmp",
      terminalProfileId: "profile-1",
      cols: 80,
      rows: 24,
      command: "cargo test",
      title: "Tests",
    });
    await client.terminal.onSession(() => {});

    expect(calls.map((call) => call.command)).toEqual([
      "terminal.capabilities",
      "terminal.profilesList",
      "terminal.sessionsList",
      "terminal.sendText",
      "terminal.runCommand",
      "terminal.spawnAndRun",
    ]);
    expect(subscribed).toEqual(["terminal:session"]);
  });

  it("routes Sprint 4 baseline filesystem commands through typed clients", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> =
      [];
    const transport: IpcTransport = {
      async invoke<TResponse>(command: string, args?: Record<string, unknown>) {
        calls.push({ command, args });

        if (command === "fs.standard_locations") {
          return {
            locations: [
              {
                id: "home",
                name: "Home",
                uri: "local:///Users/ilya",
                section: "Favorites",
              },
            ],
          } as TResponse;
        }

        if (command === "fs.properties") {
          return {
            properties: {
              uri: "local:///tmp/a.txt",
              name: "a.txt",
              kind: "file",
              size: 1,
              totalSize: null,
              itemCount: null,
              fileCount: null,
              directoryCount: null,
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
              totalSize: 1,
              itemCount: 1,
              fileCount: 1,
              directoryCount: 0,
              warnings: [],
              incomplete: false,
            },
          } as TResponse;
        }

        if (command === "fs.folder_size_start") {
          return {
            job: {
              jobId: "folder-job",
              operationKind: "folderSize",
              status: "running",
              completedItems: 0,
              totalItems: 0,
              completedBytes: 0,
              startedAt: new Date(0).toISOString(),
              updatedAt: new Date(0).toISOString(),
            },
          } as TResponse;
        }

        if (command === "fs.recursive_search") {
          return {
            result: { matches: [], warnings: [], incomplete: false },
          } as TResponse;
        }

        if (command === "fs.recursive_search_start") {
          return {
            job: {
              jobId: "search-job",
              operationKind: "recursiveSearch",
              status: "running",
              completedItems: 0,
              totalItems: 0,
              completedBytes: 0,
              startedAt: new Date(0).toISOString(),
              updatedAt: new Date(0).toISOString(),
            },
          } as TResponse;
        }

        return { ok: true } as TResponse;
      },
    };
    const client = new FileOctopusClient(transport);

    await client.fs.standardLocations();
    await client.fs.openPathWithDefaultApp({ uri: "local:///tmp/a.txt" });
    await client.fs.revealPathInFileManager({ uri: "local:///tmp/a.txt" });
    await client.fs.properties({
      uri: "local:///tmp/a.txt",
      includeFolderSummary: true,
    });
    await client.fs.folderSize({ uri: "local:///tmp" });
    await client.fs.startFolderSizeJob({ uri: "local:///tmp" });
    await client.fs.recursiveSearch({
      uri: "local:///tmp",
      query: "needle",
      limit: 100,
    });
    await client.fs.startRecursiveSearchJob({
      uri: "local:///tmp",
      query: "needle",
      limit: 100,
    });
    await client.fs.startWatching({ uri: "local:///tmp" });
    await client.fs.stopWatching();

    expect(calls.map((call) => call.command)).toEqual([
      "fs.standard_locations",
      "fs.open_default",
      "fs.reveal",
      "fs.properties",
      "fs.folder_size",
      "fs.folder_size_start",
      "fs.recursive_search",
      "fs.recursive_search_start",
      "fs.watch_start",
      "fs.watch_stop",
    ]);
  });

  it("subscribes to Sprint 4 metadata job events", async () => {
    const subscribed: string[] = [];
    const transport: IpcTransport = {
      async invoke<TResponse>() {
        return {} as TResponse;
      },
      async listen(event, handler) {
        subscribed.push(event);

        if (event === FOLDER_SIZE_COMPLETED_EVENT) {
          handler({
            jobId: "folder-job",
            uri: "local:///tmp",
            summary: {
              totalSize: 1,
              itemCount: 1,
              fileCount: 1,
              directoryCount: 0,
              warnings: [],
              incomplete: false,
            },
          });
        }

        if (event === RECURSIVE_SEARCH_MATCH_EVENT) {
          handler({
            jobId: "search-job",
            uri: "local:///tmp",
            query: "needle",
            item: {
              uri: "local:///tmp/needle.txt",
              parentUri: "local:///tmp",
              name: "needle.txt",
              kind: "file",
            },
          });
        }

        if (event === RECURSIVE_SEARCH_COMPLETED_EVENT) {
          handler({
            jobId: "search-job",
            uri: "local:///tmp",
            query: "needle",
            result: { matches: [], warnings: [], incomplete: false },
          });
        }

        return () => undefined;
      },
    };
    const client = new FileOctopusClient(transport);
    const seen: string[] = [];

    await client.fs.onFolderSizeCompleted((event) => seen.push(event.jobId));
    await client.fs.onRecursiveSearchMatch((event) =>
      seen.push(event.item.name),
    );
    await client.fs.onRecursiveSearchCompleted((event) =>
      seen.push(event.jobId),
    );

    expect(subscribed).toEqual([
      FOLDER_SIZE_COMPLETED_EVENT,
      RECURSIVE_SEARCH_MATCH_EVENT,
      RECURSIVE_SEARCH_COMPLETED_EVENT,
    ]);
    expect(seen).toEqual(["folder-job", "needle.txt", "search-job"]);
  });

  it("subscribes to directory batch events", async () => {
    let subscribedEvent = "";
    const transport: IpcTransport = {
      async invoke<TResponse>() {
        return {} as TResponse;
      },
      async listen(event, handler) {
        subscribedEvent = event;
        handler({
          sessionId: "session-1",
          uri: "local:///tmp",
          entries: [],
          batchIndex: 0,
          isComplete: true,
        });
        return () => undefined;
      },
    };
    const client = new FileOctopusClient(transport);
    const events: string[] = [];

    await client.fs.onDirectoryBatch((event) => events.push(event.sessionId));

    expect(subscribedEvent).toBe(DIRECTORY_BATCH_EVENT);
    expect(events).toEqual(["session-1"]);
  });

  it("subscribes to native menu command events", async () => {
    let subscribedEvent = "";
    const transport: IpcTransport = {
      async invoke<TResponse>() {
        return {} as TResponse;
      },
      async listen(event, handler) {
        subscribedEvent = event;
        handler({
          commandId: "view.sort",
          sortField: "owner",
        });
        return () => undefined;
      },
    };
    const client = new FileOctopusClient(transport);
    const events: string[] = [];

    await client.onNativeMenuCommand((event) => {
      events.push(`${event.commandId}:${event.sortField}`);
    });

    expect(subscribedEvent).toBe(NATIVE_MENU_COMMAND_EVENT);
    expect(events).toEqual(["view.sort:owner"]);
  });

  it("routes file operation and job commands through typed clients", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> =
      [];
    const transport: IpcTransport = {
      async invoke<TResponse>(command: string, args?: Record<string, unknown>) {
        calls.push({ command, args });

        if (command === "fileOperation.plan") {
          return {
            plan: {
              operationId: "op-1",
              kind: "copy",
              sources: ["local:///tmp/a.txt"],
              destination: "local:///tmp/dest",
              conflictPolicy: "fail",
              items: [],
              conflicts: [],
              warnings: [],
              totalItems: 0,
            },
          } as TResponse;
        }

        if (command === "operationHistory.listRecent") {
          return { operations: [] } as TResponse;
        }

        if (command === "diagnostics.appDataHealth") {
          return {
            configDir: "~/.fileoctopus/config",
            dataDir: "~/.fileoctopus",
            logDir: "~/.fileoctopus/logs",
            databasePath: "~/.fileoctopus/operation-history.sqlite",
            databaseExists: true,
            schemaVersion: 1,
            missingDirectories: [],
            startupRecoveryCount: 0,
          } as TResponse;
        }

        if (command === "diagnostics.exportBundle") {
          return { path: "/tmp/fileoctopus.zip", files: [] } as TResponse;
        }

        if (command === "operationHistory.clear") {
          return { deletedCount: 1 } as TResponse;
        }

        return {
          job: {
            jobId: "job-1",
            operationKind: "copy",
            status: "running",
            completedItems: 0,
            totalItems: 1,
            completedBytes: 0,
            startedAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString(),
          },
        } as TResponse;
      },
      async listen(event, handler) {
        handler({
          jobId: "job-1",
          operationKind: "copy",
          completedItems: 0,
          totalItems: 1,
          completedBytes: 0,
          updatedAt: new Date(0).toISOString(),
        });
        return () => undefined;
      },
    };
    const client = new FileOctopusClient(transport);
    const events: string[] = [];

    await client.fileOperations.planFileOperation({
      operation: {
        kind: "copy",
        sources: ["local:///tmp/a.txt"],
        destination: "local:///tmp/dest",
      },
    });
    await client.fileOperations.startFileOperation({
      operationId: "op-1",
    });
    await client.jobs.cancelJob({ jobId: "job-1" });
    await client.jobs.getJobStatus({ jobId: "job-1" });
    await client.operationHistory.listRecentOperations({ limit: 10 });
    await client.operationHistory.clearOperationHistory();
    await client.diagnostics.appDataHealth();
    await client.diagnostics.exportBundle({
      destination: "/tmp/fileoctopus.zip",
    });
    await client.fileOperations.onJobProgress((event) =>
      events.push(String(event.jobId)),
    );

    expect(calls.map((call) => call.command)).toEqual([
      "fileOperation.plan",
      "fileOperation.start",
      "job.cancel",
      "job.status",
      "operationHistory.listRecent",
      "operationHistory.clear",
      "diagnostics.appDataHealth",
      "diagnostics.exportBundle",
    ]);
    expect(events).toEqual(["job-1"]);
  });

  it("routes diagnostics log streaming through the diagnostics client", async () => {
    const calls: string[] = [];
    let subscribedEvent = "";
    const transport: IpcTransport = {
      async invoke<TResponse>(command: string) {
        calls.push(command);
        return undefined as unknown as TResponse;
      },
      async listen(event, handler) {
        subscribedEvent = event;
        handler({
          level: "INFO",
          target: "fs_core::listing",
          message: "listed 3 entries",
          timestampMs: 1000,
        });
        return () => undefined;
      },
    };
    const client = new FileOctopusClient(transport);
    const records: string[] = [];

    await client.diagnostics.onLogRecord((record) =>
      records.push(`${record.level}:${record.message}`),
    );
    await client.diagnostics.startLogStream();
    await client.diagnostics.stopLogStream();

    expect(subscribedEvent).toBe(DIAGNOSTICS_LOG_EVENT);
    expect(records).toEqual(["INFO:listed 3 entries"]);
    expect(calls).toEqual([
      "diagnostics.startLogStream",
      "diagnostics.stopLogStream",
    ]);
  });

  it("routes preferences through the preferences client", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> =
      [];
    const transport: IpcTransport = {
      async invoke<TResponse>(command: string, args?: Record<string, unknown>) {
        calls.push({ command, args });

        if (command === "preferences.get") {
          return {
            preferences: {
              theme: "system",
              density: "comfortable",
              defaultViewMode: "details",
              showHiddenFiles: false,
              sidebarWidth: 240,
              splitRatio: 0.5,
              activityPanelVisible: false,
              activityPanelWidth: 288,
              paneMode: "dual",
              jobDrawerBehavior: "manual",
            },
          } as TResponse;
        }

        return {
          preferences: {
            theme: "dark",
            density: "comfortable",
            defaultViewMode: "details",
            showHiddenFiles: false,
            sidebarWidth: 240,
            splitRatio: 0.5,
            activityPanelVisible: false,
            activityPanelWidth: 288,
            paneMode: "dual",
            jobDrawerBehavior: "manual",
          },
        } as TResponse;
      },
    };

    const client = new FileOctopusClient(transport);
    const initial = await client.preferences.get();
    const updated = await client.preferences.set({
      key: "theme",
      value: "dark",
    });

    expect(initial.preferences.theme).toBe("system");
    expect(updated.preferences.theme).toBe("dark");
    expect(calls.map((call) => call.command)).toEqual([
      "preferences.get",
      "preferences.set",
    ]);
    expect(calls[1]?.args).toEqual({
      request: { key: "theme", value: "dark" },
    });
  });

  it("routes navigation commands through the navigation client", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> =
      [];
    const transport: IpcTransport = {
      async invoke<TResponse>(command: string, args?: Record<string, unknown>) {
        calls.push({ command, args });

        if (command === "navigation.listFavorites") {
          return { favorites: [] } as TResponse;
        }

        if (command === "navigation.toggleStarred") {
          return { starred: true } as TResponse;
        }

        return { ok: true } as TResponse;
      },
    };

    const client = new FileOctopusClient(transport);

    await client.navigation.recordVisit({
      uri: "local:///tmp",
      label: "tmp",
    });
    const favorites = await client.navigation.listFavorites();
    const starred = await client.navigation.toggleStarred({
      uri: "local:///tmp",
      label: "tmp",
    });

    expect(favorites.favorites).toEqual([]);
    expect(starred.starred).toBe(true);
    expect(calls.map((call) => call.command)).toEqual([
      "navigation.recordVisit",
      "navigation.listFavorites",
      "navigation.toggleStarred",
    ]);
    expect(calls[0]?.args).toEqual({
      request: { uri: "local:///tmp", label: "tmp" },
    });
  });

  it("normalizes frontend-safe ipc errors", () => {
    expect(
      normalizeIpcError({
        code: IPC_ERROR_CODES.NOT_FOUND,
        message: "missing",
      }),
    ).toEqual({
      code: IPC_ERROR_CODES.NOT_FOUND,
      message: "missing",
    });
    expect(normalizeIpcError("boom")).toEqual({
      code: IPC_ERROR_CODES.UNKNOWN,
      message: "boom",
    });
  });

  it("routes git discovery and status through the git client", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> =
      [];
    const transport: IpcTransport = {
      async invoke<TResponse>(command: string, args?: Record<string, unknown>) {
        calls.push({ command, args });

        if (command === "git.discover") {
          return {
            repo: {
              rootUri: "local:///repo",
              branch: "main",
              headShort: "abcdef1",
              isDirty: true,
            },
          } as TResponse;
        }

        if (command === "git.statusForRepository") {
          return {
            repo: {
              rootUri: "local:///repo",
              branch: "main",
              headShort: "abcdef1",
              isDirty: true,
            },
            files: [
              {
                uri: "local:///repo/changed.txt",
                repoRelativePath: "changed.txt",
                status: "modified",
                previousUri: null,
                previousRepoRelativePath: null,
              },
            ],
          } as TResponse;
        }

        if (command === "git.diffFile") {
          return {
            repo: null,
            file: {
              uri: "local:///repo/changed.txt",
              repoRelativePath: "changed.txt",
              status: "modified",
              previousUri: null,
              previousRepoRelativePath: null,
            },
            oldLabel: "HEAD:changed.txt",
            newLabel: "Worktree:changed.txt",
            hunks: [],
            oldLineCount: 1,
            newLineCount: 1,
            oldTruncated: false,
            newTruncated: false,
            binary: false,
            unsupportedReason: null,
          } as TResponse;
        }

        return {
          repo: null,
          entries: {
            "local:///repo/changed.txt": "modified",
          },
        } as TResponse;
      },
    };

    const client = new FileOctopusClient(transport);
    const discovery = await client.git.discover({ uri: "local:///repo" });
    const status = await client.git.statusForDirectory({
      uri: "local:///repo",
    });
    const repositoryStatus = await client.git.statusForRepository({
      uri: "local:///repo",
    });
    const diff = await client.git.diffFile({
      uri: "local:///repo/changed.txt",
    });

    expect(discovery.repo?.branch).toBe("main");
    expect(status.entries["local:///repo/changed.txt"]).toBe("modified");
    expect(repositoryStatus.files[0]?.repoRelativePath).toBe("changed.txt");
    expect(diff.oldLabel).toBe("HEAD:changed.txt");
    expect(calls.map((call) => call.command)).toEqual([
      "git.discover",
      "git.statusForDirectory",
      "git.statusForRepository",
      "git.diffFile",
    ]);
    expect(calls[1]?.args).toEqual({
      request: { uri: "local:///repo" },
    });
    expect(calls[3]?.args).toEqual({
      request: { uri: "local:///repo/changed.txt" },
    });
  });

  it("exports typed error and warning catalogs", () => {
    expect(isKnownIpcErrorCode(IPC_ERROR_CODES.TIMEOUT)).toBe(true);
    expect(isKnownIpcErrorCode(IPC_ERROR_CODES.CONNECTION_REQUIRED)).toBe(true);
    expect(isKnownIpcErrorCode("definitely_not_real")).toBe(false);
    expect(
      isKnownFileOperationWarningCode(
        FILE_OPERATION_WARNING_CODES.METADATA_FAILED,
      ),
    ).toBe(true);
    expect(isKnownFileOperationWarningCode("unknown_warning")).toBe(false);
  });

  it("routes network profile commands through the network client", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> =
      [];
    const transport: IpcTransport = {
      async invoke<TResponse>(command: string, args?: Record<string, unknown>) {
        calls.push({ command, args });
        if (command === "network.profilesList") {
          return { profiles: [] } as TResponse;
        }
        if (command === "network.connect") {
          return { ok: true } as TResponse;
        }
        return { ok: true } as TResponse;
      },
    };

    const client = new FileOctopusClient(transport);
    await client.network.listProfiles();
    await client.network.connect({ id: "profile-1" });
    await client.network.trustFingerprint({
      id: "profile-1",
      fingerprint: "SHA256:abc",
    });

    expect(calls.map((call) => call.command)).toEqual([
      "network.profilesList",
      "network.connect",
      "network.profileTrustFingerprint",
    ]);
    expect(calls[1]?.args).toEqual({ request: { id: "profile-1" } });
    expect(calls[2]?.args).toEqual({
      request: { id: "profile-1", fingerprint: "SHA256:abc" },
    });
  });

  it("routes network.discoverNeighborhood through the network client", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> =
      [];
    const transport: IpcTransport = {
      async invoke<TResponse>(command: string, args?: Record<string, unknown>) {
        calls.push({ command, args });
        return {
          uri: "network:///",
          entries: [
            {
              uri: "network:///cloud",
              name: "Cloud Storage",
              extension: null,
              kind: "directory",
              size: null,
              modifiedAt: null,
              createdAt: null,
              accessedAt: null,
              isHidden: false,
              isSymlink: false,
              symlinkTarget: null,
              providerId: "network",
              canRead: false,
              canList: true,
              canWrite: false,
              canDelete: false,
              canRename: false,
              virtualKind: "group",
            },
          ],
        } as TResponse;
      },
    };

    const client = new FileOctopusClient(transport);
    const response = await client.network.discoverNeighborhood({
      uri: "network:///",
    });

    expect(calls.map((call) => call.command)).toEqual([
      "network.discoverNeighborhood",
    ]);
    expect(calls[0]?.args).toEqual({ request: { uri: "network:///" } });
    expect(response.entries[0].virtualKind).toBe("group");
  });

  it("normalizes IPC errors thrown by network.discoverNeighborhood", async () => {
    const transport: IpcTransport = {
      async invoke<TResponse>() {
        throw {
          code: IPC_ERROR_CODES.NOT_FOUND,
          message: "no such uri",
        };
        return undefined as unknown as TResponse;
      },
    };
    const client = new FileOctopusClient(transport);

    await expect(
      client.network.discoverNeighborhood({ uri: "network:///oops" }),
    ).rejects.toEqual({
      code: IPC_ERROR_CODES.NOT_FOUND,
      message: "no such uri",
    });
  });

  it("returns idempotent Tauri event unlisteners", async () => {
    const nativeUnlisten = vi.fn();
    tauriMocks.listen.mockResolvedValue(nativeUnlisten);

    const unlisten = await createTauriTransport().listen?.(
      "directory:batch",
      () => {},
    );

    unlisten?.();
    unlisten?.();

    expect(tauriMocks.listen).toHaveBeenCalledTimes(1);
    expect(nativeUnlisten).toHaveBeenCalledTimes(1);
  });

  it("absorbs rejected Tauri unlisten promises", async () => {
    const nativeUnlisten = vi.fn(() =>
      Promise.reject(
        new TypeError(
          "undefined is not an object (evaluating 'listeners[eventId].handlerId')",
        ),
      ),
    );
    tauriMocks.listen.mockResolvedValue(nativeUnlisten);

    const unlisten = await createTauriTransport().listen?.(
      "directory:batch",
      () => {},
    );

    unlisten?.();
    await Promise.resolve();

    expect(nativeUnlisten).toHaveBeenCalledTimes(1);
  });
});
