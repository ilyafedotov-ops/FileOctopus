import { Button } from "@fileoctopus/ui";
import type { PaneLoadState } from "../paneTypes";

interface PaneStateViewProps {
  loadState: PaneLoadState;
  uri: string;
  message: string | null;
  onRetry: () => void;
  onRefresh: () => void;
  onCreateFolder: () => void;
}

const isProductionBuild = Boolean(
  (import.meta as ImportMeta & { env?: { PROD?: boolean } }).env?.PROD,
);

export function PaneStateView({
  loadState,
  uri,
  message,
  onRetry,
  onRefresh,
  onCreateFolder,
}: PaneStateViewProps) {
  if (
    loadState === "loading" ||
    loadState === "loaded" ||
    loadState === "idle"
  ) {
    return null;
  }

  const pathLabel = uri.replace(/^local:\/\//, "");

  if (loadState === "empty") {
    return (
      <div className="fo-pane-state fo-pane-state-empty">
        <strong>This folder is empty</strong>
        <span className="fo-pane-state-path">{pathLabel}</span>
        <div className="fo-pane-state-actions">
          <Button type="button" variant="ghost" size="sm" onClick={onRefresh}>
            Refresh
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onCreateFolder}
          >
            New Folder
          </Button>
        </div>
      </div>
    );
  }

  const title =
    loadState === "notFound"
      ? "Folder not found"
      : loadState === "permissionDenied"
        ? "Permission denied"
        : loadState === "timeout"
          ? "Directory listing timed out"
          : "Unable to read this location";

  const guidance =
    loadState === "notFound"
      ? "The path may have been moved, renamed, or deleted."
      : loadState === "permissionDenied"
        ? "Check macOS privacy settings or choose another location."
        : null;

  return (
    <div className="fo-pane-state fo-pane-state-error">
      <strong>{title}</strong>
      <span className="fo-pane-state-path">{pathLabel}</span>
      {message ? (
        <span className="fo-pane-state-message">{message}</span>
      ) : null}
      {guidance ? (
        <span className="fo-pane-state-message">{guidance}</span>
      ) : null}
      {!isProductionBuild && message ? (
        <details className="fo-pane-state-details">
          <summary>Technical details</summary>
          <pre>{message}</pre>
        </details>
      ) : null}
      <div className="fo-pane-state-actions">
        <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
          Retry
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onRefresh}>
          Refresh
        </Button>
      </div>
    </div>
  );
}
