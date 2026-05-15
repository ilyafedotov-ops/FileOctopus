import { useRef } from "react";

interface LayoutResizersProps {
  onSidebarResize: (width: number) => void;
  onSplitResize: (ratio: number) => void;
}

export function SidebarResizer({
  onSidebarResize,
}: {
  onSidebarResize: (width: number) => void;
}) {
  const dragging = useRef(false);

  return (
    <div
      className="fo-resizer fo-resizer-sidebar"
      role="separator"
      aria-orientation="vertical"
      onMouseDown={(event) => {
        dragging.current = true;
        const startX = event.clientX;
        const startWidth = Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--fo-sidebar-width",
          ),
        );

        const onMove = (moveEvent: MouseEvent) => {
          if (!dragging.current) {
            return;
          }
          const width = Math.round(
            Math.min(
              480,
              Math.max(160, startWidth + (moveEvent.clientX - startX)),
            ),
          );
          onSidebarResize(width);
        };

        const onUp = () => {
          dragging.current = false;
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      }}
    />
  );
}

export function SplitResizer({
  onSplitResize,
}: {
  onSplitResize: (ratio: number) => void;
}) {
  const dragging = useRef(false);

  return (
    <div
      className="fo-resizer fo-resizer-split"
      role="separator"
      aria-orientation="vertical"
      onMouseDown={(event) => {
        dragging.current = true;
        const workspace = (event.currentTarget as HTMLElement)
          .closest(".fo-dual-pane")
          ?.getBoundingClientRect();
        if (!workspace) {
          return;
        }

        const onMove = (moveEvent: MouseEvent) => {
          if (!dragging.current) {
            return;
          }
          const ratio = Math.min(
            0.8,
            Math.max(
              0.2,
              (moveEvent.clientX - workspace.left) / workspace.width,
            ),
          );
          onSplitResize(ratio);
        };

        const onUp = () => {
          dragging.current = false;
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      }}
    />
  );
}

export function LayoutResizers(props: LayoutResizersProps) {
  return (
    <>
      <SidebarResizer onSidebarResize={props.onSidebarResize} />
      <SplitResizer onSplitResize={props.onSplitResize} />
    </>
  );
}
