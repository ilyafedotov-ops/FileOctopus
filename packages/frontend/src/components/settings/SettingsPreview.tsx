import { Badge, Button, Icons } from "@fileoctopus/ui";

interface SettingsPreviewProps {
  /** Optional caption shown above the sample. */
  caption?: string;
}

const SAMPLE_ROWS = [
  { name: "Documents", kind: "folder" as const, meta: "—", state: "selected" },
  { name: "report.pdf", kind: "file" as const, meta: "248 KB", state: "" },
  { name: "photo.jpg", kind: "image" as const, meta: "1.2 MB", state: "hover" },
];

/**
 * Contained, non-interactive sample that mirrors the live theme, density,
 * accent, font-size and icon-size preferences (applied globally to
 * `documentElement` by `applyPreferences`). It lets the user see the effect of
 * a change in-context without scanning the whole window. Purely presentational.
 */
export function SettingsPreview({ caption }: SettingsPreviewProps) {
  return (
    <div
      className="fo-settings-preview"
      role="img"
      aria-label="Live preview of the current appearance settings"
    >
      {caption ? (
        <span className="fo-settings-preview-caption">{caption}</span>
      ) : null}
      <div className="fo-settings-preview-frame" aria-hidden="true">
        <div className="fo-settings-preview-toolbar">
          <span className="fo-settings-preview-icon">{Icons.folder()}</span>
          <span className="fo-settings-preview-path">/ Home / Workspace</span>
          <Button type="button" variant="primary" size="sm" tabIndex={-1}>
            Action
          </Button>
        </div>
        <ul className="fo-settings-preview-list">
          {SAMPLE_ROWS.map((row) => (
            <li
              key={row.name}
              className={
                row.state
                  ? `fo-settings-preview-row fo-settings-preview-row--${row.state}`
                  : "fo-settings-preview-row"
              }
            >
              <span className="fo-settings-preview-icon">
                {row.kind === "folder"
                  ? Icons.folder()
                  : row.kind === "image"
                    ? Icons.pictures()
                    : Icons.file()}
              </span>
              <span className="fo-settings-preview-name">{row.name}</span>
              <span className="fo-settings-preview-meta">{row.meta}</span>
            </li>
          ))}
        </ul>
        <div className="fo-settings-preview-badges">
          <Badge tone="accent">Accent</Badge>
          <Badge tone="success">Success</Badge>
          <Badge tone="warning">Warning</Badge>
          <Badge tone="danger">Danger</Badge>
        </div>
      </div>
    </div>
  );
}
