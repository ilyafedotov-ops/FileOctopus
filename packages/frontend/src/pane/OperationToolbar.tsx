import { Icons, ToolbarButton } from "@fileoctopus/ui";
import {
  ToolbarDropdowns,
  type ToolbarDropdownsProps,
} from "./ToolbarDropdowns";

export interface OperationToolbarProps extends ToolbarDropdownsProps {
  canGoBack: boolean;
  canGoForward: boolean;
  canGoUp: boolean;
  onBack: () => void;
  onForward: () => void;
  onUp: () => void;
  onRefresh: () => void;
  onCommandSearch: () => void;
}

export function OperationToolbar({
  canGoBack,
  canGoForward,
  canGoUp,
  onBack,
  onForward,
  onUp,
  onRefresh,
  onCommandSearch,
  ...dropdownProps
}: OperationToolbarProps) {
  return (
    <div className="fo-operation-toolbar" aria-label="File operations">
      <div className="fo-toolbar-group fo-toolbar-group-nav">
        <ToolbarButton disabled={!canGoBack} onClick={onBack}>
          {Icons.chevronLeft()}
          <span className="fo-toolbar-label">Back</span>
        </ToolbarButton>
        <ToolbarButton disabled={!canGoForward} onClick={onForward}>
          {Icons.chevronRight()}
          <span className="fo-toolbar-label">Forward</span>
        </ToolbarButton>
        <ToolbarButton disabled={!canGoUp} onClick={onUp}>
          {Icons.arrowUp()}
          <span className="fo-toolbar-label">Up</span>
        </ToolbarButton>
      </div>
      <span className="fo-toolbar-separator" aria-hidden="true" />
      <input
        type="search"
        className="fo-toolbar-search"
        placeholder="Command, path, or action..."
        aria-label="Open command palette"
        readOnly
        onClick={onCommandSearch}
        onFocus={onCommandSearch}
      />
      <span className="fo-toolbar-separator" aria-hidden="true" />
      <ToolbarButton onClick={onRefresh} title="Refresh">
        {Icons.refresh()}
      </ToolbarButton>
      <span className="fo-toolbar-separator" aria-hidden="true" />
      <ToolbarDropdowns {...dropdownProps} />
    </div>
  );
}
