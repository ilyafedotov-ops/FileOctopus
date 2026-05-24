import { describe, expect, it } from "vitest";
import { Icons } from "@fileoctopus/ui";

describe("Icons.video", () => {
  it("exists as a function on the Icons object", () => {
    expect(typeof Icons.video).toBe("function");
  });

  it("returns a React element when called", () => {
    const el = Icons.video();
    expect(el).toBeTruthy();
  });
});
