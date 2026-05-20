import { useCallback, useEffect, useRef, useState } from "react";
import type {
  FileEntryDto,
  FsClient,
  ReadFileRangeResponse,
} from "@fileoctopus/ts-api";
import { normalizeIpcError } from "@fileoctopus/ts-api";
import { operationErrorMessage } from "../../dialogs/OperationDialogView";

const PAGE_BYTES = 64 * 1024;
const BYTES_PER_ROW = 16;

interface ViewerHexModeProps {
  entry: FileEntryDto;
  fs: FsClient;
}

function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function pad(value: number, width: number, radix: number): string {
  return value.toString(radix).padStart(width, "0");
}

function asciiFor(byte: number): string {
  return byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : ".";
}

function formatHexRows(bytes: Uint8Array, startOffset: number): string {
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += BYTES_PER_ROW) {
    const slice = bytes.subarray(i, i + BYTES_PER_ROW);
    const hex = Array.from(slice)
      .map((b) => pad(b, 2, 16))
      .join(" ")
      .padEnd(BYTES_PER_ROW * 3 - 1, " ");
    const ascii = Array.from(slice).map(asciiFor).join("");
    lines.push(`${pad(startOffset + i, 8, 16)}  ${hex}  ${ascii}`);
  }
  return lines.join("\n");
}

export function ViewerHexMode({ entry, fs }: ViewerHexModeProps) {
  const [rows, setRows] = useState("");
  const [offset, setOffset] = useState(0);
  const [byteSize, setByteSize] = useState<number | null>(null);
  const [eof, setEof] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const loadNextPage = useCallback(async () => {
    if (loading || eof) return;
    setLoading(true);
    setError(null);
    try {
      const response: ReadFileRangeResponse = await fs.readFileRange({
        uri: entry.uri,
        offset,
        length: PAGE_BYTES,
      });
      const bytes = decodeBase64(response.bytesBase64);
      setRows(
        (prev) => (prev ? prev + "\n" : "") + formatHexRows(bytes, offset),
      );
      setOffset(offset + response.bytesRead);
      setByteSize(response.byteSize);
      setEof(response.eof);
    } catch (err) {
      const normalized = normalizeIpcError(err);
      setError(operationErrorMessage(normalized.code, normalized.message));
    } finally {
      setLoading(false);
    }
  }, [entry.uri, eof, fs, loading, offset]);

  useEffect(() => {
    setRows("");
    setOffset(0);
    setByteSize(null);
    setEof(false);
    setError(null);
  }, [entry.uri]);

  useEffect(() => {
    if (offset === 0 && !eof && !error) {
      void loadNextPage();
    }
  }, [eof, error, loadNextPage, offset]);

  const onScroll = useCallback(() => {
    const node = containerRef.current;
    if (!node) return;
    const remaining = node.scrollHeight - (node.scrollTop + node.clientHeight);
    if (remaining < 200 && !loading && !eof) {
      void loadNextPage();
    }
  }, [eof, loadNextPage, loading]);

  return (
    <div
      ref={containerRef}
      className="fo-viewer-hex"
      onScroll={onScroll}
      tabIndex={0}
    >
      {error && <div className="fo-viewer-error">{error}</div>}
      <pre className="fo-viewer-hex-body">{rows}</pre>
      {loading && <div className="fo-viewer-loading">Loading…</div>}
      {byteSize !== null && (
        <div className="fo-viewer-footer">
          {offset.toLocaleString()} / {byteSize.toLocaleString()} bytes
          {eof ? " (end)" : ""}
        </div>
      )}
    </div>
  );
}
