import type { AppInfoResponse } from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";
import { useDialogEscape } from "../../hooks/useDialogEscape";

interface AboutDialogProps {
  open: boolean;
  appInfo: AppInfoResponse | null;
  onClose: () => void;
}

export function AboutDialog({ open, appInfo, onClose }: AboutDialogProps) {
  useDialogEscape(open, onClose);

  if (!open) {
    return null;
  }

  return (
    <div className="fo-dialog-backdrop" role="presentation" onClick={onClose}>
      <dialog
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
        <dl className="fo-properties">
          <dt>Version</dt>
          <dd>{appInfo?.version ?? "—"}</dd>
          <dt>Build</dt>
          <dd>{appInfo?.buildProfile ?? "—"}</dd>
        </dl>
      </dialog>
    </div>
  );
}
