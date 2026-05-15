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
    <div className="fo-toast-stack" aria-live="polite">
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
              <button type="button" onClick={toast.onAction}>
                {toast.actionLabel}
              </button>
            ) : null}
            <button type="button" onClick={() => onDismiss(toast.id)}>
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
