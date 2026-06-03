import { Button } from "@fileoctopus/ui";

export interface ToastMessage {
  id: string;
  tone: "success" | "error" | "info";
  title: string;
  detail?: string;
  popup?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastStackProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  // The live region stays mounted even when empty so screen readers announce
  // toasts inserted into it; tearing the region down per-toast can suppress
  // announcements (UPP-I1). Empty renders no visible content.
  return (
    <div
      className="fo-toast-stack"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`fo-toast fo-toast-${toast.tone}`}
          // Errors are urgent → assertive alert; success/info are polite status.
          role={toast.tone === "error" ? "alert" : "status"}
        >
          <div className="fo-toast-body">
            <strong>{toast.title}</strong>
            {toast.detail ? <span>{toast.detail}</span> : null}
          </div>
          <div className="fo-toast-actions">
            {toast.actionLabel && toast.onAction ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toast.onAction}
              >
                {toast.actionLabel}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDismiss(toast.id)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
