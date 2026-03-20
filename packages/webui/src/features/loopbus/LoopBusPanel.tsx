import { CircleDashed } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Badge, BadgeLabel, BadgeLeadingVisual } from "../../components/ui/badge";
import { Tabs } from "../../components/ui/tabs";
import { buildCycleDigests, normalizePhase, type LoopBusPanelProps } from "./loopbus-panel-data";
import { LoopBusFlowSection } from "./LoopBusFlowSection";
import { LoopBusModelSection } from "./LoopBusModelSection";
import { LoopBusTraceSection } from "./LoopBusTraceSection";

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
  const handleTabChange = useCallback((value: string) => {
    setTab(value === "trace" || value === "model" ? value : "flow");
  }, []);

  return (
    <section className="grid h-full grid-rows-[auto_auto_minmax(0,1fr)_auto] rounded-xl bg-white p-3 shadow-xs">
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

      <div className="mb-2 flex items-center justify-between gap-2">
        <Tabs
          items={[
            { id: "flow", label: "Flow" },
            { id: "trace", label: `Trace (${traces.length})` },
            { id: "model", label: `Model (${modelCalls.length})` },
          ]}
          value={tab}
          onValueChange={handleTabChange}
        />
        <span className="text-[11px] text-slate-500">
          api record: {apiRecording.enabled ? `on (${apiRecording.refCount})` : "off"}
        </span>
      </div>

      {tab === "flow" ? (
        <LoopBusFlowSection
          activePhase={activePhase}
          kernel={kernel}
          inputSignals={inputSignals}
          logs={logs}
          traces={traces}
          modelCalls={modelCalls}
          apiCalls={apiCalls}
          cycleDigests={cycleDigests}
        />
      ) : null}

      {tab === "trace" ? (
        <LoopBusTraceSection
          traces={traces}
          hasMoreTrace={hasMoreTrace}
          loadingTrace={loadingTrace}
          onLoadMoreTrace={onLoadMoreTrace}
        />
      ) : null}

      {tab === "model" ? (
        <LoopBusModelSection
          modelCalls={modelCalls}
          hasMoreModel={hasMoreModel}
          loadingModel={loadingModel}
          onLoadMoreModel={onLoadMoreModel}
        />
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
