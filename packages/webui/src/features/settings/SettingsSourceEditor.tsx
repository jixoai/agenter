import { json } from "@codemirror/lang-json";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useMemo } from "react";

import { ClipSurface } from "../../components/ui/overflow-surface";
import { cn } from "../../lib/utils";

const JSON_BASIC_SETUP = {
  foldGutter: false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  searchKeymap: false,
} as const;

interface SettingsSourceEditorProps {
  value: string;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  testId?: string;
  onChange?: (nextValue: string) => void;
}

export const SettingsSourceEditor = ({
  value,
  readOnly = false,
  placeholder,
  className,
  testId,
  onChange,
}: SettingsSourceEditorProps) => {
  const themeExtension = useMemo<Extension>(
    () =>
      EditorView.theme({
        "&": {
          height: "100%",
          fontSize: "12px",
          backgroundColor: "transparent",
        },
        ".cm-editor": {
          height: "100%",
          backgroundColor: "transparent",
        },
        ".cm-scroller": {
          overflow: "auto",
          fontFamily: "var(--font-mono)",
          lineHeight: "1.45",
        },
        ".cm-content": {
          minHeight: "100%",
          padding: "10px 12px",
        },
        ".cm-gutters": {
          borderRight: "1px solid #e2e8f0",
          backgroundColor: readOnly ? "#f8fafc" : "#f1f5f9",
          color: "#64748b",
        },
        ".cm-activeLineGutter": {
          backgroundColor: "transparent",
        },
        ".cm-focused": {
          outline: "none",
        },
        ".cm-cursor": {
          borderLeftColor: "#0f766e",
        },
        ".cm-placeholder": {
          color: "#94a3b8",
          fontStyle: "italic",
        },
      }),
    [readOnly],
  );

  const extensions = useMemo<Extension[]>(
    () => [
      json(),
      EditorView.lineWrapping,
      EditorState.readOnly.of(readOnly),
      EditorView.editable.of(!readOnly),
      themeExtension,
    ],
    [readOnly, themeExtension],
  );

  return (
    <ClipSurface data-testid={testId} className={cn("h-full min-w-0 rounded-md border border-slate-200 bg-white", className)}>
      <CodeMirror
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        editable={!readOnly}
        readOnly={readOnly}
        extensions={extensions}
        basicSetup={JSON_BASIC_SETUP}
        className="h-full min-w-0"
        theme="none"
      />
    </ClipSurface>
  );
};
