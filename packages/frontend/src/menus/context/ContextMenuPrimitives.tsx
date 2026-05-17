import type { ReactNode } from "react";
import { Button } from "@fileoctopus/ui";

export function ContextMenuItem({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="fo-context-menu-item"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function ContextMenuSeparator() {
  return <div className="fo-context-menu-separator" role="separator" />;
}
