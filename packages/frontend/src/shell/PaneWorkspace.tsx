import type { VolumeDto } from "@fileoctopus/ts-api";
import { Sidebar } from "../sidebar/Sidebar";
import { FilePanel } from "../pane/FilePanel";
import { ActivityRailPanel } from "../jobs/ActivityRailPanel";
import { SidebarResizer, SplitResizer } from "./LayoutResizers";
import { useShellLayout } from "./ShellLayoutContext";
import { useEffect, useState } from "react";

export function PaneWorkspace() {
  const ctx = useShellLayout();
  const paneMode = ctx.preferences?.paneMode === "single" ? "single" : "dual";
  const [volumes, setVolumes] = useState<VolumeDto[]>([]);

  useEffect(() => {
    let cancelled = false;
    ctx.client.fs
      .discoverVolumes()
      .then((resp) => {
        if (!cancelled) setVolumes(resp.volumes);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ctx.client.fs]);

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
            networkProfiles={ctx.networkProfiles}
            networkStatuses={ctx.networkStatuses}
            networkEnabled={ctx.appInfo?.networkEnabled ?? false}
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
            onAddServer={() => ctx.handleCommandSelect("nav.addServer")}
            onConnectProfile={(profileId) => void ctx.connectProfile(profileId)}
            onDisconnectProfile={(profileId) =>
              void ctx.disconnectProfile(profileId)
            }
            onEditProfile={(profile) =>
              ctx.handleCommandSelect("nav.connectServer", undefined, {
                networkProfile: profile,
              })
            }
            busyProfileIds={ctx.busyProfileIds}
            onDeleteProfile={(profileId) => {
              const profile = ctx.networkProfiles.find(
                (item) => item.id === profileId,
              );
              if (profile) {
                ctx.setRemoveServerProfile(profile);
              }
            }}
            onOpenProfileTerminal={(profile) =>
              void ctx.openProfileTerminalTab(profile)
            }
            volumes={volumes}
            onEjectVolume={(mountPoint) => {
              ctx.client.fs
                .ejectVolume({ mountPoint })
                .then((resp) => {
                  if (resp.success) {
                    void ctx.client.fs.discoverVolumes().then((r) => {
                      setVolumes(r.volumes);
                    });
                  }
                })
                .catch(() => {});
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
        data-pane-direction={
          ctx.preferences?.paneDirection === "vertical"
            ? "vertical"
            : "horizontal"
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
      <ActivityRailPanel
        client={ctx.client}
        jobs={Object.values(ctx.jobs)}
        history={ctx.history}
        error={ctx.operationError}
        collapsed={ctx.activityCollapsed}
        jobMetrics={ctx.jobMetrics}
        activeFolderUri={ctx.activeTabUri}
        activePanelId={ctx.state.activePanelId}
        onToggleCollapsed={() => ctx.handleCommandSelect("view.toggleActivity")}
        onCancel={(jobId) => void ctx.client.jobs.cancelJob({ jobId })}
        onPause={(jobId) => void ctx.client.jobs.pauseJob({ jobId })}
        onResume={(jobId) => void ctx.client.jobs.resumeJob({ jobId })}
        onRefreshHistory={() => void ctx.refreshHistory()}
        onClearHistory={() => void ctx.clearHistory()}
        onOpenTerminalInFolder={() =>
          ctx.handleCommandSelect("op.openTerminal", ctx.state.activePanelId)
        }
      />
    </section>
  );
}
