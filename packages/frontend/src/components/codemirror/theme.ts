import { EditorView } from "@codemirror/view";

export const codeMirrorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "var(--fo-editor-bg, var(--fo-surface))",
    color: "var(--fo-text)",
  },
  ".cm-scroller": {
    fontFamily: 'var(--fo-mono-font, "SF Mono", Menlo, Consolas, monospace)',
    fontSize: "13px",
    lineHeight: "1.5",
  },
  ".cm-content": {
    caretColor: "var(--fo-text)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--fo-text)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    {
      backgroundColor: "var(--fo-accent-soft)",
    },
  ".cm-gutters": {
    backgroundColor: "var(--fo-surface-elevated, var(--fo-surface))",
    color: "var(--fo-muted-text)",
    borderRight: "1px solid var(--fo-border)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--fo-row-hover-bg)",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--fo-row-hover-bg)",
  },
  ".cm-matchingBracket": {
    backgroundColor: "var(--fo-accent-soft)",
    outline: "1px solid var(--fo-accent)",
  },
});
