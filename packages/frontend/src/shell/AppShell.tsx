import type { ReactNode } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { TitleBar } from "./TitleBar";
import { useShellLayout } from "./ShellLayoutContext";

export function AppShell({
  toolbar,
  workspace,
  overlays,
  statusBar,
}: {
  toolbar: ReactNode;
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
          {toolbar}
          {workspace}
          {overlays}
          {statusBar}
        </div>
      </main>
    </ErrorBoundary>
  );
}
