import { useEffect, useState } from "react";
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
}

export function usePaneGitStatus(
  client: GitStatusClient,
  uri: string,
): PaneGitStatus {
  const [status, setStatus] = useState<PaneGitStatus>(emptyGitStatus);
  const statusForDirectory = client.git?.statusForDirectory;

  useEffect(() => {
    let cancelled = false;

    if (!uri.startsWith("local://") || !statusForDirectory) {
      setStatus(emptyGitStatus);
      return () => {
        cancelled = true;
      };
    }

    setStatus((current) => ({ ...current, loading: true }));

    void statusForDirectory({ uri })
      .then((response) => {
        if (cancelled) {
          return;
        }
        setStatus({
          repo: response.repo ?? null,
          entries: response.entries,
          loading: false,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setStatus(emptyGitStatus);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [statusForDirectory, uri]);

  return status;
}
