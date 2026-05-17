import { describe, expect, it } from "vitest";
import {
  DIRECTORY_BATCH_EVENT,
  FOLDER_SIZE_COMPLETED_EVENT,
  FileOctopusClient,
  RECURSIVE_SEARCH_COMPLETED_EVENT,
  RECURSIVE_SEARCH_MATCH_EVENT,
  normalizeIpcError,
} from "../src/client";
import type { IpcTransport } from "../src/types";

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

        if (command === "fs.create_file") {
          return {
            entry: {
              uri: "local:///tmp/new.txt",
              name: "new.txt",
              kind: "file",
              size: 0,
              isHidden: false,
              isSymlink: false,
              providerId: "local",
              canRead: true,
              canList: false,
              canWrite: false,
              canDelete: false,
              canRename: false,
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
    await client.fs.createFile({ uri: "local:///tmp/new.txt" });
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
    await client.fs.deletePermanently({ uris: ["local:///tmp/a.txt"] });
    await client.fs.startWatching({ uri: "local:///tmp" });
    await client.fs.stopWatching();

    expect(calls.map((call) => call.command)).toEqual([
      "fs.standard_locations",
      "fs.open_default",
      "fs.reveal",
      "fs.create_file",
      "fs.properties",
      "fs.folder_size",
      "fs.folder_size_start",
      "fs.recursive_search",
      "fs.recursive_search_start",
      "fs.delete_permanently",
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
              activityPanelVisible: true,
              activityPanelWidth: 288,
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
            activityPanelVisible: true,
            activityPanelWidth: 288,
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
      normalizeIpcError({ code: "not_found", message: "missing" }),
    ).toEqual({
      code: "not_found",
      message: "missing",
    });
    expect(normalizeIpcError("boom")).toEqual({
      code: "unknown",
      message: "boom",
    });
  });
});
