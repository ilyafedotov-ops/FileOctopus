import { AppShell } from "./AppShell";
import { PaneWorkspace } from "./PaneWorkspace";
import {
  ShellLayoutProvider,
  type ShellLayoutContextValue,
} from "./ShellLayoutContext";
import { ShellOverlays } from "./ShellOverlays";
import { ShellStatusBar } from "./ShellStatusBar";
import { ShellToolbar } from "./ShellToolbar";

export type ShellLayoutProps = ShellLayoutContextValue;

export function ShellLayout(props: ShellLayoutProps) {
  return (
    <ShellLayoutProvider value={props}>
      <AppShell
        toolbar={<ShellToolbar />}
        workspace={<PaneWorkspace />}
        overlays={<ShellOverlays />}
        statusBar={<ShellStatusBar />}
      />
    </ShellLayoutProvider>
  );
}
