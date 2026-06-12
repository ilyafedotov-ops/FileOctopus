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
    <div key="customize" className="fo-first-run-body">
      <h3>Customize</h3>
      <p>
        Theme, density, locations, and terminal defaults all live in Settings —
        adjust them now or any time later.
      </p>
      <div className="fo-first-run-grid">
        <button
          type="button"
          aria-label="Appearance"
          onClick={() => run(onOpenSettings)}
        >
          <strong>Appearance</strong>
          <span>Theme, density, accent, font, and icon scale.</span>
        </button>
        <button
          type="button"
          aria-label="Locations"
          onClick={() => run(onOpenSettings)}
        >
          <strong>Locations</strong>
          <span>Standard folders, volumes, favorites, and sync roots.</span>
        </button>
        <button
          type="button"
          aria-label="Terminal"
          onClick={() => run(onOpenSettings)}
        >
          <strong>Terminal</strong>
          <span>Shell defaults and SSH terminal behavior.</span>
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
    <div key="connections" className="fo-first-run-body">
      <h3>Remote connections</h3>
      <p>
        Add SFTP, SSH, SMB, or S3 profiles with credentials stored in the OS
        keychain — then you are set. Start opens the workspace.
      </p>
      <Button type="button" size="sm" onClick={() => run(onOpenNetwork)}>
        Add connection
      </Button>
    </div>,
  ];

  return (
    <WizardShell
      open={open}
      onClose={onDismiss}
      title="Welcome to FileOctopus"
      subtitle="Set up the workspace, network connections, and terminal defaults."
      steps={["Workspace", "Customize", "Connections"]}
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
