import type { Dispatch, SetStateAction } from "react";
import type {
  ConflictPolicy,
  FileEntryDto,
  FileOperationKind,
  FileOperationPlanDto,
  JobSnapshot,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import {
  normalizeIpcError,
  createFileOctopusClient,
} from "@fileoctopus/ts-api";
import type { FileOctopusState, PanelAction, PanelId } from "../panelStore";
import {
  activeTab,
  normalizeLocalInput,
  parentUri,
  selectVisibleEntries,
} from "../panelStore";
import { localPathFromUri } from "../utils/paneUtils";
import {
  type OperationDialog,
  jobIdValue,
  joinLocalUri,
  isValidName,
  operationErrorMessage,
} from "../dialogs/OperationDialogView";
import type { SearchState } from "../pane/PaneFilterBar";
import type { ToastMessage } from "../components/ToastStack";

type CopyMoveKind = Extract<FileOperationKind, "copy" | "move">;

export interface FileClipboardState {
  kind: CopyMoveKind;
  uris: string[];
  providerId: string;
  timestamp: number;
}

export interface UseFileOpHandlersDeps {
  client: ReturnType<typeof createFileOctopusClient>;
  state: FileOctopusState;
  dispatch: Dispatch<PanelAction>;
  setSearch: Dispatch<SetStateAction<SearchState | null>>;
  setDialog: Dispatch<SetStateAction<OperationDialog | null>>;
  setClipboard: Dispatch<SetStateAction<FileClipboardState | null>>;
  clipboard: FileClipboardState | null;
  setJobs: Dispatch<SetStateAction<Record<string, JobSnapshot>>>;
  setOperationError: Dispatch<SetStateAction<string | null>>;
  pushToast: (toast: Omit<ToastMessage, "id">) => void;
  preferences: UserPreferencesDto | null;
  refreshPanel: (
    panelId: PanelId,
    options?: {
      replace?: boolean;
      includeHidden?: boolean;
      softRefresh?: boolean;
    },
  ) => void;
  refreshVisiblePanels: () => void;
  refreshNavigation: () => Promise<void>;
  navigatePanel: (
    panelId: PanelId,
    input: string,
    options?: {
      replace?: boolean;
      includeHidden?: boolean;
      softRefresh?: boolean;
    },
  ) => Promise<void>;
}

export function useFileOpHandlers(deps: UseFileOpHandlersDeps) {
  const {
    client,
    state,
    dispatch,
    setSearch,
    setDialog,
    setClipboard,
    clipboard,
    setJobs,
    setOperationError,
    pushToast,
    preferences,
    refreshPanel,
    refreshVisiblePanels,
    refreshNavigation,
    navigatePanel,
  } = deps;

  async function planOperation(
    kind: FileOperationKind,
    sources: string[],
    destination?: string,
    newName?: string,
    conflictPolicy: ConflictPolicy = "fail",
  ) {
    return client.fileOperations.planFileOperation({
      operation: {
        kind,
        sources,
        destination,
        newName,
        conflictPolicy,
      },
    });
  }

  async function startPlannedOperation(
    plan: FileOperationPlanDto,
  ): Promise<boolean> {
    try {
      const started = await client.fileOperations.startFileOperation({
        operationId: plan.operationId,
      });

      setJobs((current) => ({
        ...current,
        [jobIdValue(started.job.jobId)]: started.job,
      }));
      return true;
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setOperationError(
        operationErrorMessage(normalized.code, normalized.message),
      );
      return false;
    }
  }

  async function startOperation(
    kind: FileOperationKind,
    sources: string[],
    destination?: string,
    newName?: string,
    conflictPolicy: ConflictPolicy = "fail",
  ): Promise<boolean> {
    setOperationError(null);

    try {
      const planResponse = await planOperation(
        kind,
        sources,
        destination,
        newName,
        conflictPolicy,
      );

      return startPlannedOperation(planResponse.plan);
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setOperationError(
        operationErrorMessage(normalized.code, normalized.message),
      );
      return false;
    }
  }

  async function reviewCopyMoveDialog(
    current: Extract<OperationDialog, { type: "copyMove" }>,
  ) {
    setOperationError(null);
    setDialog({ ...current, planning: true, error: null });

    try {
      const planResponse = await planOperation(
        current.kind,
        current.entries.map((entry) => entry.uri),
        normalizeLocalInput(current.destination),
        undefined,
        current.conflictPolicy,
      );

      setDialog({ ...current, plan: planResponse.plan, planning: false });
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setDialog({
        ...current,
        planning: false,
        error: operationErrorMessage(normalized.code, normalized.message),
      });
    }
  }

  function selectedEntries(panelId: PanelId): FileEntryDto[] {
    const tab = activeTab(state.panels[panelId]);

    return tab.selectedIds
      .map((id) => tab.entriesById[id])
      .filter((entry): entry is FileEntryDto => Boolean(entry));
  }

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

    try {
      const result = await client.fs.startFolderSizeJob({ uri: entry.uri });
      setDialog({
        type: "properties",
        panelId,
        entry,
        properties: null,
        loading: true,
        folderSizeJobId: jobIdValue(result.job.jobId),
        error: null,
      });
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setOperationError(
        operationErrorMessage(normalized.code, normalized.message),
      );
    }
  }

  function copySelectionToFileClipboard(panelId: PanelId, kind: CopyMoveKind) {
    const entries = selectedEntries(panelId);

    if (entries.length === 0) {
      return;
    }

    setClipboard({
      kind,
      uris: entries.map((entry) => entry.uri),
      providerId: entries[0].providerId,
      timestamp: Date.now(),
    });
  }

  async function pasteClipboard(panelId: PanelId) {
    if (!clipboard) {
      return;
    }

    const tab = activeTab(state.panels[panelId]);
    const ok = await startOperation(
      clipboard.kind,
      clipboard.uris,
      tab.uri,
      undefined,
      "renameNew",
    );

    if (ok && clipboard.kind === "move") {
      setClipboard(null);
    }
  }

  async function copyTextFromSelection(
    panelId: PanelId,
    mode: "path" | "name" | "parentPath" | "uri",
  ) {
    const entries = selectedEntries(panelId);

    if (entries.length === 0) {
      return;
    }

    const text = entries
      .map((entry) => {
        switch (mode) {
          case "path":
            return localPathFromUri(entry.uri);
          case "name":
            return entry.name;
          case "parentPath":
            return localPathFromUri(parentUri(entry.uri) ?? "");
          case "uri":
            return entry.uri;
        }
      })
      .join("\n");

    await globalThis.navigator.clipboard?.writeText(text);
  }

  function handleCreateFolder(panelId: PanelId) {
    setDialog({
      type: "createFolder",
      panelId,
      name: "New Folder",
      error: null,
    });
  }

  function handleCreateFile(panelId: PanelId) {
    setDialog({
      type: "createFile",
      panelId,
      name: "New File.txt",
      error: null,
    });
  }

  function handleRename(panelId: PanelId) {
    const entries = selectedEntries(panelId);
    const entry = entries[0];

    if (entries.length !== 1 || !entry) {
      return;
    }

    setDialog({
      type: "rename",
      panelId,
      entry,
      name: entry.name,
      error: null,
    });
  }

  function handleCopyOrMove(panelId: PanelId, kind: CopyMoveKind) {
    const entries = selectedEntries(panelId);
    const otherPanel = panelId === "left" ? "right" : "left";
    const defaultDestination = activeTab(state.panels[otherPanel]).uri;

    if (entries.length === 0) {
      return;
    }

    setDialog({
      type: "copyMove",
      panelId,
      kind,
      entries,
      destination: defaultDestination,
      conflictPolicy: "fail",
      plan: null,
      planning: false,
      step: "review",
      error: null,
    });
  }

  async function executeTrash(_panelId: PanelId, entries: FileEntryDto[]) {
    const ok = await startOperation(
      "deleteToTrash",
      entries.map((entry) => entry.uri),
    );

    if (ok) {
      setDialog(null);
    }
  }

  function handleTrash(panelId: PanelId) {
    const entries = selectedEntries(panelId);

    if (entries.length === 0) {
      return;
    }

    if (
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(SKIP_TRASH_CONFIRM_KEY) === "true"
    ) {
      void executeTrash(panelId, entries);
      return;
    }

    setDialog({
      type: "trash",
      panelId,
      entries,
      dontAskAgain: false,
      error: null,
    });
  }

  async function toggleStarredForEntry(entry: FileEntryDto) {
    try {
      await client.navigation.toggleStarred({
        uri: entry.uri,
        label: entry.name,
      });
      await refreshNavigation();
    } catch (error) {
      setOperationError(normalizeIpcError(error).message);
    }
  }

  function handlePermanentDelete(panelId: PanelId) {
    const entries = selectedEntries(panelId);

    if (entries.length === 0) {
      return;
    }

    setDialog({ type: "permanentDelete", panelId, entries, error: null });
  }

  async function handleProperties(
    panelId: PanelId,
    entry: FileEntryDto | null,
  ) {
    const tab = activeTab(state.panels[panelId]);
    const target = entry ?? selectedEntries(panelId)[0] ?? null;
    const uri = target?.uri ?? tab.uri;

    setDialog({
      type: "properties",
      panelId,
      entry: target,
      properties: null,
      loading: true,
      folderSizeJobId: null,
      error: null,
    });

    try {
      const response = await client.fs.properties({
        uri,
        includeFolderSummary: false,
      });
      const properties = response.properties;
      let folderSizeJobId: string | null = null;

      if (properties.kind === "directory") {
        const sizeJob = await client.fs.startFolderSizeJob({ uri });
        folderSizeJobId = jobIdValue(sizeJob.job.jobId);
      }

      setDialog({
        type: "properties",
        panelId,
        entry: target,
        properties,
        loading: Boolean(folderSizeJobId),
        folderSizeJobId,
        error: null,
      });
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

  async function handleCompress(panelId: PanelId) {
    const tab = activeTab(state.panels[panelId]);
    const selectedUris: string[] = [];
    if (tab.selectedId) {
      const entry = selectVisibleEntries(tab).find(
        (e) => e.uri === tab.selectedId,
      );
      if (entry) selectedUris.push(entry.uri);
    }
    if (selectedUris.length === 0) {
      pushToast({
        tone: "error",
        title: "Select files or folders to compress",
      });
      return;
    }

    const parentUri = tab.uri;
    const firstEntry = selectVisibleEntries(tab).find(
      (e) => e.uri === tab.selectedId,
    );
    const baseName = firstEntry
      ? firstEntry.name.indexOf(".") !== -1
        ? firstEntry.name.split(".")[0]
        : firstEntry.name
      : "archive";
    const destinationUri = joinLocalUri(parentUri, baseName + ".zip");

    try {
      const planResponse = await planOperation(
        "createArchive",
        selectedUris,
        destinationUri,
      );
      const started = await client.fileOperations.startFileOperation({
        operationId: planResponse.plan.operationId,
      });
      setJobs((current) => ({
        ...current,
        [jobIdValue(started.job.jobId)]: started.job,
      }));
      pushToast({
        tone: "info",
        title: "Compression started",
        detail: baseName + ".zip",
      });
    } catch (error) {
      const normalized = normalizeIpcError(error);
      pushToast({
        tone: "error",
        title: `Compress failed: ${normalized.message}`,
      });
    }
  }

  async function handleExtract(panelId: PanelId) {
    const tab = activeTab(state.panels[panelId]);
    const selectedEntry =
      selectVisibleEntries(tab).find((e) => e.uri === tab.selectedId) ?? null;

    if (!selectedEntry || selectedEntry.kind === "directory") {
      pushToast({ tone: "error", title: "Select an archive to extract" });
      return;
    }

    const archiveName = selectedEntry.name;
    const dotIndex = archiveName.lastIndexOf(".");
    const dirName =
      dotIndex > 0
        ? archiveName.substring(0, dotIndex)
        : archiveName + "_extracted";
    const destinationUri = joinLocalUri(tab.uri, dirName);

    try {
      const planResponse = await planOperation(
        "extractArchive",
        [selectedEntry.uri],
        destinationUri,
      );
      const started = await client.fileOperations.startFileOperation({
        operationId: planResponse.plan.operationId,
      });
      setJobs((current) => ({
        ...current,
        [jobIdValue(started.job.jobId)]: started.job,
      }));
      pushToast({
        tone: "info",
        title: "Extraction started",
        detail: dirName,
      });
    } catch (error) {
      const normalized = normalizeIpcError(error);
      pushToast({
        tone: "error",
        title: `Extract failed: ${normalized.message}`,
      });
    }
  }

  async function submitCreateFolder(
    current: Extract<OperationDialog, { type: "createFolder" }>,
  ) {
    const name = current.name.trim();

    if (!isValidName(name)) {
      setDialog({
        ...current,
        error: "Enter a folder name without path separators.",
      });
      return;
    }

    const tab = activeTab(state.panels[current.panelId]);
    const ok = await startOperation(
      "createDirectory",
      [],
      joinLocalUri(tab.uri, name),
    );

    if (ok) {
      setDialog(null);
      refreshVisiblePanels();
    }
  }

  async function submitCreateFile(
    current: Extract<OperationDialog, { type: "createFile" }>,
  ) {
    const name = current.name.trim();

    if (!isValidName(name)) {
      setDialog({
        ...current,
        error: "Enter a file name without path separators.",
      });
      return;
    }

    const tab = activeTab(state.panels[current.panelId]);
    const targetUri = joinLocalUri(tab.uri, name);

    try {
      const planResponse = await planOperation("createFile", [], targetUri);
      const started = await client.fileOperations.startFileOperation({
        operationId: planResponse.plan.operationId,
      });

      setJobs((jobMap) => ({
        ...jobMap,
        [jobIdValue(started.job.jobId)]: started.job,
      }));
      setDialog(null);
      dispatch({
        type: "setSelection",
        panelId: current.panelId,
        entryId: targetUri,
      });
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setDialog({
        ...current,
        error: operationErrorMessage(normalized.code, normalized.message),
      });
    }
  }

  async function submitRename(
    current: Extract<OperationDialog, { type: "rename" }>,
  ) {
    const name = current.name.trim();

    if (!isValidName(name)) {
      setDialog({ ...current, error: "Enter a name without path separators." });
      return;
    }

    const ok = await startOperation(
      "rename",
      [current.entry.uri],
      undefined,
      name,
    );

    if (ok) {
      setDialog(null);
      refreshVisiblePanels();
    }
  }

  async function submitCopyMove(
    current: Extract<OperationDialog, { type: "copyMove" }>,
  ) {
    if (!current.destination.trim()) {
      setDialog({ ...current, error: "Enter a destination local URI." });
      return;
    }

    if (!current.plan) {
      await reviewCopyMoveDialog(current);
      return;
    }

    if (
      current.step !== "confirm-overwrite" &&
      (preferences?.confirmOverwrite ?? false) &&
      current.plan.conflicts.length > 0 &&
      current.conflictPolicy === "overwrite"
    ) {
      setDialog({ ...current, step: "confirm-overwrite" });
      return;
    }

    const ok = await startPlannedOperation(current.plan);

    if (ok) {
      setDialog(null);
    }
  }

  async function submitTrash(
    current: Extract<OperationDialog, { type: "trash" }>,
  ) {
    if (current.dontAskAgain && typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(SKIP_TRASH_CONFIRM_KEY, "true");
    }

    await executeTrash(current.panelId, current.entries);
  }

  async function submitPermanentDelete(
    current: Extract<OperationDialog, { type: "permanentDelete" }>,
  ) {
    try {
      const planResponse = await planOperation(
        "deletePermanently",
        current.entries.map((entry) => entry.uri),
      );
      const started = await client.fileOperations.startFileOperation({
        operationId: planResponse.plan.operationId,
      });

      setJobs((jobMap) => ({
        ...jobMap,
        [jobIdValue(started.job.jobId)]: started.job,
      }));
      setDialog(null);
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setDialog({
        ...current,
        error: operationErrorMessage(normalized.code, normalized.message),
      });
    }
  }

  return {
    planOperation,
    startPlannedOperation,
    startOperation,
    reviewCopyMoveDialog,
    selectedEntries,
    openExternal,
    revealEntry,
    calculateSize,
    copySelectionToFileClipboard,
    pasteClipboard,
    copyTextFromSelection,
    handleCreateFolder,
    handleCreateFile,
    handleRename,
    handleCopyOrMove,
    executeTrash,
    handleTrash,
    toggleStarredForEntry,
    handlePermanentDelete,
    handleProperties,
    runRecursiveSearch,
    toggleHidden,
    openTerminal,
    handleChecksum,
    handleCompress,
    handleExtract,
    submitCreateFolder,
    submitCreateFile,
    submitRename,
    submitCopyMove,
    submitTrash,
    submitPermanentDelete,
  };
}

const SKIP_TRASH_CONFIRM_KEY = "fileoctopus.skipTrashConfirm";
