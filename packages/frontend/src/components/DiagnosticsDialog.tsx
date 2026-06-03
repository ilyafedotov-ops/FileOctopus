import type { ReactNode } from "react";
import { useRef } from "react";
import type {
  AppDataHealthResponse,
  AppInfoResponse,
} from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";
import { useDialogEscape } from "../hooks/useDialogEscape";
import { useFocusTrap } from "../hooks/useFocusTrap";

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
  onOpenLiveConsole?: () => void;
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  const mono = typeof value === "string";
  return (
    <>
      <dt>{label}</dt>
      <dd className={mono ? "fo-detail-mono" : undefined}>{value}</dd>
    </>
  );
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
  onOpenLiveConsole,
}: DiagnosticsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogEscape(open, onClose);
  useFocusTrap(dialogRef, open);

  if (!open) {
    return null;
  }

  return (
    <div className="fo-dialog-backdrop" role="presentation" onClick={onClose}>
      <dialog
        ref={dialogRef}
        open
        className="fo-dialog fo-diagnostics-dialog"
        aria-labelledby="diagnostics-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <div>
            <h2 id="diagnostics-title">Diagnostics</h2>
            <p>Runtime information and support bundle export.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>
        <div className="fo-dialog-body">
          <section className="fo-dialog-section" aria-label="Application">
            <h3 className="fo-dialog-section-title">Application</h3>
            <dl className="fo-detail-grid">
              <DetailRow
                label="Version"
                value={appInfo?.version ?? "unknown"}
              />
              <DetailRow
                label="Build"
                value={appInfo?.buildProfile ?? "unknown"}
              />
              <DetailRow label="Commit" value={appInfo?.commitSha ?? "n/a"} />
            </dl>
          </section>

          <section className="fo-dialog-section" aria-label="Runtime">
            <h3 className="fo-dialog-section-title">Runtime</h3>
            <dl className="fo-detail-grid">
              <DetailRow
                label="Schema"
                value={String(appHealth?.schemaVersion ?? 0)}
              />
              <DetailRow
                label="Recovered jobs"
                value={String(appHealth?.startupRecoveryCount ?? 0)}
              />
            </dl>
          </section>

          {showDeveloperFields ? (
            <section className="fo-dialog-section" aria-label="Paths">
              <h3 className="fo-dialog-section-title">Paths</h3>
              <dl className="fo-detail-grid">
                <DetailRow
                  label="Config dir"
                  value={appHealth?.configDir ?? "—"}
                />
                <DetailRow label="Data dir" value={appHealth?.dataDir ?? "—"} />
                <DetailRow label="Log dir" value={appHealth?.logDir ?? "—"} />
                <DetailRow
                  label="Database"
                  value={appHealth?.databasePath ?? "—"}
                />
              </dl>
            </section>
          ) : null}

          <section className="fo-dialog-section" aria-label="Live logs">
            <h3 className="fo-dialog-section-title">Live logs</h3>
            <p>
              Open the debug console to watch backend and frontend log output in
              real time.
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!onOpenLiveConsole}
              onClick={() => onOpenLiveConsole?.()}
            >
              Open live console
            </Button>
          </section>

          <section className="fo-dialog-section" aria-label="Export">
            <h3 className="fo-dialog-section-title">Export bundle</h3>
            <p>
              Save a zip archive of logs and configuration for troubleshooting.
            </p>
            <label className="fo-dialog-field">
              <span>Destination</span>
              <input
                value={destination}
                onChange={(event) => onDestinationChange(event.target.value)}
              />
            </label>
          </section>

          {message ? (
            <div className="fo-dialog-callout" role="status">
              <strong>Status</strong>
              <span>{message}</span>
            </div>
          ) : null}

          <div className="fo-dialog-footer">
            <Button type="button" variant="ghost" size="sm" onClick={onRefresh}>
              Refresh
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={exporting}
              onClick={onExport}
            >
              {exporting ? "Exporting…" : "Export bundle"}
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
