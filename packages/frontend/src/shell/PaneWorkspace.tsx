import { normalizeIpcError } from "@fileoctopus/ts-api";
import { Sidebar } from "../sidebar/Sidebar";
import { FilePanel } from "../pane/FilePanel";
import { ActivityPanel } from "../activity/ActivityPanel";
import { SidebarResizer, SplitResizer } from "./LayoutResizers";
import { useShellLayout } from "./ShellLayoutContext";

export function PaneWorkspace() {
  const ctx = useShellLayout();
  const paneMode = ctx.preferences?.paneMode === "single" ? "single" : "dual";

  return (
    <section
      ref={ctx.workspaceRef}
      className="fo-workspace"
      aria-label="File workspace"
    >
      {ctx.preferences?.sidebarVisible !== false ? (
        <>
          <Sidebar
            locations={ctx.locations}
            favorites={ctx.favorites}
            recentToday={ctx.recentToday}
            recentWeek={ctx.recentWeek}
            starred={ctx.starred}
            activeUri={ctx.activeTabUri}
            onNavigate={(uri) =>
              ctx.navigatePanel(ctx.state.activePanelId, uri)
            }
            onAddFavorite={(uri, label) => {
              void ctx.client.navigation
                .addFavorite({ uri, label })
                .then(() => ctx.refreshNavigation())
                .catch((error) =>
                  ctx.setOperationError(normalizeIpcError(error).message),
                );
            }}
            onRemoveFavorite={(id) => {
              void ctx.client.navigation
                .removeFavorite({ id })
                .then(() => ctx.refreshNavigation())
                .catch((error) =>
                  ctx.setOperationError(normalizeIpcError(error).message),
                );
            }}
            onRenameFavorite={(id, label) => {
              void ctx.client.navigation
                .renameFavorite({ id, label })
                .then(() => ctx.refreshNavigation())
                .catch((error) =>
                  ctx.setOperationError(normalizeIpcError(error).message),
                );
            }}
            onRevealFavorite={(uri) => {
              void ctx.client.fs
                .revealPathInFileManager({ uri })
                .catch((error: unknown) =>
                  ctx.setOperationError(normalizeIpcError(error).message),
                );
            }}
          />
          <SidebarResizer
            onSidebarResize={(width) => {
              document.documentElement.style.setProperty(
                "--fo-sidebar-width",
                `${width}px`,
              );
              void ctx.updatePreference("sidebarWidth", String(width));
            }}
          />
        </>
      ) : null}
      <div
        className={
          paneMode === "single"
            ? "fo-dual-pane fo-dual-pane-single"
            : "fo-dual-pane"
        }
        aria-label="File panels"
      >
        <FilePanel {...ctx.makeFilePanelProps("left")} />
        {paneMode === "dual" ? (
          <>
            <SplitResizer
              onSplitResize={(ratio) => {
                const nextRatio = ctx.applySplitRatioFn(ratio);
                void ctx.updatePreference("splitRatio", String(nextRatio));
              }}
            />
            <FilePanel {...ctx.makeFilePanelProps("right")} />
          </>
        ) : null}
      </div>
      <ActivityPanel
        jobs={Object.values(ctx.jobs)}
        history={ctx.history}
        error={ctx.operationError}
        collapsed={ctx.activityCollapsed}
        jobMetrics={ctx.jobMetrics}
        onToggleCollapsed={() => {
          const next = !ctx.activityCollapsed;
          if (!next) {
            ctx.markActivityPinnedOpen();
          }
          ctx.setActivityCollapsed(next);
          void ctx.updatePreference("activityPanelVisible", String(!next));
        }}
        onCancel={(jobId) => void ctx.client.jobs.cancelJob({ jobId })}
        onRefreshHistory={() => void ctx.refreshHistory()}
        onClearHistory={() => void ctx.clearHistory()}
      />
    </section>
  );
}
