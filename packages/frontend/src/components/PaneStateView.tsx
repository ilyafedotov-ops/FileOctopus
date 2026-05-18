import { Button } from "@fileoctopus/ui";
import type { PaneLoadState } from "../paneTypes";

interface PaneStateViewProps {
  loadState: PaneLoadState;
  uri: string;
  message: string | null;
  canPaste?: boolean;
  onRetry: () => void;
  onRefresh: () => void;
  onCreateFolder: () => void;
  onCreateFile?: () => void;
  onPaste?: () => void;
}

const isProductionBuild = Boolean(
  (import.meta as ImportMeta & { env?: { PROD?: boolean } }).env?.PROD,
);

export function PaneStateView({
  loadState,
  uri,
  message,
  canPaste = false,
  onRetry,
  onRefresh,
  onCreateFolder,
  onCreateFile,
  onPaste,
}: PaneStateViewProps) {
  const pathLabel = uri.replace(/^local:\/\//, "");

  if (loadState === "loading") {
    return (
      <section
        className="fo-pane-state fo-pane-state-loading"
        aria-live="polite"
      >
        <span className="fo-pane-state-spinner" aria-hidden="true" />
        <strong>Loading folder</strong>
        <span className="fo-pane-state-path">{pathLabel}</span>
      </section>
    );
  }

  if (loadState === "loaded" || loadState === "idle") {
    return null;
  }

  if (loadState === "empty") {
    return (
      <section className="fo-pane-state fo-pane-state-empty">
        <strong>This folder is empty</strong>
        <span className="fo-pane-state-path">{pathLabel}</span>
        <div className="fo-pane-state-actions">
          <Button type="button" variant="ghost" size="sm" onClick={onRefresh}>
            Refresh
          </Button>
          {canPaste && onPaste ? (
            <Button type="button" variant="ghost" size="sm" onClick={onPaste}>
              Paste
            </Button>
          ) : null}
          {onCreateFile ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCreateFile}
            >
              New File
            </Button>
          ) : null}
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onCreateFolder}
          >
            New Folder
          </Button>
        </div>
      </section>
    );
  }

  const title =
    loadState === "notFound"
      ? "Folder not found"
      : loadState === "permissionDenied"
        ? "Permission denied"
        : loadState === "timeout"
          ? "Directory listing timed out"
          : loadState === "offline"
            ? "Device unavailable"
            : "Unable to read this location";

  const guidance =
    loadState === "notFound"
      ? "The path may have been moved, renamed, or deleted."
      : loadState === "permissionDenied"
        ? "Check macOS privacy settings or choose another location."
        : loadState === "offline"
          ? "The device may be disconnected or unmounted. Try reconnecting it."
          : null;

  return (
    <section className="fo-pane-state fo-pane-state-error">
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
          <summary>Show details</summary>
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
    </section>
  );
}
