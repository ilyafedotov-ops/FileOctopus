import { describe, expect, it, vi } from "vitest";
import { createNavigationController } from "../src/navigation/navigationController";
import type { NavigationControllerDeps } from "../src/navigation/navigationController";
import { createInitialState, panelReducer } from "../src/panelStore";
import type { PanelAction } from "../src/panelStore";

function createClientMock() {
  return {
    fs: {
      listStart: vi.fn().mockResolvedValue({
        sessionId: "s1",
        requestId: "r1",
      }),
      standardLocations: vi.fn(),
    },
    network: {
      connect: vi.fn().mockResolvedValue({ ok: true }),
      listProfiles: vi.fn().mockResolvedValue({ profiles: [] }),
      connectionStatus: vi.fn().mockResolvedValue({ statuses: [] }),
    },
    navigation: {
      recordVisit: vi.fn().mockResolvedValue(undefined),
      listFavorites: vi.fn().mockResolvedValue({ favorites: [] }),
      listRecent: vi.fn().mockResolvedValue({ entries: [] }),
      listStarred: vi.fn().mockResolvedValue({ entries: [] }),
    },
    operationHistory: {
      listRecentOperations: vi.fn(),
      clearOperationHistory: vi.fn(),
    },
    diagnostics: { appDataHealth: vi.fn(), exportBundle: vi.fn() },
    getAppInfo: vi.fn(),
  } as unknown as NavigationControllerDeps["client"];
}

describe("navigation controller remote navigation", () => {
  it("does not call client.network.connect before listing a remote URI", async () => {
    const client = createClientMock();
    let state = createInitialState();
    const dispatch = (action: PanelAction) => {
      state = panelReducer(state, action);
    };

    const controller = createNavigationController({
      client,
      state,
      dispatch,
      setSearch: vi.fn(),
      setFavorites: vi.fn(),
      setRecentToday: vi.fn(),
      setRecentWeek: vi.fn(),
      setStarred: vi.fn(),
      setOperationError: vi.fn(),
    });

    await controller.navigatePanel(
      "left",
      "sftp://550e8400-e29b-41d4-a716-446655440000/",
    );

    expect(client.network.connect).not.toHaveBeenCalled();
    expect(client.fs.listStart).toHaveBeenCalledTimes(1);
  });
});
