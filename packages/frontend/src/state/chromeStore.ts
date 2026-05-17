import { useCallback, useEffect, useMemo, useState } from "react";

const STATUS_BAR_KEY = "fileoctopus.statusBarVisible";
const TOOLBAR_KEY = "fileoctopus.toolbarVisible";

function readStoredBoolean(key: string, defaultValue: boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    if (value === null) {
      return defaultValue;
    }
    return value === "true";
  } catch {
    return defaultValue;
  }
}

function writeStoredBoolean(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}

export function applyChromeLayout(
  statusBarVisible: boolean,
  toolbarVisible: boolean,
) {
  const root = document.documentElement;
  root.dataset.statusBar = statusBarVisible ? "visible" : "hidden";
  if (toolbarVisible) {
    delete root.dataset.toolbarHidden;
  } else {
    root.dataset.toolbarHidden = "true";
  }
}

export interface ChromeLayoutState {
  statusBarVisible: boolean;
  toolbarVisible: boolean;
  setStatusBarVisible: (visible: boolean) => void;
  setToolbarVisible: (visible: boolean) => void;
  toggleStatusBar: () => void;
  toggleToolbar: () => void;
}

export function useChromeLayoutStore(): ChromeLayoutState {
  const [statusBarVisible, setStatusBarVisibleState] = useState(() =>
    readStoredBoolean(STATUS_BAR_KEY, true),
  );
  const [toolbarVisible, setToolbarVisibleState] = useState(() =>
    readStoredBoolean(TOOLBAR_KEY, true),
  );

  useEffect(() => {
    applyChromeLayout(statusBarVisible, toolbarVisible);
  }, [statusBarVisible, toolbarVisible]);

  const setStatusBarVisible = useCallback((visible: boolean) => {
    setStatusBarVisibleState(visible);
    writeStoredBoolean(STATUS_BAR_KEY, visible);
  }, []);

  const setToolbarVisible = useCallback((visible: boolean) => {
    setToolbarVisibleState(visible);
    writeStoredBoolean(TOOLBAR_KEY, visible);
  }, []);

  const toggleStatusBar = useCallback(() => {
    setStatusBarVisibleState((current) => {
      const next = !current;
      writeStoredBoolean(STATUS_BAR_KEY, next);
      return next;
    });
  }, []);

  const toggleToolbar = useCallback(() => {
    setToolbarVisibleState((current) => {
      const next = !current;
      writeStoredBoolean(TOOLBAR_KEY, next);
      return next;
    });
  }, []);

  return useMemo(
    () => ({
      statusBarVisible,
      toolbarVisible,
      setStatusBarVisible,
      setToolbarVisible,
      toggleStatusBar,
      toggleToolbar,
    }),
    [
      statusBarVisible,
      toolbarVisible,
      setStatusBarVisible,
      setToolbarVisible,
      toggleStatusBar,
      toggleToolbar,
    ],
  );
}
