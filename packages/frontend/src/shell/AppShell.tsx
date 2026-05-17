import type { ReactNode } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { TitleBar } from "./TitleBar";
import { useShellLayout } from "./ShellLayoutContext";

export function AppShell({
  workspace,
  overlays,
  statusBar,
}: {
  workspace: ReactNode;
  overlays: ReactNode;
  statusBar: ReactNode;
}) {
  const { handleShellKeyDown, menuBarProps, setSettingsOpen } =
    useShellLayout();

  return (
    <ErrorBoundary>
      <main className="fo-shell" tabIndex={-1} onKeyDown={handleShellKeyDown}>
        <div className="fo-shell-frame">
          <TitleBar
            onSettings={() => setSettingsOpen(true)}
            menuBarProps={menuBarProps}
          />
          {workspace}
          {overlays}
          {statusBar}
        </div>
      </main>
    </ErrorBoundary>
  );
}
