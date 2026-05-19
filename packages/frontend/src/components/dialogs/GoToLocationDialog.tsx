import { useEffect, useRef, useState } from "react";
import { Button } from "@fileoctopus/ui";
import { useDialogEscape } from "../../hooks/useDialogEscape";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { isSupportedNavigationUri } from "@fileoctopus/ts-api";
import { normalizeUriInput } from "../../panelStore";

interface GoToLocationDialogProps {
  open: boolean;
  initialUri: string;
  onClose: () => void;
  onNavigate: (uri: string) => void;
}

export function GoToLocationDialog({
  open,
  initialUri,
  onClose,
  onNavigate,
}: GoToLocationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useDialogEscape(open, onClose);
  useFocusTrap(dialogRef, open);
  const [path, setPath] = useState(initialUri);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPath(initialUri.replace(/^local:\/\//, ""));
      setError(null);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [open, initialUri]);

  if (!open) {
    return null;
  }

  return (
    <div className="fo-dialog-backdrop" role="presentation" onClick={onClose}>
      <dialog
        ref={dialogRef}
        open
        role="dialog"
        className="fo-dialog fo-go-to-dialog"
        aria-labelledby="go-to-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <div>
            <h2 id="go-to-title">Go to Location</h2>
            <p>Enter a folder path or remote URI to open in the active pane.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>
        <form
          className="fo-dialog-form"
          onSubmit={(event) => {
            event.preventDefault();
            try {
              const uri = normalizeUriInput(path);
              if (!isSupportedNavigationUri(uri)) {
                setError("Enter an absolute local path or sftp:// URI.");
                return;
              }
              onNavigate(uri);
              onClose();
            } catch {
              setError("Enter a valid path.");
            }
          }}
        >
          <label className="fo-dialog-field">
            <span>Path</span>
            <input
              ref={inputRef}
              aria-label="Path"
              value={path}
              onChange={(event) => {
                setPath(event.target.value);
                setError(null);
              }}
            />
          </label>
          {error ? <div className="fo-operation-error">{error}</div> : null}
          <div className="fo-dialog-footer">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Go
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
