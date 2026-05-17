import { useEffect, useRef, useState } from "react";
import { BreadcrumbPath } from "@fileoctopus/ui";
import { breadcrumbSegments } from "../utils/paneUtils";

export interface PathBarProps {
  value: string;
  error: string | null;
  focusToken: number;
  onSubmit: (value: string) => void;
  onBreadcrumbContextMenu?: (path: string, event: React.MouseEvent) => void;
}

export function PathBar({
  value,
  error,
  focusToken,
  onSubmit,
  onBreadcrumbContextMenu,
}: PathBarProps) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [editing, value]);

  useEffect(() => {
    if (focusToken > 0) {
      setEditing(true);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [focusToken]);

  if (!editing) {
    return (
      <div
        className={error ? "fo-path-error-wrap" : undefined}
        onDoubleClick={() => setEditing(true)}
      >
        <BreadcrumbPath
          segments={breadcrumbSegments(value).map((segment) => ({
            label: segment.label,
            path: segment.uri,
          }))}
          onNavigate={onSubmit}
          onEditPath={() => setEditing(true)}
          onSegmentContextMenu={
            onBreadcrumbContextMenu
              ? (segment, e) => onBreadcrumbContextMenu(segment.path, e)
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      className={error ? "fo-path fo-path-error" : "fo-path"}
      value={editing ? draft : value}
      aria-label="Current path"
      onFocus={() => setEditing(true)}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          setEditing(false);
          onSubmit(draft);
        }

        if (event.key === "Escape") {
          setEditing(false);
          setDraft(value);
        }
      }}
      onBlur={() => {
        setEditing(false);
        setDraft(value);
      }}
    />
  );
}
