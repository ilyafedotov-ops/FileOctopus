import type {
  JobSnapshot,
  OperationHistoryRecordDto,
} from "@fileoctopus/ts-api";
import {
  Badge,
  Button,
  IconButton,
  Icons,
  SegmentedControl,
} from "@fileoctopus/ui";
import { useMemo, useRef } from "react";
import { useTerminal } from "../app/providers/TerminalProvider";
import {
  TerminalTabBar,
  type TerminalSearchDirection,
} from "../terminal/TerminalTabBar";
import {
  TerminalView,
  type TerminalViewHandle,
} from "../terminal/TerminalView";
import {
  sessionsForActivityRail,
  type ActivityRailSegment,
} from "../terminal/terminalSlice";
import { JobCard } from "./JobCard";
import { OperationHistoryList } from "./OperationHistoryList";
import { jobIdValue } from "./jobCardUtils";
import type { FileOctopusClient } from "@fileoctopus/ts-api";

interface JobMetrics {
  speedLabel: string | null;
  etaLabel: string | null;
}

interface ActivityRailPanelProps {
  client: FileOctopusClient;
  jobs: JobSnapshot[];
  history: OperationHistoryRecordDto[];
  error: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onCancel: (jobId: string) => void;
  onPause?: (jobId: string) => void;
  onResume?: (jobId: string) => void;
  onRefreshHistory: () => void;
  onClearHistory: () => void;
  jobMetrics: Record<string, JobMetrics>;
  activeFolderUri: string;
  activePanelId: "left" | "right";
  onOpenTerminalInFolder: () => void;
}

const SEGMENT_HEADERS: Record<
  ActivityRailSegment,
  { title: string; subtitle: string }
> = {
  activity: {
    title: "Jobs & Activity",
    subtitle: "Operations and history",
  },
  history: {
    title: "Jobs & Activity",
    subtitle: "Operations and history",
  },
  terminal: {
    title: "Terminal",
    subtitle: "Shell sessions in the active folder",
  },
};

