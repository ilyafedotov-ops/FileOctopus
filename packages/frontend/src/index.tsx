import {
  Component,
  type KeyboardEvent,
  type MouseEvent,
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
  AppDataHealthResponse,
  AppInfoResponse,
  ConflictPolicy,
  FileEntryDto,
  FileOperationPlanDto,
  FileOperationKind,
  FolderSizeCompletedEventDto,
  PathPropertiesDto,
  RecursiveSearchCompletedEventDto,
  RecursiveSearchMatchEventDto,
  RecursiveSearchResultDto,
  StandardLocationDto,
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
  type ViewMode,
} from "./panelStore";
import {
  applyAllPreferences,
  applyDensityPreference,
  rowHeightForDensity,
  viewModeFromPreference,
  type DensityPreference,
} from "./applyPreferences";
import { DiagnosticsDialog } from "./components/DiagnosticsDialog";
import { PaneStateView } from "./components/PaneStateView";
import { SettingsDialog } from "./components/SettingsDialog";
import { ShortcutsDialog } from "./components/ShortcutsDialog";
import { ToastStack, type ToastMessage } from "./components/ToastStack";
import {
  createRequestId,
  isPaneLoading,
  paneStateLabel,
  type PaneLoadState,
} from "./paneTypes";
import { isEditableTarget } from "./shortcuts";
import type { UserPreferencesDto } from "@fileoctopus/ts-api";

const overscan = 8;
const isProductionBuild = Boolean(
  (import.meta as ImportMeta & { env?: { PROD?: boolean } }).env?.PROD,
);

type CopyMoveKind = Extract<FileOperationKind, "copy" | "move">;

interface FileClipboardState {
  kind: CopyMoveKind;
  uris: string[];
  providerId: string;
  timestamp: number;
}

interface ContextMenuState {
  panelId: PanelId;
  x: number;
  y: number;
  entry: FileEntryDto | null;
}

interface SearchState {
  panelId: PanelId;
  query: string;
  running: boolean;
  jobId: string | null;
  result: RecursiveSearchResultDto | null;
  error: string | null;
}

type OperationDialog =
  | {
      type: "createFolder";
      panelId: PanelId;
      name: string;
      error: string | null;
    }
  | {
      type: "createFile";
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
    }
  | {
      type: "permanentDelete";
      panelId: PanelId;
      entries: FileEntryDto[];
      error: string | null;
    }
  | {
      type: "properties";
      panelId: PanelId;
      entry: FileEntryDto | null;
      properties: PathPropertiesDto | null;
      loading: boolean;
      folderSizeJobId: string | null;
      error: string | null;
    };

