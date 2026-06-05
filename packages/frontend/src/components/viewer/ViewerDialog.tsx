import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Ref } from "react";
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
import { detectViewerMode, type ViewerMode } from "./detectViewerMode";
import { ViewerTextMode } from "./ViewerTextMode";
import { ViewerHexMode } from "./ViewerHexMode";
import { ViewerImageMode } from "./ViewerImageMode";
import { ViewerMediaMode } from "./ViewerMediaMode";
import { ViewerPdfMode } from "./ViewerPdfMode";
import { operationErrorMessage } from "../../dialogs/OperationDialogView";
import type { CodeMirrorPaneHandle } from "../codemirror/CodeMirrorPane";
import {
  type LocalPathPicker,
  pickLocalFileEntry,
  pickLocalPath as defaultPickLocalPath,
} from "../../utils/pathPicker";

interface ViewerDialogProps {
  open: boolean;
  entry: FileEntryDto | null;
  fs: FsClient;
  onClose: () => void;
  siblings?: FileEntryDto[];
  onNavigate?: (entry: FileEntryDto) => void;
  onEntryChange?: (entry: FileEntryDto) => void;
  pickLocalPath?: LocalPathPicker;
}

export function ViewerDialog({
  open,
  entry,
  fs,
  onClose,
  siblings,
  onNavigate,
  onEntryChange,
  pickLocalPath,
}: ViewerDialogProps) {
  const initialMode = useMemo(() => detectViewerMode(entry), [entry]);
  const [mode, setMode] = useState<ViewerMode>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, onClose]);

  // Gallery navigation helpers
  const currentIndex = useMemo(() => {
    if (!entry || !siblings) return -1;
    return siblings.findIndex((s) => s.uri === entry.uri);
  }, [entry, siblings]);

  const hasPrev = currentIndex > 0;
  const hasNext =
    siblings && currentIndex >= 0 && currentIndex < siblings.length - 1;

  if (!open || !entry) return null;

  return (
    <div
      className="fo-viewer-backdrop"
      role="dialog"
      aria-label="File viewer"
      aria-modal="true"
    >
      <div className="fo-viewer-modal">
        <ViewerContent
          entry={entry}
          fs={fs}
          mode={mode}
          onModeChange={setMode}
          onClose={onClose}
          siblings={siblings}
          currentIndex={currentIndex}
          hasPrev={hasPrev}
          hasNext={Boolean(hasNext)}
          onNavigate={onNavigate}
          onEntryChange={onEntryChange}
          pickLocalPath={pickLocalPath}
        />
      </div>
    </div>
  );
}

interface ViewerContentProps {
  entry: FileEntryDto;
  fs: FsClient;
  mode: ViewerMode;
  onModeChange: (mode: ViewerMode) => void;
  onClose?: () => void;
  siblings?: FileEntryDto[];
  currentIndex?: number;
  hasPrev?: boolean;
  hasNext?: boolean;
  onNavigate?: (entry: FileEntryDto) => void;
  onEntryChange?: (entry: FileEntryDto) => void;
  pickLocalPath?: LocalPathPicker;
  headerVariant?: "dialog" | "pane";
  showOpenExternalAction?: boolean;
}

