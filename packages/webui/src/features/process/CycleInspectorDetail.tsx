import type {
  ModelCallDeltaItem,
  ModelCallItem,
  RuntimeAttentionState,
  RuntimeChatCycle,
  ObservabilityTraceItem as RuntimeTraceItem,
} from "@agenter/client-sdk";
import {
  Bot,
  CircleAlert,
  CircleCheckBig,
  GitCommitHorizontal,
  LoaderCircle,
  PanelRightOpen,
  Sparkles,
  UserRound,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";

import { MarkdownDocument } from "../../components/markdown/MarkdownDocument";
import { Badge } from "../../components/ui/badge";
import { Button, ButtonLabel, ButtonLeadingVisual } from "../../components/ui/button";
import { JSONViewer } from "../../components/ui/json-viewer";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { Sheet } from "../../components/ui/sheet";
import { Tabs } from "../../components/ui/tabs";
import { ToolInvocationCard } from "../../components/ui/tool-invocation-card";
import { cn } from "../../lib/utils";
import {
  EMPTY_RUNTIME_ATTENTION_STATE,
  type AttentionSelectionState,
} from "../attention/attention-view-model";
import { resolveChatMessagePresentation } from "../chat/chat-contract";
import { useCompactViewport } from "../shell/useCompactViewport";
import {
  buildCycleModelCallWorkbench,
  type ModelCallConversationRow,
} from "./cycle-modelcall-workbench";
import { buildCycleInspectorDetail, formatCycleTitle } from "./cycle-inspector-view-model";

interface CycleInspectorDetailProps {
  cycle: RuntimeChatCycle;
  attention?: RuntimeAttentionState;
  modelCalls?: ModelCallItem[];
  modelCallDeltas?: ModelCallDeltaItem[];
  traces?: RuntimeTraceItem[];
  onOpenAttentionRef?: (selection: AttentionSelectionState) => void;
}

type InspectorTab = "config" | "attention" | "stats";

const statusIcon = (cycle: RuntimeChatCycle) => {
  if (cycle.status === "error") {
    return <CircleAlert className="h-4 w-4 text-rose-600" />;
  }
  if (cycle.status === "streaming" || cycle.status === "collecting" || cycle.status === "applying") {
    return <LoaderCircle className="h-4 w-4 animate-spin text-teal-700" />;
  }
  return <CircleCheckBig className="h-4 w-4 text-emerald-600" />;
};

const formatTime = (value: number): string =>
  new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const sourceLabel = (source: ModelCallConversationRow["source"]): string => {
  if (source === "request") {
    return "request";
  }
  if (source === "delta") {
    return "stream";
  }
  return "runtime";
};

const ConversationMessageRow = ({ row }: { row: Extract<ModelCallConversationRow, { kind: "user" | "assistant" }> }) => {
  const align = row.kind === "user" ? "end" : "start";
  const presentation = resolveChatMessagePresentation({
    role: row.kind,
    channel: row.kind === "assistant" ? "to_user" : undefined,
  });
  const leading = row.kind === "user" ? <UserRound className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />;

  return (
    <div className={cn("flex", align === "end" ? "justify-end" : "justify-start")} data-chat-align={align}>
      <article
        className={cn(
          "max-w-[min(100%,44rem)] rounded-2xl px-3 py-3",
          presentation.bubbleClassName,
        )}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] opacity-85">
          <span className="inline-flex items-center gap-1 font-medium">
            {leading}
            {row.kind === "user" ? "User" : "Assistant"}
          </span>
          <span>{formatTime(row.timestamp)}</span>
          <Badge variant="secondary" className="bg-white/20 text-current">
            {sourceLabel(row.source)}
          </Badge>
        </div>
        <MarkdownDocument
          value={row.content}
          mode="preview"
          usage="chat"
          surface={presentation.markdownSurface}
          syntaxTone={presentation.syntaxTone}
          density="compact"
          padding="none"
          className="text-[13px]"
        />
      </article>
    </div>
  );
};

const ConversationToolRow = ({ row }: { row: Extract<ModelCallConversationRow, { kind: "tool" }> }) => {
  return (
    <div className="flex justify-start" data-chat-align="start">
      <article className="max-w-[min(100%,44rem)] rounded-2xl border border-slate-200 bg-white px-3 py-3">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
            <Wrench className="h-3.5 w-3.5" />
            Tool
          </span>
          <span>{formatTime(row.timestamp)}</span>
          <Badge variant="secondary">{sourceLabel(row.source)}</Badge>
        </div>
        <ToolInvocationCard invocation={row.invocation} className="bg-white" />
      </article>
    </div>
  );
};

const AttentionRefCard = ({
  label,
  subtitle,
  contextId,
  itemId,
  onOpenAttentionRef,
}: {
  label: string;
  subtitle: string;
  contextId: string;
  itemId: string | null;
  onOpenAttentionRef?: (selection: AttentionSelectionState) => void;
}) => {
  const clickable = Boolean(onOpenAttentionRef && itemId);

  if (!clickable || !itemId) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpenAttentionRef?.({ contextId, itemId })}
      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-slate-300"
    >
      <p className="text-sm font-medium text-slate-900">{label}</p>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </button>
  );
};

