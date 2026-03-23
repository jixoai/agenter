import { useVirtualizer } from "@tanstack/react-virtual";
import { LoaderCircle } from "lucide-react";
import { useRef, type ReactNode } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../components/ui/accordion";
import { AsyncSurface, resolveAsyncSurfaceState } from "../../components/ui/async-surface";
import { Button } from "../../components/ui/button";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { observeElementOffsetWithCleanup } from "../../lib/virtualizer";

interface ModelInspectorTimelineProps<TItem> {
  items: readonly TItem[];
  loading: boolean;
  loadingOlder: boolean;
  hasMore: boolean;
  estimateSize?: number;
  emptyMessage: string;
  onLoadMore?: () => void;
  itemKey: (item: TItem) => string;
  renderTrigger: (item: TItem) => ReactNode;
  renderContent: (item: TItem) => ReactNode;
}

export const ModelInspectorTimeline = <TItem,>({
  items,
  loading,
  loadingOlder,
  hasMore,
  estimateSize = 92,
  emptyMessage,
  onLoadMore,
  itemKey,
  renderTrigger,
  renderContent,
}: ModelInspectorTimelineProps<TItem>) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => listRef.current,
    observeElementOffset: observeElementOffsetWithCleanup,
    estimateSize: () => estimateSize,
    overscan: 8,
    initialRect: {
      width: 0,
      height: estimateSize * 5,
    },
  });
  const shouldVirtualize = items.length > 20;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onLoadMore} disabled={!hasMore || loadingOlder || !onLoadMore}>
          {loadingOlder ? (
            <span className="inline-flex items-center gap-1">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              Loading...
            </span>
          ) : hasMore ? (
            "Load older"
          ) : (
            "Complete"
          )}
        </Button>
      </div>

      <AsyncSurface
        state={resolveAsyncSurfaceState({ loading, hasData: items.length > 0 })}
        empty={<div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">{emptyMessage}</div>}
        emptyLoadingLabel="Loading history..."
        className="min-h-[16rem]"
      >
        <ScrollViewport ref={listRef} className="h-[min(60dvh,36rem)] pr-1">
          {shouldVirtualize ? (
            <div
              className="relative"
              style={{
                height: `${virtualizer.getTotalSize()}px`,
              }}
            >
              {virtualizer.getVirtualItems().map((row) => {
                const item = items[row.index];
                if (!item) {
                  return null;
                }
                return (
                  <div
                    key={itemKey(item)}
                    data-index={row.index}
                    ref={(node) => {
                      if (node) {
                        virtualizer.measureElement(node);
                      }
                    }}
                    className="absolute top-0 left-0 w-full pb-2"
                    style={{
                      transform: `translateY(${row.start}px)`,
                    }}
                  >
                    <Accordion type="single" collapsible>
                      <AccordionItem value={itemKey(item)} className="rounded-xl border border-slate-200 bg-white px-3">
                        <AccordionTrigger className="py-2 hover:no-underline">{renderTrigger(item)}</AccordionTrigger>
                        <AccordionContent>{renderContent(item)}</AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <Accordion key={itemKey(item)} type="single" collapsible>
                  <AccordionItem value={itemKey(item)} className="rounded-xl border border-slate-200 bg-white px-3">
                    <AccordionTrigger className="py-2 hover:no-underline">{renderTrigger(item)}</AccordionTrigger>
                    <AccordionContent>{renderContent(item)}</AccordionContent>
                  </AccordionItem>
                </Accordion>
              ))}
            </div>
          )}
        </ScrollViewport>
      </AsyncSurface>
    </div>
  );
};
