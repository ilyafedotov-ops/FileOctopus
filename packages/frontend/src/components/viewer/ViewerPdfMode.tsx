import { useEffect, useState } from "react";
import type { FileEntryDto, FsClient } from "@fileoctopus/ts-api";
import { normalizeIpcError } from "@fileoctopus/ts-api";
import { operationErrorMessage } from "../../dialogs/OperationDialogView";

interface ViewerPdfModeProps {
  entry: FileEntryDto;
  fs: FsClient;
}

const MAX_PDF_BYTES = 20 * 1024 * 1024;

export function ViewerPdfMode({ entry, fs }: ViewerPdfModeProps) {
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [byteSize, setByteSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDataUri(null);
    setByteSize(null);
    setError(null);
    setLoading(true);
    fs.readFileAsDataUri({ uri: entry.uri, maxBytes: MAX_PDF_BYTES })
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

  if (loading) return <div className="fo-viewer-loading">Loading PDF…</div>;
  if (error) return <div className="fo-viewer-error">{error}</div>;
  if (!dataUri)
    return <div className="fo-viewer-placeholder">No PDF available</div>;

  return (
    <div className="fo-viewer-pdf-wrap">
      <object
        className="fo-viewer-pdf"
        data={dataUri}
        type="application/pdf"
        title="PDF viewer"
      />
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
