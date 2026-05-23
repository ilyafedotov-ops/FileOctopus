const STORAGE_KEY = "fileoctopus.sessionPaths";
const REMEMBER_KEY = "fileoctopus.rememberSessionPaths";

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

export function getRememberSessionPaths(): boolean {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (raw === null) return true;
    return raw === "true";
  } catch {
    return true;
  }
}

export function setRememberSessionPaths(value: boolean): void {
  try {
    localStorage.setItem(REMEMBER_KEY, String(value));
  } catch {
    // silently ignore
  }
}
