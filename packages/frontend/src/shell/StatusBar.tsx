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
  showHidden?: boolean;
  onOpenActivity: () => void;
  onShowErrorDetails?: () => void;
  logPath?: string | null;
  showLogPath?: boolean;
  totalSizeLabel?: string | null;
  freeSpaceLabel?: string | null;
}

function pluralItems(n: number): string {
  return n === 1 ? "item" : "items";
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
  showHidden = false,
  onOpenActivity,
  onShowErrorDetails,
  logPath,
  showLogPath = false,
  totalSizeLabel,
  freeSpaceLabel,
}: StatusBarProps) {
  const isLoading = loadState === "loading";
  const totalLabel =
    entryCount === 0
      ? "Empty"
      : `${entryCount} ${pluralItems(entryCount)}${totalSizeLabel ? ` (${totalSizeLabel})` : ""}`;
  const selLabel =
    selectedCount === 0
      ? "No selection"
      : `${selectedCount} ${pluralItems(selectedCount)}${selectedSizeLabel ? ` (${selectedSizeLabel})` : ""}`;
  const paneLabelText = filterActive
    ? `${activePanelLabel} - ${pathLabel} - Filtered`
    : `${activePanelLabel} - ${pathLabel}`;

  return (
    <footer className="fo-status" aria-label="Application status">
      <span className="fo-status-segment fo-status-pane" title={pathLabel}>
        {paneLabelText}
      </span>
      <span className="fo-status-separator" aria-hidden="true" />
      {isLoading ? (
        <span className="fo-status-segment">Loading…</span>
      ) : (
        <>
          <span className="fo-status-segment">Selected: {selLabel}</span>
          <span className="fo-status-separator" aria-hidden="true" />
          <span className="fo-status-segment">Total: {totalLabel}</span>
          {freeSpaceLabel && (
            <>
              <span className="fo-status-separator" aria-hidden="true" />
              <span className="fo-status-segment">Free: {freeSpaceLabel}</span>
            </>
          )}
        </>
      )}
      <span className="fo-status-spacer" />
      <span className="fo-sr-only" role="status" aria-live="polite">
        {activeJobCount > 0
          ? `${activeJobCount} active job${activeJobCount === 1 ? "" : "s"}${operationError ? ", errors detected" : ""}`
          : operationError
            ? "No active jobs, errors detected"
            : "No active jobs"}
      </span>
      <button
        type="button"
        className="fo-status-segment fo-status-button"
        onClick={onOpenActivity}
        title="Open Jobs & Activity panel"
      >
        {activeJobCount > 0
          ? `${activeJobCount} active job${activeJobCount === 1 ? "" : "s"}${operationError ? " - Errors" : ""}`
          : `0 active jobs${operationError ? " - Errors" : " - No errors"}`}
      </button>
      {operationError && onShowErrorDetails ? (
        <button
          type="button"
          className="fo-status-segment fo-status-button fo-status-error"
          onClick={onShowErrorDetails}
        >
          View error
        </button>
      ) : null}
      {showHidden ? (
        <span className="fo-status-segment" title="Hidden files visible">
          ◑
        </span>
      ) : null}
      {showLogPath && logPath ? (
        <span className="fo-status-segment fo-status-log" title={logPath}>
          {logPath}
        </span>
      ) : null}
    </footer>
  );
}

export function readinessFromLoadState(loadState: PaneLoadState): string {
  if (loadState === "loading") return "Loading";
  if (
    loadState === "error" ||
    loadState === "notFound" ||
    loadState === "permissionDenied" ||
    loadState === "timeout"
  )
    return "Attention";
  return "Ready";
}
