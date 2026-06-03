import type { FileEntryDto } from "@fileoctopus/ts-api";
import { normalizeIpcError } from "@fileoctopus/ts-api";
import type { PanelId } from "../../panelStore";
import { activeTab, parentUri, selectVisibleEntries } from "../../panelStore";
import {
  jobIdValue,
  operationErrorMessage,
} from "../../dialogs/OperationDialogView";
import type { OperationDialog } from "../../dialogs/OperationDialogView";
import type { UseFileOpHandlersDeps } from "./types";
import { useOperationCore, type OperationCore } from "./useOperationCore";

function fileSizeBaseline(entries: FileEntryDto[]): number {
  return entries
    .filter((entry) => entry.kind !== "directory")
    .reduce((sum, entry) => sum + (entry.size ?? 0), 0);
}

export function useMetadataHandlers(
  deps: UseFileOpHandlersDeps,
  coreOverride?: OperationCore,
) {
  const {
    client,
    state,
    dispatch,
    setSearch,
    setDialog,
    setOperationError,
    pushToast,
    refreshPanel,
    navigatePanel,
  } = deps;

  const { selectedEntries } = coreOverride ?? useOperationCore(deps);

  async function openExternal(entry: FileEntryDto) {
    setOperationError(null);

    try {
      await client.fs.openPathWithDefaultApp({ uri: entry.uri });
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setOperationError(
        operationErrorMessage(normalized.code, normalized.message),
      );
    }
  }

  async function revealEntry(panelId: PanelId, entry: FileEntryDto | null) {
    if (!entry) {
      return;
    }

    try {
      await client.fs.revealPathInFileManager({ uri: entry.uri });
    } catch {
      const parent = parentUri(entry.uri);

      if (parent) {
        await navigatePanel(panelId, parent);
        dispatch({ type: "setSelection", panelId, entryId: entry.uri });
      }
    }
  }

  async function calculateSize(panelId: PanelId, entry: FileEntryDto | null) {
    if (!entry || entry.kind !== "directory") {
      return;
    }

    setDialog({
      type: "properties",
      panelId,
      entry,
      properties: null,
      loading: true,
      folderSizeJobId: null,
      error: null,
    });

    try {
      const response = await client.fs.properties({
        uri: entry.uri,
        includeFolderSummary: false,
      });

      setDialog({
        type: "properties",
        panelId,
        entry,
        properties: response.properties,
        loading: true,
        folderSizeJobId: null,
        error: null,
      });

      const result = await client.fs.startFolderSizeJob({ uri: entry.uri });
      setDialog((current) =>
        current?.type === "properties" &&
        current.panelId === panelId &&
        current.properties?.uri === entry.uri
          ? {
              ...current,
              loading: true,
              folderSizeJobId: jobIdValue(result.job.jobId),
            }
          : current,
      );
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setDialog((current) =>
        current?.type === "properties" && current.panelId === panelId
          ? {
              ...current,
              loading: false,
              error: operationErrorMessage(normalized.code, normalized.message),
            }
          : current,
      );
      setOperationError(
        operationErrorMessage(normalized.code, normalized.message),
      );
    }
  }

  async function handleProperties(
    panelId: PanelId,
    entry: FileEntryDto | null,
    focusPermissions = false,
  ) {
    let entries = selectedEntries(panelId);

    if (entries.length === 0 && entry) {
      entries = [entry];
    } else if (entries.length === 1 && entry && entry.uri !== entries[0].uri) {
      entries = [entry];
    }

    if (entries.length > 1) {
      setOperationError(null);
      setDialog({
        type: "selectionProperties",
        panelId,
        entries,
        totalSize: null,
        calculatingSize: false,
        folderSizeJobIds: [],
        pendingFolderSizeJobs: 0,
        folderSizeBytes: 0,
        fileSizeBaseline: fileSizeBaseline(entries),
        error: null,
      });
      return;
    }

    const tab = activeTab(state.panels[panelId]);
    const target = entries[0] ?? entry ?? null;
    const uri = target?.uri ?? tab.uri;

    setDialog({
      type: "properties",
      panelId,
      entry: target,
      properties: null,
      loading: true,
      folderSizeJobId: null,
      error: null,
      focusPermissions,
    });

    try {
      const response = await client.fs.properties({
        uri,
        includeFolderSummary: false,
      });
      const properties = response.properties;

      setDialog({
        type: "properties",
        panelId,
        entry: target,
        properties,
        loading: properties.kind === "directory",
        folderSizeJobId: null,
        error: null,
        focusPermissions,
      });

      if (properties.kind === "directory") {
        try {
          const sizeJob = await client.fs.startFolderSizeJob({ uri });
          setDialog((current) =>
            current?.type === "properties" &&
            current.panelId === panelId &&
            current.properties?.uri === uri
              ? {
                  ...current,
                  loading: true,
                  folderSizeJobId: jobIdValue(sizeJob.job.jobId),
                }
              : current,
          );
        } catch (error) {
          const normalized = normalizeIpcError(error);
          setDialog((current) =>
            current?.type === "properties" && current.panelId === panelId
              ? {
                  ...current,
                  loading: false,
                  error: operationErrorMessage(
                    normalized.code,
                    normalized.message,
                  ),
                }
              : current,
          );
        }
      }
    } catch (error) {
      setDialog({
        type: "properties",
        panelId,
        entry: target,
        properties: null,
        loading: false,
        folderSizeJobId: null,
        error: normalizeIpcError(error).message,
      });
    }
  }

  async function calculateSelectionSize(
    current: Extract<OperationDialog, { type: "selectionProperties" }>,
  ) {
    const directories = current.entries.filter(
      (entry) => entry.kind === "directory",
    );

    if (directories.length === 0) {
      setDialog({
        ...current,
        totalSize: current.fileSizeBaseline,
        calculatingSize: false,
        error: null,
      });
      return;
    }

    setOperationError(null);
    setDialog({ ...current, calculatingSize: true, error: null });

    try {
      const folderSizeJobIds: string[] = [];

      for (const directory of directories) {
        const result = await client.fs.startFolderSizeJob({
          uri: directory.uri,
        });
        folderSizeJobIds.push(jobIdValue(result.job.jobId));
      }

      setDialog({
        ...current,
        calculatingSize: true,
        folderSizeJobIds,
        pendingFolderSizeJobs: folderSizeJobIds.length,
        folderSizeBytes: 0,
        totalSize: null,
        error: null,
      });
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setDialog({
        ...current,
        calculatingSize: false,
        error: operationErrorMessage(normalized.code, normalized.message),
      });
    }
  }

  async function runRecursiveSearch(panelId: PanelId) {
    const tab = activeTab(state.panels[panelId]);
    const query = tab.recursiveQuery.trim();

    if (!query) {
      setSearch(null);
      return;
    }

    setSearch({
      panelId,
      query,
      running: true,
      jobId: null,
      result: { matches: [], warnings: [], incomplete: false },
      error: null,
    });

    try {
      const response = await client.fs.startRecursiveSearchJob({
        uri: tab.uri,
        query,
        limit: 500,
      });

      setSearch({
        panelId,
        query,
        running: true,
        jobId: jobIdValue(response.job.jobId),
        result: { matches: [], warnings: [], incomplete: false },
        error: null,
      });
    } catch (error) {
      setSearch({
        panelId,
        query,
        running: false,
        jobId: null,
        result: null,
        error: normalizeIpcError(error).message,
      });
    }
  }

  function toggleHidden(panelId: PanelId) {
    const tab = activeTab(state.panels[panelId]);

    dispatch({ type: "toggleHidden", panelId });
    refreshPanel(panelId, {
      replace: true,
      includeHidden: !tab.showHidden,
    });
  }

  async function openTerminal(uri: string) {
    try {
      await client.fs.openTerminal({ uri });
    } catch (error) {
      const normalized = normalizeIpcError(error);
      pushToast({
        tone: "error",
        title: `Failed to open terminal: ${normalized.message}`,
      });
    }
  }

  async function handleChecksum(panelId: PanelId) {
    const tab = activeTab(state.panels[panelId]);
    const selectedEntry =
      selectVisibleEntries(tab).find((e) => e.uri === tab.selectedId) ?? null;

    if (!selectedEntry || selectedEntry.kind === "directory") {
      pushToast({ tone: "error", title: "Select a file to compute checksum" });
      return;
    }

    try {
      const result = await client.fs.computeHash({
        uri: selectedEntry.uri,
        algorithm: "sha256",
      });
      pushToast({
        tone: "success",
        title: `SHA-256: ${result.hash}`,
      });
    } catch (error) {
      const normalized = normalizeIpcError(error);
      pushToast({
        tone: "error",
        title: `Checksum failed: ${normalized.message}`,
      });
    }
  }

  return {
    openExternal,
    revealEntry,
    calculateSize,
    calculateSelectionSize,
    handleProperties,
    runRecursiveSearch,
    toggleHidden,
    openTerminal,
    handleChecksum,
  };
}
