import {
  autocompletion,
  completionStatus,
  startCompletion,
  type Completion,
  type CompletionSource,
} from "@codemirror/autocomplete";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useMemo, type KeyboardEventHandler } from "react";

import { extractFilesFromTransfer } from "./ai-input-assets";
import { COMPLETION_LIMIT, SLASH_COMMANDS, type AIInputSuggestion } from "./ai-input-contract";
import { findSlashCommandToken, findWorkspacePathToken } from "./ai-input-logic";

interface AIInputEditorProps {
  editorResetKey: number;
  value: string;
  placeholder: string;
  disabled: boolean;
  submitting: boolean;
  imageEnabled: boolean;
  workspacePath?: string | null;
  onSearchPaths?: (input: { cwd: string; query: string; limit?: number }) => Promise<AIInputSuggestion[]>;
  onChange: (value: string) => void;
  onCreateEditor: (view: EditorView) => void;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
  onMergePendingFiles: (files: File[]) => void;
  onResetDragState: () => void;
}

const completionIsIgnored = (completion: Completion): boolean =>
  completion.type?.split(/\s+/).includes("ignored") ?? false;

export const AIInputEditor = ({
  editorResetKey,
  value,
  placeholder,
  disabled,
  submitting,
  imageEnabled,
  workspacePath,
  onSearchPaths,
  onChange,
  onCreateEditor,
  onKeyDown,
  onMergePendingFiles,
  onResetDragState,
}: AIInputEditorProps) => {
  const slashCompletionSource = useMemo<CompletionSource>(() => {
    return async (context) => {
      const token = findSlashCommandToken(context.state.doc.toString(), context.pos);
      if (!token) {
        return null;
      }
      const query = token.raw.toLowerCase();
      const options = SLASH_COMMANDS.filter((item) => item.label.startsWith(query)).map<Completion>((item) => ({
        label: item.label,
        detail: item.detail,
        type: "keyword",
        apply: item.label,
      }));
      if (options.length === 0) {
        return null;
      }
      return {
        from: token.from,
        to: token.to,
        filter: false,
        options,
      };
    };
  }, []);

  const pathCompletionSource = useMemo<CompletionSource | null>(() => {
    if (!workspacePath || !onSearchPaths) {
      return null;
    }

    return async (context) => {
      const token = findWorkspacePathToken(context.state.doc.toString(), context.pos);
      if (!token) {
        return null;
      }

      const items = await onSearchPaths({
        cwd: workspacePath,
        query: token.raw,
        limit: COMPLETION_LIMIT,
      });
      if (context.aborted || items.length === 0) {
        return null;
      }

      const options: Completion[] = items.map((item) => ({
        label: item.path,
        displayLabel: item.label,
        detail: item.isDirectory ? "dir" : "file",
        type: [item.isDirectory ? "namespace" : "file", item.ignored ? "ignored" : ""].filter(Boolean).join(" "),
        apply: item.path.startsWith("@") ? item.path : `@${item.path}`,
        boost: item.isDirectory ? 5 : 0,
      }));

      return {
        from: token.from,
        to: token.to,
        filter: false,
        options,
      };
    };
  }, [onSearchPaths, workspacePath]);

  const extensions = useMemo(() => {
    const completionOverrides = pathCompletionSource ? [slashCompletionSource, pathCompletionSource] : [slashCompletionSource];

    return [
      markdown({ codeLanguages: languages }),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) {
          return;
        }
        const cursor = update.state.selection.main.head;
        const currentValue = update.state.doc.toString();
        const pathToken = findWorkspacePathToken(currentValue, cursor);
        const slashToken = findSlashCommandToken(currentValue, cursor);
        if (!pathToken && !slashToken) {
          return;
        }
        const status = completionStatus(update.state);
        if (status === "active" || status === "pending") {
          return;
        }
        startCompletion(update.view);
      }),
      EditorView.domEventHandlers({
        paste: (event) => {
          const clipboardFiles = extractFilesFromTransfer(event.clipboardData, {
            imageEnabled,
            imageOnly: true,
          });
          if (clipboardFiles.length === 0) {
            return false;
          }
          event.preventDefault();
          onMergePendingFiles(clipboardFiles);
          return true;
        },
        drop: (event) => {
          const droppedFiles = extractFilesFromTransfer(event.dataTransfer, {
            imageEnabled,
          });
          if (droppedFiles.length === 0) {
            return false;
          }
          event.preventDefault();
          onResetDragState();
          onMergePendingFiles(droppedFiles);
          return true;
        },
      }),
      EditorView.theme({
        "&": {
          fontSize: "13px",
          backgroundColor: "transparent",
        },
        ".cm-scroller": {
          fontFamily: "var(--font-sans)",
          lineHeight: "1.55",
        },
        ".cm-content": {
          padding: "14px 14px 12px",
          minHeight: "132px",
        },
        ".cm-gutters": {
          display: "none",
        },
        ".cm-focused": {
          outline: "none",
        },
        ".cm-editor": {
          backgroundColor: "transparent",
        },
        ".cm-cursor": {
          borderLeftColor: "#0f766e",
        },
        ".cm-placeholder": {
          color: "#94a3b8",
        },
        ".cm-tooltip-autocomplete": {
          border: "1px solid #e2e8f0",
          backgroundColor: "rgba(255, 255, 255, 0.98)",
          borderRadius: "16px",
          padding: "4px",
          boxShadow: "0 16px 40px rgba(15, 23, 42, 0.16)",
          backdropFilter: "blur(10px)",
        },
        ".cm-tooltip-autocomplete ul": {
          fontFamily: "var(--font-sans)",
          padding: "0",
        },
        ".cm-tooltip-autocomplete ul li": {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          borderRadius: "12px",
          padding: "8px 10px",
          color: "#475569",
        },
        ".cm-tooltip-autocomplete ul li[aria-selected]": {
          backgroundColor: "#ccfbf1",
          color: "#134e4a",
        },
        ".cm-completionOption-ignored .cm-completionLabel": {
          color: "#64748b",
        },
        ".cm-completionOption-ignored .cm-completionDetail": {
          color: "#94a3b8",
        },
        ".cm-completionOption-ignored[aria-selected] .cm-completionLabel": {
          color: "#0f766e",
        },
        ".cm-completionFlag": {
          marginLeft: "8px",
          borderRadius: "999px",
          padding: "1px 6px",
          fontSize: "10px",
          fontWeight: "600",
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          color: "#64748b",
          backgroundColor: "#e2e8f0",
        },
        ".cm-completionOption-ignored[aria-selected] .cm-completionFlag": {
          color: "#115e59",
          backgroundColor: "rgba(15, 118, 110, 0.12)",
        },
        ".cm-completionLabel": {
          minWidth: "0",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontWeight: "600",
        },
        ".cm-completionDetail": {
          marginLeft: "12px",
          color: "#94a3b8",
          fontSize: "11px",
          letterSpacing: "0.02em",
          textTransform: "uppercase",
        },
      }),
      autocompletion({
        override: completionOverrides,
        activateOnTyping: true,
        icons: false,
        maxRenderedOptions: COMPLETION_LIMIT,
        optionClass: (completion) => (completionIsIgnored(completion) ? "cm-completionOption-ignored" : ""),
        addToOptions: [
          {
            position: 72,
            render: (completion) => {
              if (!completionIsIgnored(completion)) {
                return null;
              }
              const badge = document.createElement("span");
              badge.className = "cm-completionFlag";
              badge.textContent = "ignored";
              return badge;
            },
          },
        ],
      }),
    ];
  }, [imageEnabled, onMergePendingFiles, onResetDragState, pathCompletionSource, slashCompletionSource]);

  return (
    <div className="relative">
      <CodeMirror
        key={editorResetKey}
        value={value}
        onChange={onChange}
        onCreateEditor={onCreateEditor}
        placeholder={placeholder}
        extensions={extensions}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLineGutter: false,
          highlightActiveLine: false,
        }}
        editable={!disabled && !submitting}
        readOnly={disabled || submitting}
        theme="none"
        onKeyDown={onKeyDown}
      />
    </div>
  );
};
