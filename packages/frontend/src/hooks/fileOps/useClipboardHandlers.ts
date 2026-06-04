import {
  normalizeIpcError,
  type FileOperationPlanDto,
} from "@fileoctopus/ts-api";
import type { PanelId } from "../../panelStore";
import { activeTab, parentUri } from "../../panelStore";
import { operationErrorMessage } from "../../dialogs/OperationDialogView";
import { localPathFromUri } from "../../utils/paneUtils";
import type { CopyMoveKind, UseFileOpHandlersDeps } from "./types";
import { useOperationCore, type OperationCore } from "./useOperationCore";

export function useClipboardHandlers(
  deps: UseFileOpHandlersDeps,
  coreOverride?: OperationCore,
) {
  const { state, setClipboard, setDialog, setOperationError, clipboard } = deps;
  const { planOperation, startPlannedOperation, selectedEntries } =
    coreOverride ?? useOperationCore(deps);

  function copySelectionToFileClipboard(panelId: PanelId, kind: CopyMoveKind) {
    const entries = selectedEntries(panelId);

    if (entries.length === 0) {
      return;
    }

    setClipboard({
      kind,
      uris: entries.map((entry) => entry.uri),
      entries,
      providerId: entries[0].providerId,
      timestamp: Date.now(),
    });
  }

  async function pasteClipboard(panelId: PanelId) {
    if (!clipboard) {
      return;
    }

    const tab = activeTab(state.panels[panelId]);
    let plan: FileOperationPlanDto;

    try {
      const planResponse = await planOperation(
        clipboard.kind,
        clipboard.uris,
        tab.uri,
        undefined,
        "renameNew",
      );
      plan = planResponse.plan;
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setOperationError(
        operationErrorMessage(normalized.code, normalized.message),
      );
      return;
    }

    if (plan.conflicts.length > 0) {
      setDialog({
        type: "copyMove",
        panelId,
        kind: clipboard.kind,
        entries: clipboard.entries,
        destination: tab.uri,
        conflictPolicy: "fail",
        advancedOptions: false,
        planningEnabled: false,
        plan,
        planning: false,
        step: "confirm-overwrite",
        error: null,
      });
      return;
    }

    const ok = await startPlannedOperation(plan);

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

  return {
    copySelectionToFileClipboard,
    pasteClipboard,
    copyTextFromSelection,
  };
}
