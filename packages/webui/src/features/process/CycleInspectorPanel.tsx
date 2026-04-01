import type {
  ModelCallDeltaItem,
  ModelCallItem,
  RuntimeAttentionState,
  RuntimeChatCycle,
  ObservabilityTraceItem as RuntimeTraceItem,
} from "@agenter/client-sdk";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CircleAlert, CircleCheckBig, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AsyncSurface, resolveAsyncSurfaceState } from "../../components/ui/async-surface";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { HelpHint } from "../../components/ui/help-hint";
import { ScrollViewport, ViewportMask } from "../../components/ui/overflow-surface";
import { Sheet } from "../../components/ui/sheet";
import { cn } from "../../lib/utils";
import { observeElementOffsetWithCleanup } from "../../lib/virtualizer";
import type { LongListPagingState } from "../../shared/long-list-paging";
import { EMPTY_RUNTIME_ATTENTION_STATE, type AttentionSelectionState } from "../attention/attention-view-model";
import { CycleInspectorDetail } from "./CycleInspectorDetail";
import {
  buildCycleTimelineSummary,
  formatCycleBadge,
  formatCycleTitle,
  getCycleStatusMeta,
} from "./cycle-inspector-view-model";

interface CycleInspectorPanelProps {
  cycles: RuntimeChatCycle[];
  attention?: RuntimeAttentionState;
  modelCalls?: ModelCallItem[];
  modelCallDeltas?: ModelCallDeltaItem[];
  traces?: RuntimeTraceItem[];
  loading?: boolean;
  selectedCycleId?: string | null;
  detailMode?: "split" | "sheet";
  pagingState?: LongListPagingState;
  onLoadMore?: () => void;
  onOpenAttentionRef?: (selection: AttentionSelectionState) => void;
}

interface CycleTimelineItem {
  id: string;
  cycle: RuntimeChatCycle;
  headline: string;
  detail: string;
}

const TIMELINE_ROW_ESTIMATE = 96;
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
    <Button
      type="button"
      variant="outline"
      onClick={() => onSelect(item.id)}
      className={cn(
        "h-auto w-full items-start justify-start rounded-xl px-3 py-2.5 text-left whitespace-normal shadow-sm",
        selected
          ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-900"
          : "border-slate-200 bg-white hover:border-slate-300",
      )}
      aria-label={`${formatCycleTitle(item.cycle, index + 1)} · ${status.label}`}
    >
      <div className="flex w-full items-start gap-3">
        <div className="pt-0.5">{statusIcon(item.cycle)}</div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{formatCycleTitle(item.cycle, index + 1)}</span>
            <Badge className={selected ? "bg-white/15 text-white" : status.toneClassName}>
              {formatCycleBadge(item.cycle, index + 1)}
            </Badge>
            <Badge variant="secondary" className={selected ? "bg-white/12 text-white/80" : ""}>
              {item.cycle.kind}
            </Badge>
            {item.cycle.kind === "compact" && item.cycle.compactTrigger ? (
              <Badge
                variant="secondary"
                className={selected ? "bg-white/12 text-white/80" : "bg-amber-100 text-amber-700"}
                title={`Compaction trigger: ${item.cycle.compactTrigger}`}
              >
                compact:{item.cycle.compactTrigger}
              </Badge>
            ) : null}
          </div>
          <p className={cn("text-xs leading-5 font-medium", selected ? "text-white/88" : "text-slate-700")}>
            {item.headline}
          </p>
          <p className={cn("text-[11px] leading-5", selected ? "text-white/72" : "text-slate-500")}>{item.detail}</p>
        </div>
      </div>
    </Button>
  );
};

