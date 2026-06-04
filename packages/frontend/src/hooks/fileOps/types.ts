import type { Dispatch, SetStateAction } from "react";
import type {
  FileEntryDto,
  FileOperationKind,
  FileOperationPlanDto,
  JobSnapshot,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import { createFileOctopusClient } from "@fileoctopus/ts-api";
import type { FileOctopusState, PanelAction, PanelId } from "../../panelStore";
import type { OperationDialog } from "../../dialogs/OperationDialogView";
import type { SearchState } from "../../pane/PaneFilterBar";
import type { ContentSearchState } from "../../pane/ContentSearchPanel";
import type { ToastMessage } from "../../components/ToastStack";

export type CopyMoveKind = Extract<FileOperationKind, "copy" | "move">;

export interface FileClipboardState {
  kind: CopyMoveKind;
  uris: string[];
  entries: FileEntryDto[];
  providerId: string;
  timestamp: number;
}

export interface UseFileOpHandlersDeps {
  client: ReturnType<typeof createFileOctopusClient>;
  state: FileOctopusState;
  dispatch: Dispatch<PanelAction>;
  setSearch: Dispatch<SetStateAction<SearchState | null>>;
  setContentSearch: Dispatch<SetStateAction<ContentSearchState | null>>;
  setDialog: Dispatch<SetStateAction<OperationDialog | null>>;
  setClipboard: Dispatch<SetStateAction<FileClipboardState | null>>;
  clipboard: FileClipboardState | null;
  setJobs: Dispatch<SetStateAction<Record<string, JobSnapshot>>>;
  setOperationError: Dispatch<SetStateAction<string | null>>;
  pushToast: (toast: Omit<ToastMessage, "id">) => void;
  preferences: UserPreferencesDto | null;
  refreshPanel: (
    panelId: PanelId,
    options?: {
      replace?: boolean;
      includeHidden?: boolean;
      softRefresh?: boolean;
      backgroundRefresh?: boolean;
    },
  ) => void;
  refreshVisiblePanels: (options?: {
    replace?: boolean;
    includeHidden?: boolean;
    softRefresh?: boolean;
    backgroundRefresh?: boolean;
  }) => void;
  refreshNavigation: () => Promise<void>;
  navigatePanel: (
    panelId: PanelId,
    input: string,
    options?: {
      replace?: boolean;
      includeHidden?: boolean;
      softRefresh?: boolean;
      backgroundRefresh?: boolean;
    },
  ) => Promise<void>;
  registerOperationRefresh?: (
    jobId: string,
    plan: FileOperationPlanDto,
  ) => void;
}
