import { cx } from "./cx";

export interface DividerProps {
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export function Divider({
  orientation = "horizontal",
  className,
}: DividerProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cx(
        "fo-ui-divider",
        `fo-ui-divider--${orientation}`,
        className,
      )}
    />
  );
}
