import { describe, expect, it } from "vitest";
import { rootUri } from "../src/utils/paneUtils";

describe("rootUri", () => {
  it("returns filesystem root on unix paths", () => {
    expect(rootUri("local:///Users/ilya/Documents")).toBe("local:///");
  });

  it("returns drive root on windows paths", () => {
    expect(rootUri("local:///D:/Projects/app")).toBe("local://D:/");
  });
});
