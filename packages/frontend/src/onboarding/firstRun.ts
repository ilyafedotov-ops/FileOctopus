export const FIRST_RUN_DISMISSED_KEY = "fileoctopus.firstRunDismissed";

export function shouldShowFirstRunOverlay(): boolean {
  try {
    return localStorage.getItem(FIRST_RUN_DISMISSED_KEY) !== "true";
  } catch {
    return true;
  }
}

export function markFirstRunOverlayDismissed(): void {
  try {
    localStorage.setItem(FIRST_RUN_DISMISSED_KEY, "true");
  } catch {
    return;
  }
}
