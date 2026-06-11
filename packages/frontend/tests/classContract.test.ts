import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const frontendSrc = join(__dirname, "..", "src");
const uiSrc = join(__dirname, "..", "..", "ui", "src");

const NON_CLASS_TOKENS = new Set([
  "fo-debug",
  "fo-smart-folders",
  "fo-file-tags",
]);

const KNOWN_UNSTYLED = new Set([
  "fo-path-field",
  "fo-preview-pdf",
  "fo-toolbar-customize-title",
  "fo-dialog-subtitle",
  "fo-wizard-dialog",
  "fo-wizard-body",
  "fo-acl-owner",
  "fo-acl-group",
  "fo-close-pane-terminal-dialog",
  "fo-conflict-source",
  "fo-conflict-dest",
  "fo-checkbox-label",
  "fo-dialog-field-static",
  "fo-fingerprint-display",
  "fo-remote-path-picker-dialog",
  "fo-doc",
  "fo-dialog-content",
  "fo-properties-error",
  "fo-properties-input",
  "fo-remove-server-dialog",
  "fo-properties-label",
  "fo-tag-blue",
  "fo-tag-green",
  "fo-tag-violet",
  "fo-tag-orange",
  "fo-tag-teal",
  "fo-tag-pink",
  "fo-tag-amber",
  "fo-tag-red",
  "fo-tag-indigo",
  "fo-properties-content",
  "fo-warning-text",
  "fo-warning",
  "fo-danger",
  "fo-terminal-command-dialog",
  "fo-editor-confirm-message",
  "fo-settings-actions",
  "fo-destination-chooser",
  "fo-copy-dialog-form",
  "fo-history-kind",
  "fo-context-menu-item--submenu",
  "fo-pane-editor-tab",
  "fo-pane-preview-tab",
  "fo-empty-action--folder",
  "fo-empty-action--file",
  "fo-colvis-backdrop",
  "fo-colvis-item--active",
  "fo-column-button-drag-over",
  "fo-column-label",
  "fo-resizer-activity",
  "fo-status-pane",
  "fo-menubar-host",
  "fo-sidebar-warning",
  "fo-sidebar-error",
  "fo-sidebar-busy",
  "fo-context-menu-group",
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
        if (NON_CLASS_TOKENS.has(cls) || KNOWN_UNSTYLED.has(cls)) continue;
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
