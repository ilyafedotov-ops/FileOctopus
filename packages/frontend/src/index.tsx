import {
  Component,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  createFileOctopusClient,
  normalizeIpcError,
} from "@fileoctopus/ts-api";
import type {
  ConflictPolicy,
  FileEntryDto,
  FileOperationPlanDto,
  FileOperationKind,
  JobCancelledEvent,
  JobCompletedEvent,
  JobFailedEvent,
  JobProgressEvent,
  JobSnapshot,
  JobStartedEvent,
  OperationHistoryRecordDto,
} from "@fileoctopus/ts-api";
import {
  activeTab,
  createInitialState,
  normalizeLocalInput,
  panelReducer,
  parentUri,
  selectVisibleEntries,
  type PanelId,
  type PanelTabState,
  type SortField,
} from "./panelStore";

const rowHeight = 30;
const overscan = 8;

type CopyMoveKind = Extract<FileOperationKind, "copy" | "move">;

type OperationDialog =
  | {
      type: "createFolder";
      panelId: PanelId;
      name: string;
      error: string | null;
    }
  | {
      type: "rename";
      panelId: PanelId;
      entry: FileEntryDto;
      name: string;
      error: string | null;
    }
  | {
      type: "copyMove";
      panelId: PanelId;
      kind: CopyMoveKind;
      entries: FileEntryDto[];
      destination: string;
      conflictPolicy: ConflictPolicy;
      plan: FileOperationPlanDto | null;
      planning: boolean;
      error: string | null;
    }
  | {
      type: "trash";
      panelId: PanelId;
      entries: FileEntryDto[];
      error: string | null;
    };

