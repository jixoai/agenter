import { Activity, ArrowLeft, ArrowRight, Cpu, Database, Workflow } from "lucide-react";

import {
  InlineAffordance,
  InlineAffordanceLabel,
  InlineAffordanceLeadingVisual,
} from "../../components/ui/inline-affordance";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { cn } from "../../lib/utils";
import {
  FLOW_ROWS,
  toTime,
  type ApiCallItem,
  type CycleDigest,
  type InputSignalMap,
  type LoopBusKernelState,
  type LoopBusStateLogItem,
  type LoopBusTraceItem,
  type LoopPhase,
  type ModelCallItem,
} from "./loopbus-panel-data";
import { StatusIcon } from "./LoopBusPanelShared";

interface LoopBusFlowSectionProps {
  activePhase: LoopPhase;
  kernel: LoopBusKernelState | null;
  inputSignals: InputSignalMap;
  logs: LoopBusStateLogItem[];
  traces: LoopBusTraceItem[];
  modelCalls: ModelCallItem[];
  apiCalls: ApiCallItem[];
  cycleDigests: CycleDigest[];
}

export const LoopBusFlowSection = ({
  activePhase,
  kernel,
  inputSignals,
  logs,
  traces,
  modelCalls,
  apiCalls,
  cycleDigests,
}: LoopBusFlowSectionProps) => (
  <ScrollViewport className="flex flex-1 flex-col gap-2 rounded-lg bg-slate-50 p-2">
    <section className="@container grid grid-cols-2 gap-2 text-[11px] md:grid-cols-4">
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

    <div className="space-y-1">
      {FLOW_ROWS.map((row, rowIndex) => (
        <div key={`flow-row-${rowIndex + 1}`} className="grid grid-cols-3 gap-1.5">
          {row.map((step) => {
            const active = activePhase === step.phase;
            return (
              <article
                key={step.id}
                className={cn(
                  "relative rounded-lg border px-2 py-2",
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
      {cycleDigests.length === 0 ? <p className="px-1 text-[11px] text-slate-500">No cycle records yet.</p> : null}
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
  </ScrollViewport>
);
