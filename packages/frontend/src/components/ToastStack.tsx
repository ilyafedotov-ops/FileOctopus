import { Button } from "@fileoctopus/ui";

export interface ToastMessage {
  id: string;
  tone: "success" | "error" | "info";
  title: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastStackProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) {
    return null;
  }

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
          role="status"
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
