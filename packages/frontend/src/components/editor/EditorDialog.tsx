import { useCallback, useEffect, useRef, useState } from "react";
import type { FileEntryDto, FsClient } from "@fileoctopus/ts-api";
import { displayPathFromUri, normalizeIpcError } from "@fileoctopus/ts-api";
import { DropdownMenu, type DropdownMenuItem } from "@fileoctopus/ui";
import { redo, selectAll, undo } from "@codemirror/commands";
import {
  findNext,
  findPrevious,
  openSearchPanel,
  replaceAll,
  replaceNext,
} from "@codemirror/search";
import { operationErrorMessage } from "../../dialogs/OperationDialogView";
import { EditorView } from "./EditorView";
import type { CodeMirrorPaneHandle } from "../codemirror/CodeMirrorPane";
import {
  type LocalPathPicker,
  pickLocalFileEntry,
  localPathToResourceUri,
  pickLocalPath as defaultPickLocalPath,
} from "../../utils/pathPicker";

interface EditorDialogProps {
  open: boolean;
  entry: FileEntryDto | null;
  fs: FsClient;
  onClose: () => void;
  onSaved?: () => void;
  onEntryChange?: (entry: FileEntryDto) => void;
  pickLocalPath?: LocalPathPicker;
}

export function EditorDialog({
  open,
  entry,
  fs,
  onClose,
  onSaved,
  onEntryChange,
  pickLocalPath,
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
          onEntryChange={onEntryChange}
          pickLocalPath={pickLocalPath}
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
  onEntryChange?: (entry: FileEntryDto) => void;
  pickLocalPath?: LocalPathPicker;
}

export function EditorContent({
  entry,
  fs,
  onClose,
  onSaved,
  onEntryChange,
  pickLocalPath = defaultPickLocalPath,
}: EditorContentProps) {
  const editorRef = useRef<CodeMirrorPaneHandle | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
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
    } catch (err) {
      const normalized = normalizeIpcError(err);
      setError(operationErrorMessage(normalized.code, normalized.message));
    } finally {
      setSaving(false);
    }
  }, [doc, entry, fs, isRemote, saving]);

  const reportError = useCallback((err: unknown) => {
    if (err instanceof Error) {
      setError(err.message);
      return;
    }
    const normalized = normalizeIpcError(err);
    setError(operationErrorMessage(normalized.code, normalized.message));
  }, []);

  const openPickedFile = useCallback(async () => {
    if (dirty) {
      setError("Save or discard changes before opening another file.");
      return;
    }
    setError(null);
    try {
      const nextEntry = await pickLocalFileEntry({
        fs,
        title: "Open document",
        currentPath: displayPathFromUri(entry.uri),
        pickLocalPath,
      });
      if (nextEntry) onEntryChange?.(nextEntry);
    } catch (err) {
      reportError(err);
    }
  }, [dirty, entry.uri, fs, onEntryChange, pickLocalPath, reportError]);

  const saveAs = useCallback(async () => {
    if (saving || isRemote) return;
    setSaving(true);
    setError(null);
    try {
      const selected = await pickLocalPath({
        kind: "save",
        title: "Save document as",
        currentPath: displayPathFromUri(entry.uri),
      });
      if (!selected) return;
      const uri = localPathToResourceUri(selected);
      await fs.writeTextFile({ uri, content: doc });
      const response = await fs.stat({ uri });
      setInitialDoc(doc);
      onSaved?.();
      onEntryChange?.(response.entry);
    } catch (err) {
      reportError(err);
    } finally {
      setSaving(false);
    }
  }, [
    doc,
    entry.uri,
    fs,
    isRemote,
    onEntryChange,
    onSaved,
    pickLocalPath,
    reportError,
    saving,
  ]);

  const runEditorCommand = useCallback(
    (command: Parameters<CodeMirrorPaneHandle["runCommand"]>[0]) => {
      editorRef.current?.runCommand(command);
      editorRef.current?.focus();
    },
    [],
  );

  const copyAll = useCallback(() => {
    void navigator.clipboard?.writeText(doc);
  }, [doc]);

  const fileItems: DropdownMenuItem[] = [
    {
      id: "open",
      label: "Open...",
      onSelect: () => void openPickedFile(),
    },
    {
      id: "save",
      label: "Save",
      shortcut: "Ctrl+S",
      disabled: !dirty || saving || isRemote,
      onSelect: () => void save(),
    },
    {
      id: "save-as",
      label: "Save As...",
      disabled: saving || isRemote,
      onSelect: () => void saveAs(),
    },
    {
      id: "open-externally",
      label: "Open Externally",
      separatorBefore: true,
      onSelect: () => {
        void fs.openPathWithDefaultApp({ uri: entry.uri }).catch(reportError);
      },
    },
    {
      id: "reveal",
      label: "Reveal in File Manager",
      onSelect: () => {
        void fs.revealPathInFileManager({ uri: entry.uri }).catch(reportError);
      },
    },
    {
      id: "close",
      label: "Close",
      separatorBefore: true,
      onSelect: requestClose,
    },
  ];

  const editItems: DropdownMenuItem[] = [
    {
      id: "undo",
      label: "Undo",
      shortcut: "Ctrl+Z",
      onSelect: () => runEditorCommand(undo),
    },
    {
      id: "redo",
      label: "Redo",
      shortcut: "Ctrl+Shift+Z",
      onSelect: () => runEditorCommand(redo),
    },
    {
      id: "cut",
      label: "Cut",
      separatorBefore: true,
      onSelect: () => {
        editorRef.current?.focus();
        document.execCommand("cut");
      },
    },
    {
      id: "copy",
      label: "Copy",
      onSelect: () => {
        editorRef.current?.focus();
        document.execCommand("copy");
      },
    },
    {
      id: "paste",
      label: "Paste",
      onSelect: () => {
        editorRef.current?.focus();
        document.execCommand("paste");
      },
    },
    {
      id: "select-all",
      label: "Select All",
      shortcut: "Ctrl+A",
      separatorBefore: true,
      onSelect: () => runEditorCommand(selectAll),
    },
    {
      id: "copy-all",
      label: "Copy All",
      onSelect: copyAll,
    },
  ];

  const searchItems: DropdownMenuItem[] = [
    {
      id: "find",
      label: "Find",
      shortcut: "Ctrl+F",
      onSelect: () => runEditorCommand(openSearchPanel),
    },
    {
      id: "find-next",
      label: "Find Next",
      shortcut: "F3",
      onSelect: () => runEditorCommand(findNext),
    },
    {
      id: "find-previous",
      label: "Find Previous",
      shortcut: "Shift+F3",
      onSelect: () => runEditorCommand(findPrevious),
    },
    {
      id: "replace",
      label: "Replace",
      separatorBefore: true,
      onSelect: () => runEditorCommand(openSearchPanel),
    },
    {
      id: "replace-next",
      label: "Replace Next",
      onSelect: () => runEditorCommand(replaceNext),
    },
    {
      id: "replace-all",
      label: "Replace All",
      onSelect: () => runEditorCommand(replaceAll),
    },
  ];

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
        <div className="fo-document-menubar" aria-label="Editor menus">
          <DropdownMenu
            label="File"
            open={openMenu === "file"}
            items={fileItems}
            onOpenChange={(open) => setOpenMenu(open ? "file" : null)}
            align="start"
            triggerClassName="fo-document-menu-trigger"
          />
          <DropdownMenu
            label="Edit"
            open={openMenu === "edit"}
            items={editItems}
            onOpenChange={(open) => setOpenMenu(open ? "edit" : null)}
            align="start"
            triggerClassName="fo-document-menu-trigger"
          />
          <DropdownMenu
            label="Search"
            open={openMenu === "search"}
            items={searchItems}
            onOpenChange={(open) => setOpenMenu(open ? "search" : null)}
            align="start"
            triggerClassName="fo-document-menu-trigger"
          />
        </div>
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
        {loading && (
          <div className="fo-editor-loading">
            {entry?.isPlaceholder ? "Downloading from cloud…" : "Loading…"}
          </div>
        )}
        {error && <div className="fo-editor-error">{error}</div>}
        {!loading && initialDoc !== null && (
          <EditorView
            ref={editorRef}
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
