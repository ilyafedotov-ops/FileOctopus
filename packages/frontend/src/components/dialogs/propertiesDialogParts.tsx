import { useId, useState, type ReactNode } from "react";
import type { PathPropertiesDto } from "@fileoctopus/ts-api";
import { Icons } from "@fileoctopus/ui";

export function PropertiesSection({
  title,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  /** Render a disclosure toggle so the section can be collapsed. */
  collapsible?: boolean;
  /** Initial open state when collapsible (default open). */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  if (!collapsible) {
    return (
      <section className="fo-properties-section" aria-label={title}>
        <h3 className="fo-properties-section-title">{title}</h3>
        {children}
      </section>
    );
  }

  return (
    <section className="fo-properties-section" aria-label={title}>
      <button
        type="button"
        className="fo-properties-section-toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="fo-properties-section-chevron" aria-hidden="true">
          {open ? Icons.chevronDown() : Icons.chevronRight()}
        </span>
        <h3 className="fo-properties-section-title">{title}</h3>
      </button>
      {open ? (
        <div id={bodyId} className="fo-properties-section-body">
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function PropertiesRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

export function formatContains(properties: PathPropertiesDto): string {
  if (properties.kind !== "directory") {
    return "—";
  }

  if (
    properties.itemCount == null &&
    properties.directoryCount == null &&
    properties.fileCount == null
  ) {
    return "Not available";
  }

  return [
    properties.itemCount != null && `${properties.itemCount} item(s)`,
    properties.directoryCount != null &&
      `${properties.directoryCount} folder(s)`,
    properties.fileCount != null && `${properties.fileCount} file(s)`,
  ]
    .filter(Boolean)
    .join(", ");
}

export function formatFlags(properties: PathPropertiesDto): ReactNode {
  const flags: string[] = [];
  if (properties.isHidden) {
    flags.push("Hidden");
  }
  if (properties.readonly) {
    flags.push("Read-only");
  }
  if (properties.isSymlink) {
    flags.push(
      `Symlink${properties.symlinkTarget ? ` → ${properties.symlinkTarget}` : ""}`,
    );
  }

  if (flags.length === 0) {
    return <span className="fo-properties-muted">None</span>;
  }

  return (
    <div className="fo-properties-badges">
      {flags.map((flag) => (
        <span key={flag} className="fo-properties-badge">
          {flag}
        </span>
      ))}
    </div>
  );
}