export function FileOctopusShell() {
  const client = useMemo(() => createFileOctopusClient(), []);
  const [state, dispatch] = useReducer(panelReducer, undefined, () =>
    createInitialState(),
  );
  const [jobs, setJobs] = useState<Record<string, JobSnapshot>>({});
  const [history, setHistory] = useState<OperationHistoryRecordDto[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<OperationDialog | null>(null);
  const left = activeTab(state.panels.left);
  const right = activeTab(state.panels.right);

  useEffect(() => {
    client.fs
      .onDirectoryBatch((event) =>
        dispatch({ type: "applyBatch", batch: event }),
      )
      .catch((error) => {
        const normalized = normalizeIpcError(error);
        dispatch({
          type: "setError",
          panelId: "left",
          error: normalized.message,
        });
      });
  }, [client]);

  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    const remember = (event: JobSnapshot) =>
      setJobs((current) => ({
        ...current,
        [jobIdValue(event.jobId)]: event,
      }));

    Promise.all([
      client.fileOperations.onJobStarted((event) => {
        remember(snapshotFromStarted(event));
      }),
      client.fileOperations.onJobProgress((event) => {
        setJobs((current) => ({
          ...current,
          [jobIdValue(event.jobId)]: mergeProgress(current, event),
        }));
      }),
      client.fileOperations.onJobCompleted((event) => {
        setJobs((current) => ({
          ...current,
          [jobIdValue(event.jobId)]: mergeCompleted(current, event),
        }));
        refreshVisiblePanels();
        void refreshHistory();
      }),
      client.fileOperations.onJobFailed((event) => {
        setJobs((current) => ({
          ...current,
          [jobIdValue(event.jobId)]: mergeFailed(current, event),
        }));
        void refreshHistory();
      }),
      client.fileOperations.onJobCancelled((event) => {
        setJobs((current) => ({
          ...current,
          [jobIdValue(event.jobId)]: mergeCancelled(current, event),
        }));
        refreshVisiblePanels();
        void refreshHistory();
      }),
    ])
      .then((items) => unlisteners.push(...items))
      .catch((error) => {
        setOperationError(normalizeIpcError(error).message);
      });

    return () => {
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, [client, left.uri, right.uri]);

  useEffect(() => {
    void navigatePanel("left", activeTab(state.panels.left).uri);
    void navigatePanel("right", activeTab(state.panels.right).uri);
    void refreshHistory();
  }, []);

  async function navigatePanel(panelId: PanelId, input: string) {
    const uri = normalizeLocalInput(input);

    if (!uri.startsWith("local://")) {
      dispatch({
        type: "setError",
        panelId,
        error: "Enter a local:// URI or absolute path",
      });
      return;
    }

    dispatch({ type: "navigate", panelId, uri });

    try {
      const response = await client.fs.listStart({
        uri,
        batchSize: 256,
        includeHidden: false,
      });
      dispatch({
        type: "startSession",
        panelId,
        sessionId: response.sessionId,
      });
    } catch (error) {
      const normalized = normalizeIpcError(error);
      dispatch({ type: "setError", panelId, error: normalized.message });
    }
  }

  function activateEntry(panelId: PanelId, entry: FileEntryDto | null) {
    if (!entry) {
      return;
    }

    if (entry.kind === "directory") {
      void navigatePanel(panelId, entry.uri);
      return;
    }

    dispatch({
      type: "setError",
      panelId,
      error: "File activation is not implemented in Sprint 1",
    });
  }

  function refreshVisiblePanels() {
    void navigatePanel("left", activeTab(state.panels.left).uri);
    void navigatePanel("right", activeTab(state.panels.right).uri);
  }

  async function refreshHistory() {
    try {
      const response = await client.operationHistory.listRecentOperations({
        limit: 20,
      });
      setHistory(response.operations);
    } catch (error) {
      setOperationError(normalizeIpcError(error).message);
    }
  }

  async function planOperation(
    kind: FileOperationKind,
    sources: string[],
    destination?: string,
    newName?: string,
    conflictPolicy: ConflictPolicy = "fail",
  ) {
    return client.fileOperations.planFileOperation({
      operation: {
        kind,
        sources,
        destination,
        newName,
        conflictPolicy,
      },
    });
  }

  async function startPlannedOperation(
    plan: FileOperationPlanDto,
  ): Promise<boolean> {
    try {
      const started = await client.fileOperations.startFileOperation({ plan });

      setJobs((current) => ({
        ...current,
        [jobIdValue(started.job.jobId)]: started.job,
      }));
      return true;
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setOperationError(
        operationErrorMessage(normalized.code, normalized.message),
      );
      return false;
    }
  }

  async function startOperation(
    kind: FileOperationKind,
    sources: string[],
    destination?: string,
    newName?: string,
    conflictPolicy: ConflictPolicy = "fail",
  ): Promise<boolean> {
    setOperationError(null);

    try {
      const planResponse = await planOperation(
        kind,
        sources,
        destination,
        newName,
        conflictPolicy,
      );

      return startPlannedOperation(planResponse.plan);
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setOperationError(
        operationErrorMessage(normalized.code, normalized.message),
      );
      return false;
    }
  }

  async function reviewCopyMoveDialog(
    current: Extract<OperationDialog, { type: "copyMove" }>,
  ) {
    setOperationError(null);
    setDialog({ ...current, planning: true, error: null });

    try {
      const planResponse = await planOperation(
        current.kind,
        current.entries.map((entry) => entry.uri),
        normalizeLocalInput(current.destination),
        undefined,
        current.conflictPolicy,
      );

      setDialog({ ...current, plan: planResponse.plan, planning: false });
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setDialog({
        ...current,
        planning: false,
        error: operationErrorMessage(normalized.code, normalized.message),
      });
    }
  }

  function selectedEntries(panelId: PanelId): FileEntryDto[] {
    const tab = activeTab(state.panels[panelId]);

    return tab.selectedIds
      .map((id) => tab.entriesById[id])
      .filter((entry): entry is FileEntryDto => Boolean(entry));
  }

  function handleCreateFolder(panelId: PanelId) {
    setDialog({
      type: "createFolder",
      panelId,
      name: "New Folder",
      error: null,
    });
  }

  function handleRename(panelId: PanelId) {
    const entries = selectedEntries(panelId);
    const entry = entries[0];

    if (entries.length !== 1 || !entry) {
      return;
    }

    setDialog({
      type: "rename",
      panelId,
      entry,
      name: entry.name,
      error: null,
    });
  }

  function handleCopyOrMove(panelId: PanelId, kind: CopyMoveKind) {
    const entries = selectedEntries(panelId);
    const otherPanel = panelId === "left" ? "right" : "left";
    const defaultDestination = activeTab(state.panels[otherPanel]).uri;

    if (entries.length === 0) {
      return;
    }

    setDialog({
      type: "copyMove",
      panelId,
      kind,
      entries,
      destination: defaultDestination,
      conflictPolicy: "fail",
      plan: null,
      planning: false,
      error: null,
    });
  }

  function handleTrash(panelId: PanelId) {
    const entries = selectedEntries(panelId);

    if (entries.length === 0) {
      return;
    }

    setDialog({ type: "trash", panelId, entries, error: null });
  }

  async function submitCreateFolder(
    current: Extract<OperationDialog, { type: "createFolder" }>,
  ) {
    const name = current.name.trim();

    if (!isValidName(name)) {
      setDialog({
        ...current,
        error: "Enter a folder name without path separators.",
      });
      return;
    }

    const tab = activeTab(state.panels[current.panelId]);
    const ok = await startOperation(
      "createDirectory",
      [],
      joinLocalUri(tab.uri, name),
    );

    if (ok) {
      setDialog(null);
      refreshVisiblePanels();
    }
  }

  async function submitRename(
    current: Extract<OperationDialog, { type: "rename" }>,
  ) {
    const name = current.name.trim();

    if (!isValidName(name)) {
      setDialog({ ...current, error: "Enter a name without path separators." });
      return;
    }

    const ok = await startOperation(
      "rename",
      [current.entry.uri],
      undefined,
      name,
    );

    if (ok) {
      setDialog(null);
      refreshVisiblePanels();
    }
  }

  async function submitCopyMove(
    current: Extract<OperationDialog, { type: "copyMove" }>,
  ) {
    if (!current.destination.trim()) {
      setDialog({ ...current, error: "Enter a destination local URI." });
      return;
    }

    if (!current.plan) {
      await reviewCopyMoveDialog(current);
      return;
    }

    const ok = await startPlannedOperation(current.plan);

    if (ok) {
      setDialog(null);
    }
  }

  async function submitTrash(
    current: Extract<OperationDialog, { type: "trash" }>,
  ) {
    const ok = await startOperation(
      "deleteToTrash",
      current.entries.map((entry) => entry.uri),
    );

    if (ok) {
      setDialog(null);
    }
  }

  function handleShellKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") {
      return;
    }

    event.preventDefault();
    dispatch({
      type: "setActivePanel",
      panelId: state.activePanelId === "left" ? "right" : "left",
    });
  }

  return (
    <ErrorBoundary>
      <main className="fo-shell" onKeyDown={handleShellKeyDown}>
        <header className="fo-topbar">
          <div>
            <h1>FileOctopus</h1>
            <p>Rust-owned local navigation</p>
          </div>
          <div className="fo-command-strip">
            <span>{state.activePanelId.toUpperCase()}</span>
          </div>
        </header>
        <section className="fo-panels" aria-label="File panels">
          <FilePanel
            panelId="left"
            title="Left"
            tab={left}
            active={state.activePanelId === "left"}
            onActivate={() =>
              dispatch({ type: "setActivePanel", panelId: "left" })
            }
            onNavigate={(uri) => navigatePanel("left", uri)}
            onSelect={(entryId) =>
              dispatch({ type: "setSelection", panelId: "left", entryId })
            }
            onEntrySelect={(entryId, mode) =>
              dispatch({ type: "selectEntry", panelId: "left", entryId, mode })
            }
            onCreateFolder={() => handleCreateFolder("left")}
            onRename={() => handleRename("left")}
            onCopy={() => handleCopyOrMove("left", "copy")}
            onMoveOperation={() => handleCopyOrMove("left", "move")}
            onTrash={() => handleTrash("left")}
            onMove={(delta) =>
              dispatch({ type: "moveSelection", panelId: "left", delta })
            }
            onSort={(field) =>
              dispatch({ type: "setSort", panelId: "left", field })
            }
            onFilter={(filter) =>
              dispatch({ type: "setFilter", panelId: "left", filter })
            }
            onEntryActivate={(entry) => activateEntry("left", entry)}
          />
          <FilePanel
            panelId="right"
            title="Right"
            tab={right}
            active={state.activePanelId === "right"}
            onActivate={() =>
              dispatch({ type: "setActivePanel", panelId: "right" })
            }
            onNavigate={(uri) => navigatePanel("right", uri)}
            onSelect={(entryId) =>
              dispatch({ type: "setSelection", panelId: "right", entryId })
            }
            onEntrySelect={(entryId, mode) =>
              dispatch({
                type: "selectEntry",
                panelId: "right",
                entryId,
                mode,
              })
            }
            onCreateFolder={() => handleCreateFolder("right")}
            onRename={() => handleRename("right")}
            onCopy={() => handleCopyOrMove("right", "copy")}
            onMoveOperation={() => handleCopyOrMove("right", "move")}
            onTrash={() => handleTrash("right")}
            onMove={(delta) =>
              dispatch({ type: "moveSelection", panelId: "right", delta })
            }
            onSort={(field) =>
              dispatch({ type: "setSort", panelId: "right", field })
            }
            onFilter={(filter) =>
              dispatch({ type: "setFilter", panelId: "right", filter })
            }
            onEntryActivate={(entry) => activateEntry("right", entry)}
          />
        </section>
        <JobActivityPanel
          jobs={Object.values(jobs)}
          history={history}
          error={operationError}
          onCancel={(jobId) => void client.jobs.cancelJob({ jobId })}
          onRefreshHistory={() => void refreshHistory()}
        />
        <OperationDialogView
          dialog={dialog}
          onClose={() => setDialog(null)}
          onUpdate={(next) => setDialog(next)}
          onReviewCopyMove={(current) => void reviewCopyMoveDialog(current)}
          onSubmitCreateFolder={(current) => void submitCreateFolder(current)}
          onSubmitRename={(current) => void submitRename(current)}
          onSubmitCopyMove={(current) => void submitCopyMove(current)}
          onSubmitTrash={(current) => void submitTrash(current)}
        />
        <footer className="fo-status">
          {left.selectedIds.length + right.selectedIds.length} selected,{" "}
          {left.orderedEntryIds.length + right.orderedEntryIds.length} entries
          loaded
        </footer>
      </main>
    </ErrorBoundary>
  );
}

