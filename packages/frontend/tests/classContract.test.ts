import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const frontendSrc = join(__dirname, "..", "src");
const uiSrc = join(__dirname, "..", "..", "ui", "src");

const NON_CLASS_TOKENS = new Set([
  "fo-debug",
  "fo-smart-folders",
  "fo-file-tags",
  "fo-doc",
  "fo-toolbar-customize-title",
]);

function walk(dir: string, ext: RegExp, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, ext, acc);
    } else if (ext.test(name)) {
      acc.push(full);
    }
  }
  return acc;
}

function definedClasses(): Set<string> {
  const defined = new Set<string>();
  const cssFiles = [
    ...walk(join(frontendSrc, "styles"), /\.css$/),
    ...walk(uiSrc, /\.css$/),
  ];
  for (const file of cssFiles) {
    const content = readFileSync(file, "utf8");
    for (const match of content.matchAll(/\.(fo-[a-zA-Z0-9_-]+)/g)) {
      defined.add(match[1]);
    }
  }
  return defined;
}

function usedClasses(): Map<string, string[]> {
  const used = new Map<string, string[]>();
  const sourceFiles = walk(frontendSrc, /\.tsx?$/).filter(
    (file) => !file.includes(`${join("src", "styles")}`),
  );
  for (const file of sourceFiles) {
    const content = readFileSync(file, "utf8");
    for (const literal of content.matchAll(/["'`]([^"'`\n]*)["'`]/g)) {
      for (const match of literal[1].matchAll(
        /(?<![-a-zA-Z0-9])fo-[a-z0-9]+(?:-+[a-z0-9]+)*\b/g,
      )) {
        const cls = match[0];
        if (NON_CLASS_TOKENS.has(cls)) continue;
        const files = used.get(cls) ?? [];
        if (!files.includes(file)) files.push(file);
        used.set(cls, files);
      }
    }
  }
  return used;
}

describe("fo-* class contract", () => {
  it("every fo-* class referenced in components has a CSS rule", () => {
    const defined = definedClasses();
    const missing: string[] = [];
    for (const [cls, files] of usedClasses()) {
      if (defined.has(cls)) continue;
      const hasPrefixedVariant = [...defined].some((d) =>
        d.startsWith(`${cls}-`),
      );
      if (hasPrefixedVariant) continue;
      missing.push(
        `${cls} (${files.map((f) => f.split("/src/")[1]).join(", ")})`,
      );
    }
    expect(missing).toEqual([]);
  });
});
