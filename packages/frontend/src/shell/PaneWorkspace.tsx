import { Sidebar } from "../sidebar/Sidebar";
import { FilePanel } from "../pane/FilePanel";
import { ActivityPanel } from "../jobs/ActivityPanel";
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
              ctx.handleCommandSelect("nav.openUri", ctx.state.activePanelId, {
                targetUri: uri,
              })
            }
            onAddFavorite={(uri, label) =>
              ctx.handleCommandSelect(
                "nav.addFavorite",
                ctx.state.activePanelId,
                {
                  targetUri: uri,
                  preferenceValue: label,
                },
              )
            }
            onRemoveFavorite={(id) =>
              ctx.handleCommandSelect("nav.removeFavorite", undefined, {
                favoriteId: id,
              })
            }
            onRenameFavorite={(id, label) =>
              ctx.handleCommandSelect("nav.renameFavorite", undefined, {
                favoriteId: id,
                preferenceValue: label,
              })
            }
            onRevealFavorite={(uri) =>
              ctx.handleCommandSelect(
                "nav.revealUri",
                ctx.state.activePanelId,
                {
                  targetUri: uri,
                },
              )
            }
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
        onToggleCollapsed={() => ctx.handleCommandSelect("view.toggleActivity")}
        onCancel={(jobId) => void ctx.client.jobs.cancelJob({ jobId })}
        onRefreshHistory={() => void ctx.refreshHistory()}
        onClearHistory={() => void ctx.clearHistory()}
      />
    </section>
  );
}
