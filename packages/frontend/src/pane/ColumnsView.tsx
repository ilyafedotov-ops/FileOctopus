import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import { createFileOctopusClient } from "@fileoctopus/ts-api";
import { createRequestId } from "../paneTypes";
import {
  isRemoteUri,
  uriScheme,
  profileIdFromRemoteUri,
  buildRemoteUri,
  remotePathFromUri,
} from "@fileoctopus/ts-api";
import {
  isParentDirectoryEntry,
  prependParentDirectoryEntry,
} from "../utils/parentEntry";

interface ColumnsViewProps {
  rootUri: string;
  activeUri: string;
  showHidden: boolean;
  onNavigate: (uri: string) => void;
  onOpen: (entry: FileEntryDto) => void;
  fileIcon: (entry: FileEntryDto) => ReactNode;
}

const MAX_COLUMNS = 4;

export function ColumnsView({
  rootUri,
  activeUri,
  showHidden,
  onNavigate,
  onOpen,
  fileIcon,
}: ColumnsViewProps) {
  const stack = useMemo(
    () => uriStack(activeUri, rootUri),
    [activeUri, rootUri],
  );
  const [columns, setColumns] = useState<Record<string, FileEntryDto[]>>({});

  useEffect(() => {
    let cancelled = false;
    const client = createFileOctopusClient();

    void (async () => {
      const next: Record<string, FileEntryDto[]> = {};
      for (const uri of stack.slice(0, MAX_COLUMNS)) {
        try {
          const listed = await listDirectory(client, uri, showHidden);
          next[uri] = prependParentDirectoryEntry(uri, listed);
        } catch {
          const parentOnly = prependParentDirectoryEntry(uri, []);
          next[uri] = parentOnly;
        }
      }
      if (!cancelled) {
        setColumns(next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showHidden, stack]);

  return (
    <div className="fo-columns-view" role="list">
      {stack.slice(0, MAX_COLUMNS).map((uri) => (
        <section className="fo-columns-column" key={uri}>
          {(columns[uri] ?? []).map((entry) => (
            <button
              key={entry.uri}
              type="button"
              className={
                stack.includes(entry.uri) && !isParentDirectoryEntry(entry, uri)
                  ? "fo-columns-active"
                  : ""
              }
              onClick={() => {
                if (
                  isParentDirectoryEntry(entry, uri) ||
                  entry.kind === "directory"
                ) {
                  onNavigate(entry.uri);
                } else {
                  onOpen(entry);
                }
              }}
            >
              <span>{fileIcon(entry)}</span>
              <span>{entry.name}</span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}

async function listDirectory(
  client: ReturnType<typeof createFileOctopusClient>,
  uri: string,
  showHidden: boolean,
): Promise<FileEntryDto[]> {
  const response = await client.fs.listStart({
    requestId: createRequestId(),
    uri,
    includeHidden: showHidden,
    batchSize: 500,
  });

  return new Promise((resolve, reject) => {
    const entries: FileEntryDto[] = [];
    let unlisten: (() => void) | null = null;

    void client.fs
      .onDirectoryBatch((batch) => {
        if (batch.sessionId !== response.sessionId) {
          return;
        }
        if (batch.error) {
          unlisten?.();
          reject(new Error(batch.error.message ?? batch.error.code));
          return;
        }
        entries.push(...batch.entries);
        if (batch.isComplete) {
          unlisten?.();
          resolve(
            entries.sort((left, right) => left.name.localeCompare(right.name)),
          );
        }
      })
      .then((cleanup) => {
        unlisten = cleanup;
      });
  });
}

function uriStack(activeUri: string, rootUriValue: string): string[] {
  if (isRemoteUri(activeUri)) {
    const scheme = uriScheme(activeUri);
    const profileId = profileIdFromRemoteUri(activeUri);
    if (!scheme || !profileId) {
      return [rootUriValue, activeUri];
    }

    const path = remotePathFromUri(activeUri) ?? "/";
    const parts = path.split("/").filter(Boolean);
    const stack = [rootUriValue];
    let current = "";

    for (const part of parts) {
      current = `${current}/${part}`;
      stack.push(buildRemoteUri(scheme, profileId, current));
    }

    return stack.length > 0 ? stack : [rootUriValue];
  }

  if (!activeUri.startsWith("local://")) {
    return [rootUriValue, activeUri];
  }

  const path = activeUri.replace("local://", "");
  const parts = path.split("/").filter(Boolean);
  const stack = [rootUriValue];
  let current = "local://";

  for (const part of parts) {
    current = `${current.replace(/\/$/, "")}/${part}`;
    stack.push(current);
  }

  return stack.length > 0 ? stack : [rootUriValue];
}
