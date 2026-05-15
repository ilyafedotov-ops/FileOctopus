import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export type BadgeTone = "default" | "accent" | "success" | "warning" | "danger";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
}

export function Badge({
  tone = "default",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cx("fo-ui-badge", `fo-ui-badge--${tone}`, className)}
      {...props}
    >
      {children}
    </span>
  );
}
