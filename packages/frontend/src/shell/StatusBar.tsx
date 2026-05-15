import type { PaneLoadState } from "../paneTypes";

interface StatusBarProps {
  loadState: PaneLoadState;
  selectedCount: number;
  entryCount: number;
  selectedSizeLabel: string | null;
  activeJobCount: number;
  operationError: string | null;
  logPath?: string | null;
}

export function StatusBar({
  loadState,
  selectedCount,
  entryCount,
  selectedSizeLabel,
  activeJobCount,
  operationError,
  logPath,
}: StatusBarProps) {
  const readiness =
    loadState === "loading"
      ? "Loading"
      : loadState === "error" || loadState === "permissionDenied"
        ? "Attention"
        : "Ready";

  return (
    <footer className="fo-status">
      <span>{readiness}</span>
      <span>
        {selectedCount} selected · {entryCount} items
        {selectedSizeLabel ? ` · ${selectedSizeLabel} selected` : ""}
      </span>
      <span>
        {activeJobCount} active job{activeJobCount === 1 ? "" : "s"}
        {operationError ? " · Errors" : " · No errors"}
      </span>
      {logPath ? <span className="fo-status-log">{logPath}</span> : null}
    </footer>
  );
}

export function readinessFromLoadState(loadState: PaneLoadState): string {
  if (loadState === "loading") {
    return "Loading";
  }
  if (loadState === "error" || loadState === "permissionDenied") {
    return "Attention";
  }
  return "Ready";
}
