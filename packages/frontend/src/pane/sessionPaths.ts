const STORAGE_KEY = "fileoctopus.sessionPaths";

interface SessionPaths {
  left: string | null;
  right: string | null;
}

export function persistSessionPaths(left: string, right: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ left, right }));
  } catch {
    // quota or security errors — silently ignore
  }
}

export function restoreSessionPaths(): SessionPaths {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { left: null, right: null };
    const parsed = JSON.parse(raw) as Partial<SessionPaths>;
    return {
      left: typeof parsed.left === "string" ? parsed.left : null,
      right: typeof parsed.right === "string" ? parsed.right : null,
    };
  } catch {
    return { left: null, right: null };
  }
}

export function clearSessionPaths(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silently ignore
  }
}
