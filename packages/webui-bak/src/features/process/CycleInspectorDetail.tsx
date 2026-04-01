import type {
  ModelCallDeltaItem,
  ModelCallItem,
  RuntimeAttentionState,
  RuntimeChatCycle,
  ObservabilityTraceItem as RuntimeTraceItem,
} from "@agenter/client-sdk";
import { CircleAlert, CircleCheckBig, LoaderCircle, PanelRightOpen } from "lucide-react";
import { useMemo, useState } from "react";

import { MarkdownDocument } from "../../components/markdown/MarkdownDocument";
import { Badge } from "../../components/ui/badge";
import { Button, ButtonLabel, ButtonLeadingVisual } from "../../components/ui/button";
import { HelpHint } from "../../components/ui/help-hint";
import { JSONViewer } from "../../components/ui/json-viewer";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { Sheet } from "../../components/ui/sheet";
import { Tabs } from "../../components/ui/tabs";
import { cn } from "../../lib/utils";
import { EMPTY_RUNTIME_ATTENTION_STATE, type AttentionSelectionState } from "../attention/attention-view-model";
import { useCompactViewport } from "../shell/useCompactViewport";
import { buildCycleInspectorDetail, formatCycleTitle } from "./cycle-inspector-view-model";
import { buildCycleModelCallWorkbench } from "./cycle-modelcall-workbench";
import { CycleModelCallTranscript } from "./CycleModelCallTranscript";

interface CycleInspectorDetailProps {
  cycle: RuntimeChatCycle;
  attention?: RuntimeAttentionState;
  modelCalls?: ModelCallItem[];
  modelCallDeltas?: ModelCallDeltaItem[];
  traces?: RuntimeTraceItem[];
  onOpenAttentionRef?: (selection: AttentionSelectionState) => void;
}

type InspectorTab = "config" | "attention";

const statusIcon = (cycle: RuntimeChatCycle) => {
  if (cycle.status === "error") {
    return <CircleAlert className="h-4 w-4 text-rose-600" />;
  }
  if (cycle.status === "streaming" || cycle.status === "collecting" || cycle.status === "applying") {
    return <LoaderCircle className="h-4 w-4 animate-spin text-teal-700" />;
  }
  return <CircleCheckBig className="h-4 w-4 text-emerald-600" />;
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
    <Button
      type="button"
      variant="outline"
      onClick={() => onOpenAttentionRef?.({ contextId, itemId })}
      className="h-auto w-full items-start justify-start rounded-xl border-slate-200 bg-slate-50 px-3 py-2 text-left whitespace-normal shadow-none transition hover:border-slate-300 hover:bg-white"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
    </Button>
  );
};

