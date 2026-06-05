import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView as CMView } from "@codemirror/view";
import { buildEditorExtensions, buildReadOnlyExtensions } from "./extensions";

export type CodeMirrorCommand = (view: CMView) => boolean;

export interface CodeMirrorPaneHandle {
  runCommand: (command: CodeMirrorCommand) => boolean;
  focus: () => void;
  getDocument: () => string;
  hasSelection: () => boolean;
}

interface CodeMirrorPaneProps {
  fileName: string;
  doc: string;
  readOnly?: boolean;
  onChange?: (next: string) => void;
  onSaveRequested?: () => void;
  onScroll?: (scrollElement: HTMLElement) => void;
  className?: string;
  autoFocus?: boolean;
}

export const CodeMirrorPane = forwardRef<
  CodeMirrorPaneHandle,
  CodeMirrorPaneProps
>(function CodeMirrorPane(
  {
    fileName,
    doc,
    readOnly = false,
    onChange,
    onSaveRequested,
    onScroll,
    className = "fo-codemirror-pane",
    autoFocus = false,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<CMView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSaveRequested);
  const onScrollRef = useRef(onScroll);

  useImperativeHandle(
    ref,
    () => ({
      runCommand: (command) => {
        const view = viewRef.current;
        return view ? command(view) : false;
      },
      focus: () => viewRef.current?.focus(),
      getDocument: () => viewRef.current?.state.doc.toString() ?? "",
      hasSelection: () =>
        Boolean(
          viewRef.current?.state.selection.ranges.some((range) => !range.empty),
        ),
    }),
    [],
  );

  useEffect(() => {
    onChangeRef.current = onChange;
    onSaveRef.current = onSaveRequested;
    onScrollRef.current = onScroll;
  }, [onChange, onSaveRequested, onScroll]);

  useEffect(() => {
    if (!hostRef.current) return;

    const extensions = readOnly
      ? buildReadOnlyExtensions(fileName)
      : buildEditorExtensions({
          fileName,
          onSaveRequested: () => onSaveRef.current?.(),
          onChange: (next) => onChangeRef.current?.(next),
        });

    const state = EditorState.create({ doc, extensions });
    const view = new CMView({ state, parent: hostRef.current });
    viewRef.current = view;

    const handleScroll = () => onScrollRef.current?.(view.scrollDOM);
    if (readOnly) {
      view.scrollDOM.addEventListener("scroll", handleScroll);
    }

    if (autoFocus) {
      view.focus();
    }

    return () => {
      view.scrollDOM.removeEventListener("scroll", handleScroll);
      view.destroy();
      viewRef.current = null;
    };
  }, [autoFocus, fileName, readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const current = view.state.doc.toString();
    if (current === doc) return;

    if (readOnly && doc.startsWith(current)) {
      view.dispatch({
        changes: { from: current.length, insert: doc.slice(current.length) },
      });
      return;
    }

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: doc },
    });
  }, [doc, readOnly]);

  return <div ref={hostRef} className={className} />;
});
