import { describe, expect, it } from "vitest";
import { joinUri } from "../src/navigation/uriJoin";

describe("joinUri", () => {
  it("joins local parent paths", () => {
    expect(joinUri("local:///tmp", "child.txt")).toBe("local:///tmp/child.txt");
  });

  it("joins remote parent paths", () => {
    expect(
      joinUri("sftp://550e8400-e29b-41d4-a716-446655440000/home", "child.txt"),
    ).toBe("sftp://550e8400-e29b-41d4-a716-446655440000/home/child.txt");
  });
});
