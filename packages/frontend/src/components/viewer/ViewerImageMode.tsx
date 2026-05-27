import { useEffect, useRef, useState } from "react";
import type { FileEntryDto, FsClient } from "@fileoctopus/ts-api";
import { normalizeIpcError } from "@fileoctopus/ts-api";
import { operationErrorMessage } from "../../dialogs/OperationDialogView";

interface ViewerImageModeProps {
  entry: FileEntryDto;
  fs: FsClient;
}

export function ViewerImageMode({ entry, fs }: ViewerImageModeProps) {
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [byteSize, setByteSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDataUri(null);
    setByteSize(null);
    setError(null);
    setDimensions(null);
    setLoading(true);
    fs.readFileAsDataUri({ uri: entry.uri, maxBytes: 20 * 1024 * 1024 })
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

  const handleImageLoad = () => {
    if (imgRef.current) {
      const w = imgRef.current.naturalWidth;
      const h = imgRef.current.naturalHeight;
      if (w && h) {
        setDimensions({ width: w, height: h });
      }
    }
  };

  if (loading) return <div className="fo-viewer-loading">Loading image…</div>;
  if (error) return <div className="fo-viewer-error">{error}</div>;
  if (!dataUri)
    return <div className="fo-viewer-placeholder">No image available</div>;

  return (
    <div className="fo-viewer-image-wrap">
      <img
        ref={imgRef}
        className="fo-viewer-image"
        src={dataUri}
        alt={entry.name}
        onLoad={handleImageLoad}
      />
      <div className="fo-viewer-footer">
        {dimensions && (
          <span className="fo-viewer-dimensions">
            {dimensions.width} × {dimensions.height}
          </span>
        )}
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
