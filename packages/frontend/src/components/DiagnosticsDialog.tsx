import type { AppDataHealthResponse, AppInfoResponse } from "@fileoctopus/ts-api";

interface DiagnosticsDialogProps {
  open: boolean;
  appInfo: AppInfoResponse | null;
  appHealth: AppDataHealthResponse | null;
  destination: string;
  message: string | null;
  exporting: boolean;
  showDeveloperFields: boolean;
  onClose: () => void;
  onDestinationChange: (value: string) => void;
  onRefresh: () => void;
  onExport: () => void;
}

export function DiagnosticsDialog({
  open,
  appInfo,
  appHealth,
  destination,
  message,
  exporting,
  showDeveloperFields,
  onClose,
  onDestinationChange,
  onRefresh,
  onExport,
}: DiagnosticsDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fo-dialog-backdrop" role="presentation" onClick={onClose}>
      <dialog
        open
        className="fo-dialog fo-diagnostics-dialog"
        aria-labelledby="diagnostics-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <h2 id="diagnostics-title">Diagnostics</h2>
          <button type="button" className="fo-dialog-close" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="fo-diagnostics-grid">
          <span>Version</span>
          <span>{appInfo?.version ?? "unknown"}</span>
          <span>Build</span>
          <span>{appInfo?.buildProfile ?? "unknown"}</span>
          <span>Commit</span>
          <span>{appInfo?.commitSha ?? "n/a"}</span>
          <span>Schema</span>
          <span>{appHealth?.schemaVersion ?? 0}</span>
          <span>Recovered jobs</span>
          <span>{appHealth?.startupRecoveryCount ?? 0}</span>
          {showDeveloperFields ? (
            <>
              <span>Config dir</span>
              <span>{appHealth?.configDir ?? ""}</span>
              <span>Data dir</span>
              <span>{appHealth?.dataDir ?? ""}</span>
              <span>Log dir</span>
              <span>{appHealth?.logDir ?? ""}</span>
              <span>Database</span>
              <span>{appHealth?.databasePath ?? ""}</span>
            </>
          ) : null}
        </div>
        <label className="fo-diagnostics-export">
          Export destination
          <input
            value={destination}
            onChange={(event) => onDestinationChange(event.target.value)}
          />
        </label>
        <div className="fo-pane-state-actions">
          <button type="button" onClick={onRefresh}>
            Refresh
          </button>
          <button type="button" disabled={exporting} onClick={onExport}>
            {exporting ? "Exporting…" : "Export bundle"}
          </button>
        </div>
        {message ? <div className="fo-empty-inline">{message}</div> : null}
      </dialog>
    </div>
  );
}
