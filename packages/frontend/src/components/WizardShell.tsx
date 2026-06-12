import { type ReactNode } from "react";
import { Button, cx } from "@fileoctopus/ui";
import { DialogShell } from "./DialogShell";

export interface WizardShellProps {
  open: boolean;
  onClose: () => void;
  /** Dialog heading. */
  title: string;
  /** Optional supporting line under the title. */
  subtitle?: ReactNode;
  /** Ordered step labels. */
  steps: string[];
  /** Zero-based index of the active step. */
  currentStep: number;
  /** Allow jumping to an already-reached step via the indicator. */
  onStepSelect?: (index: number) => void;
  /** Back handler; the Back button only renders when not on the first step. */
  onBack?: () => void;
  /** Primary action (Next / Finish / a custom label per step). */
  onPrimary: () => void;
  /** Primary button label (e.g. "Next", "Save"). */
  primaryLabel: string;
  primaryDisabled?: boolean;
  cancelLabel?: string;
  showCancel?: boolean;
  /** Validation/operation error shown below the body. */
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Stepped wizard frame (UPP-F1). Wraps {@link DialogShell} with a numbered
 * step indicator and a canonical Back / Cancel / primary footer. Field content
 * for the active step is supplied via `children`; navigation, validation, and
 * the primary label are driven by the caller so each step can gate progress.
 */
export function WizardShell({
  open,
  onClose,
  title,
  subtitle,
  steps,
  currentStep,
  onStepSelect,
  onBack,
  onPrimary,
  primaryLabel,
  primaryDisabled,
  cancelLabel = "Cancel",
  showCancel = true,
  error,
  className,
  children,
}: WizardShellProps) {
  const showBack = currentStep > 0 && Boolean(onBack);

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      className={cx("fo-wizard-dialog", className)}
      footer={
        <>
          {showCancel ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              {cancelLabel}
            </Button>
          ) : null}
          {showBack ? (
            <Button type="button" variant="ghost" size="sm" onClick={onBack}>
              Back
            </Button>
          ) : null}
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={primaryDisabled}
            onClick={onPrimary}
          >
            {primaryLabel}
          </Button>
        </>
      }
    >
      <div className="fo-wizard-progress" aria-hidden="true">
        <div
          className="fo-wizard-progress-fill"
          style={{
            width: `${(currentStep / Math.max(1, steps.length - 1)) * 100}%`,
          }}
        />
      </div>
      <ol className="fo-wizard-steps" aria-label="Steps">
        {steps.map((label, index) => {
          const state =
            index === currentStep
              ? "active"
              : index < currentStep
                ? "done"
                : "todo";
          const reachable = Boolean(onStepSelect) && index <= currentStep;
          return (
            <li
              key={label}
              className={cx("fo-wizard-step", `fo-wizard-step-${state}`)}
              aria-current={index === currentStep ? "step" : undefined}
            >
              <button
                type="button"
                className="fo-wizard-step-btn"
                disabled={!reachable}
                title={label}
                onClick={() => onStepSelect?.(index)}
              >
                <span className="fo-wizard-step-index" aria-hidden="true">
                  {state === "done" ? "✓" : index + 1}
                </span>
                <span className="fo-wizard-step-label">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="fo-wizard-body">{children}</div>
      {error ? (
        <p className="fo-dialog-error fo-wizard-error">{error}</p>
      ) : null}
    </DialogShell>
  );
}
