const DEFAULT_VIEW_MODE_DETAILS_MIGRATION_KEY =
  "fileoctopus.defaultViewModeDetailsMigrated";

export function isDefaultViewModeDetailsMigrationDone(): boolean {
  try {
    return (
      localStorage.getItem(DEFAULT_VIEW_MODE_DETAILS_MIGRATION_KEY) === "true"
    );
  } catch {
    return false;
  }
}

export function markDefaultViewModeDetailsMigrationDone() {
  try {
    localStorage.setItem(DEFAULT_VIEW_MODE_DETAILS_MIGRATION_KEY, "true");
  } catch {
    return;
  }
}
