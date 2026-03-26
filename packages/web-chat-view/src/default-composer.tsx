import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { LoaderCircle, SendHorizontal } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import type { WebChatComposerRenderProps } from "./types";

export const DefaultWebChatComposer = ({
  channel,
  disabled,
  sending,
  connectionState,
  onSubmit,
}: WebChatComposerRenderProps) => {
  const [draft, setDraft] = useState("");
  const canSubmit = !disabled && !sending && draft.trim().length > 0;

  const handleSubmit = useCallback(async () => {
    const text = draft.trim();
    if (!canSubmit || text.length === 0) {
      return;
    }
    await onSubmit({ text, assets: [] });
    setDraft("");
  }, [canSubmit, draft, onSubmit]);

  const extensions = useMemo(
    () => [
      markdown({ codeLanguages: languages }),
      EditorView.lineWrapping,
      EditorView.domEventHandlers({
        keydown: (event) => {
          if (event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) {
            return false;
          }
          event.preventDefault();
          void handleSubmit();
          return true;
        },
      }),
      EditorView.theme({
        "&": { fontSize: "13px", backgroundColor: "transparent" },
        ".cm-scroller": { fontFamily: "var(--font-sans)", lineHeight: "1.5" },
        ".cm-content": { padding: "10px 12px", minHeight: "72px" },
        ".cm-gutters": { display: "none" },
        ".cm-focused": { outline: "none" },
        ".cm-editor": { backgroundColor: "transparent" },
        ".cm-placeholder": { color: "#94a3b8" },
        ".cm-cursor": { borderLeftColor: "#0f766e" },
      }),
    ],
    [handleSubmit],
  );

  return (
    <section className="border-t border-slate-200 bg-white/94 px-2 py-2 backdrop-blur md:px-2.5 md:py-2.5">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <CodeMirror
          value={draft}
          extensions={extensions}
          editable={!disabled && !sending}
          placeholder={`Message ${channel.title}...`}
          onChange={setDraft}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
          }}
        />
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-3 py-2 text-[11px] text-slate-500">
          <span>{connectionState === "connected" ? "Enter to send, Shift+Enter for newline" : "Waiting for channel transport"}</span>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              void handleSubmit();
            }}
            className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white transition disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {sending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <SendHorizontal className="h-3.5 w-3.5" />}
            <span>Send</span>
          </button>
        </div>
      </div>
    </section>
  );
};
