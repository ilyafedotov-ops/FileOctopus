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
}

export function OperationToolbar({
  selectedCount,
  canGoBack,
  canGoForward,
  canGoUp,
  onBack,
  onForward,
  onUp,
  onRefresh,
  ...dropdownProps
}: OperationToolbarProps) {
  return (
    <div className="fo-operation-toolbar" aria-label="File operations">
      <div className="fo-toolbar-group fo-toolbar-group-nav">
        <ToolbarButton disabled={!canGoBack} onClick={onBack}>
          {Icons.chevronLeft()}
          <span>Back</span>
        </ToolbarButton>
        <ToolbarButton disabled={!canGoForward} onClick={onForward}>
          {Icons.chevronRight()}
          <span>Forward</span>
        </ToolbarButton>
        <ToolbarButton disabled={!canGoUp} onClick={onUp}>
          {Icons.arrowUp()}
          <span>Up</span>
        </ToolbarButton>
        <ToolbarButton onClick={onRefresh}>
          {Icons.refresh()}
          <span>Refresh</span>
        </ToolbarButton>
      </div>
      <span className="fo-toolbar-separator" aria-hidden="true" />
      <ToolbarDropdowns selectedCount={selectedCount} {...dropdownProps} />
      <span className="fo-toolbar-meta">{selectedCount} selected</span>
    </div>
  );
}
