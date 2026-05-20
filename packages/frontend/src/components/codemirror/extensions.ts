import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { searchKeymap } from "@codemirror/search";
import { EditorState, type Extension } from "@codemirror/state";
import {
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  EditorView,
} from "@codemirror/view";
import { syntaxHighlightExtension } from "./highlightStyle";
import { languageExtensionForFileName } from "./language";
import { codeMirrorTheme } from "./theme";

function languageForFileName(fileName?: string): Extension[] {
  if (!fileName) return [];
  const language = languageExtensionForFileName(fileName);
  return language ? [language] : [];
}

function sharedBaseExtensions(fileName?: string): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    codeMirrorTheme,
    syntaxHighlightExtension,
    ...languageForFileName(fileName),
    EditorView.lineWrapping,
    EditorState.tabSize.of(2),
  ];
}

export interface BuildEditorExtensionsOptions {
  fileName?: string;
  onSaveRequested: () => void;
  onChange: (next: string) => void;
}

export function buildEditorExtensions(
  options: BuildEditorExtensionsOptions,
): Extension[] {
  const saveBinding = keymap.of([
    {
      key: "Mod-s",
      preventDefault: true,
      run: () => {
        options.onSaveRequested();
        return true;
      },
    },
  ]);

  return [
    ...sharedBaseExtensions(options.fileName),
    history(),
    saveBinding,
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        options.onChange(update.state.doc.toString());
      }
    }),
  ];
}

export function buildReadOnlyExtensions(fileName?: string): Extension[] {
  return [
    ...sharedBaseExtensions(fileName),
    EditorState.readOnly.of(true),
    EditorView.editable.of(false),
  ];
}