interface FilePanelProps {
  panelId: PanelId;
  title: string;
  tab: PanelTabState;
  active: boolean;
  onActivate: () => void;
  onNavigate: (uri: string) => void;
  onSelect: (entryId: string | null) => void;
  onEntrySelect: (entryId: string, mode: "single" | "toggle" | "range") => void;
  onMove: (delta: number) => void;
  onSort: (field: SortField) => void;
  onFilter: (filter: string) => void;
  onEntryActivate: (entry: FileEntryDto | null) => void;
  onCreateFolder: () => void;
  onRename: () => void;
  onCopy: () => void;
  onMoveOperation: () => void;
  onTrash: () => void;
}

function FilePanel({
  panelId,
  title,
  tab,
  active,
  onActivate,
  onNavigate,
  onSelect,
  onEntrySelect,
  onMove,
  onSort,
  onFilter,
  onEntryActivate,
  onCreateFolder,
  onRename,
  onCopy,
  onMoveOperation,
  onTrash,
}: FilePanelProps) {
  const entries = selectVisibleEntries(tab);
  const selectedEntry =
    entries.find((entry) => entry.uri === tab.selectedId) ?? null;
  const upUri = parentUri(tab.uri);

  return (
    <section
      className={active ? "fo-panel fo-panel-active" : "fo-panel"}
      onFocus={onActivate}
    >
      <header className="fo-panel-header">
        <span>{title}</span>
        <span>{tab.loading ? "Loading" : `${entries.length} shown`}</span>
      </header>
      <div className="fo-panel-body">
        <div className="fo-panel-tools">
          <button
            type="button"
            disabled={!upUri}
            onClick={() => upUri && onNavigate(upUri)}
          >
            Up
          </button>
          <PathBar value={tab.uri} error={tab.error} onSubmit={onNavigate} />
          <input
            className="fo-filter"
            aria-label={`${panelId} filter`}
            value={tab.filter}
            placeholder="Filter"
            onChange={(event) => onFilter(event.target.value)}
          />
        </div>
        <OperationToolbar
          selectedCount={tab.selectedIds.length}
          canRename={tab.selectedIds.length === 1}
          onCreateFolder={onCreateFolder}
          onRename={onRename}
          onCopy={onCopy}
          onMove={onMoveOperation}
          onTrash={onTrash}
        />
        {tab.error ? (
          <div className="fo-panel-error">
            <span>{tab.error}</span>
            <button type="button" onClick={() => onNavigate(tab.uri)}>
              Retry
            </button>
          </div>
        ) : null}
        <FileTable
          entries={entries}
          loading={tab.loading}
          selectedId={tab.selectedId}
          selectedIds={tab.selectedIds}
          focusedId={tab.focusedId}
          sortField={tab.sort.field}
          sortDirection={tab.sort.direction}
          onSelect={onSelect}
          onEntrySelect={onEntrySelect}
          onMove={onMove}
          onSort={onSort}
          onActivate={() => onEntryActivate(selectedEntry)}
          onEntryActivate={onEntryActivate}
        />
      </div>
    </section>
  );
}

