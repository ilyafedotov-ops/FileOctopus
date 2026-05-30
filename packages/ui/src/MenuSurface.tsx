import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "./cx";

/**
 * Shared surface container for menus, context menus, and popovers (UPP-D1).
 *
 * Provides a unified visual frame: elevation shadow, border, background,
 * padding, max-height, and overflow — all from design tokens. Wraps any
 * menu content (dropdown items, context items, custom list).
 *
 * Usage:
 *   <MenuSurface>
 *     <button role="menuitem">Item 1</button>
 *     <button role="menuitem">Item 2</button>
 *   </MenuSurface>
 */
export interface MenuSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Extra class names for positioning/context (e.g. "fo-ui-dropdown-menu--portal") */
  className?: string;
}

export const MenuSurface = forwardRef<HTMLDivElement, MenuSurfaceProps>(
  function MenuSurface({ children, className, ...rest }, ref) {
    return (
      <div ref={ref} className={cx("fo-menu-surface", className)} {...rest}>
        {children}
      </div>
    );
  },
);
