import { AppShell } from "./AppShell";
import { PaneWorkspace } from "./PaneWorkspace";
import {
  ShellLayoutProvider,
  type ShellLayoutContextValue,
} from "./ShellLayoutContext";
import { ShellOverlays } from "./ShellOverlays";
import { ShellStatusBar } from "./ShellStatusBar";

export type ShellLayoutProps = ShellLayoutContextValue;

export function ShellLayout(props: ShellLayoutProps) {
  return (
    <ShellLayoutProvider value={props}>
      <AppShell
        workspace={<PaneWorkspace />}
        overlays={<ShellOverlays />}
        statusBar={<ShellStatusBar />}
      />
    </ShellLayoutProvider>
  );
}
