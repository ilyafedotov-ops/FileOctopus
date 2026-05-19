import { useEffect, useState } from "react";
import type { VolumeDto, FsClient } from "@fileoctopus/ts-api";

export interface VolumePickerDialogProps {
  open: boolean;
  fs: FsClient;
  onClose: () => void;
  onSelect: (mountUri: string) => void;
}

export function VolumePickerDialog({
  open,
  fs,
  onClose,
  onSelect,
}: VolumePickerDialogProps) {
  const [volumes, setVolumes] = useState<VolumeDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fs.discoverVolumes()
      .then((res) => {
        if (!cancelled) {
          setVolumes(res.volumes);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, fs]);

  if (!open) return null;

  return (
    <div className="fo-dialog-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Volumes"
        className="fo-dialog fo-volume-picker"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fo-dialog-header">
          <h2 className="fo-dialog-title">Volumes</h2>
          <button
            type="button"
            className="fo-ui-icon-btn"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="fo-dialog-body fo-volume-picker-body">
          {loading && <div className="fo-volume-picker-loading">Loading…</div>}
          {error && <div className="fo-volume-picker-error">{error}</div>}
          {!loading && !error && volumes.length === 0 && (
            <div className="fo-volume-picker-empty">No volumes found</div>
          )}
          {!loading &&
            !error &&
            volumes.length > 0 &&
            volumes.map((vol) => (
              <button
                key={vol.mountUri}
                type="button"
                className="fo-volume-item"
                onClick={() => onSelect(vol.mountUri)}
              >
                <span className="fo-volume-name">{vol.name}</span>
                <span className="fo-volume-fs">{vol.fileSystemType}</span>
                {vol.isRemovable && (
                  <span className="fo-volume-badge" title="Removable">
                    ↻
                  </span>
                )}
                {vol.isNetwork && (
                  <span className="fo-volume-badge" title="Network">
                    ◈
                  </span>
                )}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
