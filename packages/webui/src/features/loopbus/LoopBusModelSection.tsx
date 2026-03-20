import { useVirtualizer } from "@tanstack/react-virtual";
import { Cpu } from "lucide-react";
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
import { MODEL_ROW_ESTIMATE, OVERSCAN, toJson, toTime, type ModelCallItem } from "./loopbus-panel-data";
import { PanelHeader, StatusIcon } from "./LoopBusPanelShared";

interface LoopBusModelSectionProps {
  modelCalls: ModelCallItem[];
  hasMoreModel: boolean;
  loadingModel: boolean;
  onLoadMoreModel?: () => void | Promise<void>;
}

export const LoopBusModelSection = ({
  modelCalls,
  hasMoreModel,
  loadingModel,
  onLoadMoreModel,
}: LoopBusModelSectionProps) => {
  const modelParentRef = useRef<HTMLDivElement | null>(null);
  const modelVirtualizer = useVirtualizer({
    count: modelCalls.length,
    getScrollElement: () => modelParentRef.current,
    observeElementOffset: observeElementOffsetWithCleanup,
    estimateSize: () => MODEL_ROW_ESTIMATE,
    overscan: OVERSCAN,
  });

  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-lg bg-slate-50">
      <PanelHeader
        label="Model"
        count={modelCalls.length}
        hasMore={hasMoreModel}
        loading={loadingModel}
        onLoadMore={onLoadMoreModel}
      />
      <AsyncSurface
        state={resolveAsyncSurfaceState({ loading: Boolean(loadingModel), hasData: modelCalls.length > 0 })}
        loadingOverlayLabel="Refreshing model calls..."
        skeleton={<div className="h-full rounded-lg bg-white" />}
        empty={<p className="px-3 py-3 text-[11px] text-slate-500">No model calls yet.</p>}
        className="flex-1"
      >
        <ScrollViewport ref={modelParentRef} className="flex-1">
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
        </ScrollViewport>
      </AsyncSurface>
    </div>
  );
};
