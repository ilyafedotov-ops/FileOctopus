export interface TabSessionTab {
  uri: string;
  viewMode: string;
  sortField: string;
  sortAscending: boolean;
  filter: string;
}

export interface TabSessionPane {
  tabs: TabSessionTab[];
  activeTabIndex: number;
}

export interface TabSession {
  id: string;
  name: string;
  createdAt: string;
  panes: TabSessionPane[];
}

export function captureTabSession(
  name: string,
  panes: TabSessionPane[],
): TabSession {
  return {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name,
    createdAt: new Date().toISOString(),
    panes: panes.map((pane) => ({
      tabs: pane.tabs.map((tab) => ({ ...tab })),
      activeTabIndex: pane.activeTabIndex,
    })),
  };
}

export function parseTabSessions(json: string): TabSession[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidTabSession);
  } catch {
    return [];
  }
}

export function serializeTabSessions(sessions: TabSession[]): string {
  return JSON.stringify(sessions);
}

function isValidTabSession(obj: unknown): obj is TabSession {
  if (typeof obj !== "object" || obj === null) return false;
  const s = obj as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    typeof s.name === "string" &&
    typeof s.createdAt === "string" &&
    Array.isArray(s.panes)
  );
}
