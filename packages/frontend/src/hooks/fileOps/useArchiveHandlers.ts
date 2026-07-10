import { normalizeIpcError } from "@fileoctopus/ts-api";
import type { PanelId } from "../../panelStore";
import { activeTab, selectVisibleEntries } from "../../panelStore";
import {
  jobIdValue,
  joinLocalUri,
  mergeJobSnapshot,
} from "../../dialogs/OperationDialogView";
import type { UseFileOpHandlersDeps } from "./types";
import { useOperationCore, type OperationCore } from "./useOperationCore";

export function useArchiveHandlers(
  deps: UseFileOpHandlersDeps,
  coreOverride?: OperationCore,
) {
  const { client, state, setJobs, pushToast } = deps;
  const { planOperation } = coreOverride ?? useOperationCore(deps);

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
        [jobIdValue(started.job.jobId)]: mergeJobSnapshot(current, started.job),
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
        [jobIdValue(started.job.jobId)]: mergeJobSnapshot(current, started.job),
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

  return {
    handleCompress,
    handleExtract,
  };
}
