import type { PanelId } from "../../panelStore";
import { activeTab, parentUri } from "../../panelStore";
import { localPathFromUri } from "../../utils/paneUtils";
import type { CopyMoveKind, UseFileOpHandlersDeps } from "./types";
import { useOperationCore, type OperationCore } from "./useOperationCore";

export function useClipboardHandlers(
  deps: UseFileOpHandlersDeps,
  coreOverride?: OperationCore,
) {
  const { state, setClipboard, clipboard } = deps;
  const { startOperation, selectedEntries } =
    coreOverride ?? useOperationCore(deps);

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

  return {
    copySelectionToFileClipboard,
    pasteClipboard,
    copyTextFromSelection,
  };
}
