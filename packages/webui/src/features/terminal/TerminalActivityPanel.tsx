import type { RuntimeClientState, TerminalActivityItem } from "@agenter/client-sdk";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MessageSquareText, TerminalSquare, Wrench } from "lucide-react";
import { useRef } from "react";

import { AsyncSurface, resolveAsyncSurfaceState } from "../../components/ui/async-surface";
import { MarkdownDocument } from "../../components/markdown/MarkdownDocument";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { ScrollViewport, ViewportMask } from "../../components/ui/overflow-surface";
import { ToolInvocationCard, type ToolInvocationView } from "../../components/ui/tool-invocation-card";
import { observeElementOffsetWithCleanup } from "../../lib/virtualizer";
import { AssistantMarkdown } from "../chat/AssistantMarkdown";

interface TerminalActivityPanelProps {
  terminalId: string;
  terminalRead: RuntimeClientState["terminalReadsBySession"][string][string] | undefined;
  items: TerminalActivityItem[];
  hasMore: boolean;
  loading: boolean;
  loadingOlder: boolean;
  onLoadMore: () => void;
}

const ACTIVITY_ROW_ESTIMATE = 220;
const ACTIVITY_OVERSCAN = 6;

const renderTerminalRead = (terminalRead: NonNullable<TerminalActivityPanelProps["terminalRead"]>) => {
  return ["```json", JSON.stringify(terminalRead, null, 2), "```"].join("\n");
};

const toInvocationFromActivity = (item: TerminalActivityItem): ToolInvocationView | null => {
  if (item.kind !== "message" || item.channel !== "tool" || !item.tool) {
    return null;
  }
  return {
    invocationId: item.tool.invocationId,
    toolName: item.tool.name,
    status: item.tool.status,
    startedAt: item.tool.startedAt,
    finishedAt: item.tool.finishedAt,
    call: item.tool.call
      ? {
          value: item.tool.call.value,
          rawText: item.tool.call.rawText,
        }
      : undefined,
    result: item.tool.result
      ? {
          value: item.tool.result.value,
          rawText: item.tool.result.rawText,
        }
      : undefined,
    error: item.tool.error,
  };
};

const renderActivityBody = (item: TerminalActivityItem) => {
  const invocation = toInvocationFromActivity(item);
  if (invocation) {
    return <ToolInvocationCard invocation={invocation} className="bg-white" />;
  }
  if (item.kind === "message") {
    return (
      <AssistantMarkdown
        content={item.content}
        channel={item.channel === "user_input" ? undefined : item.channel}
        tool={item.tool}
      />
    );
  }
  const fenced = ["```text", item.content, "```"].join("\n");
  return (
    <MarkdownDocument
      value={fenced}
      mode="preview"
      usage="inspector"
      surface="muted"
      syntaxTone="accented"
      density="compact"
      padding="compact"
    />
  );
};

export const TerminalActivityPanel = ({
  terminalId,
  terminalRead,
  items,
  hasMore,
  loading,
  loadingOlder,
  onLoadMore,
}: TerminalActivityPanelProps) => {
  const hasData = Boolean(terminalRead) || items.length > 0;
  const listRef = useRef<HTMLDivElement | null>(null);
  const itemVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => listRef.current,
    observeElementOffset: observeElementOffsetWithCleanup,
    estimateSize: () => ACTIVITY_ROW_ESTIMATE,
    overscan: ACTIVITY_OVERSCAN,
  });
  const shouldVirtualize = items.length > 20;

  return (
    <ViewportMask className="grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="typo-title-3 text-slate-900">Activity</h3>
            <Badge variant="secondary">{terminalId}</Badge>
            {terminalRead ? <Badge variant="secondary">latest read</Badge> : null}
            {items.length > 0 ? <Badge variant="secondary">{items.length} items</Badge> : null}
          </div>
          <Button size="sm" variant="secondary" onClick={onLoadMore} disabled={!hasMore || loading || loadingOlder}>
            {loading || loadingOlder ? "Loading..." : hasMore ? "Load older" : "Complete"}
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          Server-backed terminal activity scoped by session and terminal id.
        </p>
      </div>

      <AsyncSurface
        state={resolveAsyncSurfaceState({ loading, hasData })}
        empty={<p className="px-4 py-4 text-sm text-slate-500">No terminal-local activity is available yet.</p>}
        emptyLoadingLabel="Loading terminal activity..."
        className="flex-1"
      >
        <ScrollViewport ref={listRef} className="h-full px-3 py-3" data-terminal-activity-scroll-owner="inspector">
          <div className="space-y-3">
            {terminalRead ? (
              <article className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="mb-2 inline-flex items-center gap-2 text-xs text-slate-500">
                  <TerminalSquare className="h-3.5 w-3.5" />
                  <span>Latest terminal_read result</span>
                </div>
                <MarkdownDocument
                  value={renderTerminalRead(terminalRead)}
                  mode="preview"
                  usage="inspector"
                  surface="muted"
                  syntaxTone="accented"
                  density="compact"
                  padding="compact"
                />
              </article>
            ) : null}

            {items.length > 0 ? (
              shouldVirtualize ? (
                <div
                  className="relative"
                  style={{
                    height: `${itemVirtualizer.getTotalSize()}px`,
                  }}
                >
                  {itemVirtualizer.getVirtualItems().map((row) => {
                    const item = items[row.index];
                    if (!item) {
                      return null;
                    }
                    return (
                      <article
                        key={item.id}
                        data-index={row.index}
                        ref={(node) => {
                          if (node) {
                            itemVirtualizer.measureElement(node);
                          }
                        }}
                        className="absolute top-0 left-0 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                        style={{
                          transform: `translateY(${row.start}px)`,
                        }}
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          {item.kind === "message" ? (
                            <MessageSquareText className="h-3.5 w-3.5" />
                          ) : (
                            <Wrench className="h-3.5 w-3.5" />
                          )}
                          <span>{item.title}</span>
                          <Badge variant="secondary">{item.kind}</Badge>
                          {item.cycleId ? <Badge variant="secondary">cycle {item.cycleId}</Badge> : null}
                        </div>
                        {renderActivityBody(item)}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        {item.kind === "message" ? <MessageSquareText className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}
                        <span>{item.title}</span>
                        <Badge variant="secondary">{item.kind}</Badge>
                        {item.cycleId ? <Badge variant="secondary">cycle {item.cycleId}</Badge> : null}
                      </div>
                      {renderActivityBody(item)}
                    </article>
                  ))}
                </div>
              )
            ) : null}
          </div>
        </ScrollViewport>
      </AsyncSurface>
    </ViewportMask>
  );
};
