import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

export interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  primary?: boolean;
}

export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  function ToolbarButton(
    { primary = false, className, type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cx(
          "fo-ui-btn",
          "fo-ui-btn--sm",
          primary ? "fo-ui-btn--primary" : "fo-ui-btn--default",
          "fo-ui-toolbar-btn",
          className,
        )}
        {...props}
      />
    );
  },
);
