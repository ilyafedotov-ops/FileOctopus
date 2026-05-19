import type { FileOctopusClient } from "@fileoctopus/ts-api";
import { StubTerminalProvider } from "../src/app/providers/TerminalProvider";
import { ActivityRailPanel } from "../src/jobs/ActivityRailPanel";
import { StatusBar } from "../src/shell/StatusBar";
import { TitleBar } from "../src/shell/TitleBar";
import { mockTerminalClient } from "./mockTerminalClient";

const visualClient = {
  terminal: mockTerminalClient(),
} as unknown as FileOctopusClient;

export function VisualShellFixture() {
  return (
    <div className="fo-shell">
      <div className="fo-shell-frame">
        <TitleBar
          helpOpen={false}
          onToggleHelp={() => undefined}
          onSettings={() => undefined}
          onShortcuts={() => undefined}
          onDiagnostics={() => undefined}
        />
        <section className="fo-workspace" aria-label="File workspace preview">
          <aside className="fo-sidebar fo-sidebar-section">
            <h2 className="fo-sidebar-section-title">Favorites</h2>
          </aside>
          <div className="fo-dual-pane" aria-label="File panels preview">
            <section className="fo-panel fo-panel-active">
              <header className="fo-panel-header">
                <span className="fo-pane-badge">Left</span>
              </header>
            </section>
            <section className="fo-panel">
              <header className="fo-panel-header">
                <span className="fo-pane-badge">Right</span>
              </header>
            </section>
          </div>
          <StubTerminalProvider>
            <ActivityRailPanel
              client={visualClient}
              jobs={[]}
              history={[]}
              error={null}
              collapsed={false}
              jobMetrics={{}}
              activeFolderUri="local:///Users/ilya/Documents"
              onToggleCollapsed={() => undefined}
              onCancel={() => undefined}
              onRefreshHistory={() => undefined}
              onClearHistory={() => undefined}
              onOpenTerminalInFolder={() => undefined}
            />
          </StubTerminalProvider>
        </section>
        <StatusBar
          activePanelLabel="Left pane"
          pathLabel="/Users/ilya/Documents"
          loadState="loaded"
          selectedCount={1}
          entryCount={12}
          filterActive={false}
          selectedSizeLabel="128 KB"
          activeJobCount={0}
          operationError={null}
          onOpenActivity={() => undefined}
        />
      </div>
    </div>
  );
}
