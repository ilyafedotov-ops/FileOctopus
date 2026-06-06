import type { FileEntryDto } from "@fileoctopus/ts-api";
import { isRemoteUri, normalizeIpcError } from "@fileoctopus/ts-api";
import type { PanelId } from "../../panelStore";
import { activeTab } from "../../panelStore";
import {
  isValidName,
  operationErrorMessage,
} from "../../dialogs/OperationDialogView";
import type { OperationDialog } from "../../dialogs/OperationDialogView";
import { joinUri } from "../../navigation/uriJoin";
import type { UseFileOpHandlersDeps } from "./types";
import { useOperationCore, type OperationCore } from "./useOperationCore";

const SKIP_TRASH_CONFIRM_KEY = "fileoctopus.skipTrashConfirm";
const DEFAULT_FOLDER_NAME = "New Folder";

function nextFolderName(entries: FileEntryDto[]): string {
  const existing = new Set(
    entries
      .filter((entry) => entry.kind === "directory")
      .map((entry) => entry.name),
  );

  if (!existing.has(DEFAULT_FOLDER_NAME)) {
    return DEFAULT_FOLDER_NAME;
  }

  let suffix = 2;
  while (existing.has(`${DEFAULT_FOLDER_NAME} ${suffix}`)) {
    suffix += 1;
  }

  return `${DEFAULT_FOLDER_NAME} ${suffix}`;
}

export function useMutationHandlers(
  deps: UseFileOpHandlersDeps,
  coreOverride?: OperationCore,
) {
  const {
    client,
    state,
    dispatch,
    setDialog,
    setOperationError,
    refreshNavigation,
    preferences,
  } = deps;

  const {
    planOperation,
    startOperation,
    startPlannedOperation,
    selectedEntries,
  } = coreOverride ?? useOperationCore(deps);

  function handleCreateFolder(panelId: PanelId) {
    const tab = activeTab(state.panels[panelId]);
    setDialog({
      type: "createFolder",
      panelId,
      name: nextFolderName(Object.values(tab.entriesById)),
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

  function handleTrash(panelId: PanelId) {
    const entries = selectedEntries(panelId);

    if (entries.length === 0) {
      return;
    }

    const confirmDisabled = preferences?.confirmDelete === false;
    const skipPersisted =
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(SKIP_TRASH_CONFIRM_KEY) === "true";

    if (confirmDisabled || skipPersisted) {
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

  async function executeTrash(_panelId: PanelId, entries: FileEntryDto[]) {
    const sources = entries.map((entry) => entry.uri);
    const kind = sources.some((uri) => isRemoteUri(uri))
      ? "deletePermanently"
      : "deleteToTrash";
    const ok = await startOperation(kind, sources);

    if (ok) {
      setDialog(null);
    }
  }

  function handlePermanentDelete(panelId: PanelId) {
    const entries = selectedEntries(panelId);

    if (entries.length === 0) {
      return;
    }

    if (preferences?.confirmPermanentDelete === false) {
      void startOperation(
        "deletePermanently",
        entries.map((entry) => entry.uri),
      );
      return;
    }

    setDialog({ type: "permanentDelete", panelId, entries, error: null });
  }

  function handleDelete(panelId: PanelId) {
    handlePermanentDelete(panelId);
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
    const targetUri = joinUri(tab.uri, name);

    try {
      const planResponse = await planOperation(
        "createDirectory",
        [],
        targetUri,
      );

      if (planResponse.plan.conflicts.length > 0) {
        setDialog({
          ...current,
          error: "A folder with this name already exists.",
        });
        return;
      }

      const ok = await startPlannedOperation(planResponse.plan);

      if (ok) {
        setDialog(null);
      }
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setDialog({
        ...current,
        error: operationErrorMessage(normalized.code, normalized.message),
      });
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
    const targetUri = joinUri(tab.uri, name);

    try {
      const planResponse = await planOperation("createFile", [], targetUri);
      const ok = await startPlannedOperation(planResponse.plan);

      if (ok) {
        setDialog(null);
        dispatch({
          type: "setSelection",
          panelId: current.panelId,
          entryId: targetUri,
        });
      }
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
      const tab = activeTab(state.panels[current.panelId]);
      dispatch({
        type: "renameEntry",
        oldUri: current.entry.uri,
        newUri: joinUri(tab.uri, name),
        name,
      });
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
      const ok = await startPlannedOperation(planResponse.plan);

      if (ok) {
        setDialog(null);
      }
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setDialog({
        ...current,
        error: operationErrorMessage(normalized.code, normalized.message),
      });
    }
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

  async function submitInlineRename(
    panelId: PanelId,
    entry: FileEntryDto,
    name: string,
  ) {
    const trimmed = name.trim();
    if (!isValidName(trimmed)) {
      setDialog({
        type: "rename",
        panelId,
        entry,
        name: trimmed,
        error: "Enter a name without path separators.",
      });
      return;
    }
    if (trimmed === entry.name) {
      return;
    }
    const ok = await startOperation("rename", [entry.uri], undefined, trimmed);
    if (ok) {
      const tab = activeTab(state.panels[panelId]);
      dispatch({
        type: "renameEntry",
        oldUri: entry.uri,
        newUri: joinUri(tab.uri, trimmed),
        name: trimmed,
      });
    }
  }

  return {
    handleCreateFolder,
    handleCreateFile,
    handleRename,
    handleTrash,
    executeTrash,
    handlePermanentDelete,
    handleDelete,
    submitCreateFolder,
    submitCreateFile,
    submitRename,
    submitInlineRename,
    submitTrash,
    submitPermanentDelete,
    toggleStarredForEntry,
  };
}
