import { Button } from "@fileoctopus/ui";
import { IPC_ERROR_CODES, isRemoteUri } from "@fileoctopus/ts-api";
import type { PaneLoadState } from "../paneTypes";
import { localPathFromUri } from "../utils/paneUtils";

interface PaneStateViewProps {
  loadState: PaneLoadState;
  uri: string;
  message: string | null;
  errorCode?: string | null;
  canPaste?: boolean;
  allowCreation?: boolean;
  onRetry: () => void;
  onRefresh: () => void;
  onCreateFolder: () => void;
  onCreateFile?: () => void;
  onPaste?: () => void;
  onEditCredentials?: () => void;
}

const isProductionBuild = Boolean(
  (import.meta as ImportMeta & { env?: { PROD?: boolean } }).env?.PROD,
);

function displayUriPath(uri: string): string {
  if (uri.startsWith("local://")) {
    return localPathFromUri(uri);
  }

  if (isRemoteUri(uri)) {
    const body = uri.split("://")[1] ?? "";
    const slashIndex = body.indexOf("/");
    if (slashIndex === -1) {
      return "/";
    }
    const path = body.slice(slashIndex);
    return path || "/";
  }

  return uri;
}

function networkErrorCopy(errorCode: string | null | undefined): {
  title: string;
  guidance: string | null;
  showEditCredentials: boolean;
  retryLabel: string;
} | null {
  switch (errorCode) {
    case IPC_ERROR_CODES.CONNECTION_REQUIRED:
      return {
        title: "Connection required",
        guidance: "Connect to this server before browsing remote files.",
        showEditCredentials: false,
        retryLabel: "Connect",
      };
    case IPC_ERROR_CODES.AUTHENTICATION_FAILED:
      return {
        title: "Authentication failed",
        guidance:
          "Check the username, password, or private key for this server.",
        showEditCredentials: true,
        retryLabel: "Reconnect",
      };
    case IPC_ERROR_CODES.CONNECTION_LOST:
      return {
        title: "Connection lost",
        guidance: "The server closed the connection. Try reconnecting.",
        showEditCredentials: false,
        retryLabel: "Reconnect",
      };
    case IPC_ERROR_CODES.NETWORK_ERROR:
      return {
        title: "Network error",
        guidance: "Check the server address and your network connection.",
        showEditCredentials: false,
        retryLabel: "Retry",
      };
    default:
      return null;
  }
}

export function PaneStateView({
  loadState,
  uri,
  message,
  errorCode = null,
  canPaste = false,
  allowCreation = true,
  onRetry,
  onRefresh,
  onCreateFolder,
  onCreateFile,
  onPaste,
  onEditCredentials,
}: PaneStateViewProps) {
  const pathLabel = displayUriPath(uri);
  const networkCopy = isRemoteUri(uri) ? networkErrorCopy(errorCode) : null;

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
        {allowCreation ? (
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
        ) : (
          <div className="fo-pane-state-actions">
            <Button type="button" variant="ghost" size="sm" onClick={onRefresh}>
              Refresh
            </Button>
          </div>
        )}
      </section>
    );
  }

  const title =
    networkCopy?.title ??
    (loadState === "notFound"
      ? "Folder not found"
      : loadState === "permissionDenied"
        ? "Permission denied"
        : loadState === "timeout"
          ? "Directory listing timed out"
          : loadState === "offline"
            ? "Device unavailable"
            : "Unable to read this location");

  const guidance =
    networkCopy?.guidance ??
    (loadState === "notFound"
      ? "The path may have been moved, renamed, or deleted."
      : loadState === "permissionDenied"
        ? "Check macOS privacy settings or choose another location."
        : loadState === "offline"
          ? "The device may be disconnected or unmounted. Try reconnecting it."
          : null);

  const retryLabel = networkCopy?.retryLabel ?? "Retry";

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
          {retryLabel}
        </Button>
        {networkCopy?.showEditCredentials && onEditCredentials ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onEditCredentials}
          >
            Edit credentials
          </Button>
        ) : null}
        <Button type="button" variant="ghost" size="sm" onClick={onRefresh}>
          Refresh
        </Button>
      </div>
    </section>
  );
}
