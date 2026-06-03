import { useId, type ReactNode } from "react";
import { Button, Icons, cx } from "@fileoctopus/ui";

interface PathBrowseFieldProps {
  className: string;
  label: string;
  value: string;
  placeholder?: string;
  browseLabel: string;
  onChange: (value: string) => void;
  onBrowse: () => void;
  children?: ReactNode;
}

export function PathBrowseField({
  className,
  label,
  value,
  placeholder,
  browseLabel,
  onChange,
  onBrowse,
  children,
}: PathBrowseFieldProps) {
  const inputId = useId();

  return (
    <div className={cx(className, "fo-path-field")}>
      <label htmlFor={inputId}>{label}</label>
      <div className="fo-path-input-row">
        <input
          id={inputId}
          type="text"
          aria-label={label}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={browseLabel}
          title={browseLabel}
          onClick={onBrowse}
        >
          {Icons.folder()}
        </Button>
      </div>
      {children}
    </div>
  );
}
