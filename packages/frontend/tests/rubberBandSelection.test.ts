import { describe, expect, it } from "vitest";
import { entryIdsInRubberBand } from "../src/pane/rubberBandSelection";

describe("entryIdsInRubberBand", () => {
  it("selects visible list rows intersecting the drag rectangle", () => {
    const ids = entryIdsInRubberBand({
      entries: [
        { uri: "local:///parent", isParent: true },
        { uri: "local:///a" },
        { uri: "local:///b" },
        { uri: "local:///c" },
      ],
      rowHeight: 24,
      itemsPerRow: 1,
      scrollTop: 0,
      viewportTop: 100,
      viewportLeft: 10,
      itemWidth: 300,
      rectangle: {
        left: 20,
        top: 130,
        right: 250,
        bottom: 172,
      },
    });

    expect(ids).toEqual(["local:///a", "local:///b"]);
  });

  it("selects icon-grid cells by row and column while skipping parent entries", () => {
    const ids = entryIdsInRubberBand({
      entries: [
        { uri: "local:///parent", isParent: true },
        { uri: "local:///a" },
        { uri: "local:///b" },
        { uri: "local:///c" },
      ],
      rowHeight: 110,
      itemsPerRow: 2,
      scrollTop: 0,
      viewportTop: 0,
      viewportLeft: 0,
      itemWidth: 100,
      rectangle: {
        left: 90,
        top: 0,
        right: 180,
        bottom: 120,
      },
    });

    expect(ids).toEqual(["local:///a", "local:///c"]);
  });
});
