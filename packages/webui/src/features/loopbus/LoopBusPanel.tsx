import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Cpu,
  Database,
  LoaderCircle,
  TriangleAlert,
  Workflow,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../components/ui/accordion";
import { Badge, BadgeLabel, BadgeLeadingVisual } from "../../components/ui/badge";
import {
  InlineAffordance,
  InlineAffordanceLabel,
  InlineAffordanceLeadingVisual,
  InlineAffordanceMeta,
} from "../../components/ui/inline-affordance";
import { Tabs } from "../../components/ui/tabs";
import { cn } from "../../lib/utils";

interface LoopBusStateLogItem {
  id: number;
  timestamp: number;
  stateVersion: number;
  event: string;
  prevHash: string | null;
  stateHash: string;
  patch: Array<{ op: "add" | "replace" | "remove"; path: string; value?: unknown }>;
}

interface LoopBusTraceItem {
  id: number;
  cycleId: number;
  seq: number;
  step: string;
  status: "ok" | "error" | "running";
  startedAt: number;
  endedAt: number;
  detail: Record<string, unknown>;
}

interface ModelCallItem {
  id: number;
  cycleId: number;
  createdAt: number;
  provider: string;
  model: string;
  request: unknown;
  response?: unknown;
  error?: unknown;
}

interface ApiCallItem {
  id: number;
  modelCallId: number;
  createdAt: number;
  request: unknown;
  response?: unknown;
  error?: unknown;
}

interface LoopBusKernelState {
  schemaVersion: 1;
  stateVersion: number;
  running: boolean;
  paused: boolean;
  phase: string;
  gate: "open" | "waiting_input";
  queueSize: number;
  cycle: number;
  sentBatches: number;
  updatedAt: number;
  lastMessageAt: number | null;
  lastResponseAt: number | null;
  lastWakeAt: number | null;
  lastWakeSource: string | null;
  lastError: string | null;
}

type InputSignalMap = Record<"user" | "terminal" | "task" | "attention", { version: number; timestamp: number | null }>;

type LoopPhase =
  | "waiting_commits"
  | "collecting_inputs"
  | "persisting_cycle"
  | "calling_model"
  | "applying_outputs"
  | "stopped";

interface LoopBusPanelProps {
  stage: string;
  kernel: LoopBusKernelState | null;
  inputSignals: InputSignalMap;
  logs: LoopBusStateLogItem[];
  traces: LoopBusTraceItem[];
  modelCalls: ModelCallItem[];
  apiCalls: ApiCallItem[];
  apiRecording: { enabled: boolean; refCount: number };
  hasMoreTrace?: boolean;
  hasMoreModel?: boolean;
  loadingTrace?: boolean;
  loadingModel?: boolean;
  onLoadMoreTrace?: () => void | Promise<void>;
  onLoadMoreModel?: () => void | Promise<void>;
}

interface FlowStep {
  id: string;
  phase: LoopPhase;
  step: string;
  title: string;
  subtitle: string;
  direction?: "right" | "left";
}

interface CycleDigest {
  cycleId: number;
  startedAt: number;
  endedAt: number;
  steps: string[];
  modelCalls: number;
  status: "ok" | "error" | "running";
}

const FLOW_ROWS: FlowStep[][] = [
  [
    { id: "race", phase: "waiting_commits", step: "1", title: "Race", subtitle: "wait inputs", direction: "right" },
    { id: "collect", phase: "collecting_inputs", step: "2", title: "Collect", subtitle: "facts + debounce" },
    { id: "persist", phase: "persisting_cycle", step: "3", title: "Persist", subtitle: "cycle ledger" },
  ],
  [
    {
      id: "apply",
      phase: "applying_outputs",
      step: "5",
      title: "Apply",
      subtitle: "dispatch outputs",
      direction: "left",
    },
    { id: "model", phase: "calling_model", step: "4", title: "Model", subtitle: "provider call", direction: "left" },
  ],
];

const TRACE_ROW_ESTIMATE = 72;
const MODEL_ROW_ESTIMATE = 76;
const OVERSCAN = 8;

