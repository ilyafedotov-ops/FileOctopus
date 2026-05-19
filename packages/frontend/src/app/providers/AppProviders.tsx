import type { ReactNode } from "react";
import { JobsProvider, useJobs } from "./JobsProvider";
import { ModalsProvider } from "./ModalsProvider";
import { ShellProvider, useShell } from "./ShellProvider";
import { TerminalProvider } from "./TerminalProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ShellProvider>
      <JobsProvider>
        <TerminalBridge>
          <ModalsProvider>{children}</ModalsProvider>
        </TerminalBridge>
      </JobsProvider>
    </ShellProvider>
  );
}

function TerminalBridge({ children }: { children: ReactNode }) {
  const jobs = useJobs();
  const shell = useShell();

  return (
    <TerminalProvider
      preferences={shell.preferences}
      updatePreference={async (key, value) => {
        const next = await shell.client.preferences.set({ key, value });
        shell.setPreferences(next.preferences);
      }}
      onExpandActivity={() => {
        jobs.markActivityPinnedOpen();
        jobs.setActivityCollapsed(false);
        void shell.client.preferences.set({
          key: "activityPanelVisible",
          value: "true",
        });
      }}
    >
      {children}
    </TerminalProvider>
  );
}

export { useShell } from "./ShellProvider";
export { useJobs } from "./JobsProvider";
export { useModals } from "./ModalsProvider";
export { useTerminal } from "./TerminalProvider";
