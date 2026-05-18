import { useCallback, useRef, useState, type DragEvent } from "react";

const URI_MIME = "application/x-fileoctopus-uri";
const SELECTED_URIS_MIME = "application/x-fileoctopus-selected-uris";
const PANEL_ID_MIME = "application/x-fileoctopus-panel-id";

export interface DropData {
  uris: string[];
  sourcePanelId: string | null;
  dropEffect: "copy" | "move" | "link" | "none";
}

export function useFileOctopusDragTarget() {
  const [dragOver, setDragOver] = useState(false);
  const depthRef = useRef(0);

  const reset = useCallback(() => {
    depthRef.current = 0;
    setDragOver(false);
  }, []);

  const accepts = useCallback((event: DragEvent) => {
    return event.dataTransfer.types.indexOf(URI_MIME) !== -1;
  }, []);

  const onDragEnter = useCallback(
    (event: DragEvent) => {
      if (!accepts(event)) {
        return;
      }
      event.preventDefault();
      depthRef.current += 1;
      setDragOver(true);
    },
    [accepts],
  );

  const onDragLeave = useCallback(
    (event: DragEvent) => {
      if (!accepts(event)) {
        return;
      }
      depthRef.current = Math.max(0, depthRef.current - 1);
      if (depthRef.current === 0) {
        setDragOver(false);
      }
    },
    [accepts],
  );

  const onDragOver = useCallback(
    (event: DragEvent) => {
      if (!accepts(event)) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    },
    [accepts],
  );

  return {
    dragOver,
    reset,
    dragTargetProps: {
      onDragEnter,
      onDragLeave,
      onDragOver,
    },
  };
}

export function readDraggedUri(event: DragEvent): string | null {
  const uri = event.dataTransfer.getData(URI_MIME);
  return uri || null;
}

export function readDropData(event: DragEvent): DropData | null {
  const uri = event.dataTransfer.getData(URI_MIME);
  if (!uri) return null;

  const selectedUrisRaw = event.dataTransfer.getData(SELECTED_URIS_MIME);
  let uris: string[];
  if (selectedUrisRaw) {
    try {
      const parsed = JSON.parse(selectedUrisRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        uris = parsed;
      } else {
        uris = [uri];
      }
    } catch {
      uris = [uri];
    }
  } else {
    uris = [uri];
  }

  const sourcePanelId = event.dataTransfer.getData(PANEL_ID_MIME) || null;
  const dropEffect = event.dataTransfer.dropEffect as DropData["dropEffect"];

  return { uris, sourcePanelId, dropEffect };
}
