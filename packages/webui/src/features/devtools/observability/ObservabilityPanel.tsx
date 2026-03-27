import { Activity, CircleDashed } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge, BadgeLabel, BadgeLeadingVisual } from "../../../components/ui/badge";
import { HelpHint } from "../../../components/ui/help-hint";
import { JSONViewer } from "../../../components/ui/json-viewer";
import { ScrollViewport } from "../../../components/ui/overflow-surface";
import { Tabs } from "../../../components/ui/tabs";
import { cn } from "../../../lib/utils";
import {
  buildCycleDigests,
  buildObservabilityEvents,
  normalizePhase,
  type ObservabilityEventItem,
  type ObservabilityPanelProps,
} from "./observability-panel-data";
import { ObservabilitySchedulerSection } from "./ObservabilitySchedulerSection";
import { ObservabilityTransportSection } from "./ObservabilityTransportSection";

const observabilityStatusClassName = (status: ObservabilityEventItem["status"]): string => {
  switch (status) {
    case "error":
      return "text-rose-700 bg-rose-50 border-rose-200";
    case "running":
      return "text-amber-700 bg-amber-50 border-amber-200";
    case "ok":
      return "text-emerald-700 bg-emerald-50 border-emerald-200";
    default:
      return "text-slate-600 bg-slate-100 border-slate-200";
  }
};