export const CycleInspectorPanel = ({
  cycles,
  attention = EMPTY_RUNTIME_ATTENTION_STATE,
  modelCalls = [],
  modelCallDeltas = [],
  traces = [],
  loading = false,
  selectedCycleId: preferredSelectedCycleId = null,
  detailMode = "split",
  pagingState,
  onLoadMore,
  onOpenAttentionRef,
}: CycleInspectorPanelProps) => {
  const initialLoading = loading || Boolean(pagingState?.loading && !pagingState.hydrated);
  const surfaceState = resolveAsyncSurfaceState({
    loading: initialLoading,
    hasData: cycles.length > 0,
  });
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  const items = useMemo<CycleTimelineItem[]>(() => {
    const next: CycleTimelineItem[] = [];
    for (let index = cycles.length - 1; index >= 0; index -= 1) {
      const cycle = cycles[index]!;
      const summary = buildCycleTimelineSummary({ cycle, attention, modelCalls, traces });
      next.push({
        id: cycle.id,
        cycle,
        headline: summary.headline,
        detail: summary.detail,
      });
    }
    return next;
  }, [attention, cycles, modelCalls, traces]);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => timelineRef.current,
    observeElementOffset: observeElementOffsetWithCleanup,
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
      setDetailOpen(false);
      return;
    }
    if (preferredSelectedCycleId && items.some((item) => item.id === preferredSelectedCycleId)) {
      setSelectedCycleId(preferredSelectedCycleId);
      setDetailOpen(detailMode === "sheet");
      return;
    }
    setSelectedCycleId((current) => (current && items.some((item) => item.id === current) ? current : items[0]!.id));
    if (detailMode !== "sheet") {
      setDetailOpen(false);
    }
  }, [detailMode, items, preferredSelectedCycleId]);

  const selectedCycle = items.find((item) => item.id === selectedCycleId)?.cycle ?? null;
  const activeCount = cycles.filter((cycle) => cycle.status !== "done" && cycle.status !== "error").length;
  const errorCount = cycles.filter((cycle) => cycle.status === "error").length;
  const showSplitDetail = detailMode === "split";

  const handleSelect = (cycleId: string) => {
    setSelectedCycleId(cycleId);
    if (detailMode === "sheet") {
      setDetailOpen(true);
    }
  };

  return (
    <section className="grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-xl bg-white shadow-xs">
      <div className="border-b border-slate-200 px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="typo-title-3 text-slate-900">Cycles</h2>
          <Badge variant="secondary">{cycles.length} total</Badge>
          {activeCount > 0 ? <Badge className="bg-teal-100 text-teal-700">{activeCount} active</Badge> : null}
          {errorCount > 0 ? <Badge className="bg-rose-100 text-rose-700">{errorCount} error</Badge> : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <HelpHint
            helpId="cycle-inspector:overview"
            textContext="Cycles are attention reduction passes: why the loop woke, which contexts moved, and what debt remained."
            content="Cycles are attention reduction passes: why the loop woke, which contexts moved, and what debt remained."
          />
          {pagingState || onLoadMore ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!pagingState?.hasMore || pagingState.loadingOlder || !onLoadMore}
              onClick={onLoadMore}
              className="text-[11px] text-slate-600 shadow-xs"
            >
              {pagingState?.loadingOlder ? (
                <span className="inline-flex items-center gap-1">
                  <LoaderCircle className="h-3 w-3 animate-spin" />
                  Loading...
                </span>
              ) : (
                "Load older"
              )}
            </Button>
          ) : null}
        </div>
      </div>

      <AsyncSurface
        state={surfaceState}
        emptyLoadingLabel="Loading cycle history..."
        loadingOverlayLabel="Refreshing cycles..."
        skeleton={<div className="h-full rounded-lg bg-slate-100" />}
        empty={<p className="px-3 py-4 text-sm text-slate-500">No attention-linked cycle frames yet.</p>}
        className="flex-1"
      >
        <ViewportMask
          className={cn(
            "grid h-full grid-rows-[minmax(0,1fr)] gap-3 p-3",
            showSplitDetail ? "lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]" : "",
          )}
        >
          <ViewportMask className="grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-2xl border border-slate-200 bg-slate-50">
            <div className="border-b border-slate-200 px-3 py-2">
              <p className="text-[11px] font-medium tracking-[0.14em] text-slate-500 uppercase">Timeline</p>
            </div>
            <ScrollViewport ref={timelineRef} className="h-full px-2 py-2" data-testid="cycle-timeline-scroll-viewport">
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
                        onSelect={handleSelect}
                      />
                    </div>
                  );
                })}
              </div>
            </ScrollViewport>
          </ViewportMask>

          {showSplitDetail && selectedCycle ? (
            <ViewportMask className="h-full">
              <CycleInspectorDetail
                cycle={selectedCycle}
                attention={attention}
                modelCalls={modelCalls}
                modelCallDeltas={modelCallDeltas}
                traces={traces}
                onOpenAttentionRef={onOpenAttentionRef}
              />
            </ViewportMask>
          ) : null}

          {showSplitDetail && !selectedCycle ? (
            <ViewportMask className="h-full">
              <section className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
                <p className="text-sm text-slate-500">
                  Select a cycle to inspect attention motion, item mutations, delivered side effects, and runtime
                  evidence.
                </p>
              </section>
            </ViewportMask>
          ) : null}
        </ViewportMask>
      </AsyncSurface>

      {detailMode === "sheet" && selectedCycle ? (
        <Sheet open={detailOpen} onOpenChange={setDetailOpen} side="right" title={formatCycleTitle(selectedCycle)}>
          <div className="h-full min-h-[40dvh]">
            <CycleInspectorDetail
              cycle={selectedCycle}
              attention={attention}
              modelCalls={modelCalls}
              modelCallDeltas={modelCallDeltas}
              traces={traces}
              onOpenAttentionRef={onOpenAttentionRef}
            />
          </div>
        </Sheet>
      ) : null}
    </section>
  );
};
