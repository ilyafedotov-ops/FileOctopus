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
  children?: DropdownMenuItem[];
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

function SubmenuItem({
  item,
  onCloseRoot,
}: {
  item: DropdownMenuItem;
  onCloseRoot: () => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const submenuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.top, left: rect.right + 2 });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !submenuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onDocPointer);
    return () => window.removeEventListener("mousedown", onDocPointer);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cx(
          "fo-ui-dropdown-item",
          "fo-ui-dropdown-item--submenu",
          item.separatorBefore && "fo-ui-dropdown-item--separated",
        )}
        disabled={item.disabled}
        onMouseEnter={() => setOpen(true)}
        onClick={(event) => {
          event.preventDefault();
          setOpen((value) => !value);
        }}
      >
        <span className="fo-ui-dropdown-icon" aria-hidden="true">
          {item.icon}
        </span>
        <span className="fo-ui-dropdown-label">{item.label}</span>
        <span className="fo-ui-dropdown-submenu-caret" aria-hidden="true">
          ›
        </span>
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={submenuRef}
              role="menu"
              className="fo-ui-dropdown-menu fo-ui-dropdown-menu--portal fo-ui-dropdown-submenu"
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                zIndex: 201,
              }}
              onClick={(event) => event.stopPropagation()}
            >
              {(item.children ?? []).map((child) => (
                <button
                  key={child.id}
                  type="button"
                  role="menuitem"
                  className={cx(
                    "fo-ui-dropdown-item",
                    child.checked && "fo-ui-dropdown-item--checked",
                    child.danger && "fo-ui-dropdown-item--danger",
                    child.separatorBefore && "fo-ui-dropdown-item--separated",
                  )}
                  disabled={child.disabled}
                  onClick={() => {
                    child.onSelect();
                    setOpen(false);
                    onCloseRoot();
                  }}
                >
                  <span className="fo-ui-dropdown-icon" aria-hidden="true">
                    {child.icon}
                  </span>
                  <span className="fo-ui-dropdown-label">{child.label}</span>
                  {child.shortcut ? (
                    <span className="fo-ui-dropdown-shortcut">
                      {child.shortcut}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
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
              {items.map((item) => {
                if (item.children && item.children.length > 0) {
                  return (
                    <SubmenuItem
                      key={item.id}
                      item={item}
                      onCloseRoot={() => onOpenChange(false)}
                    />
                  );
                }
                return (
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
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
