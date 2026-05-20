import { CodeMirrorPane } from "../codemirror/CodeMirrorPane";

interface EditorViewProps {
  fileName: string;
  initialDoc: string;
  onChange: (next: string) => void;
  onSaveRequested: () => void;
}

export function EditorView({
  fileName,
  initialDoc,
  onChange,
  onSaveRequested,
}: EditorViewProps) {
  return (
    <CodeMirrorPane
      fileName={fileName}
      doc={initialDoc}
      onChange={onChange}
      onSaveRequested={onSaveRequested}
      className="fo-codemirror-pane fo-editor-cm"
      autoFocus
    />
  );
}
