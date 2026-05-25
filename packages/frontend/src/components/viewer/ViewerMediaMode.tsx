import { useEffect, useRef, useState } from "react";
import type { FileEntryDto, FsClient } from "@fileoctopus/ts-api";
import { normalizeIpcError } from "@fileoctopus/ts-api";
import { operationErrorMessage } from "../../dialogs/OperationDialogView";
import { isAudioEntry } from "./detectViewerMode";

interface ViewerMediaModeProps {
  entry: FileEntryDto;
  fs: FsClient;
}

export function ViewerMediaMode({ entry, fs }: ViewerMediaModeProps) {
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [byteSize, setByteSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);

  const isAudio = isAudioEntry(entry);

  useEffect(() => {
    let cancelled = false;
    setDataUri(null);
    setByteSize(null);
    setError(null);
    setLoading(true);
    fs.readImageAsDataUri({ uri: entry.uri })
      .then((response) => {
        if (cancelled) return;
        setDataUri(response.dataUri);
        setByteSize(response.byteSize);
      })
      .catch((err) => {
        if (cancelled) return;
        const normalized = normalizeIpcError(err);
        setError(operationErrorMessage(normalized.code, normalized.message));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entry.uri, fs]);

  if (loading) return <div className="fo-viewer-loading">Loading media…</div>;
  if (error) return <div className="fo-viewer-error">{error}</div>;
  if (!dataUri)
    return <div className="fo-viewer-placeholder">No media available</div>;

  return (
    <div className="fo-viewer-media-wrap">
      <div className="fo-viewer-media-name">{entry.name}</div>
      {isAudio ? (
        <audio
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          data-testid="viewer-audio"
          className="fo-viewer-audio"
          src={dataUri}
          controls
          autoPlay
        >
          Your browser does not support audio playback.
        </audio>
      ) : (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          data-testid="viewer-video"
          className="fo-viewer-video"
          src={dataUri}
          controls
          autoPlay
        >
          Your browser does not support video playback.
        </video>
      )}
      <div className="fo-viewer-footer">
        {byteSize !== null && (
          <span className="fo-viewer-filesize">
            {byteSize.toLocaleString()} bytes
          </span>
        )}
        {entry.modifiedAt && (
          <span className="fo-viewer-modified">
            Modified: {new Date(entry.modifiedAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}
