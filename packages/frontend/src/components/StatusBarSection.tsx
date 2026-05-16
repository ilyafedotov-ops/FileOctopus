import type {
  AppDataHealthResponse,
  FileEntryDto,
  JobSnapshot,
} from "@fileoctopus/ts-api";
import type { FileOctopusState } from "../panelStore";
import { activeTab } from "../panelStore";
import { formatSize } from "../pane/fileTableUtils";
import { localPathFromUri } from "../utils/paneUtils";
import { StatusBar } from "../shell/StatusBar";

interface StatusBarSectionProps {
  state: FileOctopusState;
  jobs: Record<string, JobSnapshot>;
  operationError: string | null;
  appHealth: AppDataHealthResponse | null;
  diagnosticsOpen: boolean;
}

export function StatusBarSection({
  state,
  jobs,
  operationError,
  appHealth,
  diagnosticsOpen,
}: StatusBarSectionProps) {
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

  const activeJobCount = Object.values(jobs).filter(
    (job) => job.status === "queued" || job.status === "running",
  ).length;

  return (
    <StatusBar
      activePanelLabel={
        state.activePanelId === "left" ? "Left pane" : "Right pane"
      }
      pathLabel={localPathFromUri(statusTab.uri)}
      loadState={statusTab.loadState}
      selectedCount={statusSelection.length}
      entryCount={statusTab.orderedEntryIds.length}
      filterActive={statusTab.filter.trim().length > 0}
      selectedSizeLabel={
        statusSelection.length > 0
          ? `${formatSize(statusKnownBytes)}${statusUnknownSizes ? " plus unknown sizes" : ""}`
          : null
      }
      activeJobCount={activeJobCount}
      operationError={operationError}
      logPath={appHealth?.logDir ?? null}
      showLogPath={diagnosticsOpen}
    />
  );
}
