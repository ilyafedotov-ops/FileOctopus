import type { AppInfoResponse } from "@fileoctopus/ts-api";
import { DialogShell } from "../DialogShell";

interface AboutDialogProps {
  open: boolean;
  appInfo: AppInfoResponse | null;
  onClose: () => void;
}

export function AboutDialog({ open, appInfo, onClose }: AboutDialogProps) {
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title="About FileOctopus"
      titleId="about-title"
      subtitle="Desktop file manager powered by Rust and Tauri."
      className="fo-about-dialog"
    >
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
    </DialogShell>
  );
}
