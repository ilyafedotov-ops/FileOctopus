import { useCallback, useEffect, useState } from "react";
import type { Ref } from "react";
import type {
  FileEntryDto,
  FsClient,
  ReadFileRangeResponse,
} from "@fileoctopus/ts-api";
import { normalizeIpcError } from "@fileoctopus/ts-api";
import { operationErrorMessage } from "../../dialogs/OperationDialogView";
import { CodeMirrorPane } from "../codemirror/CodeMirrorPane";
import type { CodeMirrorPaneHandle } from "../codemirror/CodeMirrorPane";

const PAGE_BYTES = 256 * 1024;

interface ViewerTextModeProps {
  entry: FileEntryDto;
  fs: FsClient;
  codeMirrorRef?: Ref<CodeMirrorPaneHandle>;
}

function decodeBase64ToString(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export function ViewerTextMode({
  entry,
  fs,
  codeMirrorRef,
}: ViewerTextModeProps) {
  const [text, setText] = useState("");
  const [offset, setOffset] = useState(0);
  const [byteSize, setByteSize] = useState<number | null>(null);
  const [eof, setEof] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      const chunk = decodeBase64ToString(response.bytesBase64);
      setText((prev) => prev + chunk);
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
    setText("");
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

  const onScroll = useCallback(
    (node: HTMLElement) => {
      const remaining =
        node.scrollHeight - (node.scrollTop + node.clientHeight);
      if (remaining < 200 && !loading && !eof) {
        void loadNextPage();
      }
    },
    [eof, loadNextPage, loading],
  );

  return (
    <div className="fo-viewer-text">
      {error && <div className="fo-viewer-error">{error}</div>}
      <CodeMirrorPane
        ref={codeMirrorRef}
        key={entry.uri}
        fileName={entry.name}
        doc={text}
        readOnly
        onScroll={onScroll}
        className="fo-codemirror-pane fo-viewer-cm"
      />
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
