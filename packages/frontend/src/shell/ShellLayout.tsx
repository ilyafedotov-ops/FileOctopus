import type { RefObject } from "react";
import type {
  FileOctopusClient,
  AppDataHealthResponse,
  AppInfoResponse,
  AutostartStatusDto,
  FavoriteEntryDto,
  FileEntryDto,
  JobSnapshot,
  OperationHistoryRecordDto,
  RecentEntryDto,
  StarredEntryDto,
  StandardLocationDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import { normalizeIpcError } from "@fileoctopus/ts-api";
import type { FileOctopusState, PanelAction, PanelId } from "../panelStore";
import type { FilePanelProps } from "../pane/FilePanel";
import type { ContextMenuState } from "../components/ContextMenu";
import type { CommandEntry } from "../components/CommandPalette";
import type { ToastMessage } from "../components/ToastStack";
import type { OperationDialog } from "../dialogs/OperationDialogView";
import type { MenuBarProps } from "./MenuBar";
import type { FileClipboardState } from "../hooks/useFileOpHandlers";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { TitleBar } from "./TitleBar";
import { Sidebar } from "../sidebar/Sidebar";
import { SidebarResizer, SplitResizer } from "./LayoutResizers";
import { FilePanel } from "../pane/FilePanel";
import { ActivityPanel } from "../activity/ActivityPanel";
import { ToastStack } from "../components/ToastStack";
import { DialogOverlayGroup } from "../components/DialogOverlayGroup";
import { ContextMenuOverlay } from "../components/ContextMenuOverlay";
import { StatusBarSection } from "../components/StatusBarSection";

export interface ShellLayoutProps {
  workspaceRef: RefObject<HTMLElement | null>;
  handleShellKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  makeFilePanelProps: (pid: "left" | "right") => FilePanelProps;
  menuBarProps: MenuBarProps;
  state: FileOctopusState;
  activeTabUri: string;
  locations: StandardLocationDto[];
  favorites: FavoriteEntryDto[];
  recentToday: RecentEntryDto[];
  recentWeek: RecentEntryDto[];
  starred: StarredEntryDto[];
  preferences: UserPreferencesDto | null;
  updatePreference: (key: string, value: string) => Promise<void>;
  client: FileOctopusClient;
  jobs: Record<string, JobSnapshot>;
  jobMetrics: Record<
    string,
    {
      speedLabel: string | null;
      etaLabel: string | null;
      lastBytes: number;
      lastAt: number;
    }
  >;
  history: OperationHistoryRecordDto[];
  operationError: string | null;
  activityCollapsed: boolean;
  markActivityPinnedOpen: () => void;
  setActivityCollapsed: (v: boolean) => void;
  refreshHistory: () => Promise<void>;
  clearHistory: () => Promise<void>;
  settingsOpen: boolean;
  shortcutsOpen: boolean;
  commandPaletteOpen: boolean;
  previewOpen: boolean;
  diagnosticsOpen: boolean;
  dialog: OperationDialog | null;
  autostart: AutostartStatusDto | null;
  commandEntries: CommandEntry[];
  previewEntry: FileEntryDto | null;
  appInfo: AppInfoResponse | null;
  appHealth: AppDataHealthResponse | null;
  diagnosticsDestination: string;
  diagnosticsMessage: string | null;
  exportingDiagnostics: boolean;
  isProductionBuild: boolean;
  setSettingsOpen: (v: boolean) => void;
  setShortcutsOpen: (v: boolean) => void;
  setCommandPaletteOpen: (v: boolean) => void;
  setPreviewOpen: (v: boolean) => void;
  setDiagnosticsOpen: (v: boolean) => void;
  setDialog: (d: OperationDialog | null) => void;
  setDiagnosticsDestination: (v: string) => void;
  refreshDiagnostics: () => Promise<void>;
  exportDiagnostics: () => Promise<void>;
  reviewCopyMoveDialog: Parameters<
    typeof DialogOverlayGroup
  >[0]["reviewCopyMoveDialog"];
  submitCreateFolder: Parameters<
    typeof DialogOverlayGroup
  >[0]["submitCreateFolder"];
  submitCreateFile: Parameters<
    typeof DialogOverlayGroup
  >[0]["submitCreateFile"];
  submitRename: Parameters<typeof DialogOverlayGroup>[0]["submitRename"];
  submitCopyMove: Parameters<typeof DialogOverlayGroup>[0]["submitCopyMove"];
  submitTrash: Parameters<typeof DialogOverlayGroup>[0]["submitTrash"];
  submitPermanentDelete: Parameters<
    typeof DialogOverlayGroup
  >[0]["submitPermanentDelete"];
  copyTextFromSelection: (
    panelId: PanelId,
    kind: "path" | "name" | "parentPath" | "uri",
  ) => Promise<void>;
  revealEntry: (panelId: PanelId, entry: FileEntryDto | null) => Promise<void>;
  handleSetAutostart: (enabled: boolean) => Promise<void>;
  handleCommandSelect: (id: string) => void;
  toasts: ToastMessage[];
  setToasts: React.Dispatch<React.SetStateAction<ToastMessage[]>>;
  contextMenu: ContextMenuState | null;
  setContextMenu: (m: ContextMenuState | null) => void;
  clipboard: FileClipboardState | null;
  starredUriSet: Set<string>;
  dispatch: React.Dispatch<PanelAction>;
  activateEntry: (panelId: PanelId, entry: FileEntryDto | null) => void;
  handleRename: (panelId: PanelId) => void;
  copySelectionToFileClipboard: (
    panelId: PanelId,
    mode: "copy" | "move",
  ) => void;
  pasteClipboard: (panelId: PanelId) => Promise<void>;
  handleTrash: (panelId: PanelId) => void;
  toggleStarredForEntry: (entry: FileEntryDto) => Promise<void>;
  handlePermanentDelete: (panelId: PanelId) => void;
  handleProperties: (
    panelId: PanelId,
    entry: FileEntryDto | null,
  ) => Promise<void>;
  openTerminal: (uri: string) => void;
  handleChecksum: (panelId: PanelId) => Promise<void>;
  handleCompress: (panelId: PanelId) => Promise<void>;
  handleExtract: (panelId: PanelId) => Promise<void>;
  handleCreateFolder: (panelId: PanelId) => void;
  handleCreateFile: (panelId: PanelId) => void;
  refreshPanel: (panelId: PanelId) => void;
  handleCopyOrMove: (panelId: PanelId, mode: "copy" | "move") => void;
  openExternal: (entry: FileEntryDto) => Promise<void>;
  toggleHidden: (panelId: PanelId) => void;
  navigatePanel: (panelId: PanelId, uri: string) => void;
  navigateOtherPane: (uri: string) => void;
  addFavorite: (uri: string) => void;
  refreshNavigation: () => Promise<void>;
  setOperationError: (error: string | null) => void;
  applySplitRatioFn: (ratio: number) => number;
}

export function ShellLayout({
  workspaceRef,
  handleShellKeyDown,
  makeFilePanelProps,
  menuBarProps,
  state,
  activeTabUri,
  locations,
  favorites,
  recentToday,
  recentWeek,
  starred,
  preferences,
  updatePreference,
  client,
  jobs,
  jobMetrics,
  history,
  operationError,
  activityCollapsed,
  markActivityPinnedOpen,
  setActivityCollapsed,
  refreshHistory,
  clearHistory,
  settingsOpen,
  shortcutsOpen,
  commandPaletteOpen,
  previewOpen,
  diagnosticsOpen,
  dialog,
  autostart,
  commandEntries,
  previewEntry,
  appInfo,
  appHealth,
  diagnosticsDestination,
  diagnosticsMessage,
  exportingDiagnostics,
  isProductionBuild,
  setSettingsOpen,
  setShortcutsOpen,
  setCommandPaletteOpen,
  setPreviewOpen,
  setDiagnosticsOpen,
  setDialog,
  setDiagnosticsDestination,
  refreshDiagnostics,
  exportDiagnostics,
  reviewCopyMoveDialog,
  submitCreateFolder,
  submitCreateFile,
  submitRename,
  submitCopyMove,
  submitTrash,
  submitPermanentDelete,
  copyTextFromSelection,
  revealEntry,
  handleSetAutostart,
  handleCommandSelect,
  toasts,
  setToasts,
  contextMenu,
  setContextMenu,
  clipboard,
  starredUriSet,
  dispatch,
  activateEntry,
  handleRename,
  copySelectionToFileClipboard,
  pasteClipboard,
  handleTrash,
  toggleStarredForEntry,
  handlePermanentDelete,
  handleProperties,
  openTerminal,
  handleChecksum,
  handleCompress,
  handleExtract,
  handleCreateFolder,
  handleCreateFile,
  refreshPanel,
  handleCopyOrMove,
  openExternal,
  toggleHidden,
  navigatePanel,
  navigateOtherPane,
  addFavorite,
  refreshNavigation,
  setOperationError,
  applySplitRatioFn,
}: ShellLayoutProps) {
  return (
    <ErrorBoundary>
      <main className="fo-shell" tabIndex={-1} onKeyDown={handleShellKeyDown}>
        <div className="fo-shell-frame">
          <TitleBar
            onSettings={() => setSettingsOpen(true)}
            menuBarProps={menuBarProps}
          />
          <section
            ref={workspaceRef}
            className="fo-workspace"
            aria-label="File workspace"
          >
            {preferences?.sidebarVisible !== false ? (
              <>
                <Sidebar
                  locations={locations}
                  favorites={favorites}
                  recentToday={recentToday}
                  recentWeek={recentWeek}
                  starred={starred}
                  activeUri={activeTabUri}
                  onNavigate={(uri) => navigatePanel(state.activePanelId, uri)}
                  onAddFavorite={(uri, label) => {
                    void client.navigation
                      .addFavorite({ uri, label })
                      .then(() => refreshNavigation())
                      .catch((error) =>
                        setOperationError(normalizeIpcError(error).message),
                      );
                  }}
                  onRemoveFavorite={(id) => {
                    void client.navigation
                      .removeFavorite({ id })
                      .then(() => refreshNavigation())
                      .catch((error) =>
                        setOperationError(normalizeIpcError(error).message),
                      );
                  }}
                  onRenameFavorite={(id, label) => {
                    void client.navigation
                      .renameFavorite({ id, label })
                      .then(() => refreshNavigation())
                      .catch((error) =>
                        setOperationError(normalizeIpcError(error).message),
                      );
                  }}
                  onRevealFavorite={(uri) => {
                    void client.fs
                      .revealPathInFileManager({ uri })
                      .catch((error: unknown) =>
                        setOperationError(normalizeIpcError(error).message),
                      );
                  }}
                />
                <SidebarResizer
                  onSidebarResize={(width) => {
                    document.documentElement.style.setProperty(
                      "--fo-sidebar-width",
                      `${width}px`,
                    );
                    void updatePreference("sidebarWidth", String(width));
                  }}
                />
              </>
            ) : null}
            <div className="fo-dual-pane" aria-label="File panels">
              <FilePanel {...makeFilePanelProps("left")} />
              <SplitResizer
                onSplitResize={(ratio) => {
                  const nextRatio = applySplitRatioFn(ratio);
                  void updatePreference("splitRatio", String(nextRatio));
                }}
              />
              <FilePanel {...makeFilePanelProps("right")} />
            </div>
            <ActivityPanel
              jobs={Object.values(jobs)}
              history={history}
              error={operationError}
              collapsed={activityCollapsed}
              jobMetrics={jobMetrics}
              onToggleCollapsed={() => {
                const next = !activityCollapsed;
                if (!next) {
                  markActivityPinnedOpen();
                }
                setActivityCollapsed(next);
                void updatePreference("activityPanelVisible", String(!next));
              }}
              onCancel={(jobId) => void client.jobs.cancelJob({ jobId })}
              onRefreshHistory={() => void refreshHistory()}
              onClearHistory={() => void clearHistory()}
            />
          </section>
          <ToastStack
            toasts={toasts}
            onDismiss={(id) =>
              setToasts((current) => current.filter((toast) => toast.id !== id))
            }
          />
          <DialogOverlayGroup
            preferences={preferences}
            settingsOpen={settingsOpen}
            shortcutsOpen={shortcutsOpen}
            commandPaletteOpen={commandPaletteOpen}
            previewOpen={previewOpen}
            diagnosticsOpen={diagnosticsOpen}
            dialog={dialog}
            autostart={autostart}
            commandEntries={commandEntries}
            previewEntry={previewEntry}
            appInfo={appInfo}
            appHealth={appHealth}
            diagnosticsDestination={diagnosticsDestination}
            diagnosticsMessage={diagnosticsMessage}
            exportingDiagnostics={exportingDiagnostics}
            isProductionBuild={isProductionBuild}
            fs={client.fs}
            updatePreference={updatePreference}
            handleSetAutostart={handleSetAutostart}
            handleCommandSelect={handleCommandSelect}
            setSettingsOpen={setSettingsOpen}
            setShortcutsOpen={setShortcutsOpen}
            setCommandPaletteOpen={setCommandPaletteOpen}
            setDiagnosticsOpen={setDiagnosticsOpen}
            setPreviewOpen={setPreviewOpen}
            setDialog={setDialog}
            setDiagnosticsDestination={setDiagnosticsDestination}
            refreshDiagnostics={refreshDiagnostics}
            exportDiagnostics={exportDiagnostics}
            reviewCopyMoveDialog={reviewCopyMoveDialog}
            submitCreateFolder={submitCreateFolder}
            submitCreateFile={submitCreateFile}
            submitRename={submitRename}
            submitCopyMove={submitCopyMove}
            submitTrash={submitTrash}
            submitPermanentDelete={submitPermanentDelete}
            copyTextFromSelection={copyTextFromSelection}
            revealEntry={revealEntry}
          />
          <ContextMenuOverlay
            menu={contextMenu}
            state={state}
            clipboard={clipboard}
            starredUriSet={starredUriSet}
            dispatch={dispatch}
            onClose={() => setContextMenu(null)}
            activateEntry={activateEntry}
            handleRename={handleRename}
            copySelectionToFileClipboard={copySelectionToFileClipboard}
            pasteClipboard={pasteClipboard}
            handleTrash={handleTrash}
            toggleStarredForEntry={toggleStarredForEntry}
            handlePermanentDelete={handlePermanentDelete}
            copyTextFromSelection={copyTextFromSelection}
            handleProperties={handleProperties}
            revealEntry={revealEntry}
            openTerminal={openTerminal}
            handleChecksum={handleChecksum}
            handleCompress={handleCompress}
            handleExtract={handleExtract}
            handleCreateFolder={handleCreateFolder}
            handleCreateFile={handleCreateFile}
            refreshPanel={refreshPanel}
            handleCopyOrMove={handleCopyOrMove}
            openExternal={openExternal}
            toggleHidden={toggleHidden}
            navigatePanel={navigatePanel}
            navigateOtherPane={navigateOtherPane}
            addFavorite={addFavorite}
          />
          <StatusBarSection
            state={state}
            jobs={jobs}
            operationError={operationError}
            appHealth={appHealth}
            diagnosticsOpen={diagnosticsOpen}
          />
        </div>
      </main>
    </ErrorBoundary>
  );
}