const toTime = (value: number | null | undefined): string => {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleTimeString();
};

const toDuration = (start: number, end: number): string => `${Math.max(0, end - start)} ms`;

const toJson = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const normalizePhase = (phase?: string | null): LoopPhase => {
  if (!phase) {
    return "waiting_commits";
  }
  switch (phase) {
    case "waiting_commits":
    case "collecting_inputs":
    case "persisting_cycle":
    case "calling_model":
    case "applying_outputs":
    case "stopped":
      return phase;
    default:
      return "waiting_commits";
  }
};

const buildCycleDigests = (traces: LoopBusTraceItem[], modelCalls: ModelCallItem[]): CycleDigest[] => {
  const digests = new Map<number, CycleDigest>();
  for (const trace of traces) {
    const current = digests.get(trace.cycleId);
    if (current) {
      current.startedAt = Math.min(current.startedAt, trace.startedAt);
      current.endedAt = Math.max(current.endedAt, trace.endedAt);
      current.status = trace.status === "error" ? "error" : current.status === "error" ? current.status : trace.status;
      if (current.steps.at(-1) !== trace.step) {
        current.steps.push(trace.step);
      }
      continue;
    }
    digests.set(trace.cycleId, {
      cycleId: trace.cycleId,
      startedAt: trace.startedAt,
      endedAt: trace.endedAt,
      steps: [trace.step],
      modelCalls: 0,
      status: trace.status,
    });
  }
  for (const call of modelCalls) {
    const current = digests.get(call.cycleId);
    if (current) {
      current.modelCalls += 1;
      continue;
    }
    digests.set(call.cycleId, {
      cycleId: call.cycleId,
      startedAt: call.createdAt,
      endedAt: call.createdAt,
      steps: [],
      modelCalls: 1,
      status: call.error === undefined ? "ok" : "error",
    });
  }
  return [...digests.values()].sort((a, b) => b.cycleId - a.cycleId).slice(0, 6);
};

const StatusIcon = ({ status }: { status: "ok" | "error" | "running" }) => {
  if (status === "error") {
    return <TriangleAlert className="h-4 w-4 text-rose-600" />;
  }
  if (status === "running") {
    return <LoaderCircle className="h-4 w-4 animate-spin text-amber-600" />;
  }
  return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
};

const PanelHeader = ({
  label,
  count,
  hasMore,
  loading,
  onLoadMore,
}: {
  label: string;
  count: number;
  hasMore: boolean;
  loading: boolean;
  onLoadMore?: () => void | Promise<void>;
}) => {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-2 py-1.5">
      <span className="text-[11px] font-medium text-slate-700">
        {label} ({count})
      </span>
      <button
        type="button"
        disabled={!hasMore || loading || !onLoadMore}
        onClick={() => {
          void onLoadMore?.();
        }}
        className="rounded-md bg-white px-2 py-1 text-[11px] text-slate-600 shadow-xs ring-1 ring-slate-200 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Loading..." : "Load older"}
      </button>
    </div>
  );
};

