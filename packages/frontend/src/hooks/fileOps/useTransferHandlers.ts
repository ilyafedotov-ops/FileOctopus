import type { PanelId } from "../../panelStore";
import { activeTab } from "../../panelStore";
import type { OperationDialog } from "../../dialogs/OperationDialogView";
import type { CopyMoveKind, UseFileOpHandlersDeps } from "./types";
import { useOperationCore, type OperationCore } from "./useOperationCore";

export function useTransferHandlers(
  deps: UseFileOpHandlersDeps,
  coreOverride?: OperationCore,
) {
  const { state, setDialog, preferences } = deps;
  const { startPlannedOperation, reviewCopyMoveDialog, selectedEntries } =
    coreOverride ?? useOperationCore(deps);

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

  return {
    handleCopyOrMove,
    submitCopyMove,
  };
}
