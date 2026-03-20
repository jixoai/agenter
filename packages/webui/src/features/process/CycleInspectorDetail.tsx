import type { RuntimeChatCycle, RuntimeChatMessage } from "@agenter/client-sdk";
import { CircleAlert, CircleCheckBig, LoaderCircle, MessageSquareText } from "lucide-react";
import type { ReactNode } from "react";

import { MarkdownDocument } from "../../components/markdown/MarkdownDocument";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../components/ui/accordion";
import { Badge } from "../../components/ui/badge";
import { ViewportMask } from "../../components/ui/overflow-surface";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { cn } from "../../lib/utils";
import { AssistantMarkdown } from "../chat/AssistantMarkdown";
import { formatCycleTitle, getCycleStatusMeta, summarizeCycle } from "../chat/cycle-meta";
import { splitCycleInputs, summarizeSystemFacts, type CycleSystemFact } from "../chat/cycle-facts";

interface CycleInspectorDetailProps {
  cycle: RuntimeChatCycle;
}

interface UserInputBlock {
  key: string;
  text: string;
  attachments: Array<{
    key: string;
    kind: string;
    name: string;
  }>;
}

type DetailStepState = "upcoming" | "active" | "done" | "error";

const roleLabel = (message: RuntimeChatMessage): string => {
  if (message.role === "user") {
    return "User";
  }
  if (message.channel === "self_talk") {
    return "Self-talk";
  }
  if (message.channel === "tool_call") {
    return "Tool call";
  }
  if (message.channel === "tool_result") {
    return "Tool result";
  }
  return "Reply";
};

const statusIcon = (cycle: RuntimeChatCycle) => {
  if (cycle.status === "error") {
    return <CircleAlert className="h-4 w-4 text-rose-600" />;
  }
  if (cycle.status === "streaming" || cycle.status === "collecting" || cycle.status === "applying") {
    return <LoaderCircle className="h-4 w-4 animate-spin text-teal-700" />;
  }
  return <CircleCheckBig className="h-4 w-4 text-emerald-600" />;
};

const toUserInputBlocks = (cycle: RuntimeChatCycle): UserInputBlock[] => {
  const { userInputs } = splitCycleInputs(cycle);
  return userInputs.map((input, index) => ({
    key: `${cycle.id}:input:${index}`,
    text: input.parts
      .filter((part): part is Extract<(typeof input.parts)[number], { type: "text" }> => part.type === "text")
      .map((part) => part.text)
      .join("\n"),
    attachments: input.parts
      .filter((part): part is Exclude<(typeof input.parts)[number], { type: "text" }> => part.type !== "text")
      .map((part, attachmentIndex) => ({
        key: `${cycle.id}:input:${index}:attachment:${attachmentIndex}`,
        kind: part.kind,
        name: part.name,
      })),
  }));
};

const collectTechnicalMessages = (cycle: RuntimeChatCycle): RuntimeChatMessage[] =>
  [...cycle.outputs, ...cycle.liveMessages].filter((message) => message.channel !== "to_user");

const collectReplyMessages = (cycle: RuntimeChatCycle): RuntimeChatMessage[] =>
  [...cycle.outputs, ...cycle.liveMessages].filter((message) => message.role === "assistant" && message.channel === "to_user");

const resolveErrorStepIndex = (cycle: RuntimeChatCycle): number => {
  if (collectTechnicalMessages(cycle).length > 0) {
    return 2;
  }
  if (collectReplyMessages(cycle).length > 0 || cycle.streaming?.content.trim().length) {
    return 1;
  }
  if (cycle.inputs.length > 0) {
    return 0;
  }
  return 3;
};

