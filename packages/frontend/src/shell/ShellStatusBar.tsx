import { StatusBarSection } from "../components/StatusBarSection";
import { useShellLayout } from "./ShellLayoutContext";

export function ShellStatusBar() {
  const ctx = useShellLayout();

  return (
    <StatusBarSection
      state={ctx.state}
      jobs={ctx.jobs}
      operationError={ctx.operationError}
      appHealth={ctx.appHealth}
      diagnosticsOpen={ctx.diagnosticsOpen}
      onOpenActivity={() => {
        ctx.markActivityPinnedOpen();
        ctx.setActivityCollapsed(false);
        void ctx.updatePreference("activityPanelVisible", "true");
      }}
      onShowErrorDetails={
        ctx.operationError ? () => ctx.setErrorDetailsOpen(true) : undefined
      }
    />
  );
}
