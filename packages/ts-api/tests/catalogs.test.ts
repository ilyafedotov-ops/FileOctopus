import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FILE_OPERATION_WARNING_CODES, IPC_ERROR_CODES } from "../src";
import { commandMap } from "../src/commandMap";
import * as eventCatalog from "../src/events";

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

function extractRustStringConsts(source: string, moduleName: string): string[] {
  const moduleMatch = source.match(
    new RegExp(`pub mod ${moduleName} \\{([\\s\\S]*?)\\n\\}`, "m"),
  );

  if (!moduleMatch) {
    throw new Error(`module ${moduleName} not found`);
  }

  return [
    ...moduleMatch[1].matchAll(/pub const [A-Z0-9_]+: &str = "([^"]+)";/g),
  ]
    .map((match) => match[1])
    .sort();
}

function extractRustEventConsts(source: string): Record<string, string> {
  return Object.fromEntries(
    [
      ...source.matchAll(/pub const ([A-Z0-9_]+_EVENT): &str = "([^"]+)";/g),
    ].map((match) => [match[1], match[2]]),
  );
}

function extractRegisteredCommands(source: string): string[] {
  const handlerMatch = source.match(
    /tauri::generate_handler!\[\s*([\s\S]*?)\s*\]\)/m,
  );

  if (!handlerMatch) {
    throw new Error("generate_handler registry not found");
  }

  return [...handlerMatch[1].matchAll(/commands::[a-z_]+::([a-z0-9_]+)/g)]
    .map((match) => match[1])
    .sort();
}

function extractPublicTypeNames(source: string): string[] {
  return [...source.matchAll(/pub (?:struct|enum) ([A-Za-z0-9_]+)/g)]
    .map((match) => match[1])
    .sort();
}

function extractApiReferenceCommandCount(source: string): number {
  const countMatch = source.match(/\*\*(\d+) commands\*\*/);

  if (!countMatch) {
    throw new Error("API reference command count not found");
  }

  return Number(countMatch[1]);
}

const generatedIpcContracts = [
  "AppInfoResponse",
  "BatchRenameItemDto",
  "CancelJobRequest",
  "ClearOperationHistoryResponse",
  "ContentSearchCompletedEventDto",
  "ContentSearchJobResponse",
  "ContentSearchMatchDto",
  "ContentSearchMatchEventDto",
  "ContentSearchRequest",
  "ContentSearchResponse",
  "ContentSearchResultDto",
  "DirectoryBatchEventDto",
  "DirectoryEntryDto",
  "FileEntryDto",
  "FileOperationConflictDto",
  "FileOperationItemDto",
  "FileOperationPlanDto",
  "FileOperationRequestDto",
  "FileOperationWarningDto",
  "InstalledPluginDto",
  "JobStatusRequest",
  "JobStatusResponse",
  "ListArchiveRequest",
  "ListArchiveResponse",
  "ListDirectoriesRequest",
  "ListDirectoriesResponse",
  "ListRecentOperationsRequest",
  "ListRecentOperationsResponse",
  "ListStartRequest",
  "ListStartResponse",
  "OperationHistoryRecordDto",
  "PauseJobRequest",
  "PlanFileOperationRequest",
  "PlanFileOperationResponse",
  "PluginInstallRequest",
  "PluginInstallResponse",
  "PluginListResponse",
  "PluginManifestDto",
  "PluginToggleRequest",
  "PluginToggleResponse",
  "PluginUninstallRequest",
  "ResumeJobRequest",
  "StartFileOperationRequest",
  "StartFileOperationResponse",
  "WatchEventDto",
  "WatchStartRequest",
] as const;

const generatedJobContracts = [
  "JobCancelledEvent",
  "JobCompletedEvent",
  "JobFailedEvent",
  "JobPausedEvent",
  "JobProgressEvent",
  "JobResumedEvent",
  "JobSnapshot",
  "JobStartedEvent",
  "JobStatus",
] as const;

const generatedVfsContracts = [
  "ConflictPolicy",
  "FileKind",
  "FileOperationKind",
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractTypeReexports(source: string, modulePath: string): string[] {
  const matches = [
    ...source.matchAll(
      new RegExp(
        `export type \\{([^}]*)\\} from "${escapeRegExp(modulePath)}";`,
        "g",
      ),
    ),
  ];

  if (matches.length === 0) {
    throw new Error(`type re-export from ${modulePath} not found`);
  }

  return matches.flatMap((match) =>
    match[1]
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean),
  );
}

