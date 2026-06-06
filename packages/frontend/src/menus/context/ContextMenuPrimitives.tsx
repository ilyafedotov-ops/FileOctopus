import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Button, Icons } from "@fileoctopus/ui";

export function ContextMenuItem({
  disabled,
  disabledReason,
  icon,
  label,
  onClick,
  shortcut,
  submenu,
  tone,
  children,
}: {
  disabled?: boolean;
  disabledReason?: string;
  icon?: ReactNode;
  label?: ReactNode;
  onClick: () => void;
  shortcut?: string;
  submenu?: boolean;
  tone?: "default" | "danger";
  children?: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={[
        "fo-context-menu-item",
        submenu ? "fo-context-menu-item--submenu" : null,
        tone === "danger" ? "fo-context-menu-item--danger" : null,
      ]
        .filter(Boolean)
        .join(" ")}
      role="menuitem"
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      aria-disabled={disabled ? true : undefined}
      aria-haspopup={submenu ? "menu" : undefined}
      onClick={onClick}
    >
      <span className="fo-context-menu-item-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="fo-context-menu-item-label">{label ?? children}</span>
      {shortcut ? (
        <span className="fo-context-menu-item-shortcut">{shortcut}</span>
      ) : null}
      {submenu ? (
        <span className="fo-context-menu-item-caret" aria-hidden="true">
          {Icons.chevronRight()}
        </span>
      ) : null}
    </Button>
  );
}

export function ContextMenuSeparator() {
  return <div className="fo-context-menu-separator" role="separator" />;
}

export function ContextMenuSubmenu({
  children,
  icon,
  label,
}: {
  children: ReactNode;
  icon?: ReactNode;
  label: ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const [submenuStyle, setSubmenuStyle] = useState<CSSProperties>();

  const updateSubmenuPosition = useCallback(() => {
    const wrapper = wrapperRef.current;
    const submenu = submenuRef.current;
    if (!wrapper || !submenu) return;

    const pad = 8;
    const triggerRect = wrapper.getBoundingClientRect();
    const submenuRect = submenu.getBoundingClientRect();
    const submenuWidth = Math.max(submenuRect.width, 160);
    const submenuHeight = Math.max(submenu.scrollHeight, submenuRect.height);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxUsableHeight = Math.max(0, vh - pad * 2);
    let left = triggerRect.right - 1;
    let top = triggerRect.top - 4;

    if (left + submenuWidth > vw - pad) {
      left = triggerRect.left - submenuWidth + 1;
    }
    left = Math.min(
      Math.max(pad, left),
      Math.max(pad, vw - submenuWidth - pad),
    );

    if (submenuHeight > maxUsableHeight) {
      setSubmenuStyle({
        left,
        top: pad,
        maxHeight: maxUsableHeight,
        overflowY: "auto",
      });
      return;
    }

    top = Math.min(Math.max(pad, top), Math.max(pad, vh - submenuHeight - pad));
    setSubmenuStyle({ left, top });
  }, []);

  const scheduleSubmenuPosition = useCallback(() => {
    updateSubmenuPosition();
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(updateSubmenuPosition);
    }
  }, [updateSubmenuPosition]);

  return (
    <div
      ref={wrapperRef}
      className="fo-context-menu-submenu"
      onFocusCapture={scheduleSubmenuPosition}
      onMouseEnter={scheduleSubmenuPosition}
    >
      <ContextMenuItem icon={icon} label={label} onClick={() => {}} submenu />
      <div
        ref={submenuRef}
        className="fo-context-submenu"
        role="menu"
        style={submenuStyle}
      >
        {children}
      </div>
    </div>
  );
}
