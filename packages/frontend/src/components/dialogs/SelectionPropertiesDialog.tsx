import type { FileEntryDto } from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";
import { formatSize } from "../../pane/fileTableUtils";
import { localPathFromUri } from "../../utils/paneUtils";
import type { ReactNode } from "react";

export interface SelectionPropertiesDialogProps {
  open: boolean;
  entries: FileEntryDto[];
  onClose: () => void;
  onCopyPaths: () => void;
  totalSize?: number | null;
  calculatingSize?: boolean;
  onCalculateSize?: () => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="fo-properties-section">
      <legend className="fo-properties-section-title">{title}</legend>
      <div className="fo-properties-grid">{children}</div>
    </fieldset>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <span className="fo-properties-label">{label}</span>
      <span className="fo-properties-value">{value}</span>
    </>
  );
}

function commonParentPath(entries: FileEntryDto[]): string | null {
  if (entries.length === 0) return null;
  const paths = entries.map((e) => {
    const full = localPathFromUri(e.uri) ?? "";
    const idx = full.lastIndexOf("/");
    return idx > 0 ? full.substring(0, idx) : full;
  });
  if (paths.length === 1) return paths[0];
  let common = paths[0];
  for (let i = 1; i < paths.length; i++) {
    while (common.length > 0 && paths[i].indexOf(common) !== 0) {
      const slash = common.lastIndexOf("/");
      common = slash > 0 ? common.substring(0, slash) : "";
    }
    if (!common) break;
  }
  return common || null;
}

function typeBreakdown(
  entries: FileEntryDto[],
): { label: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    if (entry.kind === "directory") {
      counts["folder"] = (counts["folder"] ?? 0) + 1;
    } else {
      const ext = entry.extension || "(none)";
      counts[ext] = (counts[ext] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
}

export function SelectionPropertiesDialog({
  open,
  entries,
  onClose,
  onCopyPaths,
  totalSize,
  calculatingSize,
  onCalculateSize,
}: SelectionPropertiesDialogProps) {
  if (!open) return null;

  const fileCount = entries.filter((e) => e.kind !== "directory").length;
  const folderCount = entries.filter((e) => e.kind === "directory").length;
  const itemCount = entries.length;
  const parentPath = commonParentPath(entries);
  const breakdown = typeBreakdown(entries);

  const sizeFromFileEntries = entries
    .filter((e) => e.kind !== "directory")
    .reduce((sum, e) => sum + (e.size ?? 0), 0);

  const displaySize = totalSize != null ? totalSize : sizeFromFileEntries;

  const hasDirectories = folderCount > 0;

  return (
    <div className="fo-properties-content">
      <Section title="Summary">
        <Row label="Items" value={String(itemCount)} />
        <Row label="Files" value={String(fileCount)} />
        <Row label="Folders" value={String(folderCount)} />
        <Row
          label="Size"
          value={calculatingSize ? "Calculating…" : formatSize(displaySize)}
        />
        {hasDirectories &&
        !calculatingSize &&
        totalSize == null &&
        onCalculateSize ? (
          <Row
            label=""
            value={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCalculateSize}
              >
                Calculate Size
              </Button>
            }
          />
        ) : null}
      </Section>

      <Section title="Location">
        <Row label="Parent path" value={parentPath ?? "Not available"} />
      </Section>

      <Section title="Types">
        {breakdown.map(({ label, count }) => (
          <Row key={label} label={label} value={String(count)} />
        ))}
      </Section>

      <Section title="Flags">
        <Row
          label="Hidden"
          value={(() => {
            const hiddenCount = entries.filter((e) => e.isHidden).length;
            if (hiddenCount === 0) return "None hidden";
            if (hiddenCount === itemCount) return "All hidden";
            return `${hiddenCount} of ${itemCount} hidden`;
          })()}
        />
        <Row
          label="Read-only"
          value={(() => {
            const readOnlyCount = entries.filter((e) => !e.canWrite).length;
            if (readOnlyCount === 0) return "All writable";
            if (readOnlyCount === itemCount) return "All read-only";
            return `${readOnlyCount} of ${itemCount} read-only`;
          })()}
        />
        <Row
          label="Symlinks"
          value={(() => {
            const symCount = entries.filter((e) => e.isSymlink).length;
            if (symCount === 0) return "None";
            return `${symCount} symlink(s)`;
          })()}
        />
      </Section>

      <div className="fo-dialog-footer">
        <Button type="button" variant="ghost" size="sm" onClick={onCopyPaths}>
          Copy Paths
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
