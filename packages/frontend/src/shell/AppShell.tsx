import { useEffect, useRef, type ReactNode } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { TitleBar } from "./TitleBar";
import { useShellLayout } from "./ShellLayoutContext";
import { activeTab } from "../panelStore";
import { localPathFromUri } from "../utils/paneUtils";

function getH(sel: string) {
  const el = document.querySelector(sel);
  if (!el) return "N/A";
  const cs = getComputedStyle(el);
  return `${parseFloat(cs.height).toFixed(0)}px`;
}

const isDevBuild = Boolean(
  (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV,
);

const showDebug =
  isDevBuild &&
  typeof globalThis.localStorage === "object" &&
  globalThis.localStorage.getItem("fo-debug") === "1";

function DebugOverlay() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = () => {
      const items = [
        [".fo-topbar", "Topbar"],
        [".fo-operation-toolbar", "Toolbar"],
        [".fo-menubar", "Menubar"],
        [".fo-sidebar", "Sidebar"],
        [".fo-sidebar-item", "SidebarItem"],
        [".fo-sidebar-group-label", "GroupLabel"],
        [".fo-panel-header", "PanelHeader"],
        [".fo-breadcrumb", "Breadcrumb"],
        [".fo-columns", "TableHeader"],
        [".fo-row", "Row"],
        [".fo-status", "Statusbar"],
        [".fo-shell-frame", "ShellFrame"],
        [".fo-workspace", "Workspace"],
        [".fo-dual-pane", "DualPane"],
      ];
      if (ref.current) {
        ref.current.innerHTML =
          "<b>FO Debug (px)</b><br>" +
          items.map(([sel, name]) => `${name}: ${getH(sel)}`).join("<br>");
      }
    };
    update();
    const id = setInterval(update, 2000);
    return () => clearInterval(id);
  }, []);
  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,0.9)",
        color: "#0f0",
        font: "bold 11px/1.4 monospace",
        padding: "8px",
        borderRadius: "0 0 8px 0",
        pointerEvents: "none",
      }}
    />
  );
}

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
  const { handleShellKeyDown, menuBarProps, setSettingsOpen, state } =
    useShellLayout();
  const titlePath = localPathFromUri(activeTab(state.panels.left).uri);

  return (
    <ErrorBoundary>
      <main className="fo-shell" tabIndex={-1} onKeyDown={handleShellKeyDown}>
        <div className="fo-shell-frame">
          <TitleBar
            onSettings={() => setSettingsOpen(true)}
            menuBarProps={menuBarProps}
            titlePath={titlePath}
          />
          {toolbar}
          {workspace}
          {statusBar}
        </div>
        {overlays}
        {showDebug && <DebugOverlay />}
      </main>
    </ErrorBoundary>
  );
}