interface PathBarProps {
  value: string;
  error: string | null;
  onSubmit: (value: string) => void;
}

function PathBar({ value, error, onSubmit }: PathBarProps) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [editing, value]);

  return (
    <input
      className={error ? "fo-path fo-path-error" : "fo-path"}
      value={editing ? draft : value}
      aria-label="Current path"
      onFocus={() => setEditing(true)}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          setEditing(false);
          onSubmit(draft);
        }

        if (event.key === "Escape") {
          setEditing(false);
          setDraft(value);
        }
      }}
      onBlur={() => {
        setEditing(false);
        setDraft(value);
      }}
    />
  );
}

interface OperationToolbarProps {
  selectedCount: number;
  canRename: boolean;
  onCreateFolder: () => void;
  onRename: () => void;
  onCopy: () => void;
  onMove: () => void;
  onTrash: () => void;
}

function OperationToolbar({
  selectedCount,
  canRename,
  onCreateFolder,
  onRename,
  onCopy,
  onMove,
  onTrash,
}: OperationToolbarProps) {
  return (
    <div className="fo-operation-toolbar" aria-label="File operations">
      <button type="button" onClick={onCreateFolder}>
        New Folder
      </button>
      <button type="button" disabled={!canRename} onClick={onRename}>
        Rename
      </button>
      <button type="button" disabled={selectedCount === 0} onClick={onCopy}>
        Copy
      </button>
      <button type="button" disabled={selectedCount === 0} onClick={onMove}>
        Move
      </button>
      <button type="button" disabled={selectedCount === 0} onClick={onTrash}>
        Move to Trash
      </button>
      <span>{selectedCount} selected</span>
    </div>
  );
}

