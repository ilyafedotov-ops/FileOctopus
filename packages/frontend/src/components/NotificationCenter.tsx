import { Button } from "@fileoctopus/ui";
import type { ToastMessage } from "./ToastStack";

interface NotificationCenterProps {
  open: boolean;
  notifications: ToastMessage[];
  onClear: () => void;
  onDismiss: (id: string) => void;
}

export function NotificationCenter({
  open,
  notifications,
  onClear,
  onDismiss,
}: NotificationCenterProps) {
  if (!open) {
    return null;
  }

  return (
    <section className="fo-notification-center" aria-label="Notifications">
      <header className="fo-notification-center-header">
        <h2>Notifications</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={notifications.length === 0}
          onClick={onClear}
        >
          Clear
        </Button>
      </header>
      {notifications.length === 0 ? (
        <p className="fo-notification-empty">No notifications</p>
      ) : (
        <div className="fo-notification-list">
          {notifications
            .slice()
            .reverse()
            .map((notification) => (
              <article
                key={notification.id}
                className={`fo-notification-item fo-notification-${notification.tone}`}
              >
                <div className="fo-notification-body">
                  <strong>{notification.title}</strong>
                  {notification.detail ? (
                    <span>{notification.detail}</span>
                  ) : null}
                </div>
                <div className="fo-notification-actions">
                  {notification.actionLabel && notification.onAction ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={notification.onAction}
                    >
                      {notification.actionLabel}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onDismiss(notification.id)}
                  >
                    Dismiss
                  </Button>
                </div>
              </article>
            ))}
        </div>
      )}
    </section>
  );
}
