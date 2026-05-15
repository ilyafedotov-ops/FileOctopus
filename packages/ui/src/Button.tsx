import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

export type ButtonVariant = "default" | "primary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "default", size = "md", className, type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cx(
          "fo-ui-btn",
          `fo-ui-btn--${variant}`,
          `fo-ui-btn--${size}`,
          className,
        )}
        {...props}
      />
    );
  },
);
