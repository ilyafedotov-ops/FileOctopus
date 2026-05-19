import type { ConflictPolicy } from "@fileoctopus/ts-api";
import type { PanelId } from "../../panelStore";
import { activeTab } from "../../panelStore";
import type { OperationDialog } from "../../dialogs/OperationDialogView";
import type { CopyMoveKind, UseFileOpHandlersDeps } from "./types";
import { useOperationCore, type OperationCore } from "./useOperationCore";

function configuredConflictPolicy(value: string | undefined): ConflictPolicy {
  if (
    value === "skip" ||
    value === "overwrite" ||
    value === "renameNew" ||
    value === "renameExisting"
  ) {
    return value;
  }

  return "fail";
}

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
    const advancedOptions = preferences?.showAdvancedCopyOptions === true;

    if (entries.length === 0) {
      return;
    }

    setDialog({
      type: "copyMove",
      panelId,
      kind,
      entries,
      destination: defaultDestination,
      conflictPolicy: advancedOptions
        ? configuredConflictPolicy(preferences?.defaultConflictPolicy)
        : "fail",
      advancedOptions,
      planningEnabled: false,
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

    let plan = current.plan;

    if (!plan) {
      plan = await reviewCopyMoveDialog(current);
      if (!plan || current.planningEnabled) {
        return;
      }
    }

    const plannedDialog = { ...current, plan };

    if (
      current.step !== "confirm-overwrite" &&
      (preferences?.confirmOverwrite ?? false) &&
      plan.conflicts.length > 0 &&
      current.conflictPolicy === "overwrite"
    ) {
      setDialog({ ...plannedDialog, step: "confirm-overwrite" });
      return;
    }

    const ok = await startPlannedOperation(plan);

    if (ok) {
      setDialog(null);
    }
  }

  return {
    handleCopyOrMove,
    submitCopyMove,
  };
}