interface FileTableProps {
  entries: FileEntryDto[];
  loading: boolean;
  selectedId: string | null;
  selectedIds: string[];
  focusedId: string | null;
  sortField: SortField;
  sortDirection: string;
  onSelect: (entryId: string | null) => void;
  onEntrySelect: (entryId: string, mode: "single" | "toggle" | "range") => void;
  onMove: (delta: number) => void;
  onSort: (field: SortField) => void;
  onActivate: () => void;
  onEntryActivate: (entry: FileEntryDto | null) => void;
}

function FileTable({
  entries,
  loading,
  selectedId,
  selectedIds,
  focusedId,
  sortField,
  sortDirection,
  onSelect,
  onEntrySelect,
  onMove,
  onSort,
  onActivate,
  onEntryActivate,
}: FileTableProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const viewportHeight = viewportRef.current?.clientHeight ?? 420;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  const visibleEntries = entries.slice(startIndex, startIndex + visibleCount);
  const totalHeight = entries.length * rowHeight;

  useEffect(() => {
    if (!focusedId || !viewportRef.current) {
      return;
    }

    const index = entries.findIndex((entry) => entry.uri === focusedId);

    if (index < 0) {
      return;
    }

    const top = index * rowHeight;
    const bottom = top + rowHeight;
    const viewTop = viewportRef.current.scrollTop;
    const viewBottom = viewTop + viewportRef.current.clientHeight;

    if (top < viewTop) {
      viewportRef.current.scrollTop = top;
    } else if (bottom > viewBottom) {
      viewportRef.current.scrollTop = bottom - viewportRef.current.clientHeight;
    }
  }, [entries, focusedId]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowUp":
        event.preventDefault();
        onMove(-1);
        break;
      case "ArrowDown":
        event.preventDefault();
        onMove(1);
        break;
      case "PageUp":
        event.preventDefault();
        onMove(-Math.max(1, Math.floor(viewportHeight / rowHeight)));
        break;
      case "PageDown":
        event.preventDefault();
        onMove(Math.max(1, Math.floor(viewportHeight / rowHeight)));
        break;
      case "Home":
        event.preventDefault();
        onMove(-entries.length);
        break;
      case "End":
        event.preventDefault();
        onMove(entries.length);
        break;
      case "Enter":
        event.preventDefault();
        onActivate();
        break;
      default:
        break;
    }
  }

  return (
    <div className="fo-table-shell">
      <div className="fo-table-header">
        <ColumnButton
          field="name"
          active={sortField === "name"}
          direction={sortDirection}
          onSort={onSort}
        >
          Name
        </ColumnButton>
        <ColumnButton
          field="size"
          active={sortField === "size"}
          direction={sortDirection}
          onSort={onSort}
        >
          Size
        </ColumnButton>
        <ColumnButton
          field="modified"
          active={sortField === "modified"}
          direction={sortDirection}
          onSort={onSort}
        >
          Modified
        </ColumnButton>
        <ColumnButton
          field="type"
          active={sortField === "type"}
          direction={sortDirection}
          onSort={onSort}
        >
          Type
        </ColumnButton>
      </div>
      <div
        ref={viewportRef}
        className="fo-table-viewport"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        {entries.length === 0 ? (
          <div className="fo-empty">{loading ? "Loading" : "No entries"}</div>
        ) : (
          <div className="fo-table-spacer" style={{ height: totalHeight }}>
            {visibleEntries.map((entry, offset) => (
              <FileRow
                key={entry.uri}
                entry={entry}
                top={(startIndex + offset) * rowHeight}
                selected={entry.uri === selectedId}
                multiSelected={selectedIds.includes(entry.uri)}
                focused={entry.uri === focusedId}
                onSelect={onSelect}
                onEntrySelect={onEntrySelect}
                onEntryActivate={onEntryActivate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ColumnButtonProps {
  field: SortField;
  active: boolean;
  direction: string;
  children: ReactNode;
  onSort: (field: SortField) => void;
}

function ColumnButton({
  field,
  active,
  direction,
  children,
  onSort,
}: ColumnButtonProps) {
  return (
    <button
      type="button"
      className="fo-column-button"
      onClick={() => onSort(field)}
    >
      {children}
      {active ? ` ${direction.toUpperCase()}` : ""}
    </button>
  );
}

interface FileRowProps {
  entry: FileEntryDto;
  top: number;
  selected: boolean;
  multiSelected: boolean;
  focused: boolean;
  onSelect: (entryId: string | null) => void;
  onEntrySelect: (entryId: string, mode: "single" | "toggle" | "range") => void;
  onEntryActivate: (entry: FileEntryDto | null) => void;
}

function FileRow({
  entry,
  top,
  selected,
  multiSelected,
  focused,
  onSelect,
  onEntrySelect,
  onEntryActivate,
}: FileRowProps) {
  return (
    <button
      type="button"
      className={[
        "fo-row",
        selected || multiSelected ? "fo-row-selected" : "",
        focused ? "fo-row-focused" : "",
      ].join(" ")}
      style={{ transform: `translateY(${top}px)` }}
      onClick={(event) => {
        const mode = event.shiftKey
          ? "range"
          : event.metaKey || event.ctrlKey
            ? "toggle"
            : "single";

        if (mode === "single") {
          onSelect(entry.uri);
        } else {
          onEntrySelect(entry.uri, mode);
        }
      }}
      onDoubleClick={() => onEntryActivate(entry)}
    >
      <span>
        {entry.kind === "directory" ? "Dir" : "File"} {entry.name}
      </span>
      <span>{formatSize(entry.size)}</span>
      <span>{formatDate(entry.modifiedAt)}</span>
      <span>{entry.kind}</span>
    </button>
  );
}

function formatSize(size?: number | null): string {
  if (size == null) {
    return "";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value?: string | null): string {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString();
}

interface OperationDialogViewProps {
  dialog: OperationDialog | null;
  onClose: () => void;
  onUpdate: (dialog: OperationDialog) => void;
  onReviewCopyMove: (
    dialog: Extract<OperationDialog, { type: "copyMove" }>,
  ) => void;
  onSubmitCreateFolder: (
    dialog: Extract<OperationDialog, { type: "createFolder" }>,
  ) => void;
  onSubmitRename: (
    dialog: Extract<OperationDialog, { type: "rename" }>,
  ) => void;
  onSubmitCopyMove: (
    dialog: Extract<OperationDialog, { type: "copyMove" }>,
  ) => void;
  onSubmitTrash: (dialog: Extract<OperationDialog, { type: "trash" }>) => void;
}

function OperationDialogView({
  dialog,
  onClose,
  onUpdate,
  onReviewCopyMove,
  onSubmitCreateFolder,
  onSubmitRename,
  onSubmitCopyMove,
  onSubmitTrash,
}: OperationDialogViewProps) {
  if (!dialog) {
    return null;
  }

  const title =
    dialog.type === "createFolder"
      ? "Create Folder"
      : dialog.type === "rename"
        ? "Rename"
        : dialog.type === "trash"
          ? "Move to Trash"
          : dialog.kind === "copy"
            ? "Copy"
            : "Move";

  return (
    <div className="fo-dialog-backdrop" role="presentation">
      <section className="fo-dialog" role="dialog" aria-modal="true">
        <header>
          <strong>{title}</strong>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        {dialog.type === "createFolder" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitCreateFolder(dialog);
            }}
          >
            <label>
              Folder name
              <input
                aria-label="Folder name"
                value={dialog.name}
                onChange={(event) =>
                  onUpdate({ ...dialog, name: event.target.value, error: null })
                }
              />
            </label>
            {dialog.error ? (
              <div className="fo-operation-error">{dialog.error}</div>
            ) : null}
            <button type="submit">Create</button>
          </form>
        ) : null}
        {dialog.type === "rename" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitRename(dialog);
            }}
          >
            <label>
              New name
              <input
                aria-label="New name"
                value={dialog.name}
                onChange={(event) =>
                  onUpdate({ ...dialog, name: event.target.value, error: null })
                }
              />
            </label>
            {dialog.error ? (
              <div className="fo-operation-error">{dialog.error}</div>
            ) : null}
            <button type="submit">Rename</button>
          </form>
        ) : null}
        {dialog.type === "copyMove" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitCopyMove(dialog);
            }}
          >
            <label>
              Destination local URI
              <input
                aria-label="Destination local URI"
                value={dialog.destination}
                onChange={(event) =>
                  onUpdate({
                    ...dialog,
                    destination: event.target.value,
                    plan: null,
                    error: null,
                  })
                }
              />
            </label>
            <label>
              Conflict policy
              <select
                aria-label="Conflict policy"
                value={dialog.conflictPolicy}
                onChange={(event) =>
                  onUpdate({
                    ...dialog,
                    conflictPolicy: event.target.value as ConflictPolicy,
                    plan: null,
                    error: null,
                  })
                }
              >
                <option value="fail">Fail without changes</option>
                <option value="skip">Skip existing destinations</option>
                <option value="overwrite">
                  Overwrite existing destinations
                </option>
                <option value="renameNew">Rename new items</option>
                <option value="renameExisting">Rename existing items</option>
              </select>
            </label>
            <div className="fo-dialog-summary">
              {dialog.entries.length} item(s) selected
            </div>
            {dialog.plan ? (
              <div className="fo-dialog-summary">
                <span>
                  {dialog.plan.totalItems} planned item(s),{" "}
                  {dialog.plan.conflicts.length} conflict(s)
                </span>
                {dialog.plan.conflicts.slice(0, 3).map((conflict) => (
                  <span key={`${conflict.source}-${conflict.destination}`}>
                    {conflict.destination}
                  </span>
                ))}
                {dialog.plan.warnings.slice(0, 3).map((warning) => (
                  <span key={`${warning.code}-${warning.uri ?? ""}`}>
                    {warning.message}
                  </span>
                ))}
              </div>
            ) : null}
            {dialog.error ? (
              <div className="fo-operation-error">{dialog.error}</div>
            ) : null}
            <div className="fo-dialog-actions">
              <button
                type="button"
                disabled={dialog.planning}
                onClick={() => onReviewCopyMove(dialog)}
              >
                {dialog.planning ? "Planning" : "Plan"}
              </button>
              <button type="submit" disabled={dialog.planning || !dialog.plan}>
                Start
              </button>
            </div>
          </form>
        ) : null}
        {dialog.type === "trash" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitTrash(dialog);
            }}
          >
            <div className="fo-dialog-summary">
              <span>Move {dialog.entries.length} item(s) to Trash</span>
              {dialog.entries.slice(0, 3).map((entry) => (
                <span key={entry.uri}>{entry.name}</span>
              ))}
            </div>
            {dialog.error ? (
              <div className="fo-operation-error">{dialog.error}</div>
            ) : null}
            <button type="submit">Move to Trash</button>
          </form>
        ) : null}
      </section>
    </div>
  );
}

