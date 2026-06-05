import { forwardRef } from "react";
import { CodeMirrorPane } from "../codemirror/CodeMirrorPane";
import type { CodeMirrorPaneHandle } from "../codemirror/CodeMirrorPane";

interface EditorViewProps {
  fileName: string;
  initialDoc: string;
  onChange: (next: string) => void;
  onSaveRequested: () => void;
}

export const EditorView = forwardRef<CodeMirrorPaneHandle, EditorViewProps>(
  function EditorView(
    { fileName, initialDoc, onChange, onSaveRequested },
    ref,
  ) {
    return (
      <CodeMirrorPane
        ref={ref}
        fileName={fileName}
        doc={initialDoc}
        onChange={onChange}
        onSaveRequested={onSaveRequested}
        className="fo-codemirror-pane fo-editor-cm"
        autoFocus
      />
    );
  },
);
