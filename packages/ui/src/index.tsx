import type { ReactNode } from "react";

export interface ShellPanelProps {
  title: string;
  active?: boolean;
  children?: ReactNode;
}

export function ShellPanel({ title, active = false, children }: ShellPanelProps) {
  return (
    <section className={active ? "fo-panel fo-panel-active" : "fo-panel"}>
      <header className="fo-panel-header">
        <span>{title}</span>
        <span>{active ? "Active" : "Ready"}</span>
      </header>
      <div className="fo-panel-body">{children}</div>
    </section>
  );
}

