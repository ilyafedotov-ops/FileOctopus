import type {
  ContentSearchState,
  FileOctopusState,
  PanelAction,
  PanelId,
  PendingContentSearchEvents,
} from "../../panelStore";
import { isContentSearchActive, updatePanelTab } from "../../panelStore";

type ContentSearchAction = Extract<
  PanelAction,
  | { type: "setContentSearchQuery" }
  | { type: "startContentSearch" }
  | { type: "bindContentSearchJob" }
  | { type: "failContentSearchStart" }
  | { type: "applyContentSearchMatch" }
  | { type: "applyContentSearchCompleted" }
  | { type: "terminateContentSearchJob" }
  | { type: "discardContentSearchJobEvents" }
>;

export function isContentSearchAction(
  action: PanelAction,
): action is ContentSearchAction {
  return (
    action.type === "setContentSearchQuery" ||
    action.type === "startContentSearch" ||
    action.type === "bindContentSearchJob" ||
    action.type === "failContentSearchStart" ||
    action.type === "applyContentSearchMatch" ||
    action.type === "applyContentSearchCompleted" ||
    action.type === "terminateContentSearchJob" ||
    action.type === "discardContentSearchJobEvents"
  );
}

export function reduceContentSearch(
  state: FileOctopusState,
  action: ContentSearchAction,
): FileOctopusState {
  switch (action.type) {
    case "setContentSearchQuery":
      return updatePanelTab(state, action.panelId, action.tabId, (tab) => ({
        ...tab,
        contentSearchQuery: action.query,
      }));
    case "startContentSearch":
      return updatePanelTab(state, action.panelId, action.tabId, (tab) => ({
        ...tab,
        contentSearchQuery: action.query,
        contentSearch: {
          requestId: action.requestId,
          rootUri: action.rootUri,
          query: action.query,
          options: action.options,
          status: "starting",
          jobId: null,
          result: { matches: [], warnings: [], incomplete: false },
          error: null,
        },
      }));
    case "bindContentSearchJob":
      return bindContentSearchJob(state, action);
    case "failContentSearchStart":
      return updatePanelTab(state, action.panelId, action.tabId, (tab) => {
        const search = tab.contentSearch;
        if (
          !search ||
          search.requestId !== action.requestId ||
          search.status !== "starting"
        ) {
          return tab;
        }
        return {
          ...tab,
          contentSearch: {
            ...search,
            status: "failed",
            error: action.error,
          },
        };
      });
    case "applyContentSearchMatch": {
      const target = findSearchByJobId(state, action.event.jobId);
      if (!target) {
        return bufferMatch(state, action.event);
      }
      const search =
        state.panels[target.panelId].tabs[target.tabId].contentSearch;
      if (
        !search ||
        search.status !== "running" ||
        search.rootUri !== action.event.uri ||
        search.query !== action.event.query
      ) {
        return state;
      }
      const next = appendMatch(search, action.event.item);
      return next === search
        ? state
        : updatePanelTab(state, target.panelId, target.tabId, (tab) => ({
            ...tab,
            contentSearch: next,
          }));
    }
    case "applyContentSearchCompleted": {
      const target = findSearchByJobId(state, action.event.jobId);
      if (!target) {
        return bufferCompletion(state, action.event);
      }
      const search =
        state.panels[target.panelId].tabs[target.tabId].contentSearch;
      if (
        !search ||
        search.status !== "running" ||
        search.rootUri !== action.event.uri ||
        search.query !== action.event.query
      ) {
        return state;
      }
      const next = updatePanelTab(
        state,
        target.panelId,
        target.tabId,
        (tab) => ({
          ...tab,
          contentSearch: {
            ...search,
            status: "completed",
            result: action.event.result,
            error: null,
          },
        }),
      );
      return absorbJob(next, action.event.jobId);
    }
    case "terminateContentSearchJob": {
      const target = findSearchByJobId(state, action.jobId);
      if (!target) {
        return bufferTerminal(state, action);
      }
      const search =
        state.panels[target.panelId].tabs[target.tabId].contentSearch;
      if (!search || !isContentSearchActive(search)) {
        return state;
      }
      const next = updatePanelTab(
        state,
        target.panelId,
        target.tabId,
        (tab) => ({
          ...tab,
          contentSearch: {
            ...search,
            status: action.status,
            error: action.error,
          },
        }),
      );
      return absorbJob(next, action.jobId);
    }
    case "discardContentSearchJobEvents":
      return absorbJob(state, action.jobId);
  }
}

