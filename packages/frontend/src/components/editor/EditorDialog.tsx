import { useCallback, useEffect, useState } from "react";
import type { FileEntryDto, FsClient } from "@fileoctopus/ts-api";
import { normalizeIpcError } from "@fileoctopus/ts-api";
import { operationErrorMessage } from "../../dialogs/OperationDialogView";
import { EditorView } from "./EditorView";

interface EditorDialogProps {
  open: boolean;
  entry: FileEntryDto | null;
  fs: FsClient;
  onClose: () => void;
  onSaved?: () => void;
}

export function EditorDialog({
  open,
  entry,
  fs,
  onClose,
  onSaved,
}: EditorDialogProps) {
  if (!open || !entry) return null;

  return (
    <div
      className="fo-editor-backdrop"
      role="dialog"
      aria-label="File editor"
      aria-modal="true"
    >
      <div className="fo-editor-modal">
        <EditorContent
          entry={entry}
          fs={fs}
          onClose={onClose}
          onSaved={onSaved}
        />
      </div>
    </div>
  );
}

interface EditorContentProps {
  entry: FileEntryDto;
  fs: FsClient;
  onClose: () => void;
  onSaved?: () => void;
}

export function EditorContent({
  entry,
  fs,
  onClose,
  onSaved,
}: EditorContentProps) {
  const [initialDoc, setInitialDoc] = useState<string | null>(null);
  const [doc, setDoc] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const isRemote = entry ? !entry.uri.startsWith("local://") : false;
  const dirty = initialDoc !== null && doc !== initialDoc;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setInitialDoc(null);
    setDoc("");
    setConfirmClose(false);
    fs.readTextFile({ uri: entry.uri, maxBytes: 10 * 1024 * 1024 })
      .then((response) => {
        if (cancelled) return;
        if (response.truncated) {
          setError(
            "File is larger than the 10 MB editor cap and was truncated. Editing would lose data — close and use a system editor instead.",
          );
        }
        setInitialDoc(response.content);
        setDoc(response.content);
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
  }, [entry, fs]);

  const requestClose = useCallback(() => {
    if (dirty) {
      setConfirmClose(true);
      return;
    }
    onClose();
  }, [dirty, onClose]);

  const save = useCallback(async () => {
    if (!entry || saving || isRemote) return;
    setSaving(true);
    setError(null);
    try {
      await fs.writeTextFile({ uri: entry.uri, content: doc });
      setInitialDoc(doc);
      onSaved?.();
    } catch (err) {
      const normalized = normalizeIpcError(err);
      setError(operationErrorMessage(normalized.code, normalized.message));
    } finally {
      setSaving(false);
    }
  }, [doc, entry, fs, isRemote, onSaved, saving]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        requestClose();
      } else if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        event.stopPropagation();
        void save();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [requestClose, save]);

  return (
    <>
      <div className="fo-editor-header">
        <span className="fo-editor-title">
          {entry.name}
          {dirty && <span className="fo-editor-dirty"> •</span>}
        </span>
        {isRemote && (
          <span className="fo-editor-readonly-tag">read-only (remote)</span>
        )}
        <button
          className="fo-editor-save"
          onClick={() => void save()}
          disabled={!dirty || saving || isRemote}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          className="fo-editor-close"
          onClick={requestClose}
          title="Close (Esc)"
          aria-label="Close editor"
        >
          ✕
        </button>
      </div>
      <div className="fo-editor-body">
        {loading && <div className="fo-editor-loading">Loading…</div>}
        {error && <div className="fo-editor-error">{error}</div>}
        {!loading && initialDoc !== null && (
          <EditorView
            key={entry.uri}
            fileName={entry.name}
            initialDoc={initialDoc}
            onChange={setDoc}
            onSaveRequested={() => void save()}
          />
        )}
      </div>
      {confirmClose && (
        <div className="fo-editor-confirm">
          <div className="fo-editor-confirm-message">
            You have unsaved changes. Discard and close?
          </div>
          <div className="fo-editor-confirm-actions">
            <button onClick={() => setConfirmClose(false)}>Keep editing</button>
            <button
              onClick={() => {
                setConfirmClose(false);
                onClose();
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </>
  );
}