export const ObservabilityPanel = ({
  stage,
  kernel,
  inputSignals,
  attention,
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
}: ObservabilityPanelProps) => {
  const [tab, setTab] = useState<"trace" | "scheduler" | "transport">("trace");
  const [searchText, setSearchText] = useState("");
  const [kindFilter, setKindFilter] = useState<ObservabilityEventItem["kind"] | "all">("all");
  const activePhase = normalizePhase(kernel?.phase);
  const cycleDigests = useMemo(() => buildCycleDigests(traces, modelCalls), [modelCalls, traces]);
  const observabilityEvents = useMemo(
    () => buildObservabilityEvents({ attention, logs, traces, modelCalls, apiCalls }),
    [apiCalls, attention, logs, modelCalls, traces],
  );

  const filteredEvents = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return observabilityEvents.filter((event) => {
      if (kindFilter !== "all" && event.kind !== kindFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystacks = [event.kind, event.title, event.summary, JSON.stringify(event.payload)];
      return haystacks.some((value) => value.toLowerCase().includes(query));
    });
  }, [kindFilter, observabilityEvents, searchText]);

  const [selectedEventKey, setSelectedEventKey] = useState<string | null>(filteredEvents[0]?.key ?? null);

  useEffect(() => {
    if (filteredEvents.length === 0) {
      setSelectedEventKey(null);
      return;
    }
    if (selectedEventKey && filteredEvents.some((event) => event.key === selectedEventKey)) {
      return;
    }
    setSelectedEventKey(filteredEvents[0]!.key);
  }, [filteredEvents, selectedEventKey]);

  const selectedEvent = useMemo(
    () => filteredEvents.find((event) => event.key === selectedEventKey) ?? filteredEvents[0] ?? null,
    [filteredEvents, selectedEventKey],
  );

  const handleTabChange = useCallback((value: string) => {
    setTab(value === "scheduler" || value === "transport" ? value : "trace");
  }, []);

  const handleLoadOlderEvents = useCallback(() => {
    void onLoadMoreTrace?.();
    void onLoadMoreModel?.();
  }, [onLoadMoreModel, onLoadMoreTrace]);

  return (
    <section className="grid h-full grid-rows-[auto_auto_minmax(0,1fr)_auto] rounded-xl bg-white p-3 shadow-xs">
      <header className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="typo-title-3 text-slate-900">Observability</h2>
            <HelpHint
              helpId="observability:overview"
              textContext="Context events, scheduler state, and transport records for the attention-driven runtime."
              content={`Context events, scheduler state, and transport records for the attention-driven runtime. Stage: ${stage}.`}
            />
          </div>
        </div>
        <Badge variant="secondary" className="rounded-full text-[11px] text-slate-700">
          <BadgeLabel>{`cycle #${kernel?.cycle ?? 0}`}</BadgeLabel>
        </Badge>
      </header>

      <div className="mb-2 flex items-center justify-between gap-2">
        <Tabs
          items={[
            { id: "trace", label: `Trace (${observabilityEvents.length})` },
            { id: "scheduler", label: "Scheduler" },
            { id: "transport", label: `Transport (${modelCalls.length})` },
          ]}
          value={tab}
          onValueChange={handleTabChange}
        />
        <span className="text-[11px] text-slate-500">
          api record: {apiRecording.enabled ? `on (${apiRecording.refCount})` : "off"}
        </span>
      </div>

      {tab === "trace" ? (
        <div className="grid min-h-0 gap-3 xl:grid-cols-[20rem_minmax(0,1fr)]">
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
              <div className="mb-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_11rem]">
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search contexts, cycles, transport"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 transition-colors outline-none placeholder:text-slate-400 focus:border-sky-300"
                />
                <select
                  value={kindFilter}
                  onChange={(event) => setKindFilter(event.target.value as ObservabilityEventItem["kind"] | "all")}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 transition-colors outline-none focus:border-sky-300"
                >
                  <option value="all">All events</option>
                  <option value="attention.context">Attention contexts</option>
                  <option value="attention.commit">Attention commits</option>
                  <option value="attention.hook">Attention hooks</option>
                  <option value="cycle.frame">Cycle frames</option>
                  <option value="scheduler.state">Scheduler state</option>
                  <option value="scheduler.trace">Scheduler trace</option>
                  <option value="model.call">Model calls</option>
                  <option value="api.call">API calls</option>
                </select>
              </div>
              <p className="text-[11px] text-slate-500">
                {filteredEvents.length} visible events · contexts, cycles, scheduler, and transport in one feed
              </p>
            </div>

            <ScrollViewport
              className="rounded-xl border border-slate-200 bg-white p-2"
              data-testid="observability-event-scroll-viewport"
            >
              <div className="space-y-1.5">
                {filteredEvents.map((event) => {
                  const isSelected = event.key === selectedEvent?.key;
                  return (
                    <button
                      key={event.key}
                      type="button"
                      onClick={() => setSelectedEventKey(event.key)}
                      className={cn(
                        "w-full rounded-xl border px-2.5 py-2 text-left transition-colors",
                        isSelected
                          ? "border-slate-900 bg-slate-950 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300 hover:bg-white",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{event.title}</div>
                          <div className="mt-1 text-[11px] opacity-80">{event.kind}</div>
                        </div>
                        <span
                          className={cn(
                            "rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                            isSelected
                              ? "border-white/20 bg-white/10 text-white"
                              : observabilityStatusClassName(event.status),
                          )}
                        >
                          {event.status}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] opacity-80">{event.summary}</div>
                    </button>
                  );
                })}
                {filteredEvents.length === 0 ? (
                  <p className="px-2 py-4 text-sm text-slate-500">No observability events match the current filters.</p>
                ) : null}
              </div>
            </ScrollViewport>
          </div>

          <ScrollViewport
            className="rounded-xl border border-slate-200 bg-white p-3"
            data-testid="observability-detail-scroll-viewport"
          >
            {selectedEvent ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5">
                      {selectedEvent.kind}
                    </span>
                    {selectedEvent.cycleId !== null ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5">
                        cycle #{selectedEvent.cycleId}
                      </span>
                    ) : null}
                    {selectedEvent.contextId ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5">
                        {selectedEvent.contextId}
                      </span>
                    ) : null}
                    {selectedEvent.itemId ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5">
                        {selectedEvent.itemId}
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">{selectedEvent.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{selectedEvent.summary}</p>
                  </div>
                </div>

                <section className="space-y-2">
                  <h4 className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">Payload</h4>
                  <JSONViewer value={selectedEvent.payload} />
                </section>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Select an event to inspect its payload.
              </div>
            )}
          </ScrollViewport>
        </div>
      ) : null}

      {tab === "scheduler" ? (
        <ObservabilitySchedulerSection
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

      {tab === "transport" ? (
        <ObservabilityTransportSection
          modelCalls={modelCalls}
          hasMoreModel={hasMoreModel}
          loadingModel={loadingModel}
          onLoadMoreModel={onLoadMoreModel}
        />
      ) : null}

      {tab === "trace" && (hasMoreTrace || hasMoreModel) ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500">
            Older trace pages currently extend scheduler traces and transport records.
          </span>
          <button
            type="button"
            onClick={handleLoadOlderEvents}
            disabled={loadingTrace || loadingModel}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            {loadingTrace || loadingModel ? "Loading..." : "Load older"}
          </button>
        </div>
      ) : null}

      {!kernel?.running ? (
        <Badge variant="secondary" className="mt-2 rounded-lg text-[11px] text-slate-600">
          <BadgeLeadingVisual>
            {tab === "trace" ? <Activity className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
          </BadgeLeadingVisual>
          <BadgeLabel>{kernel ? "runtime is not running" : "persisted observability view"}</BadgeLabel>
        </Badge>
      ) : null}
    </section>
  );
};
