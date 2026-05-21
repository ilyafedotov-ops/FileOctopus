import { useEffect, useMemo, useState } from "react";
import type {
  FsClient,
  NetworkProfileDto,
  VolumeDto,
} from "@fileoctopus/ts-api";
import { normalizeIpcError } from "@fileoctopus/ts-api";
import { operationErrorMessage } from "../../dialogs/OperationDialogView";

export interface VolumePickerDialogProps {
  open: boolean;
  fs: FsClient;
  networkProfiles?: NetworkProfileDto[];
  onClose: () => void;
  onSelect: (mountUri: string) => void;
}

function networkProfileToVolume(profile: NetworkProfileDto): VolumeDto {
  return {
    name: profile.label,
    mountUri: profile.defaultUri,
    totalBytes: null,
    availableBytes: null,
    fileSystemType: "sftp",
    isRemovable: false,
    isNetwork: true,
  };
}

function VolumeRow({
  vol,
  onSelect,
}: {
  vol: VolumeDto;
  onSelect: (mountUri: string) => void;
}) {
  return (
    <button
      type="button"
      className="fo-volume-item"
      onClick={() => onSelect(vol.mountUri)}
    >
      <span className="fo-volume-name">{vol.name}</span>
      <span className="fo-volume-fs">{vol.fileSystemType}</span>
      {vol.isRemovable ? (
        <span className="fo-volume-badge" title="Removable">
          ↻
        </span>
      ) : null}
      {vol.isNetwork ? (
        <span className="fo-volume-badge" title="Network">
          ◈
        </span>
      ) : null}
    </button>
  );
}

export function VolumePickerDialog({
  open,
  fs,
  networkProfiles = [],
  onClose,
  onSelect,
}: VolumePickerDialogProps) {
  const [localVolumes, setLocalVolumes] = useState<VolumeDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const networkVolumes = useMemo(
    () =>
      networkProfiles
        .filter((profile) => profile.scheme === "sftp")
        .map(networkProfileToVolume),
    [networkProfiles],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fs.discoverVolumes()
      .then((res) => {
        if (!cancelled) {
          setLocalVolumes(res.volumes);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const normalized = normalizeIpcError(err);
          setError(operationErrorMessage(normalized.code, normalized.message));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, fs]);

  if (!open) return null;

  const hasLocal = localVolumes.length > 0;
  const hasNetwork = networkVolumes.length > 0;
  const hasAny = hasLocal || hasNetwork;
  const showSectionLabels = hasLocal && hasNetwork;

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
          {loading ? (
            <div className="fo-volume-picker-loading">Loading…</div>
          ) : null}
          {error ? <div className="fo-volume-picker-error">{error}</div> : null}
          {!loading && !error && !hasAny ? (
            <div className="fo-volume-picker-empty">No volumes found</div>
          ) : null}
          {!loading && !error && hasAny ? (
            <>
              {hasLocal ? (
                <>
                  {showSectionLabels ? (
                    <p className="fo-volume-picker-section-title">
                      Local volumes
                    </p>
                  ) : null}
                  {localVolumes.map((vol) => (
                    <VolumeRow
                      key={vol.mountUri}
                      vol={vol}
                      onSelect={onSelect}
                    />
                  ))}
                </>
              ) : null}
              {hasNetwork ? (
                <>
                  {showSectionLabels ? (
                    <p className="fo-volume-picker-section-title">
                      Network drives
                    </p>
                  ) : null}
                  {networkVolumes.map((vol) => (
                    <VolumeRow
                      key={vol.mountUri}
                      vol={vol}
                      onSelect={onSelect}
                    />
                  ))}
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
