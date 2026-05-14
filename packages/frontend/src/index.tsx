import { ShellPanel } from "@fileoctopus/ui";

export function FileOctopusShell() {
  return (
    <main className="fo-shell">
      <header className="fo-topbar">
        <div>
          <h1>FileOctopus</h1>
          <p>Dual-pane workspace foundation</p>
        </div>
        <button type="button">Command</button>
      </header>
      <section className="fo-panels" aria-label="File panels">
        <ShellPanel title="Left Panel" active>
          <div className="fo-path">local:///Users/ilya</div>
          <div className="fo-empty">Sprint 1 will connect streamed local directory listing.</div>
        </ShellPanel>
        <ShellPanel title="Right Panel">
          <div className="fo-path">local:///Users/ilya/Documents</div>
          <div className="fo-empty">Rust-owned filesystem access will appear through typed IPC.</div>
        </ShellPanel>
      </section>
      <footer className="fo-status">Ready</footer>
    </main>
  );
}
