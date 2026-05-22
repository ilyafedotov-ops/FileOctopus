import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { UserPreferencesDto } from "@fileoctopus/ts-api";
import type { DensityPreference } from "../../applyPreferences";

export interface PreferencesContextValue {
  preferences: UserPreferencesDto | null;
  density: DensityPreference;
  statusBarVisible: boolean;
  toolbarVisible: boolean;
  setPreferences: Dispatch<SetStateAction<UserPreferencesDto | null>>;
  setDensity: Dispatch<SetStateAction<DensityPreference>>;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return ctx;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferencesDto | null>(
    null,
  );
  const [density, setDensity] = useState<DensityPreference>("comfortable");

  const statusBarVisible = preferences?.statusBarVisible !== false;
  const toolbarVisible = preferences?.toolbarVisible !== false;

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      density,
      statusBarVisible,
      toolbarVisible,
      setPreferences,
      setDensity,
    }),
    [preferences, density, statusBarVisible, toolbarVisible],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}
