export interface RubberBandEntry {
  uri: string;
  isParent?: boolean;
}

export interface RubberBandRectangle {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface RubberBandSelectionOptions {
  entries: RubberBandEntry[];
  rowHeight: number;
  itemsPerRow: number;
  scrollTop: number;
  viewportTop: number;
  viewportLeft: number;
  itemWidth: number;
  rectangle: RubberBandRectangle;
}

export function normalizeRubberBandRectangle(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
): RubberBandRectangle {
  return {
    left: Math.min(startX, currentX),
    top: Math.min(startY, currentY),
    right: Math.max(startX, currentX),
    bottom: Math.max(startY, currentY),
  };
}

export function entryIdsInRubberBand({
  entries,
  rowHeight,
  itemsPerRow,
  scrollTop,
  viewportTop,
  viewportLeft,
  itemWidth,
  rectangle,
}: RubberBandSelectionOptions): string[] {
  const columns = Math.max(1, itemsPerRow);
  return entries
    .map((entry, index) => {
      if (entry.isParent) {
        return null;
      }
      const row = Math.floor(index / columns);
      const column = index % columns;
      const inlineInset = columns > 1 ? itemWidth * 0.1 : 0;
      const item = {
        left: viewportLeft + column * itemWidth + inlineInset,
        top: viewportTop + row * rowHeight - scrollTop,
        right: viewportLeft + (column + 1) * itemWidth - inlineInset,
        bottom: viewportTop + (row + 1) * rowHeight - scrollTop,
      };
      const intersects =
        rectangle.left < item.right &&
        rectangle.right > item.left &&
        rectangle.top < item.bottom &&
        rectangle.bottom > item.top;
      return intersects ? entry.uri : null;
    })
    .filter((id): id is string => Boolean(id));
}