export function ActivityRailPanel({
  client,
  jobs,
  history,
  error,
  collapsed,
  onToggleCollapsed,
  onCancel,
  onPause,
  onResume,
  onRefreshHistory,
  onClearHistory,
  jobMetrics,
  activeFolderUri,
  activePanelId,
  onOpenTerminalInFolder,
}: ActivityRailPanelProps) {
  const {
    terminal,
    setRailSegment,
    closeTerminalTab,
    renameTerminalTab,
    duplicateTerminalTab,
    switchTerminalTab,
    openNewTerminalTab,
    markSessionExited,
  } = useTerminal();
  const terminalRefs = useRef(new Map<string, TerminalViewHandle | null>());

  const segment = terminal.segment;
  const header = SEGMENT_HEADERS[segment];
  const railSessions = sessionsForActivityRail(terminal.sessions);
  const paneTerminalCount = terminal.sessions.length - railSessions.length;

  const activeJobs = jobs.filter(
    (job) =>
      job.status === "queued" ||
      job.status === "running" ||
      job.status === "paused",
  );
  const recentJobs = jobs
    .filter(
      (job) =>
        job.status !== "queued" &&
        job.status !== "running" &&
        job.status !== "paused",
    )
    .slice(-5)
    .reverse();

  const activityCards = useMemo(
    () => [...activeJobs, ...recentJobs],
    [activeJobs, recentJobs],
  );

  const openTerminalCount = railSessions.filter(
    (session) => session.status !== "exited",
  ).length;

  if (collapsed) {
    return (
      <aside
        className="fo-activity fo-activity-rail fo-activity-collapsed"
        aria-label="Activity and terminal"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="fo-activity-collapsed-btn"
          aria-label={
            activeJobs.length > 0
              ? `Expand panel (${activeJobs.length} active jobs)`
              : "Expand activity and terminal panel"
          }
          title="Jobs, history, and terminal"
          onClick={onToggleCollapsed}
        >
          {Icons.activity()}
          {activeJobs.length > 0 ? (
            <Badge tone="accent">{activeJobs.length}</Badge>
          ) : null}
          {openTerminalCount > 0 ? (
            <Badge tone="default">{openTerminalCount}</Badge>
          ) : null}
        </Button>
      </aside>
    );
  }

  return (
    <aside
      className="fo-activity fo-activity-rail"
      data-segment={segment}
      aria-label="Activity and terminal"
    >
      <header className="fo-activity-header">
        <RailPanelHeader
          title={header.title}
          subtitle={header.subtitle}
          activeJobs={activeJobs.length}
          segment={segment}
        />
        <IconButton
          label="Collapse activity panel"
          size="sm"
          onClick={onToggleCollapsed}
        >
          −
        </IconButton>
      </header>
      {error ? <div className="fo-operation-error">{error}</div> : null}
      <SegmentedControl
        aria-label="Activity views"
        className="fo-activity-segmented"
        value={segment}
        options={[
          { value: "activity", label: "Activity" },
          { value: "history", label: "History" },
          { value: "terminal", label: "Terminal" },
        ]}
        onChange={(value) => setRailSegment(value as ActivityRailSegment)}
      />
      <div className="fo-activity-body">
        {segment === "activity" ? (
          <section className="fo-activity-cards" aria-label="Active jobs">
            <h3 className="fo-activity-section-title">Active Jobs</h3>
            {activityCards.length === 0 ? (
              <div className="fo-empty-inline">No active jobs</div>
            ) : (
              activityCards.map((job) => {
                const jobId = jobIdValue(job.jobId);
                return (
                  <JobCard
                    key={jobId}
                    job={job}
                    metrics={jobMetrics[jobId]}
                    onCancel={
                      job.status === "running" ||
                      job.status === "queued" ||
                      job.status === "paused"
                        ? () => onCancel(jobId)
                        : undefined
                    }
                    onPause={
                      job.status === "running" && onPause
                        ? () => onPause(jobId)
                        : undefined
                    }
                    onResume={
                      job.status === "paused" && onResume
                        ? () => onResume(jobId)
                        : undefined
                    }
                  />
                );
              })
            )}
          </section>
        ) : null}
        {segment === "history" ? (
          <OperationHistoryList
            history={history}
            limit={12}
            onRefresh={onRefreshHistory}
            onClear={onClearHistory}
          />
        ) : null}
        {segment === "terminal" ? (
          <section className="fo-terminal-panel" aria-label="Embedded terminal">
            {railSessions.length > 0 ? (
              <>
                <TerminalTabBar
                  sessions={railSessions}
                  activeSessionId={terminal.activeSessionId}
                  onSwitch={switchTerminalTab}
                  onClose={closeTerminalTab}
                  onRename={renameTerminalTab}
                  onDuplicate={(sessionId) => {
                    void duplicateTerminalTab(sessionId);
                  }}
                  onSearch={(
                    query: string,
                    direction: TerminalSearchDirection,
                  ) => {
                    const activeSessionId = terminal.activeSessionId;
                    if (activeSessionId) {
                      terminalRefs.current
                        .get(activeSessionId)
                        ?.search(query, direction);
                    }
                  }}
                  onNew={() =>
                    void openNewTerminalTab(activeFolderUri, activePanelId)
                  }
                />
                <div className="fo-terminal-views">
                  {railSessions.map((session) => (
                    <div
                      key={session.id}
                      className="fo-terminal-view-wrap"
                      hidden={session.id !== terminal.activeSessionId}
                    >
                      {session.id.startsWith("pending-") ? (
                        <div className="fo-empty-inline">Starting shell…</div>
                      ) : (
                        <TerminalView
                          ref={(handle) => {
                            terminalRefs.current.set(session.id, handle);
                          }}
                          client={client}
                          sessionId={session.id}
                          active={session.id === terminal.activeSessionId}
                          profile={session.terminalProfile ?? null}
                          onExit={(exitCode) => {
                            markSessionExited(session.id, exitCode);
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : terminal.sessions.length > 0 ? (
              <div className="fo-terminal-empty">
                <p>
                  {paneTerminalCount === 1
                    ? "1 terminal is open in a file pane."
                    : `${paneTerminalCount} terminals are open in file panes.`}
                </p>
                <p className="fo-terminal-empty-hint">
                  Use the terminal button in the pane header, or open another
                  session here.
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void openNewTerminalTab(activeFolderUri)}
                >
                  Open detached terminal tab
                </Button>
              </div>
            ) : (
              <div className="fo-terminal-empty">
                <p>No terminal sessions yet.</p>
                <Button
                  type="button"
                  size="sm"
                  onClick={onOpenTerminalInFolder}
                >
                  Open terminal in active folder
                </Button>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </aside>
  );
}

function RailPanelHeader({
  title,
  subtitle,
  activeJobs,
  segment,
}: {
  title: string;
  subtitle: string;
  activeJobs: number;
  segment: ActivityRailSegment;
}) {
  return (
    <div>
      <h2>
        {title}
        {segment === "activity" && activeJobs > 0 ? (
          <Badge tone="accent">{activeJobs}</Badge>
        ) : null}
      </h2>
      <p>{subtitle}</p>
    </div>
  );
}
