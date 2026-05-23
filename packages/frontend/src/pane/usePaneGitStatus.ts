import { useCallback, useEffect, useRef, useState } from "react";
import type { GitFileStatusDto, GitRepoInfoDto } from "@fileoctopus/ts-api";

export interface PaneGitStatus {
  repo: GitRepoInfoDto | null;
  entries: Record<string, GitFileStatusDto>;
  loading: boolean;
}

const emptyGitStatus: PaneGitStatus = {
  repo: null,
  entries: {},
  loading: false,
};

interface GitStatusClient {
  git?: {
    statusForDirectory?: (request: { uri: string }) => Promise<{
      repo?: GitRepoInfoDto | null;
      entries: Record<string, GitFileStatusDto>;
    }>;
  };
  fs?: {
    onWatchChanged?: (
      handler: (event: { uri: string }) => void,
    ) => Promise<() => void>;
  };
}

type StatusForDirectory = NonNullable<
  NonNullable<GitStatusClient["git"]>["statusForDirectory"]
>;

const gitStatusCache = new Map<string, PaneGitStatus>();
const gitStatusRequests = new Map<string, Promise<PaneGitStatus>>();

export function usePaneGitStatus(
  client: GitStatusClient,
  uri: string,
): PaneGitStatus {
  const [status, setStatus] = useState<PaneGitStatus>(emptyGitStatus);
  const statusForDirectory = client.git?.statusForDirectory;
  const onWatchChanged = client.fs?.onWatchChanged;
  const requestSequence = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    return () => {
      mounted.current = false;
      requestSequence.current += 1;
    };
  }, []);

  const loadStatus = useCallback(
    (forceRefresh = false) => {
      const sequence = requestSequence.current + 1;
      requestSequence.current = sequence;

      if (!uri.startsWith("local://") || !statusForDirectory) {
        setStatus(emptyGitStatus);
        return;
      }

      const cached = forceRefresh ? undefined : gitStatusCache.get(uri);
      if (cached) {
        setStatus(cached);
        return;
      }

      setStatus((current) => ({ ...current, loading: true }));

      void loadDirectoryGitStatus(statusForDirectory, uri, forceRefresh)
        .then((response) => {
          if (!mounted.current || requestSequence.current !== sequence) {
            return;
          }
          setStatus(response);
        })
        .catch(() => {
          if (mounted.current && requestSequence.current === sequence) {
            setStatus(emptyGitStatus);
          }
        });
    },
    [statusForDirectory, uri],
  );

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!uri.startsWith("local://") || !onWatchChanged) {
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | null = null;

    void onWatchChanged((event) => {
      if (event.uri === uri) {
        loadStatus(true);
      }
    })
      .then((value) => {
        if (disposed) {
          value();
          return;
        }
        unlisten = value;
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [loadStatus, onWatchChanged, uri]);

  return status;
}

function loadDirectoryGitStatus(
  statusForDirectory: StatusForDirectory,
  uri: string,
  forceRefresh: boolean,
): Promise<PaneGitStatus> {
  if (!forceRefresh) {
    const cached = gitStatusCache.get(uri);
    if (cached) {
      return Promise.resolve(cached);
    }

    const pending = gitStatusRequests.get(uri);
    if (pending) {
      return pending;
    }
  }

  const request = statusForDirectory({ uri })
    .then((response) => {
      const next = {
        repo: response.repo ?? null,
        entries: response.entries,
        loading: false,
      };
      gitStatusCache.set(uri, next);
      return next;
    })
    .catch((error: unknown) => {
      gitStatusCache.delete(uri);
      throw error;
    })
    .finally(() => {
      gitStatusRequests.delete(uri);
    });

  gitStatusRequests.set(uri, request);
  return request;
}
