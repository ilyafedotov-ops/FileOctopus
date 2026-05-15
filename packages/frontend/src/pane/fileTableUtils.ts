export { fileEntryIcon as fileIconGlyph } from "@fileoctopus/ui";

export function formatSize(size?: number | null): string {
  if (size == null) {
    return "—";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value?: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const valueDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const time = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (valueDay.getTime() === today.getTime()) {
    return `Today, ${time}`;
  }

  if (valueDay.getTime() === yesterday.getTime()) {
    return `Yesterday, ${time}`;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
