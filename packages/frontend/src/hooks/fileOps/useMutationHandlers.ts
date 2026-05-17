import type { FileEntryDto } from "@fileoctopus/ts-api";
import { normalizeIpcError } from "@fileoctopus/ts-api";
import type { PanelId } from "../../panelStore";
import { activeTab } from "../../panelStore";
import {
  jobIdValue,
  joinLocalUri,
  isValidName,
  operationErrorMessage,
} from "../../dialogs/OperationDialogView";
import type { OperationDialog } from "../../dialogs/OperationDialogView";
import type { UseFileOpHandlersDeps } from "./types";
import { useOperationCore, type OperationCore } from "./useOperationCore";

const SKIP_TRASH_CONFIRM_KEY = "fileoctopus.skipTrashConfirm";

export function useMutationHandlers(
  deps: UseFileOpHandlersDeps,
  coreOverride?: OperationCore,
) {
  const {
    client,
    state,
    dispatch,
    setDialog,
    setJobs,
    setOperationError,
    refreshVisiblePanels,
    refreshNavigation,
  } = deps;

  const { planOperation, startOperation, selectedEntries } =
    coreOverride ?? useOperationCore(deps);

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

  async function executeTrash(_panelId: PanelId, entries: FileEntryDto[]) {
    const ok = await startOperation(
      "deleteToTrash",
      entries.map((entry) => entry.uri),
    );

    if (ok) {
      setDialog(null);
    }
  }

  function handlePermanentDelete(panelId: PanelId) {
    const entries = selectedEntries(panelId);

    if (entries.length === 0) {
      return;
    }

    setDialog({ type: "permanentDelete", panelId, entries, error: null });
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
      refreshVisiblePanels();
    }
  }

  return {
    handleCreateFolder,
    handleCreateFile,
    handleRename,
    handleTrash,
    executeTrash,
    handlePermanentDelete,
    submitCreateFolder,
    submitCreateFile,
    submitRename,
    submitInlineRename,
    submitTrash,
    submitPermanentDelete,
    toggleStarredForEntry,
  };
}
