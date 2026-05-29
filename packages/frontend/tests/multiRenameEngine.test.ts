import { describe, it, expect } from "vitest";
import { applyRenamePattern } from "../src/utils/multiRename";

describe("applyRenamePattern", () => {
  it("preserves original name with [N] pattern", () => {
    const result = applyRenamePattern(["photo.jpg"], {
      pattern: "[N]",
    });
    expect(result).toHaveLength(1);
    expect(result[0].newName).toBe("photo.jpg");
    expect(result[0].originalName).toBe("photo.jpg");
    expect(result[0].hasConflict).toBe(false);
  });

  it("replaces extension with [E] pattern", () => {
    const result = applyRenamePattern(["photo.jpg"], {
      pattern: "[N].png",
    });
    expect(result[0].newName).toBe("photo.png");
  });

  it("inserts counter with [C] pattern", () => {
    const result = applyRenamePattern(["a.txt", "b.txt", "c.txt"], {
      pattern: "file_[C].txt",
      counterStart: 1,
      counterStep: 1,
      counterPadding: 0,
    });
    expect(result).toHaveLength(3);
    expect(result[0].newName).toBe("file_1.txt");
    expect(result[1].newName).toBe("file_2.txt");
    expect(result[2].newName).toBe("file_3.txt");
  });

  it("pads counter with counterPadding", () => {
    const result = applyRenamePattern(["a.txt", "b.txt"], {
      pattern: "file_[C].txt",
      counterStart: 1,
      counterStep: 1,
      counterPadding: 3,
    });
    expect(result[0].newName).toBe("file_001.txt");
    expect(result[1].newName).toBe("file_002.txt");
  });

  it("supports custom counter start and step", () => {
    const result = applyRenamePattern(["a.txt", "b.txt", "c.txt"], {
      pattern: "[C].txt",
      counterStart: 10,
      counterStep: 5,
      counterPadding: 0,
    });
    expect(result[0].newName).toBe("10.txt");
    expect(result[1].newName).toBe("15.txt");
    expect(result[2].newName).toBe("20.txt");
  });

  it("supports custom counter with [C:pad:start:step] syntax", () => {
    const result = applyRenamePattern(["a.txt", "b.txt"], {
      pattern: "[C:4:100:10].txt",
      counterStart: 1,
      counterStep: 1,
      counterPadding: 0,
    });
    expect(result[0].newName).toBe("0100.txt");
    expect(result[1].newName).toBe("0110.txt");
  });

  it("performs simple search/replace", () => {
    const result = applyRenamePattern(["hello_world.txt"], {
      pattern: "[N]",
      search: "_",
      replace: "-",
    });
    expect(result[0].newName).toBe("hello-world.txt");
  });

  it("performs regex search/replace", () => {
    const result = applyRenamePattern(["photo_2024.jpg"], {
      pattern: "[N]",
      search: "\\d{4}",
      replace: "XXXX",
      useRegex: true,
    });
    expect(result[0].newName).toBe("photo_XXXX.jpg");
  });

  it("handles invalid regex gracefully", () => {
    const result = applyRenamePattern(["test.txt"], {
      pattern: "[N]",
      search: "[invalid",
      replace: "x",
      useRegex: true,
    });
    // Should not crash, just skip the regex replace
    expect(result[0].newName).toBe("test.txt");
  });

  it("applies upper case conversion", () => {
    const result = applyRenamePattern(["hello.txt"], {
      pattern: "[N]",
      caseConversion: "upper",
    });
    expect(result[0].newName).toBe("HELLO.txt");
  });

  it("applies lower case conversion to name portion (extension preserved)", () => {
    const result = applyRenamePattern(["HELLO.TXT"], {
      pattern: "[N]",
      caseConversion: "lower",
    });
    // caseConversion applies to the whole newName before extension re-append
    expect(result[0].newName).toBe("hello.TXT");
  });

  it("applies title case conversion", () => {
    const result = applyRenamePattern(["hello world.txt"], {
      pattern: "[N]",
      caseConversion: "title",
    });
    expect(result[0].newName).toBe("Hello World.txt");
  });

  it("applies sentence case conversion", () => {
    const result = applyRenamePattern(["hello world.txt"], {
      pattern: "[N]",
      caseConversion: "sentence",
    });
    expect(result[0].newName).toBe("Hello world.txt");
  });

  it("applies camelCase conversion", () => {
    const result = applyRenamePattern(["hello world.txt"], {
      pattern: "[N]",
      caseConversion: "camel",
    });
    expect(result[0].newName).toBe("helloWorld.txt");
  });

  it("applies snake_case conversion", () => {
    const result = applyRenamePattern(["HelloWorld.txt"], {
      pattern: "[N]",
      caseConversion: "snake",
    });
    expect(result[0].newName).toBe("hello_world.txt");
  });

  it("detects conflicts when names collide", () => {
    const result = applyRenamePattern(["a.txt", "b.txt"], {
      pattern: "same.txt",
    });
    expect(result).toHaveLength(2);
    expect(result[0].newName).toBe("same.txt");
    expect(result[0].hasConflict).toBe(false);
    expect(result[1].newName).toBe("same.txt");
    expect(result[1].hasConflict).toBe(true);
  });

  it("handles files without extension", () => {
    const result = applyRenamePattern(["Makefile"], {
      pattern: "[N]_backup",
    });
    expect(result[0].newName).toBe("Makefile_backup");
  });

  it("inserts date tokens [Y] [M] [D]", () => {
    const result = applyRenamePattern(["doc.txt"], {
      pattern: "[Y]-[M]-[D]_[N].txt",
    });
    const now = new Date();
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    expect(result[0].newName).toBe(`${y}-${m}-${d}_doc.txt`);
  });

  it("handles empty input array", () => {
    const result = applyRenamePattern([], { pattern: "[N]" });
    expect(result).toHaveLength(0);
  });

  it("handles empty pattern", () => {
    const result = applyRenamePattern(["test.txt"], { pattern: "" });
    // Extension is re-appended since pattern doesn't contain "."
    expect(result[0].newName).toBe(".txt");
  });

  it("combined pattern: prefix + counter + search/replace + case", () => {
    const result = applyRenamePattern(
      ["IMG_001.jpg", "IMG_002.jpg", "IMG_003.jpg"],
      {
        pattern: "[C]_[N]",
        search: "IMG_",
        replace: "photo_",
        counterStart: 1,
        counterStep: 1,
        counterPadding: 2,
        caseConversion: "lower",
      },
    );
    expect(result).toHaveLength(3);
    expect(result[0].newName).toBe("01_photo_001.jpg");
    expect(result[1].newName).toBe("02_photo_002.jpg");
    expect(result[2].newName).toBe("03_photo_003.jpg");
  });
});
