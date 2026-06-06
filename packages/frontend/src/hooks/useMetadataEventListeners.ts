import { useEffect } from "react";
import type {
  ContentSearchCompletedEventDto,
  ContentSearchMatchEventDto,
  FileOctopusClient,
  FolderSizeCompletedEventDto,
  RecursiveSearchCompletedEventDto,
  RecursiveSearchMatchEventDto,
} from "@fileoctopus/ts-api";

export interface UseMetadataEventListenersParams {
  client: FileOctopusClient;
  applyFolderSizeCompleted: (event: FolderSizeCompletedEventDto) => void;
  applyRecursiveSearchMatch: (event: RecursiveSearchMatchEventDto) => void;
  applyRecursiveSearchCompleted: (
    event: RecursiveSearchCompletedEventDto,
  ) => void;
  applyContentSearchMatch: (event: ContentSearchMatchEventDto) => void;
  applyContentSearchCompleted: (event: ContentSearchCompletedEventDto) => void;
}

export function useMetadataEventListeners({
  client,
  applyFolderSizeCompleted,
  applyRecursiveSearchMatch,
  applyRecursiveSearchCompleted,
  applyContentSearchMatch,
  applyContentSearchCompleted,
}: UseMetadataEventListenersParams) {
  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    let disposed = false;

    Promise.all([
      client.fs.onFolderSizeCompleted((event) =>
        applyFolderSizeCompleted(event),
      ),
      client.fs.onRecursiveSearchMatch((event) =>
        applyRecursiveSearchMatch(event),
      ),
      client.fs.onRecursiveSearchCompleted((event) =>
        applyRecursiveSearchCompleted(event),
      ),
      client.fs.onContentSearchMatch((event) => applyContentSearchMatch(event)),
      client.fs.onContentSearchCompleted((event) =>
        applyContentSearchCompleted(event),
      ),
    ])
      .then((items) => {
        if (disposed) {
          for (const unlisten of items) {
            unlisten();
          }
          return;
        }
        unlisteners.push(...items);
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, [
    client,
    applyFolderSizeCompleted,
    applyRecursiveSearchMatch,
    applyRecursiveSearchCompleted,
    applyContentSearchMatch,
    applyContentSearchCompleted,
  ]);
}
