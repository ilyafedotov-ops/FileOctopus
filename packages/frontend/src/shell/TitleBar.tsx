interface TitleBarProps {
  readiness: string;
  helpOpen: boolean;
  onToggleHelp: () => void;
  onSettings: () => void;
  onShortcuts: () => void;
  onDiagnostics: () => void;
}

export function TitleBar({
  readiness,
  helpOpen,
  onToggleHelp,
  onSettings,
  onShortcuts,
  onDiagnostics,
}: TitleBarProps) {
  return (
    <header className="fo-topbar">
      <div className="fo-brand">
        <span className="fo-brand-mark" aria-hidden="true">
          🐙
        </span>
        <div>
          <h1>FileOctopus</h1>
          <span className="fo-brand-badge">Rust-powered</span>
        </div>
      </div>
      <div className="fo-readiness">
        <span className="fo-readiness-dot" aria-hidden="true" />
        <span>{readiness}</span>
      </div>
      <div className="fo-topbar-actions">
        <button type="button" className="fo-topbar-settings" onClick={onSettings}>
          Settings
        </button>
        <div className="fo-help-menu">
          <button
            type="button"
            aria-expanded={helpOpen}
            onClick={onToggleHelp}
          >
            Help
          </button>
          {helpOpen ? (
            <div className="fo-help-dropdown" role="menu">
              <button type="button" role="menuitem" onClick={onShortcuts}>
                Shortcuts
              </button>
              <button type="button" role="menuitem" onClick={onDiagnostics}>
                Diagnostics
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