export const LoopBusPanel = ({
  stage,
  kernel,
  inputSignals,
  logs,
  traces,
  modelCalls,
  apiCalls,
  apiRecording,
  hasMoreTrace = false,
  hasMoreModel = false,
  loadingTrace = false,
  loadingModel = false,
  onLoadMoreTrace,
  onLoadMoreModel,
}: LoopBusPanelProps) => {
  const [tab, setTab] = useState<"flow" | "trace" | "model">("flow");
  const activePhase = normalizePhase(kernel?.phase);
  const cycleDigests = useMemo(() => buildCycleDigests(traces, modelCalls), [modelCalls, traces]);

  const traceParentRef = useRef<HTMLDivElement | null>(null);
  const traceVirtualizer = useVirtualizer({
    count: traces.length,
    getScrollElement: () => traceParentRef.current,
    estimateSize: () => TRACE_ROW_ESTIMATE,
    overscan: OVERSCAN,
  });

  const modelParentRef = useRef<HTMLDivElement | null>(null);
  const modelVirtualizer = useVirtualizer({
    count: modelCalls.length,
    getScrollElement: () => modelParentRef.current,
    estimateSize: () => MODEL_ROW_ESTIMATE,
    overscan: OVERSCAN,
  });

  return (
    <section className="flex h-full flex-1 flex-col overflow-hidden rounded-xl bg-white p-3 shadow-xs">
      <header className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="typo-title-3 text-slate-900">LoopBus</h2>
          <p className="text-[11px] text-slate-500">
            {kernel?.running ? `phase: ${activePhase}` : "runtime paused"} · stage: {stage}
          </p>
        </div>
        <Badge variant="secondary" className="rounded-full text-[11px] text-slate-700">
          <BadgeLabel>{`cycle #${kernel?.cycle ?? 0}`}</BadgeLabel>
        </Badge>
      </header>

      <section className="@container mb-2 grid grid-cols-2 gap-2 text-[11px] md:grid-cols-4">
        <div className="rounded-lg bg-slate-100 px-2 py-1.5 text-slate-700">
          <InlineAffordance className="font-medium">
            <InlineAffordanceLeadingVisual>
              <Workflow className="h-3.5 w-3.5" />
            </InlineAffordanceLeadingVisual>
            <InlineAffordanceLabel>phase</InlineAffordanceLabel>
          </InlineAffordance>
          <p className="mt-1 text-[10px] text-slate-500">{activePhase}</p>
        </div>
        <div className="rounded-lg bg-slate-100 px-2 py-1.5 text-slate-700">
          <InlineAffordance className="font-medium">
            <InlineAffordanceLeadingVisual>
              <Activity className="h-3.5 w-3.5" />
            </InlineAffordanceLeadingVisual>
            <InlineAffordanceLabel>wake</InlineAffordanceLabel>
          </InlineAffordance>
          <p className="mt-1 text-[10px] text-slate-500">
            {kernel?.lastWakeSource ?? "-"} @ {toTime(kernel?.lastWakeAt)}
          </p>
        </div>
        <div className="rounded-lg bg-slate-100 px-2 py-1.5 text-slate-700">
          <InlineAffordance className="font-medium">
            <InlineAffordanceLeadingVisual>
              <Cpu className="h-3.5 w-3.5" />
            </InlineAffordanceLeadingVisual>
            <InlineAffordanceLabel>inputs</InlineAffordanceLabel>
          </InlineAffordance>
          <p className="mt-1 text-[10px] text-slate-500">
            u{inputSignals.user.version} t{inputSignals.terminal.version} k{inputSignals.task.version} a
            {inputSignals.attention.version}
          </p>
        </div>
        <div className="rounded-lg bg-slate-100 px-2 py-1.5 text-slate-700">
          <InlineAffordance className="font-medium">
            <InlineAffordanceLeadingVisual>
              <Database className="h-3.5 w-3.5" />
            </InlineAffordanceLeadingVisual>
            <InlineAffordanceLabel>ledger</InlineAffordanceLabel>
          </InlineAffordance>
          <p className="mt-1 text-[10px] text-slate-500">
            traces {traces.length} · models {modelCalls.length} · raw {apiCalls.length}
          </p>
        </div>
      </section>

      <div className="mb-2 flex items-center justify-between gap-2">
        <Tabs
          items={[
            { id: "flow", label: "Flow" },
            { id: "trace", label: `Trace (${traces.length})` },
            { id: "model", label: `Model (${modelCalls.length})` },
          ]}
          value={tab}
          onValueChange={(value) => setTab(value === "trace" || value === "model" ? value : "flow")}
        />
        <span className="text-[11px] text-slate-500">
          api record: {apiRecording.enabled ? `on (${apiRecording.refCount})` : "off"}
        </span>
      </div>

      {tab === "flow" ? (
        <div className="flex flex-1 flex-col gap-2 overflow-auto rounded-lg bg-slate-50 p-2">
          <div className="space-y-1">
            {FLOW_ROWS.map((row, rowIndex) => (
              <div key={`flow-row-${rowIndex + 1}`} className="grid grid-cols-3 gap-1.5">
                {row.map((step) => {
                  const active = activePhase === step.phase;
                  return (
                    <article
                      key={step.id}
                      className={cn(
                        "relative overflow-hidden rounded-lg border px-2 py-2",
                        active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                          : "border-slate-200 bg-white text-slate-700",
                      )}
                    >
                      {step.direction === "right" ? (
                        <ArrowRight className="pointer-events-none absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2 text-slate-200" />
                      ) : null}
                      {step.direction === "left" ? (
                        <ArrowLeft className="pointer-events-none absolute top-1/2 left-1 h-6 w-6 -translate-y-1/2 text-slate-200" />
                      ) : null}
                      <p className="relative z-10 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
                        {step.step}
                      </p>
                      <p className="relative z-10 text-[12px] font-semibold">{step.title}</p>
                      <p className="relative z-10 text-[10px] text-slate-500">{step.subtitle}</p>
                    </article>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-white px-2 py-2 text-[11px] text-slate-600 ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-700">Kernel</span>
              <span>{kernel?.gate ?? "waiting_input"}</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              updated {toTime(kernel?.updatedAt)} · response {toTime(kernel?.lastResponseAt)} · error{" "}
              {kernel?.lastError ?? "none"}
            </p>
          </div>

          <div className="space-y-1">
            {cycleDigests.length === 0 ? (
              <p className="px-1 text-[11px] text-slate-500">No cycle records yet.</p>
            ) : null}
            {cycleDigests.map((digest) => (
              <div
                key={digest.cycleId}
                className="rounded-lg bg-white px-2 py-2 text-[11px] text-slate-600 ring-1 ring-slate-200"
              >
                <div className="flex items-center justify-between gap-2">
                  <InlineAffordance className="font-medium text-slate-800">
                    <InlineAffordanceLeadingVisual>
                      <StatusIcon status={digest.status} />
                    </InlineAffordanceLeadingVisual>
                    <InlineAffordanceLabel>{`cycle #${digest.cycleId}`}</InlineAffordanceLabel>
                  </InlineAffordance>
                  <span className="text-[10px] text-slate-500">
                    {toTime(digest.startedAt)} - {toTime(digest.endedAt)}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  {digest.steps.length > 0 ? digest.steps.join(" -> ") : "model only"} · model {digest.modelCalls}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-white px-2 py-2 text-[10px] text-slate-500 ring-1 ring-slate-200">
            state logs kept for compatibility: {logs.length}
          </div>
        </div>
      ) : null}

      {tab === "trace" ? (
        <div className="flex h-full flex-1 flex-col overflow-hidden rounded-lg bg-slate-50">
          <PanelHeader
            label="Trace"
            count={traces.length}
            hasMore={hasMoreTrace}
            loading={loadingTrace}
            onLoadMore={onLoadMoreTrace}
          />
          <div ref={traceParentRef} className="flex-1 overflow-auto">
            {traces.length === 0 ? <p className="px-3 py-3 text-[11px] text-slate-500">No trace rows yet.</p> : null}
            <div style={{ height: traceVirtualizer.getTotalSize(), position: "relative" }}>
              {traceVirtualizer.getVirtualItems().map((item) => {
                const trace = traces[item.index];
                if (!trace) {
                  return null;
                }
                return (
                  <div
                    key={trace.id}
                    ref={traceVirtualizer.measureElement}
                    data-index={item.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${item.start}px)`,
                    }}
                    className="px-2 py-1"
                  >
                    <Accordion type="single" collapsible>
                      <AccordionItem
                        value={`trace-${trace.id}`}
                        className="rounded-lg border border-slate-200 bg-white px-2"
                      >
                        <AccordionTrigger className="py-2 hover:no-underline">
                          <InlineAffordance className="flex flex-1" fill>
                            <InlineAffordanceLeadingVisual>
                              <StatusIcon status={trace.status} />
                            </InlineAffordanceLeadingVisual>
                            <InlineAffordanceLabel className="min-w-0 truncate text-xs font-medium text-slate-800">
                              #{trace.cycleId}.{trace.seq} {trace.step}
                            </InlineAffordanceLabel>
                            <InlineAffordanceMeta className="inline-flex items-center gap-2 text-[10px] text-slate-500">
                              <Clock3 className="h-3.5 w-3.5" />
                              {toDuration(trace.startedAt, trace.endedAt)}
                            </InlineAffordanceMeta>
                          </InlineAffordance>
                        </AccordionTrigger>
                        <AccordionContent>
                          <pre className="overflow-auto rounded-md bg-slate-950 p-2 text-[11px] leading-4 text-slate-100">
                            {toJson(trace.detail)}
                          </pre>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "model" ? (
        <div className="flex h-full flex-1 flex-col overflow-hidden rounded-lg bg-slate-50">
          <PanelHeader
            label="Model"
            count={modelCalls.length}
            hasMore={hasMoreModel}
            loading={loadingModel}
            onLoadMore={onLoadMoreModel}
          />
          <div ref={modelParentRef} className="flex-1 overflow-auto">
            {modelCalls.length === 0 ? (
              <p className="px-3 py-3 text-[11px] text-slate-500">No model calls yet.</p>
            ) : null}
            <div style={{ height: modelVirtualizer.getTotalSize(), position: "relative" }}>
              {modelVirtualizer.getVirtualItems().map((item) => {
                const call = modelCalls[item.index];
                if (!call) {
                  return null;
                }
                const status = call.error === undefined ? "ok" : "error";
                return (
                  <div
                    key={call.id}
                    ref={modelVirtualizer.measureElement}
                    data-index={item.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${item.start}px)`,
                    }}
                    className="px-2 py-1"
                  >
                    <Accordion type="single" collapsible>
                      <AccordionItem
                        value={`model-${call.id}`}
                        className="rounded-lg border border-slate-200 bg-white px-2"
                      >
                        <AccordionTrigger className="py-2 hover:no-underline">
                          <InlineAffordance className="flex flex-1" fill>
                            <InlineAffordanceLeadingVisual>
                              <StatusIcon status={status} />
                            </InlineAffordanceLeadingVisual>
                            <InlineAffordanceLabel className="min-w-0 truncate text-xs font-medium text-slate-800">
                              {call.provider} / {call.model}
                            </InlineAffordanceLabel>
                            <InlineAffordanceMeta className="inline-flex items-center gap-2 text-[10px] text-slate-500">
                              <Cpu className="h-3.5 w-3.5" />
                              cycle #{call.cycleId} · {toTime(call.createdAt)}
                            </InlineAffordanceMeta>
                          </InlineAffordance>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2">
                            <div>
                              <p className="mb-1 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
                                request
                              </p>
                              <pre className="overflow-auto rounded-md bg-slate-950 p-2 text-[11px] leading-4 text-slate-100">
                                {toJson(call.request)}
                              </pre>
                            </div>
                            {call.response !== undefined ? (
                              <div>
                                <p className="mb-1 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
                                  response
                                </p>
                                <pre className="overflow-auto rounded-md bg-slate-950 p-2 text-[11px] leading-4 text-slate-100">
                                  {toJson(call.response)}
                                </pre>
                              </div>
                            ) : null}
                            {call.error !== undefined ? (
                              <div>
                                <p className="mb-1 text-[10px] font-medium tracking-wide text-rose-500 uppercase">
                                  error
                                </p>
                                <pre className="overflow-auto rounded-md bg-rose-950 p-2 text-[11px] leading-4 text-rose-100">
                                  {toJson(call.error)}
                                </pre>
                              </div>
                            ) : null}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {!kernel?.running ? (
        <Badge variant="secondary" className="mt-2 rounded-lg text-[11px] text-slate-600">
          <BadgeLeadingVisual>
            <CircleDashed className="h-3.5 w-3.5" />
          </BadgeLeadingVisual>
          <BadgeLabel>runtime is not running</BadgeLabel>
        </Badge>
      ) : null}
    </section>
  );
};
