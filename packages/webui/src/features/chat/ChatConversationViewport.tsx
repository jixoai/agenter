import { useVirtualizer } from "@tanstack/react-virtual";
import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { NoticeBanner } from "../../components/ui/notice-banner";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { observeElementOffsetWithCleanup } from "../../lib/virtualizer";
import { cn } from "../../lib/utils";
import { ChatMessageRow, StatusRow, TimeDividerRow } from "./ChatConversationRows";
import type { ConversationRow } from "./chat-projection";

const LOAD_MORE_OFFSET = 160;
const STICKY_BOTTOM_OFFSET = 48;
const MESSAGE_ROW_ESTIMATE = 132;
const STATUS_ROW_ESTIMATE = 44;
const ROW_OVERSCAN = 8;
// Keep moderate transcripts fully rendered so restored chat sessions land on the latest turn reliably.
const INLINE_ROW_LIMIT = 120;

interface ChatConversationViewportProps {
  rows: ConversationRow[];
  sessionStateLabel: string;
  routeNotice?:
    | {
        tone: "info" | "warning" | "destructive";
        message: string;
      }
    | null;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore?: () => void;
  assistantAvatarUrl?: string | null;
  assistantAvatarLabel?: string;
  userAvatarLabel?: string;
  onPreviewAttachment: (assetId: string) => void;
  onOpenDevtools?: (cycleId: number) => void;
  onLatestVisibleAssistantMessageIdChange?: (messageId: string | null) => void;
}

const EmptyConversation = ({
  sessionStateLabel,
  routeNotice,
}: Pick<ChatConversationViewportProps, "sessionStateLabel" | "routeNotice">) => (
  <div className="flex h-full items-center justify-center px-4 py-10 text-center md:px-6">
    <div className="max-w-sm space-y-3">
      <h3 className="typo-title-3 text-slate-900">Start the conversation</h3>
      <p className="text-sm text-slate-600">
        {routeNotice?.message ?? `${sessionStateLabel}. Use the primary session action to begin or continue working.`}
      </p>
    </div>
  </div>
);

const isConsumableAssistantRow = (row: ConversationRow): row is Extract<ConversationRow, { type: "message" }> => {
  return (
    row.type === "message" &&
    row.message.role === "assistant" &&
    !row.message.transient &&
    (row.message.channel === undefined || row.message.channel === "to_user")
  );
};

