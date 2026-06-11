import { useState } from "react";
import { Button } from "@fileoctopus/ui";
import { WizardShell } from "./WizardShell";

interface FirstRunOverlayProps {
  open: boolean;
  onDismiss: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onOpenNetwork: () => void;
}

export function FirstRunOverlay({
  open,
  onDismiss,
  onOpenSettings,
  onOpenShortcuts,
  onOpenNetwork,
}: FirstRunOverlayProps) {
  const [step, setStep] = useState(0);

  if (!open) {
    return null;
  }

  const run = (action?: () => void) => {
    onDismiss();
    action?.();
  };

  const body = [
    <div key="workspace" className="fo-first-run-body">
      <h3>Dual pane workspace</h3>
      <p>Start with a commander-style workspace for local and remote files.</p>
      <div className="fo-first-run-grid">
        <div className="fo-first-run-card">
          <strong>Dual pane</strong>
          <span>Compare, copy, and move between two locations.</span>
        </div>
        <div className="fo-first-run-card">
          <strong>Activity rail</strong>
          <span>Track long-running jobs without leaving the workspace.</span>
        </div>
        <button type="button" aria-label="Start" onClick={() => run()}>
          <strong>Start</strong>
          <span>Skip setup and open the workspace.</span>
        </button>
        <button
          type="button"
          aria-label="Settings"
          onClick={() => run(onOpenSettings)}
        >
          <strong>Settings</strong>
          <span>Theme, layout, network, terminal, and plugins.</span>
        </button>
        <button
          type="button"
          aria-label="Shortcuts"
          onClick={() => run(onOpenShortcuts)}
        >
          <strong>Shortcuts</strong>
          <span>Keyboard reference for fast navigation.</span>
        </button>
      </div>
    </div>,
    <div key="appearance" className="fo-first-run-body">
      <h3>Appearance</h3>
      <p>Theme, density, accent, font, and icon scale live in Settings.</p>
      <Button type="button" size="sm" onClick={() => run(onOpenSettings)}>
        Open appearance settings
      </Button>
    </div>,
    <div key="locations" className="fo-first-run-body">
      <h3>Locations</h3>
      <p>
        Use the sidebar for standard folders, volumes, favorites, and cloud sync
        roots.
      </p>
      <Button type="button" size="sm" onClick={() => run(onOpenSettings)}>
        Review location settings
      </Button>
    </div>,
    <div key="network" className="fo-first-run-body">
      <h3>Remote connections</h3>
      <p>
        Add SFTP, SSH, SMB, or S3 profiles with credentials stored in the OS
        keychain.
      </p>
      <Button type="button" size="sm" onClick={() => run(onOpenNetwork)}>
        Add connection
      </Button>
    </div>,
    <div key="terminal" className="fo-first-run-body">
      <h3>Terminal</h3>
      <p>
        Configure shell defaults and SSH terminal behavior before opening
        sessions.
      </p>
      <Button type="button" size="sm" onClick={() => run(onOpenSettings)}>
        Open terminal settings
      </Button>
    </div>,
    <div key="finish" className="fo-first-run-body">
      <h3>Ready</h3>
      <p>You are set up. Open the workspace, or jump straight into:</p>
      <div className="fo-first-run-grid">
        <button
          type="button"
          aria-label="Settings"
          onClick={() => run(onOpenSettings)}
        >
          <strong>Settings</strong>
          <span>Theme, layout, network, terminal, and plugins.</span>
        </button>
        <button
          type="button"
          aria-label="Shortcuts"
          onClick={() => run(onOpenShortcuts)}
        >
          <strong>Shortcuts</strong>
          <span>Keyboard reference for fast navigation.</span>
        </button>
      </div>
    </div>,
  ];

  return (
    <WizardShell
      open={open}
      onClose={onDismiss}
      title="Welcome to FileOctopus"
      subtitle="Set up the workspace, network connections, and terminal defaults."
      steps={[
        "Workspace",
        "Appearance",
        "Locations",
        "Network",
        "Terminal",
        "Finish",
      ]}
      currentStep={step}
      onStepSelect={setStep}
      onBack={() => setStep((current) => Math.max(0, current - 1))}
      onPrimary={() => {
        if (step === body.length - 1) {
          run();
        } else {
          setStep((current) => Math.min(body.length - 1, current + 1));
        }
      }}
      primaryLabel={step === body.length - 1 ? "Start" : "Next"}
      cancelLabel="Skip"
      showCancel={step < body.length - 1}
      className="fo-first-run-dialog"
    >
      {body[step]}
    </WizardShell>
  );
}
