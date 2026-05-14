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
import type { FileEntryDto } from "@fileoctopus/ts-api";
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

export function FileOctopusShell() {
  const client = useMemo(() => createFileOctopusClient(), []);
  const [state, dispatch] = useReducer(panelReducer, undefined, () =>
    createInitialState(),
  );

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
    void navigatePanel("left", activeTab(state.panels.left).uri);
    void navigatePanel("right", activeTab(state.panels.right).uri);
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

  const left = activeTab(state.panels.left);
  const right = activeTab(state.panels.right);

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
        <footer className="fo-status">
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
  onMove: (delta: number) => void;
  onSort: (field: SortField) => void;
  onFilter: (filter: string) => void;
  onEntryActivate: (entry: FileEntryDto | null) => void;
}

function FilePanel({
  panelId,
  title,
  tab,
  active,
  onActivate,
  onNavigate,
  onSelect,
  onMove,
  onSort,
  onFilter,
  onEntryActivate,
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
          focusedId={tab.focusedId}
          sortField={tab.sort.field}
          sortDirection={tab.sort.direction}
          onSelect={onSelect}
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

interface FileTableProps {
  entries: FileEntryDto[];
  loading: boolean;
  selectedId: string | null;
  focusedId: string | null;
  sortField: SortField;
  sortDirection: string;
  onSelect: (entryId: string | null) => void;
  onMove: (delta: number) => void;
  onSort: (field: SortField) => void;
  onActivate: () => void;
  onEntryActivate: (entry: FileEntryDto | null) => void;
}

function FileTable({
  entries,
  loading,
  selectedId,
  focusedId,
  sortField,
  sortDirection,
  onSelect,
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
                focused={entry.uri === focusedId}
                onSelect={onSelect}
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
  focused: boolean;
  onSelect: (entryId: string | null) => void;
  onEntryActivate: (entry: FileEntryDto | null) => void;
}

function FileRow({
  entry,
  top,
  selected,
  focused,
  onSelect,
  onEntryActivate,
}: FileRowProps) {
  return (
    <button
      type="button"
      className={[
        "fo-row",
        selected ? "fo-row-selected" : "",
        focused ? "fo-row-focused" : "",
      ].join(" ")}
      style={{ transform: `translateY(${top}px)` }}
      onClick={() => onSelect(entry.uri)}
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
