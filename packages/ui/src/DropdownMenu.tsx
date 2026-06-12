import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "./cx";
import { Button } from "./Button";
import { MenuSurface } from "./MenuSurface";

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
  triggerAriaLabel?: string;
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
            <MenuSurface
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
                  role={
                    child.checked === undefined
                      ? "menuitem"
                      : "menuitemcheckbox"
                  }
                  aria-checked={
                    child.checked === undefined ? undefined : child.checked
                  }
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
                    {child.icon ?? (child.checked ? "✓" : null)}
                  </span>
                  <span className="fo-ui-dropdown-label">{child.label}</span>
                  {child.shortcut ? (
                    <span className="fo-ui-dropdown-shortcut">
                      {child.shortcut}
                    </span>
                  ) : null}
                </button>
              ))}
            </MenuSurface>,
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
  triggerAriaLabel,
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
      minWidth: trigger.width || 208,
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

  // When the menu opens, move focus to the menu container so arrow keys work
  // immediately (ARIA menu pattern, mirroring the context-menu behavior).
  useEffect(() => {
    if (!open || !menuStyle) {
      return;
    }
    const frame = requestAnimationFrame(() => menuRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, menuStyle]);

  const menuItemElements = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([disabled]), [role="menuitemcheckbox"]:not([disabled])',
      ) ?? [],
    );

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      onOpenChange(false);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
      triggerRef.current?.focus();
      return;
    }

    const elements = menuItemElements();
    if (elements.length === 0) {
      return;
    }
    const current = elements.findIndex((el) => el === document.activeElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = current < 0 ? 0 : (current + 1) % elements.length;
      elements[next]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const next =
        current < 0
          ? elements.length - 1
          : (current - 1 + elements.length) % elements.length;
      elements[next]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      elements[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      elements[elements.length - 1]?.focus();
    } else if (event.key.length === 1 && /\S/.test(event.key)) {
      // Type-ahead: jump to the next item whose label starts with the key.
      const char = event.key.toLowerCase();
      const start = current + 1;
      const ordered = [...elements.slice(start), ...elements.slice(0, start)];
      const match = ordered.find((el) =>
        el.textContent?.trim().toLowerCase().startsWith(char),
      );
      match?.focus();
    }
  };

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
        aria-label={triggerAriaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => onOpenChange(!open)}
      >
        {children ?? label}
      </Button>
      {open && menuStyle
        ? createPortal(
            <MenuSurface
              ref={menuRef}
              id={menuId}
              role="menu"
              tabIndex={-1}
              className="fo-ui-dropdown-menu fo-ui-dropdown-menu--portal"
              style={{
                position: "fixed",
                top: menuStyle.top,
                left: menuStyle.left,
                minWidth: menuStyle.minWidth,
                zIndex: 200,
              }}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={handleMenuKeyDown}
            >
              {items.map((item) => {
                const isSeparator =
                  item.separatorBefore && item.label.trim().length === 0;
                if (isSeparator) {
                  return (
                    <div
                      key={item.id}
                      role="separator"
                      className="fo-ui-dropdown-separator"
                    />
                  );
                }
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
                    role={
                      item.checked === undefined
                        ? "menuitem"
                        : "menuitemcheckbox"
                    }
                    aria-checked={
                      item.checked === undefined ? undefined : item.checked
                    }
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
                      {item.icon ?? (item.checked ? "✓" : null)}
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
            </MenuSurface>,
            document.body,
          )
        : null}
    </div>
  );
}
