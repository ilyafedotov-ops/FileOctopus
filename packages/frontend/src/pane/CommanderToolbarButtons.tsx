import { ToolbarButton } from "@fileoctopus/ui";
import {
  toolbarCommandMeta,
  type ToolbarEntry,
} from "../commands/toolbarConfig";
import {
  isToolbarCommandDisabled,
  type ToolbarCommandContext,
} from "../commands/toolbarCommandState";
import type { CommandId } from "../commands/types";
import {
  runToolbarCommand,
  type ToolbarActionHandlers,
} from "./toolbarActions";
import { toolbarCommandIcon } from "./toolbarIcons";

export interface CommanderToolbarButtonsProps {
  entries: ToolbarEntry[];
  commandContext: ToolbarCommandContext;
  handlers: ToolbarActionHandlers;
}

export function CommanderToolbarButtons({
  entries,
  commandContext,
  handlers,
}: CommanderToolbarButtonsProps) {
  return (
    <div
      className="fo-toolbar-group fo-toolbar-group-commander"
      role="group"
      aria-label="File commands"
    >
      {entries.map((entry, index) => {
        if (entry.kind === "separator") {
          return (
            <span
              key={`sep-${index}`}
              className="fo-toolbar-separator"
              aria-hidden="true"
            />
          );
        }
        return (
          <CommanderToolbarButton
            key={`${entry.commandId}-${index}`}
            commandId={entry.commandId}
            commandContext={commandContext}
            handlers={handlers}
          />
        );
      })}
    </div>
  );
}

function CommanderToolbarButton({
  commandId,
  commandContext,
  handlers,
}: {
  commandId: CommandId;
  commandContext: ToolbarCommandContext;
  handlers: ToolbarActionHandlers;
}) {
  const meta = toolbarCommandMeta(commandId);
  const disabled = isToolbarCommandDisabled(commandId, commandContext);
  const destructive =
    commandId === "op.delete" ||
    commandId === "op.trash" ||
    commandId === "op.deletePermanent";
  const icon = toolbarCommandIcon(commandId);

  return (
    <ToolbarButton
      className={destructive ? "fo-toolbar-danger" : undefined}
      disabled={disabled}
      title={meta.tooltip}
      aria-label={meta.label}
      onClick={() => runToolbarCommand(commandId, handlers)}
    >
      {icon}
      <span className="fo-toolbar-label">{meta.label}</span>
    </ToolbarButton>
  );
}
