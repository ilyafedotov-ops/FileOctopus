import type { FileEntryDto } from "@fileoctopus/ts-api";
import type { OperationDialog } from "./OperationDialogView";

export function selectedItemText(count: number) {
  return `${count} selected item${count === 1 ? "" : "s"}`;
}

export function operationDialogHeading(dialog: OperationDialog): {
  title: string;
  subtitle: string;
  titleId?: string;
} {
  switch (dialog.type) {
    case "createFolder":
      return {
        title: "Create Folder",
        subtitle: "Add a new folder in the current directory",
      };
    case "createFile":
      return {
        title: "Create File",
        subtitle: "Add a new empty file in the current directory",
      };
    case "rename":
      return {
        title: "Rename",
        subtitle: dialog.entry.name,
      };
    case "copyMove":
      return {
        title: `${dialog.kind === "copy" ? "Copy" : "Move"} ${dialog.entries.length} item${dialog.entries.length === 1 ? "" : "s"}`,
        subtitle: "Choose a destination",
      };
    case "trash":
      return {
        title: `Move ${dialog.entries.length} item${dialog.entries.length === 1 ? "" : "s"} to Trash`,
        subtitle: "",
      };
    case "permanentDelete":
      return {
        title: `Delete ${dialog.entries.length} item${dialog.entries.length === 1 ? "" : "s"} Permanently`,
        subtitle: "This action cannot be undone",
      };
    case "properties":
      return {
        title: "Properties",
        subtitle:
          dialog.properties?.name ??
          dialog.entry?.name ??
          (dialog.loading ? "Loading metadata…" : "Item metadata"),
        titleId: "properties-dialog-title",
      };
    case "selectionProperties":
      return {
        title: "Selection Properties",
        subtitle: selectedItemText(dialog.entries.length),
        titleId: "selection-properties-dialog-title",
      };
  }
}

export function OperationItemList({ entries }: { entries: FileEntryDto[] }) {
  return (
    <ul className="fo-dialog-item-list">
      {entries.map((entry) => (
        <li key={entry.uri}>{entry.name}</li>
      ))}
    </ul>
  );
}
