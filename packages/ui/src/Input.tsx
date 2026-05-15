import { forwardRef, type InputHTMLAttributes } from "react";
import { cx } from "./cx";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid = false, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cx(
        "fo-ui-input",
        invalid && "fo-ui-input--invalid",
        className,
      )}
      {...props}
    />
  );
});
