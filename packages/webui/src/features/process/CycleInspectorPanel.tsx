import type { RuntimeChatCycle } from "@agenter/client-sdk";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CircleAlert, CircleCheckBig, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AsyncSurface, resolveAsyncSurfaceState } from "../../components/ui/async-surface";
import { Badge } from "../../components/ui/badge";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { cn } from "../../lib/utils";
import { formatCycleBadge, formatCycleTitle, getCycleStatusMeta, summarizeCycle } from "../chat/cycle-meta";
import { CycleInspectorDetail } from "./CycleInspectorDetail";

interface CycleInspectorPanelProps {
  cycles: RuntimeChatCycle[];
  loading?: boolean;
  selectedCycleId?: string | null;
}

interface CycleTimelineItem {
  id: string;
  cycle: RuntimeChatCycle;
  summary: string;
}

const TIMELINE_ROW_ESTIMATE = 116;
const TIMELINE_OVERSCAN = 8;

const statusIcon = (cycle: RuntimeChatCycle) => {
  if (cycle.status === "error") {
    return <CircleAlert className="h-4 w-4 text-rose-600" />;
  }
  if (cycle.status === "streaming" || cycle.status === "collecting" || cycle.status === "applying") {
    return <LoaderCircle className="h-4 w-4 animate-spin text-teal-700" />;
  }
  return <CircleCheckBig className="h-4 w-4 text-emerald-600" />;
};

const TimelineItemButton = ({
  item,
  index,
  selected,
  onSelect,
}: {
  item: CycleTimelineItem;
  index: number;
  selected: boolean;
  onSelect: (cycleId: string) => void;
}) => {
  const status = getCycleStatusMeta(item.cycle);

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className={cn(
        "w-full rounded-2xl border px-3 py-3 text-left transition-colors",
        selected ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-white hover:border-slate-300",
      )}
      aria-label={`${formatCycleTitle(item.cycle, index + 1)} · ${status.label}`}
    >
      <div className="flex items-start gap-3">
        <div className="pt-0.5">{statusIcon(item.cycle)}</div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{formatCycleTitle(item.cycle, index + 1)}</span>
            <Badge className={selected ? "bg-white/15 text-white" : status.toneClassName}>{formatCycleBadge(item.cycle, index + 1)}</Badge>
            <Badge variant="secondary" className={selected ? "bg-white/12 text-white/80" : ""}>
              {item.cycle.kind}
            </Badge>
          </div>
          <p className={cn("text-xs leading-5", selected ? "text-white/78" : "text-slate-500")}>{item.summary}</p>
        </div>
      </div>
    </button>
  );
};

export const CycleInspectorPanel = ({ cycles, loading = false, selectedCycleId: preferredSelectedCycleId = null }: CycleInspectorPanelProps) => {
  const surfaceState = resolveAsyncSurfaceState({
    loading,
    hasData: cycles.length > 0,
  });
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  const items = useMemo<CycleTimelineItem[]>(
    () =>
      cycles
        .slice()
        .reverse()
        .map((cycle) => ({
          id: cycle.id,
          cycle,
          summary: summarizeCycle(cycle),
        })),
    [cycles],
  );

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => timelineRef.current,
    estimateSize: () => TIMELINE_ROW_ESTIMATE,
    overscan: TIMELINE_OVERSCAN,
    initialRect: {
      width: 0,
      height: TIMELINE_ROW_ESTIMATE * 5,
    },
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    if (items.length === 0) {
      setSelectedCycleId(null);
      return;
    }
    if (preferredSelectedCycleId && items.some((item) => item.id === preferredSelectedCycleId)) {
      setSelectedCycleId(preferredSelectedCycleId);
      return;
    }
    setSelectedCycleId((current) => (current && items.some((item) => item.id === current) ? current : items[0]!.id));
  }, [items, preferredSelectedCycleId]);

  const selectedCycle = items.find((item) => item.id === selectedCycleId)?.cycle ?? null;
  const activeCount = cycles.filter((cycle) => cycle.status !== "done" && cycle.status !== "error").length;
  const errorCount = cycles.filter((cycle) => cycle.status === "error").length;

  return (
    <section className="flex h-full flex-1 flex-col rounded-xl bg-white shadow-xs">
      <div className="border-b border-slate-200 px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="typo-title-3 text-slate-900">Cycles</h2>
          <Badge variant="secondary">{cycles.length} total</Badge>
          {activeCount > 0 ? <Badge className="bg-teal-100 text-teal-700">{activeCount} active</Badge> : null}
          {errorCount > 0 ? <Badge className="bg-rose-100 text-rose-700">{errorCount} error</Badge> : null}
        </div>
        <p className="mt-1 text-xs text-slate-500">Live cycle timeline, collected state, and assistant-side technical records.</p>
      </div>

      <AsyncSurface
        state={surfaceState}
        loadingOverlayLabel="Refreshing cycles..."
        skeleton={<div className="h-full rounded-lg bg-slate-100" />}
        empty={<p className="px-3 py-4 text-sm text-slate-500">No cycle inspection data yet.</p>}
        className="flex-1"
      >
        <div className="grid h-full gap-3 p-3 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
          <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50">
            <div className="border-b border-slate-200 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Timeline</p>
            </div>
            <ScrollViewport ref={timelineRef} className="flex-1 px-2 py-2">
              <div
                className="relative"
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                }}
              >
                {virtualRows.map((row) => {
                  const item = items[row.index]!;
                  return (
                    <div
                      key={item.id}
                      data-index={row.index}
                      ref={(node) => {
                        if (node) {
                          rowVirtualizer.measureElement(node);
                        }
                      }}
                      className="absolute top-0 left-0 w-full pb-2"
                      style={{
                        transform: `translateY(${row.start}px)`,
                      }}
                    >
                      <TimelineItemButton
                        item={item}
                        index={row.index}
                        selected={item.id === selectedCycleId}
                        onSelect={setSelectedCycleId}
                      />
                    </div>
                  );
                })}
              </div>
            </ScrollViewport>
          </section>

          {selectedCycle ? (
            <CycleInspectorDetail cycle={selectedCycle} />
          ) : (
            <section className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
              <p className="text-sm text-slate-500">Select a cycle in the timeline to inspect collected inputs and assistant records.</p>
            </section>
          )}
        </div>
      </AsyncSurface>
    </section>
  );
};
