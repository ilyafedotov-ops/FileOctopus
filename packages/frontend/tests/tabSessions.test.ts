import { describe, it, expect } from "vitest";
import {
  captureTabSession,
  parseTabSessions,
  serializeTabSessions,
} from "../src/utils/tabSessions";
import type { TabSession, TabSessionPane } from "../src/utils/tabSessions";

function makePane(overrides: Partial<TabSessionPane> = {}): TabSessionPane {
  return {
    tabs: [
      {
        uri: "local:///home/user",
        viewMode: "details",
        sortField: "name",
        sortAscending: true,
        filter: "",
      },
    ],
    activeTabIndex: 0,
    ...overrides,
  };
}

describe("captureTabSession", () => {
  it("creates session with generated id and timestamp", () => {
    const before = Date.now();
    const session = captureTabSession("Test Session", [makePane()]);
    const after = Date.now();

    expect(session.id).toMatch(/^session-\d+-[a-z0-9]+$/);
    expect(session.name).toBe("Test Session");
    expect(new Date(session.createdAt).getTime()).toBeGreaterThanOrEqual(
      before,
    );
    expect(new Date(session.createdAt).getTime()).toBeLessThanOrEqual(after);
  });

  it("copies pane tabs and activeTabIndex", () => {
    const pane: TabSessionPane = {
      tabs: [
        {
          uri: "local:///tmp",
          viewMode: "list",
          sortField: "size",
          sortAscending: false,
          filter: "*.txt",
        },
      ],
      activeTabIndex: 0,
    };
    const session = captureTabSession("S1", [pane]);
    expect(session.panes).toHaveLength(1);
    expect(session.panes[0].tabs[0].uri).toBe("local:///tmp");
    expect(session.panes[0].tabs[0].filter).toBe("*.txt");
    expect(session.panes[0].activeTabIndex).toBe(0);
  });

  it("handles multiple panes", () => {
    const left = makePane();
    const right = makePane({
      tabs: [
        {
          uri: "local:///var/log",
          viewMode: "details",
          sortField: "modified",
          sortAscending: true,
          filter: "",
        },
      ],
    });
    const session = captureTabSession("Dual", [left, right]);
    expect(session.panes).toHaveLength(2);
    expect(session.panes[0].tabs[0].uri).toBe("local:///home/user");
    expect(session.panes[1].tabs[0].uri).toBe("local:///var/log");
  });

  it("handles empty panes array", () => {
    const session = captureTabSession("Empty", []);
    expect(session.panes).toEqual([]);
  });

  it("handles pane with multiple tabs", () => {
    const pane: TabSessionPane = {
      tabs: [
        {
          uri: "local:///a",
          viewMode: "details",
          sortField: "name",
          sortAscending: true,
          filter: "",
        },
        {
          uri: "local:///b",
          viewMode: "list",
          sortField: "size",
          sortAscending: false,
          filter: "*.rs",
        },
      ],
      activeTabIndex: 1,
    };
    const session = captureTabSession("Multi-tab", [pane]);
    expect(session.panes[0].tabs).toHaveLength(2);
    expect(session.panes[0].activeTabIndex).toBe(1);
  });

  it("deep-copies tabs (mutation safe)", () => {
    const pane = makePane();
    const session = captureTabSession("S", [pane]);
    pane.tabs[0].uri = "local:///changed";
    expect(session.panes[0].tabs[0].uri).toBe("local:///home/user");
  });
});

describe("serializeTabSessions / parseTabSessions", () => {
  it("round-trips sessions", () => {
    const sessions: TabSession[] = [
      captureTabSession("A", [makePane()]),
      captureTabSession("B", [makePane(), makePane()]),
    ];
    const json = serializeTabSessions(sessions);
    const parsed = parseTabSessions(json);
    expect(parsed).toEqual(sessions);
  });

  it("round-trips empty array", () => {
    const json = serializeTabSessions([]);
    expect(parseTabSessions(json)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseTabSessions("")).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseTabSessions("not json")).toEqual([]);
  });

  it("returns empty array for non-array JSON", () => {
    expect(parseTabSessions('{"id":"x","name":"y"}')).toEqual([]);
  });

  it("filters out entries missing required fields", () => {
    const mixed = [
      { id: "1", name: "Good", createdAt: "2026-01-01", panes: [] },
      { name: "Missing id and createdAt" },
      null,
      "string",
      { id: 123, name: "Bad id type", createdAt: "2026-01-01", panes: [] },
    ];
    const json = JSON.stringify(mixed);
    const parsed = parseTabSessions(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe("Good");
  });

  it("filters out entry missing panes array", () => {
    const entries = [{ id: "1", name: "No panes", createdAt: "2026-01-01" }];
    const json = JSON.stringify(entries);
    expect(parseTabSessions(json)).toEqual([]);
  });

  it("accepts session with empty panes", () => {
    const entries = [
      { id: "1", name: "Empty panes", createdAt: "2026-01-01", panes: [] },
    ];
    const json = JSON.stringify(entries);
    const parsed = parseTabSessions(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].panes).toEqual([]);
  });
});