const InspectorTabsPanel = ({
  tab,
  onTabChange,
  workbench,
  detailModel,
  traces,
  onOpenAttentionRef,
}: {
  tab: InspectorTab;
  onTabChange: (next: InspectorTab) => void;
  workbench: ReturnType<typeof buildCycleModelCallWorkbench>;
  detailModel: ReturnType<typeof buildCycleInspectorDetail>;
  traces: RuntimeTraceItem[];
  onOpenAttentionRef?: (selection: AttentionSelectionState) => void;
}) => {
  const deltaKinds = workbench.deltas.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.kind] = (acc[entry.kind] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section className="grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-3 py-3">
        <Tabs
          items={[
            { id: "config", label: "Config" },
            { id: "attention", label: "Attention I/O" },
            { id: "stats", label: "Stats" },
          ]}
          value={tab}
          onValueChange={(value) => onTabChange(value as InspectorTab)}
          ariaLabel="Cycle inspector panel tabs"
        />
      </div>

      <ScrollViewport className="h-full px-3 py-3">
        <div className="space-y-3">
          {tab === "config" ? (
            <>
              <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <h4 className="text-sm font-semibold text-slate-900">Model call envelope</h4>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  <Badge variant="secondary">#{workbench.modelCall?.id ?? "-"}</Badge>
                  <Badge variant="secondary">{workbench.modelCall?.provider ?? "provider: n/a"}</Badge>
                  <Badge variant="secondary">{workbench.modelCall?.model ?? "model: n/a"}</Badge>
                  <Badge variant="secondary">{workbench.modelCall?.status ?? "status: n/a"}</Badge>
                </div>
                <div className="mt-3 space-y-2 text-xs text-slate-600">
                  <p>request messages: {workbench.conversation.filter((row) => row.source === "request").length}</p>
                  <p>tools declared: {workbench.config.tools.length}</p>
                  <p>stream deltas: {workbench.deltas.length}</p>
                </div>
              </article>

              <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <h4 className="text-sm font-semibold text-slate-900">System prompt</h4>
                <div className="mt-2">
                  <MarkdownDocument
                    value={
                      workbench.config.systemPrompt.length > 0
                        ? workbench.config.systemPrompt
                        : "_No system prompt was captured for this call._"
                    }
                    mode="preview"
                    usage="inspector"
                    surface="muted"
                    syntaxTone="accented"
                  />
                </div>
              </article>

              <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <h4 className="text-sm font-semibold text-slate-900">Tools config</h4>
                <div className="mt-2">
                  <JSONViewer value={workbench.config.tools} />
                </div>
              </article>

              <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <h4 className="text-sm font-semibold text-slate-900">Request / response</h4>
                <div className="mt-2 space-y-3">
                  <JSONViewer value={{ request: workbench.config.request, requestMeta: workbench.config.requestMeta }} />
                  <JSONViewer value={{ response: workbench.config.response, error: workbench.config.error }} />
                </div>
              </article>
            </>
          ) : null}

          {tab === "attention" ? (
            <>
              <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <h4 className="text-sm font-semibold text-slate-900">Input contexts</h4>
                <div className="mt-2 space-y-2">
                  {detailModel.detail.inputContexts.length > 0 ? (
                    detailModel.detail.inputContexts.map((context) => (
                      <AttentionRefCard
                        key={context.key}
                        label={context.title}
                        subtitle={`${context.contextId}${context.scoreSummary ? ` · ${context.scoreSummary}` : ""}`}
                        contextId={context.contextId}
                        itemId={context.context?.headCommitId ?? null}
                        onOpenAttentionRef={onOpenAttentionRef}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No attention input contexts were captured.</p>
                  )}
                </div>
              </article>

              <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <h4 className="text-sm font-semibold text-slate-900">Output commits</h4>
                <div className="mt-2 space-y-2">
                  {detailModel.detail.producedCommits.length > 0 ? (
                    detailModel.detail.producedCommits.map((commit) => (
                      <AttentionRefCard
                        key={commit.key}
                        label={commit.title}
                        subtitle={`${commit.contextId}${commit.scoreSummary ? ` · ${commit.scoreSummary}` : ""}`}
                        contextId={commit.contextId}
                        itemId={commit.commitId}
                        onOpenAttentionRef={onOpenAttentionRef}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No commits were produced in this cycle.</p>
                  )}
                </div>
              </article>

              <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <h4 className="text-sm font-semibold text-slate-900">Hook outcomes</h4>
                <div className="mt-2 space-y-2">
                  {detailModel.detail.hooks.length > 0 ? (
                    detailModel.detail.hooks.map((hook) => (
                      <div key={hook.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant="secondary">{hook.systemId}</Badge>
                          <Badge variant="secondary">{hook.status}</Badge>
                          <span className="text-slate-500">{hook.contextId}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No hook outcomes were recorded.</p>
                  )}
                </div>
              </article>
            </>
          ) : null}

          {tab === "stats" ? (
            <>
              <div className="grid gap-2">
                <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase">Conversation rows</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{workbench.conversation.length}</p>
                </article>
                <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase">Attention contexts</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{detailModel.metrics.contextCount}</p>
                </article>
                <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase">Remaining debt</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{detailModel.metrics.remainingActiveCount}</p>
                </article>
                <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase">Runtime traces</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{traces.length}</p>
                </article>
              </div>

              <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <h4 className="text-sm font-semibold text-slate-900">Delta distribution</h4>
                <div className="mt-2">
                  <JSONViewer value={deltaKinds} />
                </div>
              </article>

              <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <h4 className="text-sm font-semibold text-slate-900">Model call outcome</h4>
                <div className="mt-2">
                  <JSONViewer
                    value={{
                      outcome: workbench.modelCall?.outcome ?? null,
                      createdAt: workbench.modelCall?.createdAt ?? null,
                      completedAt: workbench.modelCall?.completedAt ?? null,
                      status: workbench.modelCall?.status ?? null,
                    }}
                  />
                </div>
              </article>
            </>
          ) : null}
        </div>
      </ScrollViewport>
    </section>
  );
};

export const CycleInspectorDetail = ({
  cycle,
  attention = EMPTY_RUNTIME_ATTENTION_STATE,
  modelCalls = [],
  modelCallDeltas = [],
  traces = [],
  onOpenAttentionRef,
}: CycleInspectorDetailProps) => {
  const compact = useCompactViewport();
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("config");
  const [inspectorSheetOpen, setInspectorSheetOpen] = useState(false);

  const detailModel = useMemo(
    () => buildCycleInspectorDetail({ cycle, attention, modelCalls, traces }),
    [attention, cycle, modelCalls, traces],
  );

  const workbench = useMemo(
    () =>
      buildCycleModelCallWorkbench({
        cycle,
        modelCalls,
        modelCallDeltas,
      }),
    [cycle, modelCallDeltas, modelCalls],
  );

  return (
    <section className="grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-2xl border border-slate-200 bg-white">
      <header className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-sm text-slate-700">
              {statusIcon(cycle)}
              <span>{formatCycleTitle(cycle)}</span>
            </div>
            <Badge variant="secondary">{cycle.kind}</Badge>
            <Badge variant="secondary">{detailModel.metrics.wakeSource}</Badge>
            <Badge variant="secondary">model #{workbench.modelCall?.id ?? "-"}</Badge>
          </div>

          {compact ? (
            <Button size="sm" variant="secondary" onClick={() => setInspectorSheetOpen(true)}>
              <ButtonLeadingVisual>
                <PanelRightOpen className="h-3.5 w-3.5" />
              </ButtonLeadingVisual>
              <ButtonLabel>Open Panel</ButtonLabel>
            </Button>
          ) : null}
        </div>
      </header>

      <div className={cn("grid h-full gap-3 p-3", compact ? "grid-cols-1" : "grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]")}>
        <section className="grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-2xl border border-slate-200 bg-slate-50">
          <div className="border-b border-slate-200 px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-slate-900">Model conversation</h4>
              <Badge variant="secondary">{workbench.conversation.length} rows</Badge>
              <Badge variant="secondary">{workbench.deltas.length} deltas</Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Conversation-first lens: inspect user/assistant/tool progression before drilling into configuration and attention internals.
            </p>
          </div>

          <ScrollViewport className="h-full px-3 py-3" data-testid="cycle-modelcall-conversation">
            <div className="space-y-3">
              {workbench.conversation.length > 0 ? (
                workbench.conversation.map((row) => {
                  if (row.kind === "tool") {
                    return <ConversationToolRow key={row.key} row={row} />;
                  }
                  return <ConversationMessageRow key={row.key} row={row} />;
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                  No model-call conversation rows captured yet for this cycle.
                </div>
              )}
            </div>
          </ScrollViewport>
        </section>

        {!compact ? (
          <InspectorTabsPanel
            tab={inspectorTab}
            onTabChange={setInspectorTab}
            workbench={workbench}
            detailModel={detailModel}
            traces={traces}
            onOpenAttentionRef={onOpenAttentionRef}
          />
        ) : null}
      </div>

      {compact ? (
        <Sheet open={inspectorSheetOpen} onOpenChange={setInspectorSheetOpen} side="right" title="Cycle Inspector Panel">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              Config / Attention I/O / Stats
            </span>
            <span className="inline-flex items-center gap-1">
              <GitCommitHorizontal className="h-3.5 w-3.5" />
              Cycle {cycle.cycleId ?? "pending"}
            </span>
          </div>
          <div className="h-full min-h-[42dvh]">
            <InspectorTabsPanel
              tab={inspectorTab}
              onTabChange={setInspectorTab}
              workbench={workbench}
              detailModel={detailModel}
              traces={traces}
              onOpenAttentionRef={onOpenAttentionRef}
            />
          </div>
        </Sheet>
      ) : null}
    </section>
  );
};
