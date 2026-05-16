import { Badge, Button, DropdownMenu } from "@fileoctopus/ui";
import { MenuBar, type MenuBarProps } from "./MenuBar";

interface TitleBarProps {
  helpOpen: boolean;
  onToggleHelp: () => void;
  onSettings: () => void;
  onShortcuts: () => void;
  onDiagnostics: () => void;
  menuBarProps: MenuBarProps;
}

export function TitleBar({
  helpOpen,
  onToggleHelp,
  onSettings,
  onShortcuts,
  onDiagnostics,
  menuBarProps,
}: TitleBarProps) {
  return (
    <header className="fo-topbar">
      <div className="fo-brand">
        <span className="fo-brand-mark" aria-hidden="true">
          FO
        </span>
        <h1>FileOctopus</h1>
        <Badge tone="default">Rust-powered</Badge>
      </div>
      <MenuBar {...menuBarProps} />
      <div className="fo-topbar-actions">
        <Button type="button" variant="ghost" size="sm" onClick={onSettings}>
          Settings
        </Button>
        <DropdownMenu
          label="Help"
          open={helpOpen}
          onOpenChange={(open) => {
            if (open !== helpOpen) {
              onToggleHelp();
            }
          }}
          items={[
            {
              id: "shortcuts",
              label: "Keyboard Shortcuts",
              icon: "Key",
              shortcut: "Cmd+/",
              onSelect: onShortcuts,
            },
            {
              id: "diagnostics",
              label: "Diagnostics",
              icon: "Log",
              separatorBefore: true,
              onSelect: onDiagnostics,
            },
          ]}
        >
          <span className="fo-menu-trigger">Help</span>
        </DropdownMenu>
      </div>
    </header>
  );
}
