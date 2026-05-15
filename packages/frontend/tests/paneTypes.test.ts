import { describe, expect, it } from "vitest";
import { shouldApplyBatch } from "../src/paneTypes";
import type { DirectoryBatchEventDto } from "@fileoctopus/ts-api";

function batch(requestId: string): DirectoryBatchEventDto {
  return {
    sessionId: "session-1",
    requestId,
    uri: "local:///tmp",
    entries: [],
    batchIndex: 0,
    isComplete: true,
  };
}

describe("shouldApplyBatch", () => {
  it("accepts matching request ids", () => {
    expect(shouldApplyBatch("req-a", batch("req-a"))).toBe(true);
  });

  it("rejects mismatched request ids", () => {
    expect(shouldApplyBatch("req-a", batch("req-b"))).toBe(false);
  });

  it("rejects empty batch request ids when pane expects correlation", () => {
    expect(shouldApplyBatch("req-a", batch(""))).toBe(false);
    expect(shouldApplyBatch("req-a", batch("   "))).toBe(false);
  });

  it("accepts uncorrelated batches only when pane has no active request", () => {
    expect(shouldApplyBatch(null, batch(""))).toBe(true);
    expect(shouldApplyBatch(null, batch("req-a"))).toBe(false);
  });
});
