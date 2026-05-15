import type { ReactNode } from "react";
import { cx } from "./cx";

export interface PanelProps {
  title: string;
  active?: boolean;
  children?: ReactNode;
  className?: string;
}

export function Panel({
  title,
  active = false,
  children,
  className,
}: PanelProps) {
  return (
    <section className={cx("fo-panel", active && "fo-panel-active", className)}>
      <header className="fo-panel-header">
        <span>{title}</span>
        <span>{active ? "Active" : "Ready"}</span>
      </header>
      <div className="fo-panel-body">{children}</div>
    </section>
  );
}