const resolveStepStates = (cycle: RuntimeChatCycle): DetailStepState[] => {
  if (cycle.status === "pending") {
    return ["active", "upcoming", "upcoming", "upcoming"];
  }
  if (cycle.status === "collecting") {
    return ["active", "upcoming", "upcoming", "upcoming"];
  }
  if (cycle.status === "streaming") {
    return ["done", "active", "upcoming", "upcoming"];
  }
  if (cycle.status === "applying") {
    return ["done", "done", "active", "upcoming"];
  }
  if (cycle.status === "done") {
    return ["done", "done", "done", "active"];
  }

  const states: DetailStepState[] = ["done", "done", "done", "upcoming"];
  const errorIndex = resolveErrorStepIndex(cycle);
  for (let index = errorIndex + 1; index < states.length; index += 1) {
    states[index] = "upcoming";
  }
  states[errorIndex] = "error";
  return states;
};

const resolveStepClassName = (state: DetailStepState): string => {
  switch (state) {
    case "active":
      return "border-teal-300 bg-teal-50 text-teal-700";
    case "done":
      return "border-emerald-300 bg-emerald-50 text-emerald-700";
    case "error":
      return "border-rose-300 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-500";
  }
};

const StepChip = ({
  label,
  detail,
  state,
}: {
  label: string;
  detail: string;
  state: DetailStepState;
}) => (
  <div className={cn("rounded-2xl border px-3 py-3", resolveStepClassName(state))}>
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em]">{label}</div>
    <div className="mt-1 text-sm font-medium">{detail}</div>
  </div>
);

const MetricCard = ({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) => (
  <article className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
    <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    <p className="mt-1 text-xs text-slate-500">{detail}</p>
  </article>
);

const SectionShell = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
    <div className="mb-3">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
    {children}
  </section>
);

