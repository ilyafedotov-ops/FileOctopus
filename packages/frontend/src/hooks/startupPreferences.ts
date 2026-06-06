import type {
  FileOctopusClient,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import { migrateLegacyChromePreferences } from "../state/chromeStore";
import {
  isDefaultViewModeDetailsMigrationDone,
  markDefaultViewModeDetailsMigrationDone,
} from "./viewModeMigration";

export async function migrateStartupPreferences(
  client: FileOctopusClient,
  preferences: UserPreferencesDto,
): Promise<UserPreferencesDto> {
  let loadedPreferences = preferences;

  try {
    loadedPreferences = await migrateLegacyChromePreferences(
      client,
      loadedPreferences,
    );
  } catch {
    loadedPreferences = preferences;
  }

  const shouldMigrateDefaultViewMode =
    loadedPreferences.defaultViewMode !== "details" &&
    !isDefaultViewModeDetailsMigrationDone();

  if (!shouldMigrateDefaultViewMode) {
    return loadedPreferences;
  }

  try {
    const updated = await client.preferences.set({
      key: "defaultViewMode",
      value: "details",
    });
    markDefaultViewModeDetailsMigrationDone();
    return updated.preferences;
  } catch {
    return {
      ...loadedPreferences,
      defaultViewMode: "details",
    };
  }
}
