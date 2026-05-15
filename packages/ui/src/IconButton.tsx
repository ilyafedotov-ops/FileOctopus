import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

export type IconButtonSize = "sm" | "md";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: IconButtonSize;
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { size = "md", className, label, type = "button", children, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cx(
          "fo-ui-btn",
          "fo-ui-btn--ghost",
          "fo-ui-icon-btn",
          `fo-ui-btn--${size}`,
          className,
        )}
        aria-label={label}
        title={label}
        {...props}
      >
        {children}
      </button>
    );
  },
);