const renderUserInputBlock = (block: UserInputBlock) => {
  const hasText = block.text.trim().length > 0;
  return (
    <article key={block.key} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      {hasText ? (
        <MarkdownDocument
          value={block.text}
          mode="preview"
          usage="inspector"
          surface="muted"
          syntaxTone="accented"
          density="compact"
          padding="compact"
          className="text-sm text-slate-700"
        />
      ) : (
        <p className="text-sm text-slate-500">No text payload.</p>
      )}
      {block.attachments.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {block.attachments.map((attachment) => (
            <span
              key={attachment.key}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600"
            >
              <span className="font-medium text-slate-800">{attachment.name}</span>
              <span className="uppercase tracking-[0.12em] text-slate-500">{attachment.kind}</span>
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
};

const renderFactCard = (fact: CycleSystemFact) => (
  <article key={fact.key} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <span className="font-medium uppercase tracking-[0.16em] text-slate-400">{fact.source}</span>
      <span className="font-medium text-slate-900">{fact.title}</span>
      <span>{fact.summary}</span>
    </div>
    {fact.detail.trim().length > 0 ? (
      <MarkdownDocument
        value={fact.detail}
        mode="raw"
        usage="inspector"
        surface="muted"
        syntaxTone="accented"
        density="compact"
        padding="compact"
        maxHeight={220}
        className="mt-2 text-xs text-slate-600"
      />
    ) : null}
  </article>
);

export const CycleInspectorDetail = ({ cycle }: CycleInspectorDetailProps) => {
  const status = getCycleStatusMeta(cycle);
  const userInputs = toUserInputBlocks(cycle);
  const { systemFacts } = splitCycleInputs(cycle);
  const replyMessages = collectReplyMessages(cycle);
  const technicalMessages = collectTechnicalMessages(cycle);
  const stepStates = resolveStepStates(cycle);

  return (
    <section className="grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-sm text-slate-700">
            {statusIcon(cycle)}
            <span className="font-medium">{formatCycleTitle(cycle)}</span>
          </div>
          <Badge className={status.toneClassName}>{status.label}</Badge>
          <Badge variant="secondary">{cycle.kind}</Badge>
          {cycle.wakeSource ? <Badge variant="secondary">wake {cycle.wakeSource}</Badge> : null}
          {cycle.modelCallId !== null ? <Badge variant="secondary">model #{cycle.modelCallId}</Badge> : null}
        </div>
        <p className="mt-2 text-sm text-slate-500">{summarizeCycle(cycle)}</p>
      </div>

      <ViewportMask className="h-full">
        <ScrollViewport className="flex-1 px-3 py-3">
          <div className="space-y-3">
          <section className="grid gap-3 lg:grid-cols-4">
            <StepChip label="Collect" detail={`${cycle.inputs.length} inputs`} state={stepStates[0]} />
            <StepChip
              label="Reply"
              detail={
                cycle.streaming?.content.trim().length ? "streaming draft" : `${replyMessages.length} visible replies`
              }
              state={stepStates[1]}
            />
            <StepChip label="Apply" detail={`${technicalMessages.length} technical records`} state={stepStates[2]} />
            <StepChip label="Ready" detail={status.label.toLowerCase()} state={stepStates[3]} />
          </section>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Wake source" value={cycle.wakeSource ?? "manual"} detail="Why this cycle started" />
            <MetricCard label="Inputs" value={String(cycle.inputs.length)} detail="Collected records before the model step" />
            <MetricCard
              label="Facts"
              value={String(systemFacts.length)}
              detail={systemFacts.length > 0 ? summarizeSystemFacts(systemFacts) : "No system facts"}
            />
            <MetricCard
              label="Replies"
              value={String(replyMessages.length + (cycle.streaming?.content.trim().length ? 1 : 0))}
              detail={cycle.streaming?.content.trim().length ? "Includes live streaming draft" : "Completed user-facing replies"}
            />
          </section>

          <SectionShell
            title="Inputs"
            subtitle="The user payload and queued attachments collected for this cycle."
          >
            {userInputs.length > 0 ? (
              <div className="space-y-3">{userInputs.map(renderUserInputBlock)}</div>
            ) : (
              <p className="text-sm text-slate-500">No user-facing inputs were collected for this cycle.</p>
            )}
          </SectionShell>

          <SectionShell
            title="Facts"
            subtitle="State gathered from terminal, attention, tasks, and other subsystems."
          >
            {systemFacts.length > 0 ? (
              <div className="space-y-3">{systemFacts.map(renderFactCard)}</div>
            ) : (
              <p className="text-sm text-slate-500">No collected system facts for this cycle.</p>
            )}
          </SectionShell>

          <SectionShell
            title="Reply"
            subtitle="The user-facing response for this cycle, including any live streaming draft."
          >
            {replyMessages.length > 0 || cycle.streaming?.content ? (
              <div className="space-y-3">
                {replyMessages.map((message) => (
                  <article key={message.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <AssistantMarkdown content={message.content} channel={message.channel} tool={message.tool} />
                  </article>
                ))}
                {cycle.streaming?.content ? (
                  <article className="rounded-2xl border border-teal-200 bg-teal-50/50 px-3 py-3">
                    <div className="mb-2 inline-flex items-center gap-2 text-xs font-medium text-teal-700">
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      <span>Streaming draft</span>
                    </div>
                    <AssistantMarkdown content={cycle.streaming.content} channel="to_user" />
                  </article>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No user-facing reply is available yet.</p>
            )}
          </SectionShell>

          <Accordion type="multiple" defaultValue={technicalMessages.length > 0 ? ["technical"] : []}>
            <AccordionItem value="technical" className="rounded-2xl border border-slate-200 bg-white">
              <AccordionTrigger className="px-4 py-3 text-left text-sm font-medium hover:no-underline">
                Technical records
              </AccordionTrigger>
              <AccordionContent className="border-t border-slate-200 px-4 py-4">
                {technicalMessages.length > 0 ? (
                  <div className="space-y-3">
                    {technicalMessages.map((message) => (
                      <article key={message.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="mb-2 inline-flex items-center gap-2 text-xs text-slate-500">
                          <MessageSquareText className="h-3.5 w-3.5" />
                          <span>{roleLabel(message)}</span>
                        </div>
                        <AssistantMarkdown content={message.content} channel={message.channel} tool={message.tool} />
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No assistant-side technical records for this cycle.</p>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          </div>
        </ScrollViewport>
      </ViewportMask>
    </section>
  );
};
