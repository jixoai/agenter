import { useVirtualizer } from "@tanstack/react-virtual";
import { Clock3 } from "lucide-react";
import { useRef } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../components/ui/accordion";
import { AsyncSurface, resolveAsyncSurfaceState } from "../../components/ui/async-surface";
import {
  InlineAffordance,
  InlineAffordanceLabel,
  InlineAffordanceLeadingVisual,
  InlineAffordanceMeta,
} from "../../components/ui/inline-affordance";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { observeElementOffsetWithCleanup } from "../../lib/virtualizer";
import { OVERSCAN, toDuration, toJson, TRACE_ROW_ESTIMATE, type LoopBusTraceItem } from "./loopbus-panel-data";
import { PanelHeader, StatusIcon } from "./LoopBusPanelShared";

interface LoopBusTraceSectionProps {
  traces: LoopBusTraceItem[];
  hasMoreTrace: boolean;
  loadingTrace: boolean;
  onLoadMoreTrace?: () => void | Promise<void>;
}

export const LoopBusTraceSection = ({
  traces,
  hasMoreTrace,
  loadingTrace,
  onLoadMoreTrace,
}: LoopBusTraceSectionProps) => {
  const traceParentRef = useRef<HTMLDivElement | null>(null);
  const traceVirtualizer = useVirtualizer({
    count: traces.length,
    getScrollElement: () => traceParentRef.current,
    observeElementOffset: observeElementOffsetWithCleanup,
    estimateSize: () => TRACE_ROW_ESTIMATE,
    overscan: OVERSCAN,
  });

  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-lg bg-slate-50">
      <PanelHeader
        label="Trace"
        count={traces.length}
        hasMore={hasMoreTrace}
        loading={loadingTrace}
        onLoadMore={onLoadMoreTrace}
      />
      <AsyncSurface
        state={resolveAsyncSurfaceState({ loading: Boolean(loadingTrace), hasData: traces.length > 0 })}
        loadingOverlayLabel="Refreshing trace..."
        skeleton={<div className="h-full rounded-lg bg-white" />}
        empty={<p className="px-3 py-3 text-[11px] text-slate-500">No trace rows yet.</p>}
        className="flex-1"
      >
        <ScrollViewport ref={traceParentRef} className="flex-1">
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
        </ScrollViewport>
      </AsyncSurface>
    </div>
  );
};
