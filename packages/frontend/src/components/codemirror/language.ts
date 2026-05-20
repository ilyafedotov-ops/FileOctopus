import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { StreamLanguage } from "@codemirror/language";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { yaml } from "@codemirror/legacy-modes/mode/yaml";
import type { Extension } from "@codemirror/state";

function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "";
  return name.slice(dot).toLowerCase();
}

export function languageExtensionForFileName(name: string): Extension | null {
  const ext = fileExtension(name);
  const base = name.toLowerCase();

  if (base === "dockerfile" || base === "makefile") {
    return StreamLanguage.define(shell);
  }

  switch (ext) {
    case ".js":
    case ".mjs":
    case ".cjs":
      return javascript();
    case ".jsx":
      return javascript({ jsx: true });
    case ".ts":
      return javascript({ typescript: true });
    case ".tsx":
      return javascript({ jsx: true, typescript: true });
    case ".json":
    case ".map":
      return json();
    case ".md":
      return markdown();
    case ".html":
    case ".htm":
      return html();
    case ".css":
    case ".scss":
    case ".less":
      return css();
    case ".py":
      return python();
    case ".rs":
      return rust();
    case ".sql":
      return sql();
    case ".xml":
    case ".svg":
    case ".graphql":
    case ".proto":
      return xml();
    case ".yaml":
    case ".yml":
      return StreamLanguage.define(yaml);
    case ".sh":
    case ".bash":
    case ".zsh":
      return StreamLanguage.define(shell);
    default:
      return null;
  }
}