interface JobActivityPanelProps {
  jobs: JobSnapshot[];
  history: OperationHistoryRecordDto[];
  error: string | null;
  onCancel: (jobId: string) => void;
  onRefreshHistory: () => void;
}

function JobActivityPanel({
  jobs,
  history,
  error,
  onCancel,
  onRefreshHistory,
}: JobActivityPanelProps) {
  const activeJobs = jobs.filter(
    (job) => job.status === "queued" || job.status === "running",
  );
  const recentJobs = jobs
    .filter((job) => job.status !== "queued" && job.status !== "running")
    .slice(-5);

  return (
    <aside className="fo-job-panel" aria-label="Job activity">
      <header>
        <strong>Activity</strong>
        <button type="button" onClick={onRefreshHistory}>
          Refresh
        </button>
      </header>
      {error ? <div className="fo-operation-error">{error}</div> : null}
      {[...activeJobs, ...recentJobs].length === 0 ? (
        <div className="fo-empty-inline">No active jobs</div>
      ) : (
        [...activeJobs, ...recentJobs].map((job) => {
          const jobId = jobIdValue(job.jobId);
          const percent =
            job.totalBytes && job.totalBytes > 0
              ? Math.min(
                  100,
                  Math.round((job.completedBytes / job.totalBytes) * 100),
                )
              : job.totalItems > 0
                ? Math.min(
                    100,
                    Math.round((job.completedItems / job.totalItems) * 100),
                  )
                : 0;

          return (
            <div className="fo-job-row" key={jobId}>
              <span>
                {job.operationKind} {job.status}
              </span>
              <progress value={percent} max={100} />
              <span>{job.currentItem ?? job.message ?? `${percent}%`}</span>
              {job.status === "running" || job.status === "queued" ? (
                <button type="button" onClick={() => onCancel(jobId)}>
                  Cancel
                </button>
              ) : null}
            </div>
          );
        })
      )}
      <section className="fo-history" aria-label="Operation history">
        <strong>History</strong>
        {history.length === 0 ? (
          <div className="fo-empty-inline">No recent operations</div>
        ) : (
          history.map((item) => (
            <div className="fo-history-row" key={item.jobId}>
              <span>{item.operationKind}</span>
              <span>{item.status}</span>
              <span>{item.representativeSourcePath ?? ""}</span>
            </div>
          ))
        )}
      </section>
    </aside>
  );
}

