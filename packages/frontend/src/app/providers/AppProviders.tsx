import type { ReactNode } from "react";
import { JobsProvider } from "./JobsProvider";
import { ModalsProvider } from "./ModalsProvider";
import { ShellProvider } from "./ShellProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ShellProvider>
      <JobsProvider>
        <ModalsProvider>{children}</ModalsProvider>
      </JobsProvider>
    </ShellProvider>
  );
}

export { useShell } from "./ShellProvider";
export { useJobs } from "./JobsProvider";
export { useModals } from "./ModalsProvider";
