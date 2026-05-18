import type { AppInfoResponse } from "@fileoctopus/ts-api";
import { useRef } from "react";
import { Button } from "@fileoctopus/ui";
import { useDialogEscape } from "../../hooks/useDialogEscape";
import { useFocusTrap } from "../../hooks/useFocusTrap";

interface AboutDialogProps {
  open: boolean;
  appInfo: AppInfoResponse | null;
  onClose: () => void;
}

export function AboutDialog({ open, appInfo, onClose }: AboutDialogProps) {
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
        role="dialog"
        className="fo-dialog fo-about-dialog"
        aria-labelledby="about-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <div>
            <h2 id="about-title">About FileOctopus</h2>
            <p>Desktop file manager powered by Rust and Tauri.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>
        <div className="fo-dialog-body">
          <dl className="fo-detail-grid">
            <dt>Version</dt>
            <dd>{appInfo?.version ?? "—"}</dd>
            <dt>Build</dt>
            <dd>{appInfo?.buildProfile ?? "—"}</dd>
            {appInfo?.commitSha ? (
              <>
                <dt>Commit</dt>
                <dd className="fo-detail-mono">{appInfo.commitSha}</dd>
              </>
            ) : null}
          </dl>
        </div>
      </dialog>
    </div>
  );
}
