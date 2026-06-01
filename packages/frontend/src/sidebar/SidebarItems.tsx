import { Button, cx } from "@fileoctopus/ui";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
export function SidebarSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="fo-sidebar-section">
      <div className="fo-sidebar-section-header">
        <h2 className="fo-sidebar-section-title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SidebarEmptyHint({ children }: { children: ReactNode }) {
  return <p className="fo-sidebar-empty-hint">{children}</p>;
}

export function SidebarItem({
  icon,
  label,
  active,
  onClick,
  onContextMenu,
  indented = false,
  subdued = false,
  title,
  badge,
  busy = false,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  indented?: boolean;
  subdued?: boolean;
  title?: string;
  badge?: "warning" | "error" | null;
  busy?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cx(
        "fo-sidebar-item",
        active && "fo-sidebar-active",
        indented && "fo-sidebar-indented",
        subdued && "fo-sidebar-subdued",
        badge === "warning" && "fo-sidebar-warning",
        badge === "error" && "fo-sidebar-error",
        busy && "fo-sidebar-busy",
      )}
      title={title ?? label}
      aria-busy={busy || undefined}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <span className="fo-sidebar-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="fo-sidebar-label">{label}</span>
    </Button>
  );
}
