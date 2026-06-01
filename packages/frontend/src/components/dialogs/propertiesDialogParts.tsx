import type { ReactNode } from "react";
import type { PathPropertiesDto } from "@fileoctopus/ts-api";

export function PropertiesSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="fo-properties-section" aria-label={title}>
      <h3 className="fo-properties-section-title">{title}</h3>
      {children}
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