const InspectorTabsPanel = ({
  cycle,
  tab,
  onTabChange,
  workbench,
  detailModel,
  onOpenAttentionRef,
}: {
  cycle: RuntimeChatCycle;
  tab: InspectorTab;
  onTabChange: (next: InspectorTab) => void;
  workbench: ReturnType<typeof buildCycleModelCallWorkbench>;
  detailModel: ReturnType<typeof buildCycleInspectorDetail>;
  onOpenAttentionRef?: (selection: AttentionSelectionState) => void;
}) => {
  return (
    <section className="grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-3 py-3">
        <Tabs
          items={[
            { id: "config", label: "Config" },
            { id: "attention", label: "Attention I/O" },
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
                <h4 className="text-sm font-semibold text-slate-900">Model call</h4>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  <Badge variant="secondary">#{workbench.modelCall?.id ?? "-"}</Badge>
                  <Badge variant="secondary">{cycle.kind}</Badge>
                  {detailModel.metrics.compactTrigger ? (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                      compact:{detailModel.metrics.compactTrigger}
                    </Badge>
                  ) : null}
                  <Badge variant="secondary">{workbench.modelCall?.provider ?? "provider: n/a"}</Badge>
                  <Badge variant="secondary">{workbench.modelCall?.model ?? "model: n/a"}</Badge>
                  <Badge variant="secondary">{workbench.modelCall?.status ?? "status: n/a"}</Badge>
                </div>
              </article>

              <article className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <h4 className="text-sm font-semibold text-slate-900">Cycle facts</h4>
                <div className="mt-2">
                  <JSONViewer
                    value={{
                      kind: cycle.kind,
                      wakeSource: detailModel.metrics.wakeSource,
                      protocolMode: detailModel.metrics.protocolMode,
                      inputContexts: detailModel.detail.inputContexts.length,
                      inputCommits: detailModel.metrics.inputCommitCount,
                      producedCommits: detailModel.detail.producedCommits.length,
                      activeContexts: detailModel.metrics.remainingActiveCount,
                      deliveredHooks: detailModel.metrics.deliveredCount,
                      failedHooks: detailModel.metrics.failedCount,
                      compactTrigger: detailModel.metrics.compactTrigger,
                    }}
                  />
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
                <h4 className="text-sm font-semibold text-slate-900">Payload</h4>
                <div className="mt-2">
                  <JSONViewer
                    value={{
                      request: workbench.config.request,
                      requestMeta: workbench.config.requestMeta,
                      tools: workbench.config.tools,
                      response: workbench.config.response,
                      error: workbench.config.error,
                      outcome: workbench.modelCall?.outcome ?? null,
                    }}
                  />
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
                <h4 className="text-sm font-semibold text-slate-900">Input commits</h4>
                <div className="mt-2 space-y-2">
                  {detailModel.detail.inputCommits.length > 0 ? (
                    detailModel.detail.inputCommits.map((commit) => (
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
                    <p className="text-sm text-slate-500">No input commits were captured for this cycle.</p>
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

  const detailColumnsClassName = compact
    ? "grid-cols-1"
    : "grid-cols-[minmax(16rem,0.82fr)_minmax(20rem,1.18fr)] @[72rem]:grid-cols-[minmax(18rem,0.9fr)_minmax(22rem,1.1fr)] @[88rem]:grid-cols-[minmax(22rem,0.98fr)_minmax(24rem,1.02fr)] @[104rem]:grid-cols-[minmax(25rem,1.06fr)_minmax(24rem,0.94fr)]";

  return (
    <section className="@container grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-2xl border border-slate-200 bg-white">
      <header className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-sm text-slate-700">
              {statusIcon(cycle)}
              <span>{formatCycleTitle(cycle)}</span>
            </div>
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

      <div
        className={cn("grid h-full grid-rows-[minmax(0,1fr)] gap-3 p-3", detailColumnsClassName)}
        data-cycle-detail-split-mode={compact ? "compact" : "expanded"}
      >
        <section
          data-testid="cycle-modelcall-pane"
          className="grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-2xl border border-slate-200 bg-slate-50"
        >
          <div className="border-b border-slate-200 px-3 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <h4 className="truncate text-sm font-semibold text-slate-900">Model conversation</h4>
              <HelpHint
                helpId="cycle-inspector:model-conversation"
                textContext="Objective timeline from ModelCall request and response."
                content="Objective timeline from ModelCall request and response."
              />
            </div>
          </div>

          <CycleModelCallTranscript
            rows={workbench.transcript}
            emptyMessage="No model-call messages captured for this cycle."
          />
        </section>

        {!compact ? (
          <InspectorTabsPanel
            cycle={cycle}
            tab={inspectorTab}
            onTabChange={setInspectorTab}
            workbench={workbench}
            detailModel={detailModel}
            onOpenAttentionRef={onOpenAttentionRef}
          />
        ) : null}
      </div>

      {compact ? (
        <Sheet
          open={inspectorSheetOpen}
          onOpenChange={setInspectorSheetOpen}
          side="right"
          title="Cycle Inspector Panel"
        >
          <div className="h-full min-h-[42dvh]">
            <InspectorTabsPanel
              cycle={cycle}
              tab={inspectorTab}
              onTabChange={setInspectorTab}
              workbench={workbench}
              detailModel={detailModel}
              onOpenAttentionRef={onOpenAttentionRef}
            />
          </div>
        </Sheet>
      ) : null}
    </section>
  );
};
