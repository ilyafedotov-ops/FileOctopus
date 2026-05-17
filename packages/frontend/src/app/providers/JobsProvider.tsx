import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type {
  JobSnapshot,
  OperationHistoryRecordDto,
} from "@fileoctopus/ts-api";

export interface JobMetrics {
  speedLabel: string | null;
  etaLabel: string | null;
  lastBytes: number;
  lastAt: number;
}

export interface JobsContextValue {
  jobs: Record<string, JobSnapshot>;
  history: OperationHistoryRecordDto[];
  operationError: string | null;
  activityCollapsed: boolean;
  jobMetrics: Record<string, JobMetrics>;
  setJobs: Dispatch<SetStateAction<Record<string, JobSnapshot>>>;
  setHistory: Dispatch<SetStateAction<OperationHistoryRecordDto[]>>;
  setOperationError: Dispatch<SetStateAction<string | null>>;
  setActivityCollapsed: Dispatch<SetStateAction<boolean>>;
  markActivityPinnedOpen: () => void;
}

const JobsContext = createContext<JobsContextValue | null>(null);

export function useJobs(): JobsContextValue {
  const ctx = useContext(JobsContext);
  if (!ctx) {
    throw new Error("useJobs must be used within JobsProvider");
  }
  return ctx;
}

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Record<string, JobSnapshot>>({});
  const [history, setHistory] = useState<OperationHistoryRecordDto[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [activityCollapsed, setActivityCollapsed] = useState(true);
  const [jobMetrics] = useState<Record<string, JobMetrics>>({});
  const pinnedOpenRef = useMemo(() => ({ current: false }), []);

  const markActivityPinnedOpen = () => {
    pinnedOpenRef.current = true;
  };

  const value = useMemo<JobsContextValue>(
    () => ({
      jobs,
      history,
      operationError,
      activityCollapsed,
      jobMetrics,
      setJobs,
      setHistory,
      setOperationError,
      setActivityCollapsed,
      markActivityPinnedOpen,
    }),
    [
      jobs,
      history,
      operationError,
      activityCollapsed,
      jobMetrics,
      pinnedOpenRef,
    ],
  );

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}
