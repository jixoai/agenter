import type {
  ModelCallItem,
  RuntimeAttentionState,
  RuntimeChatCycle,
  RuntimeChatMessage,
  ObservabilityTraceItem as RuntimeTraceItem,
} from "@agenter/client-sdk";
import { CircleAlert, CircleCheckBig, ExternalLink, LoaderCircle, MessageSquareText, Orbit } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { MarkdownDocument } from "../../components/markdown/MarkdownDocument";
import { Badge } from "../../components/ui/badge";
import { JSONViewer } from "../../components/ui/json-viewer";
import { Tabs } from "../../components/ui/tabs";
import { AssistantMarkdown } from "../chat/AssistantMarkdown";
import {
  EMPTY_RUNTIME_ATTENTION_STATE,
  type AttentionHookView,
  type AttentionSelectionState,
  type ResolvedAttentionCommitView,
  type ResolvedAttentionContextView,
} from "../attention/attention-view-model";
import {
  normalizeCycleExecutionRecords,
  type CycleExecutionRecord,
} from "./cycle-execution-records";
import {
  buildCycleInspectorDetail,
  formatCycleTitle,
  type CycleContextBucketView,
} from "./cycle-inspector-view-model";

interface CycleInspectorDetailProps {
  cycle: RuntimeChatCycle;
  attention?: RuntimeAttentionState;
  modelCalls?: ModelCallItem[];
  traces?: RuntimeTraceItem[];
  onOpenAttentionRef?: (selection: AttentionSelectionState) => void;
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

type CycleDetailTab = "overview" | "contexts" | "commits" | "effects" | "evidence";

const roleLabel = (message: RuntimeChatMessage): string => {
  if (message.role === "user") {
    return "User";
  }
  return message.channel === "to_user" ? "Assistant" : message.channel ?? "Assistant";
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
  const userInputs = cycle.inputs.filter((input) => input.source === "message" && input.role === "user");
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

const collectDeliveredMessages = (cycle: RuntimeChatCycle): RuntimeChatMessage[] =>
  [...cycle.outputs, ...cycle.liveMessages].filter(
    (message) => message.role === "assistant" && message.channel === "to_user",
  );

const MetricCard = ({ label, value, detail }: { label: string; value: string; detail: string }) => (
  <article className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
    <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">{label}</p>
    <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    <p className="mt-1 text-xs text-slate-500">{detail}</p>
  </article>
);

const SectionShell = ({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) => (
  <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
    <div className="mb-3">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
    {children}
  </section>
);

const statusBadgeClassName = (status: "delivered" | "failed" | "ignored"): string => {
  switch (status) {
    case "delivered":
      return "bg-emerald-100 text-emerald-700";
    case "failed":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
};

const describeHookTarget = (target: Record<string, unknown> | undefined, systemId: string): string => {
  if (!target) {
    return systemId;
  }
  const chatId = typeof target.chatId === "string" ? target.chatId : null;
  if (chatId) {
    return `chat ${chatId}`;
  }
  const terminalId = typeof target.terminalId === "string" ? target.terminalId : null;
  if (terminalId) {
    return `terminal ${terminalId}`;
  }
  const subjectId = typeof target.subjectId === "string" ? target.subjectId : null;
  if (subjectId) {
    return `${systemId} ${subjectId}`;
  }
  return systemId;
};

const formatScoreKey = (value: string): string => {
  if (value.length <= 14) {
    return value;
  }
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
};

const sortScores = (scores: Record<string, number>): Array<{ key: string; score: number }> =>
  Object.entries(scores)
    .map(([key, score]) => ({ key, score }))
    .sort((left, right) => {
      const leftActive = left.score > 0;
      const rightActive = right.score > 0;
      if (leftActive !== rightActive) {
        return leftActive ? -1 : 1;
      }
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      return left.key.localeCompare(right.key);
    });

const ScoreBadgeList = ({
  scores,
  emptyLabel,
}: {
  scores: Record<string, number>;
  emptyLabel?: string;
}) => {
  const entries = sortScores(scores);
  if (entries.length === 0) {
    return emptyLabel ? <p className="text-sm text-slate-500">{emptyLabel}</p> : null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map((entry) => (
        <span
          key={entry.key}
          className={
            entry.score > 0
              ? "inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700"
              : "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
          }
          title={entry.key}
        >
          <span className="font-medium">{formatScoreKey(entry.key)}</span>
          <span>{entry.score}</span>
        </span>
      ))}
    </div>
  );
};

const buildCommitKey = (contextId: string, commitId: string): string => `${contextId}:${commitId}`;

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
              <span className="tracking-[0.12em] text-slate-500 uppercase">{attachment.kind}</span>
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
};

const ContextCard = ({
  context,
  onOpenAttentionRef,
}: {
  context: ResolvedAttentionContextView;
  onOpenAttentionRef?: (selection: AttentionSelectionState) => void;
}) => {
  const headCommitId = context.context?.headCommitId ?? null;
  const clickable = Boolean(onOpenAttentionRef && headCommitId);
  const content = (
    <>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-900">{context.title}</div>
        <div className="mt-0.5 text-[11px] text-slate-500">
          {context.contextId}
          {context.owner ? ` · ${context.owner}` : ""}
        </div>
        {context.detail ? <div className="mt-1 line-clamp-3 text-xs text-slate-600">{context.detail}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-[11px] text-slate-500">
        {context.scoreSummary ? <span>{context.scoreSummary}</span> : null}
        {clickable ? <ExternalLink className="h-3.5 w-3.5" /> : null}
      </div>
    </>
  );

  return clickable ? (
    <button
      type="button"
      onClick={() => onOpenAttentionRef?.({ contextId: context.contextId, itemId: headCommitId })}
      className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:border-slate-300"
    >
      {content}
    </button>
  ) : (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
      {content}
    </div>
  );
};

const readHookOutputMessageId = (hook: AttentionHookView): string | null => {
  const output = hook.output;
  if (!output || typeof output !== "object") {
    return null;
  }
  const messageId = (output as Record<string, unknown>).messageId;
  return typeof messageId === "string" && messageId.length > 0 ? messageId : null;
};

const HookOutcomeBadgeRow = ({ hooks }: { hooks: AttentionHookView[] }) => {
  if (hooks.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {hooks.map((hook) => (
        <span
          key={hook.id}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${statusBadgeClassName(hook.status)}`}
          title={`${hook.systemId} · ${describeHookTarget(hook.target, hook.systemId)}`}
        >
          <span className="font-medium">{hook.systemId}</span>
          <span>{hook.status}</span>
        </span>
      ))}
    </div>
  );
};

const ProducedCommitCard = ({
  commit,
  hooks,
  onOpenAttentionRef,
}: {
  commit: ResolvedAttentionCommitView;
  hooks: AttentionHookView[];
  onOpenAttentionRef?: (selection: AttentionSelectionState) => void;
}) => {
  const clickable = Boolean(onOpenAttentionRef);
  const header = (
    <>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-900">{commit.title}</div>
        <div className="mt-0.5 text-[11px] text-slate-500">
          {commit.contextId}
          {commit.owner ? ` · ${commit.owner}` : ""}
          {commit.commit ? ` · ${commit.commit.change.type}` : ""}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-[11px] text-slate-500">
        {commit.scoreSummary ? <span>{commit.scoreSummary}</span> : null}
        {clickable ? <ExternalLink className="h-3.5 w-3.5" /> : null}
      </div>
    </>
  );

  return (
    <article className="rounded-xl border border-slate-200 bg-white px-3 py-3">
      {clickable ? (
        <button
          type="button"
          onClick={() => onOpenAttentionRef?.({ contextId: commit.contextId, itemId: commit.commitId })}
          className="flex w-full items-start justify-between gap-3 text-left hover:text-slate-950"
        >
          {header}
        </button>
      ) : (
        <div className="flex items-start justify-between gap-3">{header}</div>
      )}

      {commit.commit ? (
        <div className="mt-3 space-y-3">
          <div>
            <div className="mb-1 text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">Scores</div>
            <ScoreBadgeList scores={commit.commit.scores} emptyLabel="No score mutations on this commit." />
          </div>
          {commit.detail ? (
            <div>
              <div className="mb-1 text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">Change</div>
              <pre className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[color-mix(in_srgb,currentColor,transparent)] typo-code max-h-48 overflow-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-5 whitespace-pre-wrap text-slate-700">
                {commit.detail}
              </pre>
            </div>
          ) : null}
          <div>
            <div className="mb-1 text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">Hooks</div>
            {hooks.length > 0 ? <HookOutcomeBadgeRow hooks={hooks} /> : <p className="text-sm text-slate-500">No hook outcomes were attached to this commit.</p>}
          </div>
        </div>
      ) : null}
    </article>
  );
};

const collectRemainingScores = (bucket: CycleContextBucketView): Record<string, number> => {
  const merged: Record<string, number> = {};
  for (const context of bucket.activeContexts) {
    const scoreMap = context.context?.scoreMap ?? {};
    for (const [key, score] of Object.entries(scoreMap)) {
      if (score > 0) {
        merged[key] = Math.max(merged[key] ?? 0, score);
      }
    }
  }
  return merged;
};

const ContextBucketCard = ({
  bucket,
  hooksByCommitKey,
  onOpenAttentionRef,
}: {
  bucket: CycleContextBucketView;
  hooksByCommitKey: Map<string, AttentionHookView[]>;
  onOpenAttentionRef?: (selection: AttentionSelectionState) => void;
}) => {
  const newest = bucket.producedCommits[0]?.title ?? bucket.activeContexts[0]?.title ?? bucket.inputContexts[0]?.title;
  const remainingScores = collectRemainingScores(bucket);

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-900">{bucket.contextId}</span>
        {bucket.owner ? <Badge variant="secondary">{bucket.owner}</Badge> : null}
        {bucket.producedCommits.length > 0 ? (
          <Badge className="bg-emerald-100 text-emerald-700">{bucket.producedCommits.length} commits</Badge>
        ) : null}
        {bucket.activeContexts.length > 0 ? (
          <Badge className="bg-amber-100 text-amber-700">{bucket.activeContexts.length} active</Badge>
        ) : null}
        {bucket.inputContexts.length > 0 ? <Badge variant="secondary">{bucket.inputContexts.length} input</Badge> : null}
      </div>
      {newest ? <p className="mt-2 text-sm text-slate-700">{newest}</p> : null}
      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">Input</p>
          <div className="mt-2 space-y-2">
            {bucket.inputContexts.length > 0 ? (
              bucket.inputContexts.map((context) => (
                <ContextCard
                  key={`${bucket.contextId}:input:${context.key}`}
                  context={context}
                  onOpenAttentionRef={onOpenAttentionRef}
                />
              ))
            ) : (
              <p className="text-sm text-slate-500">No input contexts.</p>
            )}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">Produced commits</p>
          <div className="mt-2 space-y-2">
            {bucket.producedCommits.length > 0 ? (
              bucket.producedCommits.map((commit) => (
                <ProducedCommitCard
                  key={`${bucket.contextId}:commit:${commit.key}`}
                  commit={commit}
                  hooks={hooksByCommitKey.get(buildCommitKey(commit.contextId, commit.commitId)) ?? []}
                  onOpenAttentionRef={onOpenAttentionRef}
                />
              ))
            ) : (
              <p className="text-sm text-slate-500">No commits produced.</p>
            )}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">Remaining debt</p>
          <div className="mt-2 space-y-2">
            {bucket.activeContexts.length > 0 ? (
              <>
                {bucket.activeContexts.map((context) => (
                  <ContextCard
                    key={`${bucket.contextId}:active:${context.key}`}
                    context={context}
                    onOpenAttentionRef={onOpenAttentionRef}
                  />
                ))}
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                  <div className="mb-2 text-[11px] font-semibold tracking-[0.18em] text-amber-700 uppercase">
                    Remaining scores
                  </div>
                  <ScoreBadgeList scores={remainingScores} emptyLabel="No positive scores remain in this context." />
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">Resolved in this context.</p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

const DeliveredMessageCard = ({ message }: { message: RuntimeChatMessage }) => (
  <article className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
    <div className="mb-2 inline-flex items-center gap-2 text-xs text-slate-500">
      <MessageSquareText className="h-3.5 w-3.5" />
      {roleLabel(message)}
    </div>
    <MarkdownDocument
      value={message.content}
      mode="preview"
      usage="chat"
      surface="muted"
      syntaxTone="accented"
      density="compact"
      padding="compact"
    />
  </article>
);

const HookOutcomeCard = ({
  hook,
  deliveredMessage,
}: {
  hook: AttentionHookView;
  deliveredMessage: RuntimeChatMessage | null;
}) => {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={statusBadgeClassName(hook.status)}>{hook.status}</Badge>
        <Badge variant="secondary">{hook.systemId}</Badge>
        <span className="text-xs text-slate-500">{describeHookTarget(hook.target, hook.systemId)}</span>
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,0.8fr)]">
        <div className="space-y-3">
          {deliveredMessage ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
              <div className="mb-2 inline-flex items-center gap-2 text-xs font-medium text-emerald-700">
                <MessageSquareText className="h-3.5 w-3.5" />
                Visible delivery
              </div>
              <p className="text-sm text-emerald-900">{deliveredMessage.content}</p>
            </div>
          ) : null}
          <JSONViewer value={{ target: hook.target ?? null, output: hook.output ?? null, error: hook.error ?? null }} />
        </div>
        <JSONViewer
          value={{
            hookId: hook.hookId,
            systemId: hook.systemId,
            contextId: hook.contextId,
            commitId: hook.commitId,
            createdAt: hook.createdAt,
          }}
        />
      </div>
    </article>
  );
};

const ExecutionRecordCard = ({ record }: { record: CycleExecutionRecord }) => {
  if (record.kind === "tool-trace") {
    return (
      <article className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
        <AssistantMarkdown content="" toolTrace={record.toolTrace} />
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="mb-2 inline-flex items-center gap-2 text-xs text-slate-500">
        <Orbit className="h-3.5 w-3.5" />
        {roleLabel(record.message)}
      </div>
      <AssistantMarkdown
        content={record.message.content}
        channel={record.message.channel}
        tool={record.message.tool}
      />
    </article>
  );
};

export const CycleInspectorDetail = ({
  cycle,
  attention = EMPTY_RUNTIME_ATTENTION_STATE,
  modelCalls = [],
  traces = [],
  onOpenAttentionRef,
}: CycleInspectorDetailProps) => {
  const [activeTab, setActiveTab] = useState<CycleDetailTab>("overview");
  const detailModel = useMemo(
    () => buildCycleInspectorDetail({ cycle, attention, modelCalls, traces }),
    [attention, cycle, modelCalls, traces],
  );
  const userInputs = useMemo(() => toUserInputBlocks(cycle), [cycle]);
  const deliveredMessages = useMemo(() => collectDeliveredMessages(cycle), [cycle]);
  const deliveredMessageById = useMemo(() => {
    return new Map(deliveredMessages.map((message) => [message.id, message]));
  }, [deliveredMessages]);
  const executionRecords = useMemo(() => normalizeCycleExecutionRecords(cycle), [cycle]);
  const hooksByCommitKey = useMemo(() => {
    const next = new Map<string, AttentionHookView[]>();
    for (const hook of detailModel.detail.hooks) {
      const commitKey = buildCommitKey(hook.contextId, hook.commitId);
      const items = next.get(commitKey) ?? [];
      items.push(hook);
      next.set(commitKey, items);
    }
    return next;
  }, [detailModel.detail.hooks]);

  const tabItems = [
    { id: "overview", label: "Overview" },
    { id: "contexts", label: `Contexts ${detailModel.contextBuckets.length}` },
    { id: "commits", label: `Commits ${detailModel.detail.producedCommits.length}` },
    {
      id: "effects",
      label: `Effects ${detailModel.detail.hooks.length + deliveredMessages.length}`,
    },
    {
      id: "evidence",
      label: `Evidence ${executionRecords.length + detailModel.detail.traces.length + detailModel.detail.modelCalls.length}`,
    },
  ] as const;

  return (
    <section className="grid h-full grid-rows-[auto_auto_minmax(0,1fr)] rounded-2xl border border-slate-200 bg-white">
      <header className="border-b border-slate-200 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-sm text-slate-700">
            {statusIcon(cycle)}
            <span>{formatCycleTitle(cycle)}</span>
          </div>
          <Badge variant="secondary">{cycle.kind}</Badge>
          {detailModel.detail.frame?.wakeSource ? (
            <Badge variant="secondary">wake {detailModel.detail.frame.wakeSource}</Badge>
          ) : null}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <MetricCard
            label="Contexts"
            value={String(detailModel.metrics.contextCount)}
            detail="Contexts touched or kept active in this pass."
          />
          <MetricCard
            label="Commits"
            value={String(detailModel.detail.producedCommits.length)}
            detail="New attention commits written by this cycle."
          />
          <MetricCard
            label="Delivered"
            value={String(detailModel.metrics.deliveredCount)}
            detail="Hooks that produced visible external effects."
          />
          <MetricCard
            label="Remaining"
            value={String(detailModel.metrics.remainingActiveCount)}
            detail="Contexts that still carry unresolved score debt."
          />
        </div>
      </header>

      <div className="border-b border-slate-200 px-4 py-3">
        <Tabs
          items={tabItems.map((item) => ({ ...item }))}
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as CycleDetailTab)}
          ariaLabel="Cycle detail tabs"
        />
      </div>

      <div className="min-h-0 overflow-auto px-4 py-4">
        <div className="space-y-4">
          {activeTab === "overview" ? (
            <>
              <SectionShell
                title="Cycle story"
                subtitle="A cycle is one attention-reduction pass: it wakes, inspects attention debt, commits mutations, and optionally emits effects."
              >
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                  <article className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">Narrative</div>
                    <h5 className="mt-2 text-base font-semibold text-slate-900">{detailModel.summary.headline}</h5>
                    <p className="mt-2 text-sm text-slate-600">{detailModel.summary.detail}</p>
                    {cycle.streaming?.content.trim().length ? (
                      <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50 px-3 py-3">
                        <div className="mb-1 text-[11px] font-semibold tracking-[0.18em] text-teal-700 uppercase">
                          Streaming draft
                        </div>
                        <p className="text-sm text-teal-900">{cycle.streaming.content}</p>
                      </div>
                    ) : null}
                  </article>
                  <article className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">At a glance</div>
                    <div className="mt-2 space-y-2 text-sm text-slate-700">
                      <p>Wake source: {detailModel.metrics.wakeSource}</p>
                      <p>Produced commits: {detailModel.detail.producedCommits.length}</p>
                      <p>Hook outcomes: {detailModel.detail.hooks.length}</p>
                      <p>Model calls: {detailModel.detail.modelCalls.length}</p>
                    </div>
                  </article>
                </div>
              </SectionShell>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <SectionShell
                  title="External stimuli"
                  subtitle="These are the user-facing inputs that directly contributed to this cycle."
                >
                  {userInputs.length > 0 ? (
                    <div className="space-y-3">{userInputs.map(renderUserInputBlock)}</div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No direct user message entered this pass. The loop likely reactivated because attention debt remained.
                    </p>
                  )}
                </SectionShell>

                <SectionShell
                  title="Visible outcomes"
                  subtitle="Only externally visible effects belong here, such as chat replies."
                >
                  {deliveredMessages.length > 0 ? (
                    <div className="space-y-3">
                      {deliveredMessages.map((message) => (
                        <DeliveredMessageCard key={message.id} message={message} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">This cycle has not emitted any visible assistant message yet.</p>
                  )}
                </SectionShell>
              </div>
            </>
          ) : null}

          {activeTab === "contexts" ? (
            <SectionShell
              title="Context movement"
              subtitle="Why the loop woke, which contexts it inspected, which commits it wrote, and what debt still remained."
            >
              <div className="space-y-3">
                {detailModel.contextBuckets.length > 0 ? (
                  detailModel.contextBuckets.map((bucket) => (
                    <ContextBucketCard
                      key={bucket.key}
                      bucket={bucket}
                      hooksByCommitKey={hooksByCommitKey}
                      onOpenAttentionRef={onOpenAttentionRef}
                    />
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No attention-linked contexts were recorded for this cycle.</p>
                )}
              </div>
            </SectionShell>
          ) : null}

          {activeTab === "commits" ? (
            <SectionShell
              title="Produced commits"
              subtitle="Commits are the immutable mutations from which context state is derived. Hook outcomes stay attached to the commit that triggered them."
            >
              {detailModel.detail.producedCommits.length > 0 ? (
                <div className="space-y-3">
                  {detailModel.detail.producedCommits.map((commit) => (
                    <ProducedCommitCard
                      key={commit.key}
                      commit={commit}
                      hooks={hooksByCommitKey.get(buildCommitKey(commit.contextId, commit.commitId)) ?? []}
                      onOpenAttentionRef={onOpenAttentionRef}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">This cycle did not emit any new attention commits.</p>
              )}
            </SectionShell>
          ) : null}

          {activeTab === "effects" ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <SectionShell
                title="Hook outcomes"
                subtitle="Hooks are the only path by which the kernel turns commits into external effects."
              >
                {detailModel.detail.hooks.length > 0 ? (
                  <div className="space-y-3">
                    {detailModel.detail.hooks.map((hook) => (
                      <HookOutcomeCard
                        key={hook.id}
                        hook={hook}
                        deliveredMessage={(() => {
                          const messageId = readHookOutputMessageId(hook);
                          return messageId ? (deliveredMessageById.get(messageId) ?? null) : null;
                        })()}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No hook outcomes were recorded for this cycle.</p>
                )}
              </SectionShell>

              <SectionShell
                title="Delivered messages"
                subtitle="These are the user-visible chat messages associated with this cycle."
              >
                {deliveredMessages.length > 0 ? (
                  <div className="space-y-3">
                    {deliveredMessages.map((message) => (
                      <DeliveredMessageCard key={message.id} message={message} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No assistant messages were delivered for this cycle.</p>
                )}
              </SectionShell>
            </div>
          ) : null}

          {activeTab === "evidence" ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <SectionShell
                title="Execution feed"
                subtitle="Merged tool traces and internal runtime messages provide the shortest technical proof of what the model attempted in this cycle."
              >
                {executionRecords.length > 0 ? (
                  <div className="space-y-3">
                    {executionRecords.map((record) => (
                      <ExecutionRecordCard key={record.key} record={record} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No internal execution records were captured for this cycle.</p>
                )}
              </SectionShell>

              <SectionShell title="Model calls" subtitle="Provider calls attached to this cycle.">
                {detailModel.detail.modelCalls.length > 0 ? (
                  <div className="space-y-3">
                    {detailModel.detail.modelCalls.map((call) => (
                      <article key={call.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">#{call.id}</Badge>
                          <Badge variant="secondary">{call.provider}</Badge>
                          <Badge variant="secondary">{call.model}</Badge>
                          <span className="text-xs text-slate-500">{call.outcome?.code ?? call.status}</span>
                        </div>
                        <JSONViewer value={call} />
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No model calls were recorded for this cycle.</p>
                )}
              </SectionShell>

              <SectionShell title="Traces" subtitle="Runtime spans and causal evidence linked to this cycle.">
                {detailModel.detail.traces.length > 0 ? (
                  <div className="space-y-3">
                    {detailModel.detail.traces.map((trace) => (
                      <article key={trace.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{trace.kind}</Badge>
                          <Badge variant="secondary">{trace.status}</Badge>
                          <span className="text-xs text-slate-500">{trace.name}</span>
                        </div>
                        <JSONViewer value={trace} />
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No runtime traces were recorded for this cycle.</p>
                )}
              </SectionShell>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};
