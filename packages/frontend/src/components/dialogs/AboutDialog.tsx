import type { AppInfoResponse } from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";
import { DialogShell } from "../DialogShell";

interface AboutDialogProps {
  open: boolean;
  appInfo: AppInfoResponse | null;
  onClose: () => void;
  onOpenDocumentation: () => void;
}

const PLATFORM_LABELS: Record<string, string> = {
  macos: "macOS",
  windows: "Windows",
  linux: "Linux",
};

function platformLabel(targetOs: string | undefined): string {
  if (!targetOs) return "—";
  return PLATFORM_LABELS[targetOs] ?? targetOs;
}

export function AboutDialog({
  open,
  appInfo,
  onClose,
  onOpenDocumentation,
}: AboutDialogProps) {
  const dataDir = appInfo?.dataDir ?? null;

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title="About FileOctopus"
      titleId="about-title"
      subtitle="Desktop file manager powered by Rust and Tauri."
      className="fo-about-dialog"
      footer={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onOpenDocumentation}
        >
          View Documentation
        </Button>
      }
    >
      <div className="fo-dialog-body">
        <p className="fo-about-lede">
          A fast, dual-pane file manager. The Rust core owns every filesystem
          and platform operation; the interface is a thin, typed layer on top.
        </p>
        <dl className="fo-detail-grid">
          <dt>Version</dt>
          <dd>{appInfo?.version ?? "—"}</dd>
          <dt>Build</dt>
          <dd>{appInfo?.buildProfile ?? "—"}</dd>
          <dt>Platform</dt>
          <dd>{platformLabel(appInfo?.targetOs)}</dd>
          <dt>Network</dt>
          <dd>{appInfo?.networkEnabled ? "Enabled" : "Disabled"}</dd>
          {appInfo?.commitSha ? (
            <>
              <dt>Commit</dt>
              <dd className="fo-detail-mono">{appInfo.commitSha}</dd>
            </>
          ) : null}
          {dataDir ? (
            <>
              <dt>Data folder</dt>
              <dd className="fo-detail-mono fo-about-datadir">
                <span className="fo-about-datadir-path">{dataDir}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void navigator.clipboard.writeText(dataDir)}
                >
                  Copy
                </Button>
              </dd>
            </>
          ) : null}
        </dl>
        <p className="fo-about-copyright">© 2026 FileOctopus</p>
      </div>
    </DialogShell>
  );
}