export function ViewerContent({
  entry,
  fs,
  mode,
  onModeChange,
  onClose,
  siblings,
  currentIndex = -1,
  hasPrev = false,
  hasNext = false,
  onNavigate,
  onEntryChange,
  pickLocalPath = defaultPickLocalPath,
  headerVariant = "dialog",
  showOpenExternalAction = false,
}: ViewerContentProps) {
  const codeMirrorRef = useRef<CodeMirrorPaneHandle | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);

  const reportError = useCallback((err: unknown) => {
    if (err instanceof Error) {
      setMenuError(err.message);
      return;
    }
    const normalized = normalizeIpcError(err);
    setMenuError(operationErrorMessage(normalized.code, normalized.message));
  }, []);

  const runViewerCommand = useCallback(
    (command: Parameters<CodeMirrorPaneHandle["runCommand"]>[0]) => {
      codeMirrorRef.current?.runCommand(command);
      codeMirrorRef.current?.focus();
    },
    [],
  );

  const openPickedFile = useCallback(async () => {
    setMenuError(null);
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
  }, [entry.uri, fs, onEntryChange, pickLocalPath, reportError]);

  const copyAll = useCallback(() => {
    const text = codeMirrorRef.current?.getDocument() ?? "";
    if (text) void navigator.clipboard?.writeText(text);
  }, []);

  const openExternally = useCallback(() => {
    void fs.openPathWithDefaultApp({ uri: entry.uri }).catch(reportError);
  }, [entry.uri, fs, reportError]);

  const revealInFileManager = useCallback(() => {
    void fs.revealPathInFileManager({ uri: entry.uri }).catch(reportError);
  }, [entry.uri, fs, reportError]);

  const modeItems: DropdownMenuItem[] = [
    "text",
    "hex",
    "pdf",
    "image",
    "media",
  ].map((viewerMode) => ({
    id: `mode-${viewerMode}`,
    label: `${viewerMode.charAt(0).toUpperCase()}${viewerMode.slice(1)}`,
    checked: mode === viewerMode,
    onSelect: () => onModeChange(viewerMode as ViewerMode),
  }));

  const fileItems: DropdownMenuItem[] = [
    {
      id: "open",
      label: "Open...",
      onSelect: () => void openPickedFile(),
    },
    {
      id: "save",
      label: "Save",
      disabled: true,
      onSelect: () => {},
    },
    {
      id: "save-as",
      label: "Save As...",
      disabled: true,
      onSelect: () => {},
    },
    {
      id: "open-externally",
      label: "Open Externally",
      separatorBefore: true,
      onSelect: openExternally,
    },
    {
      id: "reveal",
      label: "Reveal in File Manager",
      onSelect: revealInFileManager,
    },
    {
      id: "close",
      label: "Close",
      separatorBefore: true,
      disabled: !onClose,
      onSelect: () => onClose?.(),
    },
  ];

  const editItems: DropdownMenuItem[] = [
    {
      id: "undo",
      label: "Undo",
      disabled: true,
      onSelect: () => runViewerCommand(undo),
    },
    {
      id: "redo",
      label: "Redo",
      disabled: true,
      onSelect: () => runViewerCommand(redo),
    },
    {
      id: "cut",
      label: "Cut",
      disabled: true,
      separatorBefore: true,
      onSelect: () => {},
    },
    {
      id: "copy",
      label: "Copy",
      disabled: mode !== "text",
      onSelect: () => {
        codeMirrorRef.current?.focus();
        document.execCommand("copy");
      },
    },
    {
      id: "paste",
      label: "Paste",
      disabled: true,
      onSelect: () => {},
    },
    {
      id: "select-all",
      label: "Select All",
      disabled: mode !== "text",
      separatorBefore: true,
      onSelect: () => runViewerCommand(selectAll),
    },
    {
      id: "copy-all",
      label: "Copy All",
      disabled: mode !== "text",
      onSelect: copyAll,
    },
  ];

  const searchItems: DropdownMenuItem[] = [
    {
      id: "find",
      label: "Find",
      disabled: mode !== "text",
      onSelect: () => runViewerCommand(openSearchPanel),
    },
    {
      id: "find-next",
      label: "Find Next",
      disabled: mode !== "text",
      onSelect: () => runViewerCommand(findNext),
    },
    {
      id: "find-previous",
      label: "Find Previous",
      disabled: mode !== "text",
      onSelect: () => runViewerCommand(findPrevious),
    },
    {
      id: "replace",
      label: "Replace",
      disabled: true,
      separatorBefore: true,
      onSelect: () => runViewerCommand(openSearchPanel),
    },
    {
      id: "replace-next",
      label: "Replace Next",
      disabled: true,
      onSelect: () => runViewerCommand(replaceNext),
    },
    {
      id: "replace-all",
      label: "Replace All",
      disabled: true,
      onSelect: () => runViewerCommand(replaceAll),
    },
  ];

  const viewItems: DropdownMenuItem[] = [
    {
      id: "mode",
      label: "Mode",
      onSelect: () => {},
      children: modeItems,
    },
  ];

  const menuBar = (
    <div className="fo-document-menubar" aria-label="Viewer menus">
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
      <DropdownMenu
        label="View"
        open={openMenu === "view"}
        items={viewItems}
        onOpenChange={(open) => setOpenMenu(open ? "view" : null)}
        align="start"
        triggerClassName="fo-document-menu-trigger"
      />
    </div>
  );

  return (
    <>
      <div className={`fo-viewer-header fo-viewer-header--${headerVariant}`}>
        <div className="fo-viewer-header-start">
          {menuBar}
          <span className="fo-viewer-title">{entry.name}</span>
        </div>
        <div className="fo-viewer-header-end">
          {showOpenExternalAction ? (
            <button
              type="button"
              className="fo-pane-content-action"
              onClick={openExternally}
            >
              Open externally
            </button>
          ) : null}
          <div className="fo-viewer-modes" role="tablist">
            <button
              role="tab"
              aria-selected={mode === "text"}
              onClick={() => onModeChange("text")}
              className="fo-viewer-mode-tab"
            >
              Text
            </button>
            <button
              role="tab"
              aria-selected={mode === "hex"}
              onClick={() => onModeChange("hex")}
              className="fo-viewer-mode-tab"
            >
              Hex
            </button>
            <button
              role="tab"
              aria-selected={mode === "pdf"}
              onClick={() => onModeChange("pdf")}
              className="fo-viewer-mode-tab"
            >
              PDF
            </button>
            <button
              role="tab"
              aria-selected={mode === "image"}
              onClick={() => onModeChange("image")}
              className="fo-viewer-mode-tab"
            >
              Image
            </button>
            <button
              role="tab"
              aria-selected={mode === "media"}
              onClick={() => onModeChange("media")}
              className="fo-viewer-mode-tab"
            >
              Media
            </button>
          </div>
          {siblings && siblings.length > 1 && (
            <div className="fo-viewer-gallery-nav">
              <button
                className="fo-viewer-nav-btn"
                aria-label="Previous image"
                disabled={!hasPrev}
                onClick={() => {
                  if (hasPrev && onNavigate) {
                    onNavigate(siblings[currentIndex - 1]);
                  }
                }}
              >
                ‹
              </button>
              <span className="fo-viewer-gallery-counter">
                {currentIndex + 1} / {siblings.length}
              </span>
              <button
                className="fo-viewer-nav-btn"
                aria-label="Next image"
                disabled={!hasNext}
                onClick={() => {
                  if (hasNext && onNavigate) {
                    onNavigate(siblings[currentIndex + 1]);
                  }
                }}
              >
                ›
              </button>
            </div>
          )}
          {onClose ? (
            <button
              className="fo-viewer-close"
              onClick={onClose}
              title="Close viewer (Esc)"
              aria-label="Close viewer"
            >
              ✕
            </button>
          ) : null}
        </div>
      </div>
      {menuError ? <div className="fo-viewer-error">{menuError}</div> : null}
      <div className="fo-viewer-body" data-mode={mode}>
        <ViewerBody
          mode={mode}
          entry={entry}
          fs={fs}
          codeMirrorRef={codeMirrorRef}
        />
      </div>
    </>
  );
}

function ViewerBody({
  mode,
  entry,
  fs,
  codeMirrorRef,
}: {
  mode: ViewerMode;
  entry: FileEntryDto;
  fs: FsClient;
  codeMirrorRef?: Ref<CodeMirrorPaneHandle>;
}) {
  if (mode === "text") {
    return (
      <ViewerTextMode entry={entry} fs={fs} codeMirrorRef={codeMirrorRef} />
    );
  }
  if (mode === "hex") return <ViewerHexMode entry={entry} fs={fs} />;
  if (mode === "pdf") return <ViewerPdfMode entry={entry} fs={fs} />;
  if (mode === "image") return <ViewerImageMode entry={entry} fs={fs} />;
  if (mode === "media") return <ViewerMediaMode entry={entry} fs={fs} />;
  return null;
}
