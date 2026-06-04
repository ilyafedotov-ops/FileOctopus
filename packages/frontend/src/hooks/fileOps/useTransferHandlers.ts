import { useRef } from "react";
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
  const submitInFlightRef = useRef(false);

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
    if (submitInFlightRef.current) {
      return;
    }
    submitInFlightRef.current = true;

    try {
      if (!current.destination.trim()) {
        setDialog({ ...current, error: "Enter a destination local URI." });
        return;
      }

      const resolvingConflict =
        current.step === "confirm-overwrite" && current.pendingConflictPolicy;
      const conflictPolicy =
        current.pendingConflictPolicy ?? current.conflictPolicy;
      let plan = current.plan;

      if (!plan || resolvingConflict) {
        plan = await reviewCopyMoveDialog({
          ...current,
          conflictPolicy,
          pendingConflictPolicy: undefined,
          plan: null,
          step: resolvingConflict ? "confirm-overwrite" : "review",
        });
        if (!plan || (current.planningEnabled && !resolvingConflict)) {
          return;
        }
      }

      if (
        resolvingConflict &&
        plan.conflicts.length > 0 &&
        conflictPolicy === "fail"
      ) {
        setDialog({
          ...current,
          plan,
          conflictPolicy,
          step: "confirm-overwrite",
          error:
            "Choose how to handle destination conflicts before continuing.",
        });
        return;
      }

      const plannedDialog = {
        ...current,
        conflictPolicy,
        pendingConflictPolicy: undefined,
        plan,
      };

      if (!resolvingConflict && plan.conflicts.length > 0) {
        setDialog({ ...plannedDialog, step: "confirm-overwrite" });
        return;
      }

      const ok = await startPlannedOperation(plan);

      if (ok) {
        setDialog(null);
      } else if (resolvingConflict) {
        setDialog({
          ...plannedDialog,
          step: "confirm-overwrite",
          planning: false,
          error:
            "Could not start the operation. Try again or cancel from the activity panel.",
        });
      }
    } finally {
      submitInFlightRef.current = false;
    }
  }

  return {
    handleCopyOrMove,
    submitCopyMove,
  };
}