export function FileOctopusShell() {
  const client = useMemo(() => createFileOctopusClient(), []);
  const [state, dispatch] = useReducer(panelReducer, undefined, () =>
    createInitialState(),
  );
  const [jobs, setJobs] = useState<Record<string, JobSnapshot>>({});
  const [history, setHistory] = useState<OperationHistoryRecordDto[]>([]);
  const [appInfo, setAppInfo] = useState<AppInfoResponse | null>(null);
  const [appHealth, setAppHealth] = useState<AppDataHealthResponse | null>(
    null,
  );
  const [diagnosticsDestination, setDiagnosticsDestination] = useState(
    "/tmp/fileoctopus-diagnostics.zip",
  );
  const [diagnosticsMessage, setDiagnosticsMessage] = useState<string | null>(
    null,
  );
  const [exportingDiagnostics, setExportingDiagnostics] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<OperationDialog | null>(null);
  const [locations, setLocations] = useState<StandardLocationDto[]>([]);
  const [clipboard, setClipboard] = useState<FileClipboardState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [search, setSearch] = useState<SearchState | null>(null);
  const [pathFocusToken, setPathFocusToken] = useState(0);
  const [filterFocusToken, setFilterFocusToken] = useState(0);
  const [preferences, setPreferences] = useState<UserPreferencesDto | null>(
    null,
  );
  const [density, setDensity] = useState<DensityPreference>("comfortable");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const rowHeight = rowHeightForDensity(density);
  const left = activeTab(state.panels.left);
  const right = activeTab(state.panels.right);
  const statusTab = activeTab(state.panels[state.activePanelId]);
  const statusSelection = statusTab.selectedIds
    .map((id) => statusTab.entriesById[id])
    .filter((entry): entry is FileEntryDto => Boolean(entry));
  const statusKnownBytes = statusSelection.reduce(
    (total, entry) => total + (entry.size ?? 0),
    0,
  );
  const statusUnknownSizes = statusSelection.some(
    (entry) => entry.size == null,
  );

  useEffect(() => {
    client.fs
      .onDirectoryBatch((event) =>
        dispatch({ type: "applyBatch", batch: event }),
      )
      .catch((error) => {
        const normalized = normalizeIpcError(error);
        dispatch({
          type: "setPaneError",
          panelId: "left",
          error: normalized.message,
          errorCode: normalized.code,
          loadState: "error",
        });
      });
  }, [client]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    const activePanelId = state.activePanelId;
    const activeUri = activeTab(state.panels[activePanelId]).uri;

    client.fs
      .onWatchChanged((event) => {
        if (event.uri === activeUri) {
          refreshPanel(activePanelId, { replace: true });
        }
      })
      .then((value) => {
        unlisten = value;
      })
      .catch(() => undefined);

    return () => {
      unlisten?.();
    };
  }, [client, state.activePanelId, left.uri, right.uri]);

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
        pushToast({
          tone: "success",
          title: "Operation completed",
          detail: event.operationKind,
        });
        refreshVisiblePanels();
        void refreshHistory();
      }),
      client.fileOperations.onJobFailed((event) => {
        setJobs((current) => ({
          ...current,
          [jobIdValue(event.jobId)]: mergeFailed(current, event),
        }));
        pushToast({
          tone: "error",
          title: "Operation failed",
          detail: event.message,
          actionLabel: "View details",
          onAction: () => setOperationError(event.message),
        });
        setSearch((current) =>
          current?.jobId === jobIdValue(event.jobId)
            ? { ...current, running: false, error: event.message }
            : current,
        );
        setDialog((current) =>
          current?.type === "properties" &&
          current.folderSizeJobId === jobIdValue(event.jobId)
            ? { ...current, loading: false, error: event.message }
            : current,
        );
        refreshVisiblePanels();
        void refreshHistory();
      }),
      client.fileOperations.onJobCancelled((event) => {
        setJobs((current) => ({
          ...current,
          [jobIdValue(event.jobId)]: mergeCancelled(current, event),
        }));
        pushToast({
          tone: "info",
          title: "Operation cancelled",
          detail: event.operationKind,
        });
        setSearch((current) =>
          current?.jobId === jobIdValue(event.jobId)
            ? { ...current, running: false, error: "Operation cancelled." }
            : current,
        );
        setDialog((current) =>
          current?.type === "properties" &&
          current.folderSizeJobId === jobIdValue(event.jobId)
            ? { ...current, loading: false }
            : current,
        );
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
    const unlisteners: Array<() => void> = [];

    Promise.all([
      client.fs.onFolderSizeCompleted((event) =>
        applyFolderSizeCompleted(event),
      ),
      client.fs.onRecursiveSearchMatch((event) =>
        applyRecursiveSearchMatch(event),
      ),
      client.fs.onRecursiveSearchCompleted((event) =>
        applyRecursiveSearchCompleted(event),
      ),
    ])
      .then((items) => unlisteners.push(...items))
      .catch(() => undefined);

    return () => {
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, [client]);

  useEffect(() => {
    void (async () => {
      let showHidden = false;

      try {
        const response = await client.preferences.get();
        setPreferences(response.preferences);
        applyAllPreferences(response.preferences);
        setDensity(applyDensityPreference(response.preferences.density));
        showHidden = response.preferences.showHiddenFiles;
        dispatch({
          type: "hydratePreferences",
          showHidden,
          viewMode: viewModeFromPreference(
            response.preferences.defaultViewMode,
          ),
        });
      } catch {
        // Fall back to localStorage-backed defaults in panelStore.
      }

      await navigatePanel("left", activeTab(state.panels.left).uri, {
        includeHidden: showHidden,
      });
      await navigatePanel("right", activeTab(state.panels.right).uri, {
        includeHidden: showHidden,
      });
      void refreshLocations();
      void refreshHistory();
      void refreshDiagnostics();
    })();
  }, []);

  function pushToast(toast: Omit<ToastMessage, "id">) {
    const id = createRequestId();
    setToasts((current) => [...current, { ...toast, id }]);
    globalThis.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 5000);
  }

  async function updatePreference(key: string, value: string) {
    try {
      const response = await client.preferences.set({ key, value });
      setPreferences(response.preferences);
      applyAllPreferences(response.preferences);
      setDensity(applyDensityPreference(response.preferences.density));
      if (key === "showHiddenFiles") {
        refreshVisiblePanels();
      }
    } catch (error) {
      setOperationError(normalizeIpcError(error).message);
    }
  }

  useEffect(() => {
    const tab = activeTab(state.panels[state.activePanelId]);

    void client.fs.startWatching({ uri: tab.uri }).catch(() => undefined);

    return () => {
      void client.fs.stopWatching().catch(() => undefined);
    };
  }, [client, state.activePanelId, left.uri, right.uri]);

  async function navigatePanel(
    panelId: PanelId,
    input: string,
    options: { replace?: boolean; includeHidden?: boolean } = {},
  ) {
    const uri = normalizeLocalInput(input);
    const tab = activeTab(state.panels[panelId]);

    if (!uri.startsWith("local://")) {
      dispatch({
        type: "setPaneError",
        panelId,
        error: "Enter a local:// URI or absolute path",
        errorCode: "invalid_uri",
        loadState: "error",
      });
      return;
    }

    dispatch({ type: "navigate", panelId, uri, replace: options.replace });
    setSearch((current) =>
      current?.panelId === panelId ? { ...current, result: null } : current,
    );

    await startListing(panelId, uri, options.includeHidden ?? tab.showHidden);
  }

  async function startListing(
    panelId: PanelId,
    uri: string,
    includeHidden: boolean,
  ) {
    const requestId = createRequestId();

    try {
      const response = await client.fs.listStart({
        uri,
        requestId,
        panelId,
        batchSize: 256,
        includeHidden,
      });
      dispatch({
        type: "startSession",
        panelId,
        sessionId: response.sessionId,
        requestId: response.requestId,
      });
    } catch (error) {
      const normalized = normalizeIpcError(error);
      dispatch({
        type: "setPaneError",
        panelId,
        error: normalized.message,
        errorCode: normalized.code,
        loadState:
          normalized.code === "permission_denied"
            ? "permissionDenied"
            : normalized.code === "timeout"
              ? "timeout"
              : "error",
      });
    }
  }

  async function goHistory(panelId: PanelId, direction: "back" | "forward") {
    const tab = activeTab(state.panels[panelId]);
    const uri =
      direction === "back"
        ? tab.backStack[tab.backStack.length - 1]
        : tab.forwardStack[0];

    if (!uri) {
      return;
    }

    dispatch({ type: direction === "back" ? "goBack" : "goForward", panelId });
    await startListing(panelId, uri, tab.showHidden);
  }

  function refreshPanel(
    panelId: PanelId,
    options: { replace?: boolean; includeHidden?: boolean } = {},
  ) {
    const tab = activeTab(state.panels[panelId]);

    void navigatePanel(panelId, tab.uri, {
      replace: options.replace ?? true,
      includeHidden: options.includeHidden ?? tab.showHidden,
    });
  }

  async function refreshLocations() {
    try {
      const response = await client.fs.standardLocations();
      setLocations(response.locations);
    } catch (error) {
      setOperationError(normalizeIpcError(error).message);
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

    void openExternal(entry);
  }

  function refreshVisiblePanels() {
    refreshPanel("left");
    refreshPanel("right");
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

  async function refreshDiagnostics() {
    try {
      const [info, health] = await Promise.all([
        client.getAppInfo(),
        client.diagnostics.appDataHealth(),
      ]);

      setAppInfo(info);
      setAppHealth(health);
    } catch (error) {
      setOperationError(normalizeIpcError(error).message);
    }
  }

  function applyFolderSizeCompleted(event: FolderSizeCompletedEventDto) {
    setDialog((current) => {
      if (
        current?.type !== "properties" ||
        current.folderSizeJobId !== event.jobId ||
        !current.properties
      ) {
        return current;
      }

      return {
        ...current,
        loading: false,
        properties: {
          ...current.properties,
          totalSize: event.summary.totalSize,
          itemCount: event.summary.itemCount,
          fileCount: event.summary.fileCount,
          directoryCount: event.summary.directoryCount,
          warnings: event.summary.warnings,
        },
      };
    });
  }

  function applyRecursiveSearchMatch(event: RecursiveSearchMatchEventDto) {
    setSearch((current) => {
      if (!current || current.jobId !== event.jobId) {
        return current;
      }

      const matches = current.result?.matches ?? [];

      if (matches.some((item) => item.uri === event.item.uri)) {
        return current;
      }

      return {
        ...current,
        result: {
          matches: [...matches, event.item],
          warnings: current.result?.warnings ?? [],
          incomplete: current.result?.incomplete ?? false,
        },
      };
    });
  }

  function applyRecursiveSearchCompleted(
    event: RecursiveSearchCompletedEventDto,
  ) {
    setSearch((current) => {
      if (!current || current.jobId !== event.jobId) {
        return current;
      }

      return {
        ...current,
        running: false,
        result: event.result,
        error: null,
      };
    });
  }

  async function clearHistory() {
    try {
      await client.operationHistory.clearOperationHistory();
      await refreshHistory();
    } catch (error) {
      setOperationError(normalizeIpcError(error).message);
    }
  }

  async function exportDiagnostics() {
    if (!diagnosticsDestination.trim()) {
      setDiagnosticsMessage("Enter a diagnostics bundle destination.");
      return;
    }

    setExportingDiagnostics(true);
    setDiagnosticsMessage(null);

    try {
      const response = await client.diagnostics.exportBundle({
        destination: diagnosticsDestination.trim(),
      });

      setDiagnosticsMessage(`Exported ${response.files.length} file(s).`);
    } catch (error) {
      setDiagnosticsMessage(normalizeIpcError(error).message);
    } finally {
      setExportingDiagnostics(false);
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

  async function openExternal(entry: FileEntryDto) {
    setOperationError(null);

    try {
      await client.fs.openPathWithDefaultApp({ uri: entry.uri });
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setOperationError(
        operationErrorMessage(normalized.code, normalized.message),
      );
    }
  }

  async function revealEntry(panelId: PanelId, entry: FileEntryDto | null) {
    if (!entry) {
      return;
    }

    try {
      await client.fs.revealPathInFileManager({ uri: entry.uri });
    } catch {
      const parent = parentUri(entry.uri);

      if (parent) {
        await navigatePanel(panelId, parent);
        dispatch({ type: "setSelection", panelId, entryId: entry.uri });
      }
    }
  }

  function copySelectionToFileClipboard(panelId: PanelId, kind: CopyMoveKind) {
    const entries = selectedEntries(panelId);

    if (entries.length === 0) {
      return;
    }

    setClipboard({
      kind,
      uris: entries.map((entry) => entry.uri),
      providerId: entries[0].providerId,
      timestamp: Date.now(),
    });
  }

  async function pasteClipboard(panelId: PanelId) {
    if (!clipboard) {
      return;
    }

    const tab = activeTab(state.panels[panelId]);
    const ok = await startOperation(
      clipboard.kind,
      clipboard.uris,
      tab.uri,
      undefined,
      "renameNew",
    );

    if (ok && clipboard.kind === "move") {
      setClipboard(null);
    }
  }

  async function copyTextFromSelection(
    panelId: PanelId,
    mode: "path" | "name",
  ) {
    const entries = selectedEntries(panelId);

    if (entries.length === 0) {
      return;
    }

    const text = entries
      .map((entry) =>
        mode === "path" ? localPathFromUri(entry.uri) : entry.name,
      )
      .join("\n");

    await globalThis.navigator.clipboard?.writeText(text);
  }

  function handleCreateFolder(panelId: PanelId) {
    setDialog({
      type: "createFolder",
      panelId,
      name: "New Folder",
      error: null,
    });
  }

  function handleCreateFile(panelId: PanelId) {
    setDialog({
      type: "createFile",
      panelId,
      name: "New File.txt",
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

  function handlePermanentDelete(panelId: PanelId) {
    const entries = selectedEntries(panelId);

    if (entries.length === 0) {
      return;
    }

    setDialog({ type: "permanentDelete", panelId, entries, error: null });
  }

  async function handleProperties(
    panelId: PanelId,
    entry: FileEntryDto | null,
  ) {
    const tab = activeTab(state.panels[panelId]);
    const target = entry ?? selectedEntries(panelId)[0] ?? null;
    const uri = target?.uri ?? tab.uri;

    setDialog({
      type: "properties",
      panelId,
      entry: target,
      properties: null,
      loading: true,
      folderSizeJobId: null,
      error: null,
    });

    try {
      const response = await client.fs.properties({
        uri,
        includeFolderSummary: false,
      });
      const properties = response.properties;
      let folderSizeJobId: string | null = null;

      if (properties.kind === "directory") {
        const sizeJob = await client.fs.startFolderSizeJob({ uri });
        folderSizeJobId = jobIdValue(sizeJob.job.jobId);
      }

      setDialog({
        type: "properties",
        panelId,
        entry: target,
        properties,
        loading: Boolean(folderSizeJobId),
        folderSizeJobId,
        error: null,
      });
    } catch (error) {
      setDialog({
        type: "properties",
        panelId,
        entry: target,
        properties: null,
        loading: false,
        folderSizeJobId: null,
        error: normalizeIpcError(error).message,
      });
    }
  }

  async function runRecursiveSearch(panelId: PanelId) {
    const tab = activeTab(state.panels[panelId]);
    const query = tab.recursiveQuery.trim();

    if (!query) {
      setSearch(null);
      return;
    }

    setSearch({
      panelId,
      query,
      running: true,
      jobId: null,
      result: { matches: [], warnings: [], incomplete: false },
      error: null,
    });

    try {
      const response = await client.fs.startRecursiveSearchJob({
        uri: tab.uri,
        query,
        limit: 500,
      });

      setSearch({
        panelId,
        query,
        running: true,
        jobId: jobIdValue(response.job.jobId),
        result: { matches: [], warnings: [], incomplete: false },
        error: null,
      });
    } catch (error) {
      setSearch({
        panelId,
        query,
        running: false,
        jobId: null,
        result: null,
        error: normalizeIpcError(error).message,
      });
    }
  }

  function toggleHidden(panelId: PanelId) {
    const tab = activeTab(state.panels[panelId]);

    dispatch({ type: "toggleHidden", panelId });
    refreshPanel(panelId, {
      replace: true,
      includeHidden: !tab.showHidden,
    });
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

  async function submitCreateFile(
    current: Extract<OperationDialog, { type: "createFile" }>,
  ) {
    const name = current.name.trim();

    if (!isValidName(name)) {
      setDialog({
        ...current,
        error: "Enter a file name without path separators.",
      });
      return;
    }

    const tab = activeTab(state.panels[current.panelId]);

    try {
      const response = await client.fs.createFile({
        uri: joinLocalUri(tab.uri, name),
      });

      setDialog(null);
      refreshPanel(current.panelId);
      dispatch({
        type: "setSelection",
        panelId: current.panelId,
        entryId: response.entry.uri,
      });
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setDialog({
        ...current,
        error: operationErrorMessage(normalized.code, normalized.message),
      });
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

  async function submitPermanentDelete(
    current: Extract<OperationDialog, { type: "permanentDelete" }>,
  ) {
    try {
      await client.fs.deletePermanently({
        uris: current.entries.map((entry) => entry.uri),
      });

      setDialog(null);
      refreshPanel(current.panelId);
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setDialog({
        ...current,
        error: operationErrorMessage(normalized.code, normalized.message),
      });
    }
  }

  function handleShellKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && dialog) {
      event.preventDefault();
      setDialog(null);
      return;
    }

    if (isEditableTarget(event.target)) {
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      dispatch({
        type: "setActivePanel",
        panelId: state.activePanelId === "left" ? "right" : "left",
      });
      return;
    }

    if (dialog) {
      return;
    }

    const panelId = state.activePanelId;
    const tab = activeTab(state.panels[panelId]);
    const selectedEntry =
      selectVisibleEntries(tab).find((entry) => entry.uri === tab.selectedId) ??
      null;

    if (event.key === "Enter") {
      event.preventDefault();
      activateEntry(panelId, selectedEntry);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "l") {
      event.preventDefault();
      setPathFocusToken((value) => value + 1);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
      event.preventDefault();
      setFilterFocusToken((value) => value + 1);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
      event.preventDefault();
      handleCreateFolder(panelId);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      dispatch({ type: "selectAll", panelId });
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
      event.preventDefault();
      copySelectionToFileClipboard(panelId, "copy");
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "x") {
      event.preventDefault();
      copySelectionToFileClipboard(panelId, "move");
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") {
      event.preventDefault();
      void pasteClipboard(panelId);
      return;
    }

    if (event.key === "F2") {
      event.preventDefault();
      handleRename(panelId);
      return;
    }

    if (event.altKey && event.key === "ArrowLeft") {
      event.preventDefault();
      void goHistory(panelId, "back");
      return;
    }

    if (event.altKey && event.key === "ArrowRight") {
      event.preventDefault();
      void goHistory(panelId, "forward");
      return;
    }

    if (
      event.key === "Backspace" ||
      (event.altKey && event.key === "ArrowUp")
    ) {
      const upUri = parentUri(tab.uri);

      if (upUri) {
        event.preventDefault();
        void navigatePanel(panelId, upUri);
      }

      return;
    }

    if (
      event.key === "F5" ||
      ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "r")
    ) {
      event.preventDefault();
      refreshPanel(panelId);
      return;
    }

    if (event.key === "Delete") {
      event.preventDefault();
      if (event.shiftKey) {
        handlePermanentDelete(panelId);
      } else {
        handleTrash(panelId);
      }
    }
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
            <nav className="fo-app-menu" aria-label="Help">
              <button type="button" onClick={() => setSettingsOpen(true)}>
                Settings
              </button>
              <button type="button" onClick={() => setShortcutsOpen(true)}>
                Shortcuts
              </button>
              <button type="button" onClick={() => setDiagnosticsOpen(true)}>
                Diagnostics
              </button>
            </nav>
          </div>
        </header>
        <section className="fo-panels" aria-label="File panels">
          <Sidebar
            locations={locations}
            activeUri={activeTab(state.panels[state.activePanelId]).uri}
            onNavigate={(uri) => navigatePanel(state.activePanelId, uri)}
          />
          <FilePanel
            panelId="left"
            title="Left"
            tab={left}
            active={state.activePanelId === "left"}
            onActivate={() =>
              dispatch({ type: "setActivePanel", panelId: "left" })
            }
            onNavigate={(uri) => navigatePanel("left", uri)}
            onBack={() => void goHistory("left", "back")}
            onForward={() => void goHistory("left", "forward")}
            onSelect={(entryId) =>
              dispatch({ type: "setSelection", panelId: "left", entryId })
            }
            onEntrySelect={(entryId, mode) =>
              dispatch({ type: "selectEntry", panelId: "left", entryId, mode })
            }
            onCreateFolder={() => handleCreateFolder("left")}
            onCreateFile={() => handleCreateFile("left")}
            onRename={() => handleRename("left")}
            onCopy={() => copySelectionToFileClipboard("left", "copy")}
            onCut={() => copySelectionToFileClipboard("left", "move")}
            onCopyOperation={() => handleCopyOrMove("left", "copy")}
            onMoveOperation={() => handleCopyOrMove("left", "move")}
            onPaste={() => void pasteClipboard("left")}
            onTrash={() => handleTrash("left")}
            onPermanentDelete={() => handlePermanentDelete("left")}
            onCopyPath={() => void copyTextFromSelection("left", "path")}
            onCopyName={() => void copyTextFromSelection("left", "name")}
            onProperties={(entry) => void handleProperties("left", entry)}
            onReveal={(entry) => void revealEntry("left", entry)}
            onRefresh={() => refreshPanel("left")}
            onToggleHidden={() => toggleHidden("left")}
            onMove={(delta) =>
              dispatch({ type: "moveSelection", panelId: "left", delta })
            }
            onSort={(field) =>
              dispatch({ type: "setSort", panelId: "left", field })
            }
            onFilter={(filter) =>
              dispatch({ type: "setFilter", panelId: "left", filter })
            }
            onRecursiveQuery={(query) =>
              dispatch({
                type: "setRecursiveQuery",
                panelId: "left",
                query,
              })
            }
            onRecursiveSearch={() => void runRecursiveSearch("left")}
            onViewMode={(viewMode) =>
              dispatch({ type: "setViewMode", panelId: "left", viewMode })
            }
            canPaste={Boolean(clipboard)}
            pathFocusToken={pathFocusToken}
            filterFocusToken={filterFocusToken}
            rowHeight={rowHeight}
            search={search?.panelId === "left" ? search : null}
            onContextMenu={setContextMenu}
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
            onBack={() => void goHistory("right", "back")}
            onForward={() => void goHistory("right", "forward")}
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
            onCreateFile={() => handleCreateFile("right")}
            onRename={() => handleRename("right")}
            onCopy={() => copySelectionToFileClipboard("right", "copy")}
            onCut={() => copySelectionToFileClipboard("right", "move")}
            onCopyOperation={() => handleCopyOrMove("right", "copy")}
            onMoveOperation={() => handleCopyOrMove("right", "move")}
            onPaste={() => void pasteClipboard("right")}
            onTrash={() => handleTrash("right")}
            onPermanentDelete={() => handlePermanentDelete("right")}
            onCopyPath={() => void copyTextFromSelection("right", "path")}
            onCopyName={() => void copyTextFromSelection("right", "name")}
            onProperties={(entry) => void handleProperties("right", entry)}
            onReveal={(entry) => void revealEntry("right", entry)}
            onRefresh={() => refreshPanel("right")}
            onToggleHidden={() => toggleHidden("right")}
            onMove={(delta) =>
              dispatch({ type: "moveSelection", panelId: "right", delta })
            }
            onSort={(field) =>
              dispatch({ type: "setSort", panelId: "right", field })
            }
            onFilter={(filter) =>
              dispatch({ type: "setFilter", panelId: "right", filter })
            }
            onRecursiveQuery={(query) =>
              dispatch({
                type: "setRecursiveQuery",
                panelId: "right",
                query,
              })
            }
            onRecursiveSearch={() => void runRecursiveSearch("right")}
            onViewMode={(viewMode) =>
              dispatch({ type: "setViewMode", panelId: "right", viewMode })
            }
            canPaste={Boolean(clipboard)}
            pathFocusToken={pathFocusToken}
            filterFocusToken={filterFocusToken}
            rowHeight={rowHeight}
            search={search?.panelId === "right" ? search : null}
            onContextMenu={setContextMenu}
            onEntryActivate={(entry) => activateEntry("right", entry)}
          />
        </section>
        <JobActivityPanel
          jobs={Object.values(jobs)}
          history={history}
          error={operationError}
          onCancel={(jobId) => void client.jobs.cancelJob({ jobId })}
          onRefreshHistory={() => void refreshHistory()}
          onClearHistory={() => void clearHistory()}
        />
        <ToastStack
          toasts={toasts}
          onDismiss={(id) =>
            setToasts((current) => current.filter((toast) => toast.id !== id))
          }
        />
        {preferences ? (
          <SettingsDialog
            open={settingsOpen}
            preferences={preferences}
            onClose={() => setSettingsOpen(false)}
            onChange={(key, value) => void updatePreference(key, value)}
          />
        ) : null}
        <ShortcutsDialog
          open={shortcutsOpen}
          onClose={() => setShortcutsOpen(false)}
        />
        <DiagnosticsDialog
          open={diagnosticsOpen}
          appInfo={appInfo}
          appHealth={appHealth}
          destination={diagnosticsDestination}
          message={diagnosticsMessage}
          exporting={exportingDiagnostics}
          showDeveloperFields={!isProductionBuild}
          onClose={() => setDiagnosticsOpen(false)}
          onDestinationChange={setDiagnosticsDestination}
          onRefresh={() => void refreshDiagnostics()}
          onExport={() => void exportDiagnostics()}
        />
        <OperationDialogView
          dialog={dialog}
          onClose={() => setDialog(null)}
          onUpdate={(next) => setDialog(next)}
          onReviewCopyMove={(current) => void reviewCopyMoveDialog(current)}
          onSubmitCreateFolder={(current) => void submitCreateFolder(current)}
          onSubmitCreateFile={(current) => void submitCreateFile(current)}
          onSubmitRename={(current) => void submitRename(current)}
          onSubmitCopyMove={(current) => void submitCopyMove(current)}
          onSubmitTrash={(current) => void submitTrash(current)}
          onSubmitPermanentDelete={(current) =>
            void submitPermanentDelete(current)
          }
          onCopyPath={(panelId) => void copyTextFromSelection(panelId, "path")}
          onReveal={(panelId, entry) => void revealEntry(panelId, entry)}
        />
        <ContextMenu
          menu={contextMenu}
          canPaste={Boolean(clipboard)}
          onClose={() => setContextMenu(null)}
          onOpen={(panelId, entry) => activateEntry(panelId, entry)}
          onRename={handleRename}
          onCopy={(panelId) => copySelectionToFileClipboard(panelId, "copy")}
          onCut={(panelId) => copySelectionToFileClipboard(panelId, "move")}
          onPaste={(panelId) => void pasteClipboard(panelId)}
          onTrash={handleTrash}
          onPermanentDelete={handlePermanentDelete}
          onCopyPath={(panelId) => void copyTextFromSelection(panelId, "path")}
          onCopyName={(panelId) => void copyTextFromSelection(panelId, "name")}
          onProperties={(panelId, entry) =>
            void handleProperties(panelId, entry)
          }
          onReveal={(panelId, entry) => void revealEntry(panelId, entry)}
          onCreateFolder={handleCreateFolder}
          onCreateFile={handleCreateFile}
          onRefresh={refreshPanel}
          onSelectAll={(panelId) => dispatch({ type: "selectAll", panelId })}
          onViewMode={(panelId, viewMode) =>
            dispatch({ type: "setViewMode", panelId, viewMode })
          }
          onSort={(panelId, field) =>
            dispatch({ type: "setSort", panelId, field })
          }
        />
        <footer className="fo-status">
          <span className="fo-status-pane">
            {state.activePanelId === "left" ? "Left pane" : "Right pane"}
          </span>
          <span>{paneStateLabel(statusTab.loadState)}</span>
          <span>
            {statusSelection.length} selected, {statusTab.orderedEntryIds.length}{" "}
            entries
          </span>
          {statusSelection.length > 0 ? (
            <span>
              {formatSize(statusKnownBytes)}
              {statusUnknownSizes ? " plus unknown sizes" : ""}
            </span>
          ) : null}
          <span>
            {
              Object.values(jobs).filter(
                (job) => job.status === "queued" || job.status === "running",
              ).length
            }{" "}
            active jobs
          </span>
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
  onBack: () => void;
  onForward: () => void;
  onSelect: (entryId: string | null) => void;
  onEntrySelect: (entryId: string, mode: "single" | "toggle" | "range") => void;
  onMove: (delta: number) => void;
  onSort: (field: SortField) => void;
  onFilter: (filter: string) => void;
  onRecursiveQuery: (query: string) => void;
  onRecursiveSearch: () => void;
  onViewMode: (viewMode: ViewMode) => void;
  onEntryActivate: (entry: FileEntryDto | null) => void;
  onCreateFolder: () => void;
  onCreateFile: () => void;
  onRename: () => void;
  onCopy: () => void;
  onCut: () => void;
  onCopyOperation: () => void;
  onMoveOperation: () => void;
  onPaste: () => void;
  onTrash: () => void;
  onPermanentDelete: () => void;
  onCopyPath: () => void;
  onCopyName: () => void;
  onProperties: (entry: FileEntryDto | null) => void;
  onReveal: (entry: FileEntryDto | null) => void;
  onRefresh: () => void;
  onToggleHidden: () => void;
  canPaste: boolean;
  pathFocusToken: number;
  filterFocusToken: number;
  rowHeight: number;
  search: SearchState | null;
  onContextMenu: (menu: ContextMenuState | null) => void;
}

function FilePanel({
  panelId,
  title,
  tab,
  active,
  onActivate,
  onNavigate,
  onBack,
  onForward,
  onSelect,
  onEntrySelect,
  onMove,
  onSort,
  onFilter,
  onRecursiveQuery,
  onRecursiveSearch,
  onViewMode,
  onEntryActivate,
  onCreateFolder,
  onCreateFile,
  onRename,
  onCopy,
  onCut,
  onCopyOperation,
  onMoveOperation,
  onPaste,
  onTrash,
  onPermanentDelete,
  onCopyPath,
  onCopyName,
  onProperties,
  onReveal,
  onRefresh,
  onToggleHidden,
  canPaste,
  pathFocusToken,
  filterFocusToken,
  rowHeight,
  search,
  onContextMenu,
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
        <span>{isPaneLoading(tab.loadState) ? "Loading" : `${entries.length} shown`}</span>
      </header>
      <div className="fo-panel-body">
        <div className="fo-panel-toolbar-row">
          <div className="fo-panel-nav">
            <button
              type="button"
              disabled={tab.backStack.length === 0}
              onClick={onBack}
              aria-label={`${panelId} back`}
            >
              Back
            </button>
            <button
              type="button"
              disabled={tab.forwardStack.length === 0}
              onClick={onForward}
              aria-label={`${panelId} forward`}
            >
              Forward
            </button>
            <button
              type="button"
              disabled={!upUri}
              onClick={() => upUri && onNavigate(upUri)}
            >
              Up
            </button>
          </div>
        </div>
        <div className="fo-panel-path-row">
          <PathBar
            value={tab.uri}
            error={tab.error}
            focusToken={pathFocusToken}
            onSubmit={onNavigate}
          />
          <FilterInput
            panelId={panelId}
            value={tab.filter}
            focusToken={filterFocusToken}
            onChange={onFilter}
          />
        </div>
        <OperationToolbar
          selectedCount={tab.selectedIds.length}
          canRename={tab.selectedIds.length === 1}
          canPaste={canPaste}
          showHidden={tab.showHidden}
          viewMode={tab.viewMode}
          onCreateFolder={onCreateFolder}
          onCreateFile={onCreateFile}
          onRename={onRename}
          onCopy={onCopy}
          onCut={onCut}
          onCopyOperation={onCopyOperation}
          onMove={onMoveOperation}
          onPaste={onPaste}
          onTrash={onTrash}
          onPermanentDelete={onPermanentDelete}
          onCopyPath={onCopyPath}
          onCopyName={onCopyName}
          onProperties={() => onProperties(selectedEntry)}
          onRefresh={onRefresh}
          onToggleHidden={onToggleHidden}
          onViewMode={onViewMode}
        />
        <div className="fo-search-strip">
          <input
            aria-label={`${panelId} recursive search`}
            value={tab.recursiveQuery}
            placeholder="Recursive search"
            onChange={(event) => onRecursiveQuery(event.target.value)}
          />
          <button type="button" onClick={onRecursiveSearch}>
            Search
          </button>
        </div>
        <PaneStateView
          loadState={tab.loadState}
          uri={tab.uri}
          message={tab.error}
          onRetry={() => onNavigate(tab.uri)}
          onRefresh={onRefresh}
          onCreateFolder={onCreateFolder}
        />
        <FileTable
          entries={entries}
          loadState={tab.loadState}
          rowHeight={rowHeight}
          selectedId={tab.selectedId}
          selectedIds={tab.selectedIds}
          focusedId={tab.focusedId}
          sortField={tab.sort.field}
          sortDirection={tab.sort.direction}
          viewMode={tab.viewMode}
          onSelect={onSelect}
          onEntrySelect={onEntrySelect}
          onMove={onMove}
          onSort={onSort}
          onActivate={() => onEntryActivate(selectedEntry)}
          onEntryActivate={onEntryActivate}
          onContextMenu={(event, entry) => {
            event.preventDefault();
            onActivate();
            if (entry && !tab.selectedIds.includes(entry.uri)) {
              onSelect(entry.uri);
            }
            onContextMenu({
              panelId,
              x: event.clientX,
              y: event.clientY,
              entry,
            });
          }}
        />
        <RecursiveSearchPanel
          panelId={panelId}
          search={search}
          onOpen={(entry) => onEntryActivate(entry)}
          onReveal={onReveal}
          onProperties={onProperties}
        />
      </div>
    </section>
  );
}

interface PathBarProps {
  value: string;
  error: string | null;
  focusToken: number;
  onSubmit: (value: string) => void;
}

function PathBar({ value, error, focusToken, onSubmit }: PathBarProps) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [editing, value]);

  useEffect(() => {
    if (focusToken > 0) {
      setEditing(true);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [focusToken]);

  if (!editing) {
    return (
      <div
        className={error ? "fo-breadcrumb fo-path-error" : "fo-breadcrumb"}
        onDoubleClick={() => setEditing(true)}
      >
        {breadcrumbSegments(value).map((segment) => (
          <button
            key={segment.uri}
            type="button"
            title={segment.uri}
            onClick={() => onSubmit(segment.uri)}
          >
            {segment.label}
          </button>
        ))}
        <button
          type="button"
          aria-label="Edit current path"
          onClick={() => setEditing(true)}
        >
          Path
        </button>
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
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
  canPaste: boolean;
  showHidden: boolean;
  viewMode: ViewMode;
  onCreateFolder: () => void;
  onCreateFile: () => void;
  onRename: () => void;
  onCopy: () => void;
  onCut: () => void;
  onCopyOperation: () => void;
  onMove: () => void;
  onPaste: () => void;
  onTrash: () => void;
  onPermanentDelete: () => void;
  onCopyPath: () => void;
  onCopyName: () => void;
  onProperties: () => void;
  onRefresh: () => void;
  onToggleHidden: () => void;
  onViewMode: (viewMode: ViewMode) => void;
}

function OperationToolbar({
  selectedCount,
  canRename,
  canPaste,
  showHidden,
  viewMode,
  onCreateFolder,
  onCreateFile,
  onRename,
  onCopy,
  onCut,
  onCopyOperation,
  onMove,
  onPaste,
  onTrash,
  onPermanentDelete,
  onCopyPath,
  onCopyName,
  onProperties,
  onRefresh,
  onToggleHidden,
  onViewMode,
}: OperationToolbarProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);

  return (
    <div className="fo-operation-toolbar" aria-label="File operations">
      <div className="fo-toolbar-group">
        <button type="button" onClick={onRefresh}>
          Refresh
        </button>
        <button type="button" onClick={onCreateFolder}>
          New
        </button>
        <button type="button" disabled={selectedCount === 0} onClick={onCopy}>
          Copy
        </button>
        <button type="button" disabled={selectedCount === 0} onClick={onMove}>
          Move
        </button>
        <button type="button" disabled={selectedCount === 0} onClick={onTrash}>
          Trash
        </button>
        <button
          type="button"
          disabled={selectedCount === 0}
          onClick={onPermanentDelete}
        >
          Delete
        </button>
      </div>
      <div className="fo-toolbar-group fo-toolbar-overflow">
        <button
          type="button"
          aria-expanded={overflowOpen}
          onClick={() => setOverflowOpen((value) => !value)}
        >
          More
        </button>
        {overflowOpen ? (
          <div className="fo-toolbar-menu">
            <button type="button" onClick={onCreateFile}>
              New File
            </button>
            <button type="button" disabled={!canRename} onClick={onRename}>
              Rename
            </button>
            <button type="button" disabled={selectedCount === 0} onClick={onCut}>
              Cut
            </button>
            <button type="button" disabled={!canPaste} onClick={onPaste}>
              Paste
            </button>
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={onCopyOperation}
            >
              Copy To
            </button>
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={onCopyPath}
            >
              Copy Path
            </button>
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={onCopyName}
            >
              Copy Name
            </button>
            <button type="button" onClick={onProperties}>
              Properties
            </button>
            <button type="button" onClick={onToggleHidden}>
              {showHidden ? "Hide Hidden" : "Show Hidden"}
            </button>
            <select
              aria-label="View mode"
              value={viewMode}
              onChange={(event) => onViewMode(event.target.value as ViewMode)}
            >
              <option value="details">Details</option>
              <option value="list">List</option>
              <option value="icons">Icons</option>
            </select>
          </div>
        ) : null}
      </div>
      <span className="fo-toolbar-meta">{selectedCount} selected</span>
    </div>
  );
}

interface FilterInputProps {
  panelId: PanelId;
  value: string;
  focusToken: number;
  onChange: (value: string) => void;
}

function FilterInput({ panelId, value, focusToken, onChange }: FilterInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (focusToken > 0) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [focusToken]);

  return (
    <input
      ref={inputRef}
      className="fo-filter"
      aria-label={`${panelId} filter`}
      value={value}
      placeholder="Filter"
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

interface FileTableProps {
  entries: FileEntryDto[];
  loadState: PaneLoadState;
  rowHeight: number;
  selectedId: string | null;
  selectedIds: string[];
  focusedId: string | null;
  sortField: SortField;
  sortDirection: string;
  viewMode: ViewMode;
  onSelect: (entryId: string | null) => void;
  onEntrySelect: (entryId: string, mode: "single" | "toggle" | "range") => void;
  onMove: (delta: number) => void;
  onSort: (field: SortField) => void;
  onActivate: () => void;
  onEntryActivate: (entry: FileEntryDto | null) => void;
  onContextMenu: (
    event: MouseEvent<HTMLElement>,
    entry: FileEntryDto | null,
  ) => void;
}

function FileTable({
  entries,
  loadState,
  rowHeight,
  selectedId,
  selectedIds,
  focusedId,
  sortField,
  sortDirection,
  viewMode,
  onSelect,
  onEntrySelect,
  onMove,
  onSort,
  onActivate,
  onEntryActivate,
  onContextMenu,
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
    <div
      className={`fo-table-shell fo-view-${viewMode}`}
      onContextMenu={(event) => onContextMenu(event, null)}
    >
      {viewMode === "details" ? (
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
      ) : null}
      <div
        ref={viewportRef}
        className="fo-table-viewport"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        {entries.length === 0 ? (
          <div className="fo-empty">
            {isPaneLoading(loadState) ? "Loading…" : null}
          </div>
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
                onContextMenu={onContextMenu}
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
  onContextMenu: (
    event: MouseEvent<HTMLElement>,
    entry: FileEntryDto | null,
  ) => void;
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
  onContextMenu,
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
      onContextMenu={(event) => {
        event.stopPropagation();
        onContextMenu(event, entry);
      }}
    >
      <span>
        {fileIcon(entry)} {entry.name}
      </span>
      <span>{formatSize(entry.size)}</span>
      <span>{formatDate(entry.modifiedAt)}</span>
      <span>{entry.kind}</span>
    </button>
  );
}

interface SidebarProps {
  locations: StandardLocationDto[];
  activeUri: string;
  onNavigate: (uri: string) => void;
}

function Sidebar({ locations, activeUri, onNavigate }: SidebarProps) {
  const grouped = locations.reduce<Record<string, StandardLocationDto[]>>(
    (groups, location) => ({
      ...groups,
      [location.section]: [...(groups[location.section] ?? []), location],
    }),
    {},
  );

  return (
    <aside className="fo-sidebar" aria-label="Standard locations">
      {Object.entries(grouped).map(([section, items]) => (
        <section key={section}>
          <strong>{section}</strong>
          {items.map((item) => (
            <button
              key={item.uri}
              type="button"
              className={item.uri === activeUri ? "fo-sidebar-active" : ""}
              onClick={() => onNavigate(item.uri)}
            >
              {item.name}
            </button>
          ))}
        </section>
      ))}
    </aside>
  );
}

interface RecursiveSearchPanelProps {
  panelId: PanelId;
  search: SearchState | null;
  onOpen: (entry: FileEntryDto) => void;
  onReveal: (entry: FileEntryDto) => void;
  onProperties: (entry: FileEntryDto) => void;
}

function RecursiveSearchPanel({
  search,
  onOpen,
  onReveal,
  onProperties,
}: RecursiveSearchPanelProps) {
  if (!search) {
    return null;
  }

  const matches = search.result?.matches ?? [];

  return (
    <section
      className="fo-search-results"
      aria-label="Recursive search results"
    >
      <header>
        <strong>
          {search.running ? "Searching" : `${matches.length} result(s)`}
        </strong>
        {search.error ? <span>{search.error}</span> : null}
      </header>
      {matches.length === 0 && !search.running ? (
        <div className="fo-empty-inline">No recursive matches</div>
      ) : null}
      {matches.slice(0, 50).map((match) => {
        const entry = searchMatchToEntry(match);

        return (
          <div className="fo-search-row" key={match.uri}>
            <span>
              {fileIcon(entry)} {match.name}
            </span>
            <span>{localPathFromUri(match.parentUri)}</span>
            <button type="button" onClick={() => onOpen(entry)}>
              Open
            </button>
            <button type="button" onClick={() => onReveal(entry)}>
              Reveal
            </button>
            <button type="button" onClick={() => onProperties(entry)}>
              Properties
            </button>
          </div>
        );
      })}
      {search.result?.incomplete ? (
        <div className="fo-empty-inline">
          Some folders could not be searched.
        </div>
      ) : null}
    </section>
  );
}

interface ContextMenuProps {
  menu: ContextMenuState | null;
  canPaste: boolean;
  onClose: () => void;
  onOpen: (panelId: PanelId, entry: FileEntryDto | null) => void;
  onRename: (panelId: PanelId) => void;
  onCopy: (panelId: PanelId) => void;
  onCut: (panelId: PanelId) => void;
  onPaste: (panelId: PanelId) => void;
  onTrash: (panelId: PanelId) => void;
  onPermanentDelete: (panelId: PanelId) => void;
  onCopyPath: (panelId: PanelId) => void;
  onCopyName: (panelId: PanelId) => void;
  onProperties: (panelId: PanelId, entry: FileEntryDto | null) => void;
  onReveal: (panelId: PanelId, entry: FileEntryDto | null) => void;
  onCreateFolder: (panelId: PanelId) => void;
  onCreateFile: (panelId: PanelId) => void;
  onRefresh: (panelId: PanelId) => void;
  onSelectAll: (panelId: PanelId) => void;
  onViewMode: (panelId: PanelId, viewMode: ViewMode) => void;
  onSort: (panelId: PanelId, field: SortField) => void;
}

function ContextMenu({
  menu,
  canPaste,
  onClose,
  onOpen,
  onRename,
  onCopy,
  onCut,
  onPaste,
  onTrash,
  onPermanentDelete,
  onCopyPath,
  onCopyName,
  onProperties,
  onReveal,
  onCreateFolder,
  onCreateFile,
  onRefresh,
  onSelectAll,
  onViewMode,
  onSort,
}: ContextMenuProps) {
  if (!menu) {
    return null;
  }

  const itemMenu = Boolean(menu.entry);
  const run = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div className="fo-menu-backdrop" onClick={onClose} role="presentation">
      <div
        className="fo-context-menu"
        role="menu"
        style={{ left: menu.x, top: menu.y }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          disabled={!itemMenu}
          onClick={() => run(() => onOpen(menu.panelId, menu.entry))}
        >
          Open
        </button>
        <button
          type="button"
          disabled={!itemMenu}
          onClick={() => run(() => onRename(menu.panelId))}
        >
          Rename
        </button>
        <button
          type="button"
          disabled={!itemMenu}
          onClick={() => run(() => onCopy(menu.panelId))}
        >
          Copy
        </button>
        <button
          type="button"
          disabled={!itemMenu}
          onClick={() => run(() => onCut(menu.panelId))}
        >
          Cut
        </button>
        <button
          type="button"
          disabled={!canPaste}
          onClick={() => run(() => onPaste(menu.panelId))}
        >
          Paste
        </button>
        <button
          type="button"
          onClick={() => run(() => onCreateFolder(menu.panelId))}
        >
          New Folder
        </button>
        <button
          type="button"
          onClick={() => run(() => onCreateFile(menu.panelId))}
        >
          New File
        </button>
        <button
          type="button"
          disabled={!itemMenu}
          onClick={() => run(() => onTrash(menu.panelId))}
        >
          Move to Trash
        </button>
        <button
          type="button"
          disabled={!itemMenu}
          onClick={() => run(() => onPermanentDelete(menu.panelId))}
        >
          Delete Permanently
        </button>
        <button
          type="button"
          disabled={!itemMenu}
          onClick={() => run(() => onCopyPath(menu.panelId))}
        >
          Copy Path
        </button>
        <button
          type="button"
          disabled={!itemMenu}
          onClick={() => run(() => onCopyName(menu.panelId))}
        >
          Copy Name
        </button>
        <button
          type="button"
          disabled={!itemMenu}
          onClick={() => run(() => onProperties(menu.panelId, menu.entry))}
        >
          Properties
        </button>
        <button
          type="button"
          disabled={!itemMenu}
          onClick={() => run(() => onReveal(menu.panelId, menu.entry))}
        >
          Reveal
        </button>
        <button
          type="button"
          onClick={() => run(() => onRefresh(menu.panelId))}
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={() => run(() => onSelectAll(menu.panelId))}
        >
          Select All
        </button>
        <button
          type="button"
          onClick={() => run(() => onViewMode(menu.panelId, "details"))}
        >
          Details View
        </button>
        <button
          type="button"
          onClick={() => run(() => onViewMode(menu.panelId, "list"))}
        >
          List View
        </button>
        <button
          type="button"
          onClick={() => run(() => onViewMode(menu.panelId, "icons"))}
        >
          Icon View
        </button>
        <button
          type="button"
          onClick={() => run(() => onSort(menu.panelId, "name"))}
        >
          Sort Name
        </button>
        <button
          type="button"
          onClick={() => run(() => onSort(menu.panelId, "modified"))}
        >
          Sort Modified
        </button>
      </div>
    </div>
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

function fileIcon(
  entry: Pick<FileEntryDto, "kind" | "extension" | "name">,
): string {
  if (entry.kind === "directory") {
    return "Folder";
  }

  const extension = (
    entry.extension ??
    entry.name.split(".").pop() ??
    ""
  ).toLowerCase();

  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)) {
    return "Image";
  }
  if (["mp4", "mov", "mkv", "avi"].includes(extension)) {
    return "Video";
  }
  if (["mp3", "wav", "flac", "aac"].includes(extension)) {
    return "Audio";
  }
  if (["zip", "tar", "gz", "rar", "7z"].includes(extension)) {
    return "Archive";
  }
  if (
    ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(extension)
  ) {
    return "Document";
  }
  if (
    [
      "rs",
      "ts",
      "tsx",
      "js",
      "jsx",
      "py",
      "go",
      "json",
      "html",
      "css",
    ].includes(extension)
  ) {
    return "Code";
  }
  if (entry.kind === "symlink") {
    return "Link";
  }

  return "File";
}

function propertyType(properties: PathPropertiesDto): string {
  if (properties.kind === "directory") {
    return "Folder";
  }

  if (properties.isSymlink) {
    return "Symlink";
  }

  return properties.kind;
}

function localPathFromUri(uri: string): string {
  return uri.replace(/^local:\/\//, "");
}

function breadcrumbSegments(
  uri: string,
): Array<{ label: string; uri: string }> {
  const path = localPathFromUri(uri).replace(/\/+$/, "");
  const segments = path.split("/").filter(Boolean);
  const result: Array<{ label: string; uri: string }> = [];
  let current = "";

  if (path.startsWith("/")) {
    result.push({ label: "/", uri: "local:///" });
  }

  for (const segment of segments) {
    current =
      path.startsWith("/") || current ? `${current}/${segment}` : segment;
    result.push({
      label: segment,
      uri: `local://${path.startsWith("/") ? current : `${current}/`}`,
    });
  }

  return result.length > 0 ? result : [{ label: uri, uri }];
}

function searchMatchToEntry(
  match: RecursiveSearchResultDto["matches"][number],
): FileEntryDto {
  return {
    uri: match.uri,
    name: match.name,
    kind: match.kind,
    size: match.size,
    modifiedAt: match.modifiedAt,
    isHidden: false,
    isSymlink: match.kind === "symlink",
    providerId: "local",
    canRead: true,
    canList: match.kind === "directory",
    canWrite: true,
    canDelete: true,
    canRename: true,
  };
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
  onSubmitCreateFile: (
    dialog: Extract<OperationDialog, { type: "createFile" }>,
  ) => void;
  onSubmitRename: (
    dialog: Extract<OperationDialog, { type: "rename" }>,
  ) => void;
  onSubmitCopyMove: (
    dialog: Extract<OperationDialog, { type: "copyMove" }>,
  ) => void;
  onSubmitTrash: (dialog: Extract<OperationDialog, { type: "trash" }>) => void;
  onSubmitPermanentDelete: (
    dialog: Extract<OperationDialog, { type: "permanentDelete" }>,
  ) => void;
  onCopyPath: (panelId: PanelId) => void;
  onReveal: (panelId: PanelId, entry: FileEntryDto | null) => void;
}

function OperationDialogView({
  dialog,
  onClose,
  onUpdate,
  onReviewCopyMove,
  onSubmitCreateFolder,
  onSubmitCreateFile,
  onSubmitRename,
  onSubmitCopyMove,
  onSubmitTrash,
  onSubmitPermanentDelete,
  onCopyPath,
  onReveal,
}: OperationDialogViewProps) {
  if (!dialog) {
    return null;
  }

  const title =
    dialog.type === "createFolder"
      ? "Create Folder"
      : dialog.type === "createFile"
        ? "Create File"
        : dialog.type === "rename"
          ? "Rename"
          : dialog.type === "properties"
            ? "Properties"
            : dialog.type === "permanentDelete"
              ? "Delete Permanently"
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
        {dialog.type === "createFile" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitCreateFile(dialog);
            }}
          >
            <label>
              File name
              <input
                aria-label="File name"
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
        {dialog.type === "permanentDelete" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitPermanentDelete(dialog);
            }}
          >
            <div className="fo-dialog-summary">
              <span>Permanently delete {dialog.entries.length} item(s)</span>
              {dialog.entries.slice(0, 5).map((entry) => (
                <span key={entry.uri}>{entry.name}</span>
              ))}
            </div>
            {dialog.error ? (
              <div className="fo-operation-error">{dialog.error}</div>
            ) : null}
            <button type="submit">Delete Permanently</button>
          </form>
        ) : null}
        {dialog.type === "properties" ? (
          <div className="fo-properties">
            {dialog.loading ? <div>Loading</div> : null}
            {dialog.error ? (
              <div className="fo-operation-error">{dialog.error}</div>
            ) : null}
            {dialog.properties ? (
              <>
                <dl>
                  <dt>Name</dt>
                  <dd>{dialog.properties.name}</dd>
                  <dt>Path</dt>
                  <dd>{localPathFromUri(dialog.properties.uri)}</dd>
                  <dt>Type</dt>
                  <dd>{propertyType(dialog.properties)}</dd>
                  <dt>Size</dt>
                  <dd>
                    {formatSize(
                      dialog.properties.size ?? dialog.properties.totalSize,
                    )}
                  </dd>
                  <dt>Items</dt>
                  <dd>{dialog.properties.itemCount ?? "Unavailable"}</dd>
                  <dt>Modified</dt>
                  <dd>{formatDate(dialog.properties.modifiedAt)}</dd>
                  <dt>Created</dt>
                  <dd>{formatDate(dialog.properties.createdAt)}</dd>
                  <dt>Accessed</dt>
                  <dd>{formatDate(dialog.properties.accessedAt)}</dd>
                  <dt>Hidden</dt>
                  <dd>{dialog.properties.isHidden ? "Yes" : "No"}</dd>
                  <dt>Read-only</dt>
                  <dd>{dialog.properties.readonly ? "Yes" : "No"}</dd>
                </dl>
                {dialog.properties.warnings.length > 0 ? (
                  <div className="fo-dialog-summary">
                    {dialog.properties.warnings.slice(0, 3).map((warning) => (
                      <span key={warning}>{warning}</span>
                    ))}
                  </div>
                ) : null}
                <div className="fo-dialog-actions">
                  <button
                    type="button"
                    onClick={() => onCopyPath(dialog.panelId)}
                  >
                    Copy Path
                  </button>
                  <button
                    type="button"
                    onClick={() => onReveal(dialog.panelId, dialog.entry)}
                  >
                    Reveal
                  </button>
                </div>
              </>
            ) : null}
          </div>
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
  onClearHistory: () => void;
}

function JobActivityPanel({
  jobs,
  history,
  error,
  onCancel,
  onRefreshHistory,
  onClearHistory,
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
        <header>
          <strong>History</strong>
          <button type="button" onClick={onClearHistory}>
            Clear
          </button>
        </header>
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
    destination_missing: "The destination folder no longer exists.",
    destination_conflict: "A destination item already exists.",
    invalid_name: "Enter a valid name without path separators.",
    unsupported_symlink:
      "Symlink file operations are not supported in this MVP.",
    unsupported_trash: "Move to Trash is not supported on this platform.",
    cancelled: "Operation cancelled.",
    interrupted: "Operation interrupted by app shutdown.",
    timeout: "Directory listing timed out.",
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
          <h1>FileOctopus recovered from a UI error</h1>
          {!isProductionBuild ? <pre>{this.state.error.message}</pre> : null}
          <div className="fo-dialog-actions">
            <button type="button" onClick={() => globalThis.location.reload()}>
              Reload
            </button>
            <button
              type="button"
              onClick={() =>
                void globalThis.navigator.clipboard?.writeText(
                  this.state.error?.stack ?? this.state.error?.message ?? "",
                )
              }
            >
              Copy Diagnostics
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