describe("Rust/TS contract mirrors", () => {
  it("keeps IPC error codes aligned with crates/app-ipc", () => {
    const rustSource = readRepoFile("../../../crates/app-ipc/src/lib.rs");
    const rustCodes = extractRustStringConsts(rustSource, "error_codes");
    const tsCodes = Object.values(IPC_ERROR_CODES).sort();

    expect(tsCodes).toEqual(rustCodes);
  });

  it("keeps file-operation warning codes aligned with crates/vfs", () => {
    const rustSource = readRepoFile("../../../crates/vfs/src/lib.rs");
    const rustCodes = extractRustStringConsts(
      rustSource,
      "file_operation_warning_codes",
    );
    const tsCodes = Object.values(FILE_OPERATION_WARNING_CODES).sort();

    expect(tsCodes).toEqual(rustCodes);
  });

  it("keeps event channel constants aligned with crates/app-ipc", () => {
    const rustSource = readRepoFile("../../../crates/app-ipc/src/lib.rs");
    const rustEvents = extractRustEventConsts(rustSource);
    const tsEvents = Object.fromEntries(
      Object.entries(eventCatalog)
        .filter(([key]) => key.endsWith("_EVENT"))
        .sort(([left], [right]) => left.localeCompare(right)),
    );

    expect(tsEvents).toEqual(
      Object.fromEntries(
        Object.entries(rustEvents).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    );
  });

  it("keeps the command map aligned with registered Tauri handlers", () => {
    const rustSource = readRepoFile(
      "../../../apps/desktop-tauri/src-tauri/src/lib.rs",
    );
    const registeredCommands = extractRegisteredCommands(rustSource);
    const mappedCommands = Object.values(commandMap).sort();

    expect(mappedCommands).toEqual(registeredCommands);
  });

  it("keeps the API reference command count aligned with the live registry", () => {
    const rustSource = readRepoFile(
      "../../../apps/desktop-tauri/src-tauri/src/lib.rs",
    );
    const apiReference = readRepoFile(
      "../../../docs/architecture/api-reference.md",
    );

    expect(extractApiReferenceCommandCount(apiReference)).toBe(
      extractRegisteredCommands(rustSource).length,
    );
  });

  it("keeps generated IPC and job contracts authoritative", () => {
    const handwrittenTypes = readRepoFile("../src/types.ts");
    const generatedIpcIndex = readRepoFile("../src/generated/ipc/index.ts");
    const generatedGitIndex = readRepoFile("../src/generated/git/index.ts");
    const generatedJobsIndex = readRepoFile("../src/generated/jobs/index.ts");
    const generatedVfsIndex = readRepoFile("../src/generated/vfs/index.ts");
    const ipcReexports = extractTypeReexports(
      handwrittenTypes,
      "./generated/ipc",
    );
    const gitReexports = extractTypeReexports(
      handwrittenTypes,
      "./generated/git",
    );
    const jobReexports = extractTypeReexports(
      handwrittenTypes,
      "./generated/jobs",
    );
    const vfsReexports = extractTypeReexports(
      handwrittenTypes,
      "./generated/vfs",
    );
    const authoritativeModules = [
      "acl",
      "app_info",
      "common",
      "compare",
      "diagnostics",
      "file_operations",
      "fs",
      "git",
      "listing",
      "locations",
      "navigation",
      "network",
      "plugins",
      "preferences",
      "search",
      "sync",
      "terminal",
    ];
    const rustModuleContracts = authoritativeModules.flatMap((moduleName) =>
      extractPublicTypeNames(
        readRepoFile(`../../../crates/app-ipc/src/${moduleName}.rs`),
      ),
    );
    const authoritativeIpcContracts = [
      ...new Set([...generatedIpcContracts, ...rustModuleContracts]),
    ];

    for (const name of authoritativeIpcContracts) {
      expect(handwrittenTypes).not.toMatch(
        new RegExp(`export\\s+(?:interface|type)\\s+${escapeRegExp(name)}\\b`),
      );
      expect(generatedIpcIndex).toContain(`export type { ${name} }`);
      expect(ipcReexports).toContain(name);
    }

    for (const name of generatedJobContracts) {
      expect(handwrittenTypes).not.toMatch(
        new RegExp(`export\\s+(?:interface|type)\\s+${escapeRegExp(name)}\\b`),
      );
      expect(generatedJobsIndex).toContain(`export type { ${name} }`);
      expect(jobReexports).toContain(name);
    }

    for (const name of generatedVfsContracts) {
      expect(handwrittenTypes).not.toMatch(
        new RegExp(`export\\s+(?:interface|type)\\s+${escapeRegExp(name)}\\b`),
      );
      expect(generatedVfsIndex).toContain(`export type { ${name} }`);
      expect(vfsReexports).toContain(name);
    }

    expect(generatedGitIndex).toContain(
      'export type { GitFileStatus } from "./GitFileStatus";',
    );
    expect(gitReexports).toContain("GitFileStatus");
  });

  it("keeps selected clients wired to generated camelCase contracts", () => {
    const rootClient = readRepoFile("../src/client.ts");
    const fsClient = readRepoFile("../src/clients/fs.ts");
    const fileOperationsClient = readRepoFile(
      "../src/clients/fileOperations.ts",
    );
    const historyClient = readRepoFile("../src/clients/history.ts");
    const jobsClient = readRepoFile("../src/clients/jobs.ts");
    const diagnosticsClient = readRepoFile("../src/clients/diagnostics.ts");
    const gitClient = readRepoFile("../src/clients/git.ts");
    const navigationClient = readRepoFile("../src/clients/navigation.ts");
    const networkClient = readRepoFile("../src/clients/network.ts");
    const pluginClient = readRepoFile("../src/clients/plugin.ts");
    const preferencesClient = readRepoFile("../src/clients/preferences.ts");
    const terminalClient = readRepoFile("../src/clients/terminal.ts");
    const previewTransport = readRepoFile("../src/transports/preview.ts");
    const appInfo = readRepoFile("../src/generated/ipc/AppInfoResponse.ts");
    const contentSearch = readRepoFile(
      "../src/generated/ipc/ContentSearchRequest.ts",
    );
    const pluginManifest = readRepoFile(
      "../src/generated/ipc/PluginManifestDto.ts",
    );
    const jobProgress = readRepoFile(
      "../src/generated/jobs/JobProgressEvent.ts",
    );
    const fileEntry = readRepoFile("../src/generated/ipc/FileEntryDto.ts");
    const directoryBatch = readRepoFile(
      "../src/generated/ipc/DirectoryBatchEventDto.ts",
    );
    const fileOperationRequest = readRepoFile(
      "../src/generated/ipc/FileOperationRequestDto.ts",
    );

    expect(rootClient).toContain('from "./generated/ipc"');
    expect(fsClient).toContain('from "../generated/ipc"');
    expect(fsClient).toContain("IpcInput<ContentSearchRequest>");
    expect(fsClient).toContain("IpcInput<ListStartRequest>");
    expect(fileOperationsClient).toContain('from "../generated/ipc"');
    expect(fileOperationsClient).toContain('from "../generated/jobs"');
    expect(fileOperationsClient).toContain("PlanFileOperationInput");
    expect(historyClient).toContain('from "../generated/ipc"');
    expect(historyClient).toContain("IpcInput<ListRecentOperationsRequest>");
    expect(jobsClient).toContain('from "../generated/ipc"');
    expect(diagnosticsClient).toContain('from "../generated/ipc"');
    expect(gitClient).toContain('from "../generated/ipc"');
    expect(gitClient).toContain("IpcInput<GitRevisionFilesRequest>");
    expect(navigationClient).toContain('from "../generated/ipc"');
    expect(networkClient).toContain('from "../generated/ipc"');
    expect(networkClient).toContain("NetworkProfileTestInput");
    expect(pluginClient).toContain('from "../generated/ipc"');
    expect(preferencesClient).toContain('from "../generated/ipc"');
    expect(terminalClient).toContain('from "../generated/ipc"');
    expect(terminalClient).toContain("TerminalSpawnAndRunInput");
    expect(previewTransport).toContain('from "../generated/ipc"');
    expect(appInfo).toContain("buildProfile: string");
    expect(contentSearch).toContain("caseSensitive: boolean | null");
    expect(pluginManifest).toContain("minAppVersion: string | null");
    expect(jobProgress).toContain("currentItem: string | null");
    expect(fileEntry).toContain("isPlaceholder: boolean");
    expect(directoryBatch).toContain("totalHint: number | null");
    expect(fileOperationRequest).toContain(
      "batchRenames: Array<BatchRenameItemDto>",
    );
  });

  it("keeps nullable generated request keys optional at client call sites", () => {
    const inputHelper = readRepoFile("../src/input.ts");

    expect(inputHelper).toContain("null extends T[K] ? K : never");
    expect(inputHelper).toContain(
      "Partial<Pick<T, OptionalInputKeys<T, DefaultedKeys>>>",
    );
    expect(inputHelper).toContain('"batchRenames"');
    expect(inputHelper).toContain("operation: FileOperationRequestInput");
    expect(inputHelper).toContain("NetworkProtocolOptionsInput");
    expect(inputHelper).toContain("NetworkProfileTestInput");
    expect(inputHelper).toContain("TerminalProfileInput");
    expect(inputHelper).toContain("TerminalSpawnAndRunInput");
  });

  it("keeps only TS-specific declarations handwritten", () => {
    const handwrittenTypes = readRepoFile("../src/types.ts");
    const declarations = [
      ...handwrittenTypes.matchAll(
        /^export (?:interface|type) ([A-Za-z0-9_]+)/gm,
      ),
    ]
      .map((match) => match[1])
      .sort();

    expect(declarations).toEqual(
      [
        "FileOperationWarningCode",
        "GitFileStatusDto",
        "IpcError",
        "IpcErrorCode",
        "IpcTransport",
        "KnownFileOperationWarningCode",
        "KnownIpcErrorCode",
        "NetworkConnectionDraftDto",
        "NetworkStatusEvent",
        "TerminalExitEvent",
        "TerminalOutputEvent",
        "UnlistenFn",
      ].sort(),
    );
  });
});
