import { Button } from "@fileoctopus/ui";
import { MenuBar, type MenuBarProps } from "./MenuBar";

interface TitleBarProps {
  onSettings: () => void;
  menuBarProps?: MenuBarProps;
  titlePath?: string;
}

export function TitleBar({
  onSettings,
  menuBarProps,
  titlePath = "FileOctopus",
}: TitleBarProps) {
  return (
    <header className="fo-topbar">
      <div className="fo-brand">
        <span className="fo-window-dot fo-window-dot-red" aria-hidden="true" />
        <span
          className="fo-window-dot fo-window-dot-yellow"
          aria-hidden="true"
        />
        <span
          className="fo-window-dot fo-window-dot-green"
          aria-hidden="true"
        />
        {titlePath !== "FileOctopus" ? (
          <span className="fo-brand-product">FileOctopus</span>
        ) : null}
        <h1 title={titlePath}>{titlePath}</h1>
      </div>
      {menuBarProps ? <MenuBar {...menuBarProps} /> : null}
      <div className="fo-topbar-actions">
        <Button type="button" variant="ghost" size="sm" onClick={onSettings}>
          Settings
        </Button>
      </div>
    </header>
  );
}
