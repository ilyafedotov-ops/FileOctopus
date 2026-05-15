import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "./cx";
import { Button } from "./Button";

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
  danger?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
}

export interface DropdownMenuProps {
  label: string;
  open: boolean;
  items: DropdownMenuItem[];
  onOpenChange: (open: boolean) => void;
  triggerClassName?: string;
  align?: "start" | "end";
  children?: ReactNode;
}

export function DropdownMenu({
  label,
  open,
  items,
  onOpenChange,
  triggerClassName,
  align = "end",
  children,
}: DropdownMenuProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<{
    top: number;
    left: number;
    minWidth: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setMenuStyle(null);
      return;
    }

    const trigger = triggerRef.current.getBoundingClientRect();
    const menuWidth = menuRef.current?.offsetWidth ?? 208;
    const left = align === "end" ? trigger.right - menuWidth : trigger.left;

    setMenuStyle({
      top: trigger.bottom + 4,
      left: Math.max(8, left),
      minWidth: trigger.width,
    });
  }, [align, open, items.length]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        onOpenChange(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onOpenChange, open]);

  return (
    <div
      ref={rootRef}
      className={cx(
        "fo-ui-dropdown",
        align === "start" ? "fo-ui-dropdown--start" : "fo-ui-dropdown--end",
      )}
    >
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="sm"
        className={triggerClassName}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => onOpenChange(!open)}
      >
        {children ?? label}
      </Button>
      {open && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              className="fo-ui-dropdown-menu fo-ui-dropdown-menu--portal"
              style={{
                position: "fixed",
                top: menuStyle.top,
                left: menuStyle.left,
                minWidth: menuStyle.minWidth,
                zIndex: 200,
              }}
              onClick={(event) => event.stopPropagation()}
            >
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className={cx(
                    "fo-ui-dropdown-item",
                    item.checked && "fo-ui-dropdown-item--checked",
                    item.danger && "fo-ui-dropdown-item--danger",
                    item.separatorBefore && "fo-ui-dropdown-item--separated",
                  )}
                  disabled={item.disabled}
                  onClick={() => {
                    item.onSelect();
                    onOpenChange(false);
                  }}
                >
                  <span className="fo-ui-dropdown-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="fo-ui-dropdown-label">{item.label}</span>
                  {item.shortcut ? (
                    <span className="fo-ui-dropdown-shortcut">
                      {item.shortcut}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
