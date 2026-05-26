import type { ReactNode } from "react";
import { JobsProvider, useJobs } from "./JobsProvider";
import { ModalsProvider } from "./ModalsProvider";
import { ShellProvider, useShell } from "./ShellProvider";
import { PreferencesProvider, usePreferences } from "./PreferencesProvider";
import { NavigationDataProvider } from "./NavigationDataProvider";
import { WorkspaceProvider } from "./WorkspaceProvider";
import { TerminalProvider } from "./TerminalProvider";
import { TagProvider } from "../TagContext";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ShellProvider>
      <PreferencesProvider>
        <NavigationDataProvider>
          <WorkspaceProvider>
            <JobsProvider>
              <TerminalBridge>
                <TagProvider>
                  <ModalsProvider>{children}</ModalsProvider>
                </TagProvider>
              </TerminalBridge>
            </JobsProvider>
          </WorkspaceProvider>
        </NavigationDataProvider>
      </PreferencesProvider>
    </ShellProvider>
  );
}

function TerminalBridge({ children }: { children: ReactNode }) {
  const jobs = useJobs();
  const shell = useShell();
  const prefs = usePreferences();

  return (
    <TerminalProvider
      preferences={prefs.preferences}
      updatePreference={async (key, value) => {
        const next = await shell.client.preferences.set({ key, value });
        prefs.setPreferences(next.preferences);
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
export { usePreferences } from "./PreferencesProvider";
export { useNavigationData } from "./NavigationDataProvider";
export { useWorkspace } from "./WorkspaceProvider";
export { useJobs } from "./JobsProvider";
export { useModals } from "./ModalsProvider";
export { useTerminal } from "./TerminalProvider";
