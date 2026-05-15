import type { PaneLoadState } from "../paneTypes";

interface StatusBarProps {
  activePanelLabel: string;
  pathLabel: string;
  loadState: PaneLoadState;
  selectedCount: number;
  entryCount: number;
  filterActive: boolean;
  selectedSizeLabel: string | null;
  activeJobCount: number;
  operationError: string | null;
  logPath?: string | null;
  showLogPath?: boolean;
}

function entrySummary(loadState: PaneLoadState, entryCount: number): string {
  if (loadState === "loading") {
    return "Loading…";
  }
  if (loadState === "empty") {
    return "Empty folder";
  }
  if (
    loadState === "error" ||
    loadState === "notFound" ||
    loadState === "permissionDenied" ||
    loadState === "timeout"
  ) {
    return "Unavailable";
  }
  return `${entryCount} item${entryCount === 1 ? "" : "s"}`;
}

function readinessLabel(loadState: PaneLoadState): string {
  if (loadState === "loading") {
    return "Loading";
  }
  if (
    loadState === "error" ||
    loadState === "notFound" ||
    loadState === "permissionDenied" ||
    loadState === "timeout"
  ) {
    return "Attention";
  }
  return "Ready";
}

export function StatusBar({
  activePanelLabel,
  pathLabel,
  loadState,
  selectedCount,
  entryCount,
  filterActive,
  selectedSizeLabel,
  activeJobCount,
  operationError,
  logPath,
  showLogPath = false,
}: StatusBarProps) {
  const readiness = readinessLabel(loadState);
  const selectionLabel =
    selectedCount === 0
      ? "No selection"
      : `${selectedCount} selected${selectedSizeLabel ? ` - ${selectedSizeLabel}` : ""}`;

  return (
    <footer className="fo-status" aria-label="Application status">
      <span className="fo-status-segment fo-status-readiness">{readiness}</span>
      <span className="fo-status-segment fo-status-pane" title={pathLabel}>
        {activePanelLabel} - {pathLabel}
        {filterActive ? " - Filtered" : ""}
      </span>
      <span className="fo-status-segment">{selectionLabel}</span>
      <span className="fo-status-segment">
        {entrySummary(loadState, entryCount)}
      </span>
      <span className="fo-status-segment">
        {activeJobCount} active job{activeJobCount === 1 ? "" : "s"}
        {operationError ? " - Errors" : " - No errors"}
      </span>
      {showLogPath && logPath ? (
        <span className="fo-status-segment fo-status-log" title={logPath}>
          {logPath}
        </span>
      ) : null}
    </footer>
  );
}

export function readinessFromLoadState(loadState: PaneLoadState): string {
  return readinessLabel(loadState);
}
