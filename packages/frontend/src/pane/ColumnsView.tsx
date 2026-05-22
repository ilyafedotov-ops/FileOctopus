import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { FileEntryDto, FileOctopusClient } from "@fileoctopus/ts-api";
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
  client: FileOctopusClient;
  rootUri: string;
  activeUri: string;
  showHidden: boolean;
  onNavigate: (uri: string) => void;
  onOpen: (entry: FileEntryDto) => void;
  fileIcon: (entry: FileEntryDto) => ReactNode;
}

const MAX_COLUMNS = 4;
const LISTING_TIMEOUT_MS = 30000;

type InflightMeta = {
  uri: string;
  sessionId: string | null;
  entries: FileEntryDto[];
  settled: boolean;
  timeoutId: ReturnType<typeof setTimeout>;
};

export function ColumnsView({
  client,
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
  const inflightRef = useRef<Map<string, InflightMeta>>(new Map());

  // Single global batch listener for the component lifetime.
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    void client.fs
      .onDirectoryBatch((batch) => {
        const inflight = inflightRef.current;

        function findMeta(): [InflightMeta, string] | null {
          for (const [reqId, m] of inflight) {
            if (m.sessionId === batch.sessionId) {
              return [m, reqId];
            }
          }
          if (batch.requestId) {
            const m = inflight.get(batch.requestId);
            if (m) {
              return [m, batch.requestId];
            }
          }
          return null;
        }

        const found = findMeta();
        if (!found) {
          return;
        }

        const [meta, requestId] = found;
        if (meta.settled) {
          return;
        }

        if (batch.error) {
          meta.settled = true;
          clearTimeout(meta.timeoutId);
          inflight.delete(requestId);
          setColumns((prev) => ({
            ...prev,
            [meta.uri]: prependParentDirectoryEntry(meta.uri, []),
          }));
          return;
        }

        meta.entries.push(...batch.entries);

        if (batch.isComplete) {
          meta.settled = true;
          clearTimeout(meta.timeoutId);
          inflight.delete(requestId);
          setColumns((prev) => ({
            ...prev,
            [meta.uri]: prependParentDirectoryEntry(
              meta.uri,
              [...meta.entries].sort((a, b) => a.name.localeCompare(b.name)),
            ),
          }));
        }
      })
      .then((cleanup) => {
        unlisten = cleanup;
      });

    return () => {
      unlisten?.();
    };
  }, [client]);

  // Start and cancel column listings as the stack changes.
  useEffect(() => {
    const inflight = inflightRef.current;
    const targetUris = new Set(stack.slice(0, MAX_COLUMNS));

    // Settle listings for URIs that left the stack.
    for (const [requestId, meta] of inflight) {
      if (!targetUris.has(meta.uri)) {
        clearTimeout(meta.timeoutId);
        meta.settled = true;
        inflight.delete(requestId);
      }
    }

    // Kick off new listings.
    for (const uri of stack.slice(0, MAX_COLUMNS)) {
      const alreadyInflight = Array.from(inflight.values()).some(
        (m) => m.uri === uri,
      );
      if (alreadyInflight) {
        continue;
      }

      const requestId = createRequestId();

      const timeoutId = setTimeout(() => {
        const meta = inflight.get(requestId);
        if (meta && !meta.settled) {
          meta.settled = true;
          inflight.delete(requestId);
          setColumns((prev) => ({
            ...prev,
            [uri]: prependParentDirectoryEntry(uri, []),
          }));
        }
      }, LISTING_TIMEOUT_MS);

      inflight.set(requestId, {
        uri,
        sessionId: null,
        entries: [],
        settled: false,
        timeoutId,
      });

      void client.fs
        .listStart({
          requestId,
          uri,
          includeHidden: showHidden,
          batchSize: 500,
        })
        .then((response) => {
          const meta = inflight.get(requestId);
          if (meta && !meta.settled) {
            meta.sessionId = response.sessionId;
          }
        })
        .catch(() => {
          const meta = inflight.get(requestId);
          if (meta && !meta.settled) {
            meta.settled = true;
            clearTimeout(meta.timeoutId);
            inflight.delete(requestId);
            setColumns((prev) => ({
              ...prev,
              [uri]: prependParentDirectoryEntry(uri, []),
            }));
          }
        });
    }

    return () => {
      for (const [requestId, meta] of inflight) {
        clearTimeout(meta.timeoutId);
        meta.settled = true;
        inflight.delete(requestId);
      }
    };
  }, [client, showHidden, stack]);

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
