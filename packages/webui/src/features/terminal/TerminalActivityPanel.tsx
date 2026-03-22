import type { RuntimeChatCycle, RuntimeClientState } from "@agenter/client-sdk";
import { TerminalSquare, Wrench } from "lucide-react";

import { MarkdownDocument } from "../../components/markdown/MarkdownDocument";
import { Badge } from "../../components/ui/badge";
import { ScrollViewport, ViewportMask } from "../../components/ui/overflow-surface";
import { AssistantMarkdown } from "../chat/AssistantMarkdown";
import { formatCycleTitle } from "../chat/cycle-meta";
import { normalizeCycleTechnicalRecords } from "../process/cycle-technical-records";

interface TerminalActivityPanelProps {
  terminalId: string;
  terminalRead: RuntimeClientState["terminalReadsBySession"][string][string] | undefined;
  cycles: RuntimeChatCycle[];
}

const includesTerminalId = (value: string | undefined, terminalId: string): boolean => {
  return typeof value === "string" && value.includes(terminalId);
};

const matchesToolTrace = (
  trace: ReturnType<typeof normalizeCycleTechnicalRecords>[number],
  terminalId: string,
): trace is Extract<ReturnType<typeof normalizeCycleTechnicalRecords>[number], { kind: "tool-trace" }> => {
  if (trace.kind !== "tool-trace") {
    return false;
  }
  return (
    includesTerminalId(trace.toolTrace.meta ?? undefined, terminalId) ||
    includesTerminalId(trace.toolTrace.callContent, terminalId) ||
    includesTerminalId(trace.toolTrace.resultContent, terminalId)
  );
};

const matchesMessage = (
  trace: ReturnType<typeof normalizeCycleTechnicalRecords>[number],
  terminalId: string,
): trace is Extract<ReturnType<typeof normalizeCycleTechnicalRecords>[number], { kind: "message" }> => {
  return trace.kind === "message" && includesTerminalId(trace.message.content, terminalId);
};

const renderTerminalRead = (terminalRead: NonNullable<TerminalActivityPanelProps["terminalRead"]>) => {
  return ["```json", JSON.stringify(terminalRead, null, 2), "```"].join("\n");
};

export const TerminalActivityPanel = ({ terminalId, terminalRead, cycles }: TerminalActivityPanelProps) => {
  const relatedRecords = cycles
    .slice()
    .sort((left, right) => right.createdAt - left.createdAt)
    .flatMap((cycle) =>
      normalizeCycleTechnicalRecords(cycle)
        .filter((record) => matchesToolTrace(record, terminalId) || matchesMessage(record, terminalId))
        .map((record) => ({ cycle, record })),
    );

  return (
    <ViewportMask className="grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="typo-title-3 text-slate-900">Activity</h3>
          <Badge variant="secondary">{terminalId}</Badge>
          {terminalRead ? <Badge variant="secondary">latest read</Badge> : null}
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          Terminal-local facts, tool traces, and internal records that explicitly reference this terminal id.
        </p>
      </div>

      <ScrollViewport className="h-full px-3 py-3" data-terminal-activity-scroll-owner="inspector">
        <div className="space-y-3">
          {terminalRead ? (
            <article className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="mb-2 inline-flex items-center gap-2 text-xs text-slate-500">
                <TerminalSquare className="h-3.5 w-3.5" />
                <span>Latest terminal_read result</span>
              </div>
              <MarkdownDocument
                value={renderTerminalRead(terminalRead)}
                mode="preview"
                usage="inspector"
                surface="muted"
                syntaxTone="accented"
                density="compact"
                padding="compact"
              />
            </article>
          ) : null}

          {relatedRecords.map(({ cycle, record }) => (
            <article key={`${cycle.id}:${record.key}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Wrench className="h-3.5 w-3.5" />
                <span>{formatCycleTitle(cycle)}</span>
                <Badge variant="secondary">{cycle.status}</Badge>
              </div>
              {record.kind === "tool-trace" ? (
                <AssistantMarkdown content="" toolTrace={record.toolTrace} />
              ) : (
                <AssistantMarkdown content={record.message.content} channel={record.message.channel} tool={record.message.tool} />
              )}
            </article>
          ))}

          {!terminalRead && relatedRecords.length === 0 ? (
            <p className="text-sm text-slate-500">No terminal-local activity is available yet.</p>
          ) : null}
        </div>
      </ScrollViewport>
    </ViewportMask>
  );
};
