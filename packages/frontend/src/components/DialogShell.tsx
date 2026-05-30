import { useId, useRef, type ReactNode } from "react";
import { Button, cx } from "@fileoctopus/ui";
import { useDialogEscape } from "../hooks/useDialogEscape";
import { useFocusTrap } from "../hooks/useFocusTrap";

export interface DialogShellProps {
  open: boolean;
  onClose: () => void;
  /** Heading text rendered in the dialog header. */
  title: string;
  /** Optional explicit id for the heading (defaults to a generated id). */
  titleId?: string;
  /** Optional supporting line under the title. */
  subtitle?: ReactNode;
  /** Width preset: maps to `.fo-dialog--{size}`. */
  size?: "sm" | "md" | "lg";
  /** Extra class names for the dialog element. */
  className?: string;
  /** Footer content (rendered in `.fo-dialog-footer`). Order: secondary
      actions first, primary last; destructive actions must be visually
      distinct and never auto-focused (UPP-E1). */
  footer?: ReactNode;
  /** Show the header close button (default true). */
  showClose?: boolean;
  /** Close when the backdrop is clicked (default true). */
  closeOnBackdrop?: boolean;
  children: ReactNode;
}

/**
 * Shared modal frame (UPP-E1). Encapsulates the backdrop, the native
 * `<dialog>` element, focus trapping + restore (`useFocusTrap`), Escape
 * handling (`useDialogEscape`), `aria-modal`, the standard header
 * (title / subtitle / close), and an optional footer slot — so every dialog
 * is structurally and behaviourally consistent instead of re-implementing
 * the chrome.
 */
export function DialogShell({
  open,
  onClose,
  title,
  titleId,
  subtitle,
  size,
  className,
  footer,
  showClose = true,
  closeOnBackdrop = true,
  children,
}: DialogShellProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const generatedId = useId();
  const headingId = titleId ?? `fo-dialog-${generatedId}`;

  useDialogEscape(open, onClose);
  useFocusTrap(dialogRef, open);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fo-dialog-backdrop"
      role="presentation"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <dialog
        ref={dialogRef}
        open
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={cx("fo-dialog", size && `fo-dialog--${size}`, className)}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <div>
            <h2 id={headingId}>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {showClose ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close"
            >
              Close
            </Button>
          ) : null}
        </header>
        {children}
        {footer ? <footer className="fo-dialog-footer">{footer}</footer> : null}
      </dialog>
    </div>
  );
}