function jobIdValue(jobId: JobSnapshot["jobId"]): string {
  return typeof jobId === "string" ? jobId : String(jobId.value ?? "");
}

function snapshotFromStarted(event: JobStartedEvent): JobSnapshot {
  const now = event.startedAt;

  return {
    jobId: event.jobId,
    operationKind: event.operationKind,
    status: "running",
    currentItem: null,
    completedItems: 0,
    totalItems: event.totalItems,
    completedBytes: 0,
    totalBytes: event.totalBytes,
    errorCode: null,
    message: null,
    startedAt: now,
    updatedAt: now,
  };
}

function mergeProgress(
  current: Record<string, JobSnapshot>,
  event: JobProgressEvent,
): JobSnapshot {
  const existing =
    current[jobIdValue(event.jobId)] ??
    snapshotFromStarted({
      jobId: event.jobId,
      operationKind: event.operationKind,
      totalItems: event.totalItems,
      totalBytes: event.totalBytes,
      startedAt: event.updatedAt,
    });

  return {
    ...existing,
    status: "running",
    currentItem: event.currentItem,
    completedItems: event.completedItems,
    totalItems: event.totalItems,
    completedBytes: event.completedBytes,
    totalBytes: event.totalBytes,
    updatedAt: event.updatedAt,
  };
}

