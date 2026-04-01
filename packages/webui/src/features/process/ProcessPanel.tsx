import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { AsyncSurface, resolveAsyncSurfaceState } from "../../components/ui/async-surface";
import { Button } from "../../components/ui/button";
import {
  InlineAffordance,
  InlineAffordanceLabel,
  InlineAffordanceLeadingVisual,
  InlineAffordanceMeta,
  InlineAffordanceTrailingVisual,
} from "../../components/ui/inline-affordance";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { ToolInvocationCard } from "../../components/ui/tool-invocation-card";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  channel?: "to_user" | "self_talk" | "tool";
  tool?: {
    invocationId: string;
    name: string;
    status: "waiting" | "running" | "success" | "failed" | "cancelled";
    startedAt: number;
    finishedAt?: number;
    call?: { value: unknown; rawText?: string };
    result?: { value: unknown; rawText?: string };
    error?: string;
  };
}

interface ProcessPanelProps {
  messages: ChatMessage[];
  loading?: boolean;
}

const stripInternalHtml = (input: string): string =>
  input
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?([a-zA-Z][^>\s/]*)[^>]*>/g, "")
    .trim();

export const ProcessPanel = ({ messages, loading = false }: ProcessPanelProps) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const traces = useMemo(
    () => messages.filter((message) => message.channel === "self_talk" || message.channel === "tool"),
    [messages],
  );
  const state = resolveAsyncSurfaceState({ loading, hasData: traces.length > 0 });

  return (
    <section className="flex h-full flex-1 flex-col rounded-xl bg-white p-3 shadow-xs">
      <h2 className="typo-title-3 mb-2 text-slate-900">AI Process</h2>
      <AsyncSurface
        state={state}
        loadingOverlayLabel="Refreshing process..."
        skeleton={<div className="h-full rounded-lg bg-slate-100" />}
        empty={<p className="typo-caption text-slate-500">No process trace yet.</p>}
        className="flex-1"
      >
        <ScrollViewport className="flex-1 space-y-2">
          {traces.map((trace) => {
            const isOpen = expanded[trace.id] ?? false;
            const title = trace.channel === "self_talk" ? "Self-talk" : `Tool · ${trace.tool?.name ?? "tool"}`;
            const icon = <Sparkles className="h-3.5 w-3.5 text-teal-700" />;
            const compact = stripInternalHtml(trace.content);
            return (
              <article key={trace.id} className="rounded-lg bg-slate-100 px-2 py-1.5 text-xs text-slate-700">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setExpanded((prev) => ({ ...prev, [trace.id]: !isOpen }))}
                  className="h-auto w-full justify-start px-0 py-0 text-left shadow-none hover:bg-transparent"
                >
                  <InlineAffordance className="flex w-full" fill>
                    <InlineAffordanceLeadingVisual>{icon}</InlineAffordanceLeadingVisual>
                    <InlineAffordanceLabel className="font-medium text-slate-900">{title}</InlineAffordanceLabel>
                    {trace.channel === "tool" && trace.tool ? (
                      <InlineAffordanceMeta className="text-[11px] tracking-wide text-slate-500 uppercase">
                        {trace.tool.status}
                      </InlineAffordanceMeta>
                    ) : null}
                    <InlineAffordanceTrailingVisual>
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </InlineAffordanceTrailingVisual>
                  </InlineAffordance>
                </Button>
                {isOpen ? (
                  trace.channel === "tool" && trace.tool ? (
                    <div className="mt-1">
                      <ToolInvocationCard
                        invocation={{
                          invocationId: trace.tool.invocationId,
                          toolName: trace.tool.name,
                          status: trace.tool.status,
                          startedAt: trace.tool.startedAt,
                          finishedAt: trace.tool.finishedAt,
                          call: trace.tool.call
                            ? {
                                value: trace.tool.call.value,
                                rawText: trace.tool.call.rawText,
                              }
                            : undefined,
                          result: trace.tool.result
                            ? {
                                value: trace.tool.result.value,
                                rawText: trace.tool.result.rawText,
                              }
                            : undefined,
                          error: trace.tool.error,
                        }}
                        className="bg-white"
                      />
                    </div>
                  ) : (
                    <pre className="mt-1 overflow-auto rounded bg-white p-2 text-[11px] leading-4">{compact}</pre>
                  )
                ) : null}
              </article>
            );
          })}
        </ScrollViewport>
      </AsyncSurface>
    </section>
  );
};
