import { ChevronDown, ChevronRight, Sparkles, Wrench } from "lucide-react";
import { useMemo, useState } from "react";

import {
  InlineAffordance,
  InlineAffordanceLabel,
  InlineAffordanceLeadingVisual,
  InlineAffordanceMeta,
  InlineAffordanceTrailingVisual,
} from "../../components/ui/inline-affordance";

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
    <section className="flex h-full flex-1 flex-col overflow-hidden rounded-xl bg-white p-3 shadow-xs">
      <h2 className="typo-title-3 mb-2 text-slate-900">AI Process</h2>
      <div className="flex-1 space-y-2 overflow-auto">
        {traces.length === 0 ? <p className="typo-caption text-slate-500">No process trace yet.</p> : null}
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
                className="w-full text-left"
              >
                <InlineAffordance className="flex w-full" fill>
                  <InlineAffordanceLeadingVisual>{icon}</InlineAffordanceLeadingVisual>
                  <InlineAffordanceLabel className="font-medium text-slate-900">{title}</InlineAffordanceLabel>
                  {trace.channel === "tool_result" ? (
                    <InlineAffordanceMeta className="text-[11px] tracking-wide text-slate-500 uppercase">
                      {trace.tool?.ok === false ? "failed" : "done"}
                    </InlineAffordanceMeta>
                  ) : null}
                  <InlineAffordanceTrailingVisual>
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </InlineAffordanceTrailingVisual>
                </InlineAffordance>
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