function mergeCompleted(
  current: Record<string, JobSnapshot>,
  event: JobCompletedEvent,
): JobSnapshot {
  const existing =
    current[jobIdValue(event.jobId)] ??
    snapshotFromStarted({
      jobId: event.jobId,
      operationKind: event.operationKind,
      totalItems: event.completedItems,
      totalBytes: event.completedBytes,
      startedAt: event.completedAt,
    });

  return {
    ...existing,
    status: "completed",
    completedItems: event.completedItems,
    completedBytes: event.completedBytes,
    updatedAt: event.completedAt,
  };
}

function mergeFailed(
  current: Record<string, JobSnapshot>,
  event: JobFailedEvent,
): JobSnapshot {
  const existing =
    current[jobIdValue(event.jobId)] ??
    snapshotFromStarted({
      jobId: event.jobId,
      operationKind: event.operationKind,
      totalItems: 0,
      totalBytes: 0,
      startedAt: event.failedAt,
    });

  return {
    ...existing,
    status: "failed",
    errorCode: event.errorCode,
    message: event.message,
    updatedAt: event.failedAt,
  };
}

function mergeCancelled(
  current: Record<string, JobSnapshot>,
  event: JobCancelledEvent,
): JobSnapshot {
  const existing =
    current[jobIdValue(event.jobId)] ??
    snapshotFromStarted({
      jobId: event.jobId,
      operationKind: event.operationKind,
      totalItems: 0,
      totalBytes: 0,
      startedAt: event.cancelledAt,
    });

  return {
    ...existing,
    status: "cancelled",
    updatedAt: event.cancelledAt,
  };
}

function joinLocalUri(parent: string, name: string): string {
  return `${parent.replace(/\/$/, "")}/${name}`;
}

function isValidName(name: string): boolean {
  return Boolean(name.trim()) && !/[\\/]/.test(name) && !name.includes("\0");
}

function operationErrorMessage(code: string, fallback: string): string {
  const messages: Record<string, string> = {
    permission_denied: "Permission denied for this operation.",
    not_found: "The selected file or folder no longer exists.",
    destination_conflict: "A destination item already exists.",
    invalid_name: "Enter a valid name without path separators.",
    unsupported_trash: "Move to Trash is not supported on this platform.",
    cancelled: "Operation cancelled.",
  };

  return messages[code] ?? fallback;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="fo-shell fo-fatal-error">
          {this.state.error.message}
        </main>
      );
    }

    return this.props.children;
  }
}