function bindContentSearchJob(
  state: FileOctopusState,
  action: Extract<ContentSearchAction, { type: "bindContentSearchJob" }>,
): FileOctopusState {
  const tab = state.panels[action.panelId].tabs[action.tabId];
  const search = tab?.contentSearch;
  if (
    !search ||
    search.requestId !== action.requestId ||
    search.status !== "starting"
  ) {
    return state;
  }

  const buffered = state.pendingContentSearchEvents[action.jobId];
  let nextSearch: ContentSearchState = {
    ...search,
    status: "running",
    jobId: action.jobId,
  };
  if (buffered) {
    for (const event of buffered.matches) {
      if (
        event.uri === nextSearch.rootUri &&
        event.query === nextSearch.query
      ) {
        nextSearch = appendMatch(nextSearch, event.item);
      }
    }
    if (
      buffered.completion?.uri === nextSearch.rootUri &&
      buffered.completion.query === nextSearch.query
    ) {
      nextSearch = {
        ...nextSearch,
        status: "completed",
        result: buffered.completion.result,
        error: null,
      };
    } else if (buffered.terminal) {
      nextSearch = {
        ...nextSearch,
        status: buffered.terminal.status,
        error: buffered.terminal.error,
      };
    }
  }

  const next = updatePanelTab(
    state,
    action.panelId,
    action.tabId,
    (current) => ({
      ...current,
      contentSearch: nextSearch,
    }),
  );
  return clearBufferedJob(
    nextSearch.status === "running" ? next : absorbJob(next, action.jobId),
    action.jobId,
  );
}

function appendMatch(
  search: ContentSearchState,
  item: NonNullable<ContentSearchState["result"]>["matches"][number],
): ContentSearchState {
  const matches = search.result?.matches ?? [];
  if (matches.some((match) => isSameMatch(match, item))) {
    return search;
  }
  return {
    ...search,
    result: {
      matches: [...matches, item],
      warnings: search.result?.warnings ?? [],
      incomplete: search.result?.incomplete ?? false,
    },
  };
}

function bufferMatch(
  state: FileOctopusState,
  event: Extract<
    ContentSearchAction,
    { type: "applyContentSearchMatch" }
  >["event"],
): FileOctopusState {
  if (state.absorbedContentSearchJobIds.includes(event.jobId)) {
    return state;
  }
  const buffered = pendingEvents(state, event.jobId);
  if (buffered.matches.some((item) => isSameMatch(item.item, event.item))) {
    return state;
  }
  return setBufferedJob(state, event.jobId, {
    ...buffered,
    matches: [...buffered.matches, event].slice(-500),
  });
}

function bufferCompletion(
  state: FileOctopusState,
  event: Extract<
    ContentSearchAction,
    { type: "applyContentSearchCompleted" }
  >["event"],
): FileOctopusState {
  if (state.absorbedContentSearchJobIds.includes(event.jobId)) {
    return state;
  }
  return setBufferedJob(state, event.jobId, {
    ...pendingEvents(state, event.jobId),
    completion: event,
  });
}

function bufferTerminal(
  state: FileOctopusState,
  action: Extract<ContentSearchAction, { type: "terminateContentSearchJob" }>,
): FileOctopusState {
  if (state.absorbedContentSearchJobIds.includes(action.jobId)) {
    return state;
  }
  return setBufferedJob(state, action.jobId, {
    ...pendingEvents(state, action.jobId),
    terminal: { status: action.status, error: action.error },
  });
}

function pendingEvents(
  state: FileOctopusState,
  jobId: string,
): PendingContentSearchEvents {
  return (
    state.pendingContentSearchEvents[jobId] ?? {
      matches: [],
      completion: null,
      terminal: null,
    }
  );
}

function setBufferedJob(
  state: FileOctopusState,
  jobId: string,
  events: PendingContentSearchEvents,
): FileOctopusState {
  return {
    ...state,
    pendingContentSearchEvents: {
      ...state.pendingContentSearchEvents,
      [jobId]: events,
    },
  };
}

function clearBufferedJob(
  state: FileOctopusState,
  jobId: string,
): FileOctopusState {
  if (!state.pendingContentSearchEvents[jobId]) {
    return state;
  }
  const pendingContentSearchEvents = { ...state.pendingContentSearchEvents };
  delete pendingContentSearchEvents[jobId];
  return { ...state, pendingContentSearchEvents };
}

function absorbJob(state: FileOctopusState, jobId: string): FileOctopusState {
  const cleared = clearBufferedJob(state, jobId);
  if (cleared.absorbedContentSearchJobIds.includes(jobId)) {
    return cleared;
  }
  return {
    ...cleared,
    absorbedContentSearchJobIds: [
      ...cleared.absorbedContentSearchJobIds,
      jobId,
    ].slice(-128),
  };
}

function findSearchByJobId(
  state: FileOctopusState,
  jobId: string,
): { panelId: PanelId; tabId: string } | null {
  for (const panelId of Object.keys(state.panels) as PanelId[]) {
    for (const [tabId, tab] of Object.entries(state.panels[panelId].tabs)) {
      if (tab.contentSearch?.jobId === jobId) {
        return { panelId, tabId };
      }
    }
  }
  return null;
}

function isSameMatch(
  left: NonNullable<ContentSearchState["result"]>["matches"][number],
  right: NonNullable<ContentSearchState["result"]>["matches"][number],
): boolean {
  return (
    left.uri === right.uri &&
    left.lineNumber === right.lineNumber &&
    left.matchStart === right.matchStart &&
    left.matchEnd === right.matchEnd
  );
}
