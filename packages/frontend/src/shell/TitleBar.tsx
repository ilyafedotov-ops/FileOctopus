import { Button } from "@fileoctopus/ui";
import { MenuBar, type MenuBarProps } from "./MenuBar";
import type { TitleBarStatusItem } from "./titleBarStatus";

export interface WindowControlHandlers {
  onClose?: () => void;
  onMinimize?: () => void;
  onToggleMaximize?: () => void;
}

interface TitleBarProps {
  onSettings: () => void;
  menuBarProps?: MenuBarProps;
  nativeMenuActive?: boolean;
  statusItems?: TitleBarStatusItem[];
  titlePath?: string;
  windowControls?: WindowControlHandlers;
}

export function TitleBar({
  onSettings,
  menuBarProps,
  nativeMenuActive = false,
  statusItems = [],
  titlePath = "FileOctopus",
  windowControls,
}: TitleBarProps) {
  const controls = [
    {
      className: "fo-window-dot-red",
      label: "Close window",
      onClick: windowControls?.onClose,
    },
    {
      className: "fo-window-dot-yellow",
      label: "Minimize window",
      onClick: windowControls?.onMinimize,
    },
    {
      className: "fo-window-dot-green",
      label: "Maximize window",
      onClick: windowControls?.onToggleMaximize,
    },
  ];

  return (
    <header className="fo-topbar" data-tauri-drag-region="">
      <div className="fo-brand" data-tauri-drag-region="false">
        {controls.map((control) =>
          control.onClick ? (
            <button
              key={control.label}
              type="button"
              className={`fo-window-dot ${control.className}`}
              aria-label={control.label}
              onClick={control.onClick}
            />
          ) : (
            <span
              key={control.label}
              className={`fo-window-dot ${control.className}`}
              aria-hidden="true"
            />
          ),
        )}
      </div>
      {menuBarProps && !nativeMenuActive ? (
        <div className="fo-menubar-host" data-tauri-drag-region="false">
          <MenuBar {...menuBarProps} />
        </div>
      ) : null}
      {titlePath !== "FileOctopus" ? (
        <span className="fo-brand-product" data-tauri-drag-region="">
          FileOctopus
        </span>
      ) : null}
      <h1 title={titlePath} data-tauri-drag-region="">
        {titlePath}
      </h1>
      {statusItems.length > 0 ? (
        <div
          className="fo-title-status"
          aria-label="Workspace status"
          data-tauri-drag-region="false"
        >
          {statusItems.map((item) => (
            <span
              key={item.key}
              className={`fo-title-status-pill fo-title-status-pill-${item.tone}`}
              title={item.title}
            >
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
      <div className="fo-topbar-actions" data-tauri-drag-region="false">
        <Button type="button" variant="ghost" size="sm" onClick={onSettings}>
          Settings
        </Button>
      </div>
    </header>
  );
}