export const ChatConversationViewport = ({
  rows,
  sessionStateLabel,
  routeNotice = null,
  hasMore,
  loadingMore,
  onLoadMore,
  assistantAvatarUrl,
  assistantAvatarLabel,
  userAvatarLabel,
  onPreviewAttachment,
  onOpenDevtools,
  onLatestVisibleAssistantMessageIdChange,
}: ChatConversationViewportProps) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const rowNodesRef = useRef(new Map<string, HTMLElement>());
  const visibleAssistantIdsRef = useRef(new Map<string, boolean>());
  const latestVisibleAssistantMessageIdRef = useRef<string | null>(null);
  const prependAnchorRef = useRef<{ rowCount: number; scrollHeight: number; scrollTop: number } | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  const rowKeys = useMemo(() => rows.map((row) => row.key).join("|"), [rows]);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => viewportRef.current,
    observeElementOffset: observeElementOffsetWithCleanup,
    estimateSize: (index) => (rows[index]?.type === "message" ? MESSAGE_ROW_ESTIMATE : STATUS_ROW_ESTIMATE),
    overscan: ROW_OVERSCAN,
    initialRect: {
      width: 0,
      height: MESSAGE_ROW_ESTIMATE * 5,
    },
  });
  const useInlineRows = rows.length <= INLINE_ROW_LIMIT;

  const scrollToBottom = useCallback(() => {
    const node = viewportRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, []);

  const scheduleScrollToBottom = useCallback(() => {
    const node = viewportRef.current;
    const targetWindow = node?.ownerDocument.defaultView;
    if (!node || !targetWindow) {
      return () => undefined;
    }

    let settleFrame: number | null = null;
    const frame = targetWindow.requestAnimationFrame(() => {
      scrollToBottom();
      settleFrame = targetWindow.requestAnimationFrame(() => {
        scrollToBottom();
      });
    });

    return () => {
      targetWindow.cancelAnimationFrame(frame);
      if (settleFrame !== null) {
        targetWindow.cancelAnimationFrame(settleFrame);
      }
    };
  }, [scrollToBottom]);

  const syncLatestVisibleAssistantMessageId = useCallback(() => {
    if (!onLatestVisibleAssistantMessageIdChange) {
      return;
    }
    const nextMessage =
      [...rows]
        .reverse()
        .find((row): row is Extract<ConversationRow, { type: "message" }> => {
          if (!isConsumableAssistantRow(row)) {
            return false;
          }
          return visibleAssistantIdsRef.current.get(row.message.id) === true;
        }) ?? null;
    const next = nextMessage?.message.id ?? null;
    if (latestVisibleAssistantMessageIdRef.current === next) {
      return;
    }
    latestVisibleAssistantMessageIdRef.current = next;
    onLatestVisibleAssistantMessageIdChange(next);
  }, [onLatestVisibleAssistantMessageIdChange, rows]);

  const registerRowNode = useCallback(
    (row: ConversationRow, node: HTMLElement | null) => {
      const previous = rowNodesRef.current.get(row.key);
      if (previous && observerRef.current) {
        observerRef.current.unobserve(previous);
      }
      if (!node) {
        rowNodesRef.current.delete(row.key);
        if (row.type === "message") {
          visibleAssistantIdsRef.current.delete(row.message.id);
        }
        syncLatestVisibleAssistantMessageId();
        return;
      }
      rowNodesRef.current.set(row.key, node);
      observerRef.current?.observe(node);
    },
    [syncLatestVisibleAssistantMessageId],
  );

  const handleScroll = useCallback(() => {
    const node = viewportRef.current;
    if (!node) {
      return;
    }
    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    const nextStickToBottom = distanceFromBottom <= STICKY_BOTTOM_OFFSET;
    setStickToBottom((current) => (current === nextStickToBottom ? current : nextStickToBottom));

    if (node.scrollTop <= LOAD_MORE_OFFSET && hasMore && !loadingMore && onLoadMore && !loadMoreRef.current) {
      loadMoreRef.current = true;
      prependAnchorRef.current = {
        rowCount: rows.length,
        scrollHeight: node.scrollHeight,
        scrollTop: node.scrollTop,
      };
      onLoadMore();
    }
  }, [hasMore, loadingMore, onLoadMore, rows.length]);

  useEffect(() => {
    loadMoreRef.current = false;
  }, [loadingMore, rowKeys]);

  useEffect(() => {
    const anchor = prependAnchorRef.current;
    const node = viewportRef.current;
    if (!anchor || !node || loadingMore) {
      return;
    }
    if (rows.length > anchor.rowCount) {
      const nextScrollTop = anchor.scrollTop + (node.scrollHeight - anchor.scrollHeight);
      node.scrollTop = Math.max(0, nextScrollTop);
    }
    prependAnchorRef.current = null;
  }, [loadingMore, rowKeys, rows.length]);

  useEffect(() => {
    visibleAssistantIdsRef.current.clear();
    const node = viewportRef.current;
    if (!node || rows.length === 0) {
      latestVisibleAssistantMessageIdRef.current = null;
      onLatestVisibleAssistantMessageIdChange?.(null);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const messageId = (entry.target as HTMLElement).dataset.messageId;
          const visibleAssistant = (entry.target as HTMLElement).dataset.visibleAssistant === "true";
          if (!messageId || !visibleAssistant) {
            continue;
          }
          visibleAssistantIdsRef.current.set(messageId, entry.isIntersecting && entry.intersectionRatio >= 0.2);
        }
        syncLatestVisibleAssistantMessageId();
      },
      {
        root: node,
        threshold: [0.2, 0.5, 0.8],
      },
    );

    observerRef.current = observer;
    rowNodesRef.current.forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [onLatestVisibleAssistantMessageIdChange, rows, syncLatestVisibleAssistantMessageId]);

  useEffect(() => {
    if (!stickToBottom) {
      return;
    }
    return scheduleScrollToBottom();
  }, [rowKeys, scheduleScrollToBottom, stickToBottom]);

  useEffect(() => {
    const node = contentRef.current;
    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }

    let cancelPendingScroll: (() => void) | null = null;
    const observer = new ResizeObserver(() => {
      if (!stickToBottom) {
        return;
      }
      cancelPendingScroll?.();
      cancelPendingScroll = scheduleScrollToBottom();
    });

    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelPendingScroll?.();
    };
  }, [scheduleScrollToBottom, stickToBottom]);

  const renderRow = (row: ConversationRow, index: number, style?: CSSProperties) => {
    const visibleAssistant = isConsumableAssistantRow(row);

    return (
      <section
        key={row.key}
        data-index={index}
        data-message-id={row.type === "message" ? row.message.id : ""}
        data-visible-assistant={visibleAssistant ? "true" : "false"}
        ref={(node) => {
          if (node && style) {
            rowVirtualizer.measureElement(node);
          }
          registerRowNode(row, node);
        }}
        className={cn("w-full", style ? "absolute top-0 left-0" : "")}
        style={style}
      >
        {row.type === "message" ? (
          <ChatMessageRow
            message={row.message}
            assistantAvatarUrl={assistantAvatarUrl}
            assistantAvatarLabel={assistantAvatarLabel}
            userAvatarLabel={userAvatarLabel}
            onPreviewAttachment={onPreviewAttachment}
            onOpenDevtools={onOpenDevtools}
          />
        ) : row.type === "status" ? (
          <StatusRow row={row} />
        ) : (
          <TimeDividerRow row={row} />
        )}
      </section>
    );
  };

  const virtualItems = rowVirtualizer.getVirtualItems();
  const shouldVirtualize = !useInlineRows && virtualItems.length > 0;
  const hasRouteNotice = routeNotice !== null;

  return (
    <section className={cn("grid h-full", hasRouteNotice ? "grid-rows-[auto_minmax(0,1fr)]" : "grid-rows-[minmax(0,1fr)]")}>
      {hasRouteNotice ? (
        <div className="shrink-0 px-4 pt-3 md:px-5">
          <NoticeBanner tone={routeNotice.tone}>{routeNotice.message}</NoticeBanner>
        </div>
      ) : null}

      <div className="h-full">
        <ScrollViewport
          ref={viewportRef}
          className="h-full px-3 py-3 text-slate-600 [overflow-anchor:none] md:px-4"
          onScroll={handleScroll}
          data-testid="chat-scroll-viewport"
          role="log"
          aria-label="Conversation"
        >
          <div ref={contentRef} className="min-h-full">
            {loadingMore ? (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-500">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                Loading earlier messages...
              </div>
            ) : null}

            {rows.length === 0 ? (
              <EmptyConversation sessionStateLabel={sessionStateLabel} routeNotice={routeNotice} />
            ) : shouldVirtualize ? (
              <div
                className="relative w-full"
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                }}
              >
                {virtualItems.map((item) =>
                  renderRow(rows[item.index]!, item.index, {
                    transform: `translateY(${item.start}px)`,
                  }),
                )}
              </div>
            ) : (
              <div className="space-y-0.5">{rows.map((row, index) => renderRow(row, index))}</div>
            )}
          </div>
        </ScrollViewport>
      </div>
    </section>
  );
};
