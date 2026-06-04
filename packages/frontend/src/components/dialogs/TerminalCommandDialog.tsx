import { useEffect, useRef, useState } from "react";
import { Button } from "@fileoctopus/ui";
import { DialogShell } from "../DialogShell";

interface TerminalCommandDialogProps {
  open: boolean;
  title: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (command: string) => void;
}

export function TerminalCommandDialog({
  open,
  title,
  submitLabel,
  onClose,
  onSubmit,
}: TerminalCommandDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [command, setCommand] = useState("");
  const trimmed = command.trim();

  useEffect(() => {
    if (open) {
      setCommand("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title={title}
      titleId="terminal-command-title"
      subtitle="Enter a shell command to execute."
      className="fo-terminal-command-dialog"
      size="sm"
    >
      <form
        className="fo-dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!trimmed) {
            return;
          }
          onSubmit(trimmed);
          onClose();
        }}
      >
        <label className="fo-dialog-field">
          <span>Command</span>
          <input
            ref={inputRef}
            aria-label="Terminal command"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder="pnpm test"
          />
        </label>
        <div className="fo-dialog-footer">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={!trimmed}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
