import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReducer, useState } from "react";
import { useNavigation } from "../src/hooks/useNavigation";
import { createInitialState, panelReducer } from "../src/panelStore";

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
  } as unknown as Parameters<typeof useNavigation>[0]["client"];
}

describe("useNavigation remote navigation", () => {
  it("does not call client.network.connect before listing a remote URI", async () => {
    const client = createClientMock();

    function harness() {
      const [state, dispatch] = useReducer(panelReducer, createInitialState());
      const [, setSearch] = useState(null);
      const [, setDialog] = useState(null);
      return useNavigation({
        client,
        state,
        dispatch,
        setSearch,
        setDialog,
        setFavorites: vi.fn(),
        setRecentToday: vi.fn(),
        setRecentWeek: vi.fn(),
        setStarred: vi.fn(),
        setLocations: vi.fn(),
        setNetworkProfiles: vi.fn(),
        setNetworkStatuses: vi.fn(),
        setHistory: vi.fn(),
        setOperationError: vi.fn(),
        setAppInfo: vi.fn(),
        setAppHealth: vi.fn(),
        setDiagnosticsMessage: vi.fn(),
        setExportingDiagnostics: vi.fn(),
        diagnosticsDestination: "",
      });
    }

    const { result } = renderHook(harness);
    await act(async () => {
      await result.current.navigatePanel(
        "left",
        "sftp://550e8400-e29b-41d4-a716-446655440000/",
      );
    });

    expect(client.network.connect).not.toHaveBeenCalled();
    expect(client.fs.listStart).toHaveBeenCalledTimes(1);
  });
});
