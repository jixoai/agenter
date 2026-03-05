import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, SendHorizontal } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  channel?: "to_user" | "self_talk" | "tool_call" | "tool_result";
}

interface ChatPanelProps {
  activeSessionName: string | null;
  messages: ChatMessage[];
  input: string;
  aiStatus: string;
  noTerminalHint?: string | null;
  disabled: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
}

const BOTTOM_GAP = 24;

const isUserFacingMessage = (message: ChatMessage): boolean => {
  if (message.role === "user") {
    return true;
  }
  return message.channel === "to_user" || message.channel === undefined;
};

export const ChatPanel = ({
  activeSessionName,
  messages,
  input,
  aiStatus,
  noTerminalHint,
  disabled,
  onInputChange,
  onSend,
}: ChatPanelProps) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  useEffect(() => {
    if (!stickToBottom) {
      return;
    }
    const node = viewportRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [messages, stickToBottom]);

  const visibleMessages = useMemo(
    () => {
      const normalized = messages
        .filter((message) => isUserFacingMessage(message) && message.content.trim().length > 0)
        .map((message) => ({ ...message, content: message.content.trim() }));

      const deduped: typeof normalized = [];
      for (const message of normalized) {
        const previous = deduped[deduped.length - 1];
        if (
          previous &&
          previous.role === "assistant" &&
          message.role === "assistant" &&
          previous.channel === message.channel &&
          previous.content === message.content
        ) {
          continue;
        }
        deduped.push(message);
      }
      return deduped;
    },
    [messages],
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="truncate text-sm font-semibold text-slate-900">
          {activeSessionName ? `Chat · ${activeSessionName}` : "Chat"}
        </h2>
        <Badge variant={aiStatus === "error" ? "destructive" : aiStatus === "idle" ? "secondary" : "warning"}>{aiStatus}</Badge>
      </div>

      {noTerminalHint ? (
        <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{noTerminalHint}</div>
      ) : null}

      <div
        ref={viewportRef}
        className="min-h-0 flex-1 space-y-2 overflow-auto rounded-xl bg-slate-50 p-2"
        onScroll={(event) => {
          const node = event.currentTarget;
          const isBottom = node.scrollHeight - node.scrollTop - node.clientHeight < BOTTOM_GAP;
          setStickToBottom(isBottom);
        }}
      >
        {visibleMessages.length === 0 ? <p className="px-2 py-1 text-xs text-slate-500">Start by asking Agenter a task.</p> : null}
        {visibleMessages.map((message) => (
          <article
            key={message.id}
            className={cn(
              "max-w-[86%] rounded-2xl px-3 py-2 text-sm shadow-xs",
              message.role === "user" ? "ml-auto bg-teal-600 text-white" : "mr-auto bg-white text-slate-900",
            )}
          >
            {message.role === "assistant" ? (
              <div className="space-y-2 break-words text-sm leading-6 text-slate-900">
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: (props) => <p className="whitespace-pre-wrap break-words" {...props} />,
                    ul: (props) => <ul className="list-disc pl-5" {...props} />,
                    ol: (props) => <ol className="list-decimal pl-5" {...props} />,
                    pre: (props) => <pre className="overflow-auto rounded-md bg-slate-100 p-2 text-xs leading-5" {...props} />,
                    code: (props) => <code className="rounded bg-slate-100 px-1 py-0.5 text-xs" {...props} />,
                  }}
                >
                  {message.content}
                </Markdown>
              </div>
            ) : (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            )}
          </article>
        ))}
        {aiStatus !== "idle" ? (
          <div className="mr-auto inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1 text-xs text-slate-600">
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-teal-700" />
            AI {aiStatus}
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex gap-2">
        <Textarea
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Message Agenter… (Enter to send, Shift+Enter newline)"
          disabled={disabled}
          className="min-h-[72px]"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
        />
        <Button onClick={onSend} disabled={disabled || input.trim().length === 0} className="h-auto self-end px-3" title="Send message">
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
};
