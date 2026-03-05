import { ChevronDown, ChevronRight, Sparkles, Wrench } from "lucide-react";
import { useMemo, useState } from "react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  channel?: "to_user" | "self_talk" | "tool_call" | "tool_result";
  tool?: {
    name: string;
    ok?: boolean;
  };
}

interface ProcessPanelProps {
  messages: ChatMessage[];
}

const stripInternalHtml = (input: string): string =>
  input
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?([a-zA-Z][^>\s/]*)[^>]*>/g, "")
    .trim();

const pickToolName = (message: ChatMessage): string => {
  if (message.tool?.name) {
    return message.tool.name;
  }
  const match = message.content.match(/tool:\s*([^\n]+)/);
  return match?.[1]?.trim() ?? "tool";
};

export const ProcessPanel = ({ messages }: ProcessPanelProps) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const traces = useMemo(
    () =>
      messages.filter(
        (message) =>
          message.channel === "self_talk" || message.channel === "tool_call" || message.channel === "tool_result",
      ),
    [messages],
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-xl bg-white p-3 shadow-xs">
      <h2 className="mb-2 text-sm font-semibold text-slate-900">AI Process</h2>
      <div className="min-h-0 space-y-2 overflow-auto">
        {traces.length === 0 ? <p className="text-xs text-slate-500">No process trace yet.</p> : null}
        {traces.map((trace) => {
          const isOpen = expanded[trace.id] ?? false;
          const title =
            trace.channel === "self_talk"
              ? "Self-talk"
              : trace.channel === "tool_call"
                ? `Tool call · ${pickToolName(trace)}`
                : `Tool result · ${pickToolName(trace)}`;
          const icon =
            trace.channel === "self_talk" ? (
              <Sparkles className="h-3.5 w-3.5 text-teal-700" />
            ) : (
              <Wrench className="h-3.5 w-3.5 text-slate-700" />
            );
          const compact = stripInternalHtml(trace.content);
          return (
            <article key={trace.id} className="rounded-lg bg-slate-100 px-2 py-1.5 text-xs text-slate-700">
              <button
                type="button"
                onClick={() => setExpanded((prev) => ({ ...prev, [trace.id]: !isOpen }))}
                className="flex w-full items-center gap-2 text-left"
              >
                {icon}
                <span className="font-medium text-slate-900">{title}</span>
                {trace.channel === "tool_result" ? (
                  <span className="ml-auto text-[11px] tracking-wide text-slate-500 uppercase">
                    {trace.tool?.ok === false ? "failed" : "done"}
                  </span>
                ) : null}
                {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              {isOpen ? (
                <pre className="mt-1 overflow-auto rounded bg-white p-2 text-[11px] leading-4">{compact}</pre>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
};
