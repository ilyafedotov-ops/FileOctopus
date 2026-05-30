import { useEffect, useMemo, useState } from "react";
import type {
  FsClient,
  NetworkProfileDto,
  VolumeDto,
} from "@fileoctopus/ts-api";
import { normalizeIpcError } from "@fileoctopus/ts-api";
import { Icons } from "@fileoctopus/ui";
import { DialogShell } from "../DialogShell";
import { operationErrorMessage } from "../../dialogs/OperationDialogView";

export interface VolumePickerDialogProps {
  open: boolean;
  fs: FsClient;
  networkProfiles?: NetworkProfileDto[];
  onClose: () => void;
  onSelect: (mountUri: string) => void;
  onOpenNetwork?: () => void;
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

function NetworkNeighborhoodRow({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="fo-volume-item" onClick={onOpen}>
      <span className="fo-volume-name fo-volume-name-with-icon">
        {Icons.server()}
        Network
      </span>
      <span className="fo-volume-fs">servers</span>
      <span className="fo-volume-badge" title="Network neighborhood">
        ◈
      </span>
    </button>
  );
}

export function VolumePickerDialog({
  open,
  fs,
  networkProfiles = [],
  onClose,
  onSelect,
  onOpenNetwork,
}: VolumePickerDialogProps) {
  const [localVolumes, setLocalVolumes] = useState<VolumeDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const networkVolumes = useMemo(
    () =>
      networkProfiles
        .filter(
          (profile) =>
            profile.scheme === "sftp" ||
            profile.scheme === "smb" ||
            profile.scheme === "s3",
        )
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

  const hasLocal = localVolumes.length > 0;
  const hasNetwork = networkVolumes.length > 0;
  const hasNeighborhood = Boolean(onOpenNetwork);
  const hasAny = hasLocal || hasNetwork || hasNeighborhood;
  const showSectionLabels = hasLocal && hasNetwork;

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title="Volumes"
      className="fo-volume-picker"
    >
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
                  <VolumeRow key={vol.mountUri} vol={vol} onSelect={onSelect} />
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
                  <VolumeRow key={vol.mountUri} vol={vol} onSelect={onSelect} />
                ))}
              </>
            ) : null}
          </>
        ) : null}
        {!loading && onOpenNetwork ? (
          <>
            <p className="fo-volume-picker-section-title">
              Network neighborhood
            </p>
            <NetworkNeighborhoodRow onOpen={onOpenNetwork} />
          </>
        ) : null}
      </div>
    </DialogShell>
  );
}
