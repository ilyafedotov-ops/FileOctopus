import { useEffect, useMemo, useState } from "react";
import type { FileOctopusClient, VolumeDto } from "@fileoctopus/ts-api";
import { localPathFromUri } from "../utils/paneUtils";

interface StorageGaugeProps {
  uri: string;
  client: FileOctopusClient;
}

export function StorageGauge({ uri, client }: StorageGaugeProps) {
  const [volumes, setVolumes] = useState<VolumeDto[]>([]);

  useEffect(() => {
    let cancelled = false;
    client.fs
      .discoverVolumes()
      .then((res) => {
        if (!cancelled) setVolumes(res.volumes);
      })
      .catch(() => {
        // silently ignore — gauge is decorative
      });
    return () => {
      cancelled = true;
    };
  }, [client, uri]);

  const matched = useMemo(() => {
    const path = localPathFromUri(uri);
    let best: VolumeDto | null = null;
    let bestLen = -1;
    for (const vol of volumes) {
      const mountPath = localPathFromUri(vol.mountUri);
      if (path.startsWith(mountPath) && mountPath.length > bestLen) {
        best = vol;
        bestLen = mountPath.length;
      }
    }
    return best;
  }, [uri, volumes]);

  if (
    !matched ||
    matched.totalBytes == null ||
    matched.availableBytes == null
  ) {
    return null;
  }

  const total = matched.totalBytes;
  const available = matched.availableBytes;
  const used = total - available;
  const pct = Math.max(0, Math.min(100, Math.round((used / total) * 100)));

  return (
    <span className="fo-storage-gauge" title={`${matched.name} — ${pct}% used`}>
      <span className="fo-storage-gauge-bar" aria-hidden="true">
        <span className="fo-storage-gauge-fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="fo-storage-gauge-text">{matched.name}</span>
    </span>
  );
}
