import { useVirtualizer } from "@tanstack/react-virtual";
import { CircleAlert, LoaderCircle, MessageSquareText } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { useWebChatChannel } from "./chat-channel-state";
import { DefaultWebChatComposer } from "./default-composer";
import type {
  WebChatChannel,
  WebChatComposerRenderProps,
  WebChatComposerSubmitPayload,
  WebChatConnectionState,
  WebChatMessage,
  WebChatMessageRenderInput,
  WebChatNotice,
  WebChatSocketFactory,
} from "./types";

const LOAD_MORE_OFFSET = 160;
const STICKY_BOTTOM_OFFSET = 48;
const MESSAGE_ROW_ESTIMATE = 108;
const ROW_OVERSCAN = 8;

const compareMessageId = (left: string, right: string): number => {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }
  return left.localeCompare(right);
};

const connectionChipClassName = (state: WebChatConnectionState): string => {
  if (state === "connected") {
    return "border-teal-200 bg-teal-50 text-teal-700";
  }
  if (state === "connecting") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (state === "error") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-slate-200 bg-slate-100 text-slate-600";
};

const connectionLabel = (state: WebChatConnectionState): string => {
  switch (state) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting";
    case "error":
      return "Transport error";
    case "closed":
      return "Transport offline";
    default:
      return "Idle";
  }
};

const formatTimestamp = (timestamp: number): string =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));

const isAssistantMessage = (channel: WebChatChannel | null, message: WebChatMessage): boolean => {
  if (!channel) {
    return false;
  }
  return message.from === channel.owner || message.from === `avatar:${channel.owner}`;
};

const buildInteractiveText = (
  message: WebChatMessage,
  fields: Record<string, string>,
  fieldLabels: Record<string, string>,
): string => {
  const summaryLines = Object.entries(fields)
    .map(([id, value]) => {
      const normalized = value.trim();
      if (normalized.length === 0) {
        return null;
      }
      return `${fieldLabels[id] ?? id}: ${normalized}`;
    })
    .filter((value): value is string => value !== null);
  if (summaryLines.length === 0) {
    return message.content;
  }
  return `${message.content}\n${summaryLines.join("\n")}`;
};

const DefaultMessageRow = ({
  channel,
  message,
  onSubmitInteractive,
}: {
  channel: WebChatChannel;
  message: WebChatMessage;
  onSubmitInteractive: (text: string) => Promise<void>;
}) => {
  const assistant = isAssistantMessage(channel, message);
  const interactive = message.kind === "interactive" ? message.payload?.interactive : undefined;
  const [interactiveDraft, setInteractiveDraft] = useState<Record<string, string>>({});
  const [interactiveSubmitting, setInteractiveSubmitting] = useState(false);

  const handleInteractiveSubmit = async () => {
    if (!interactive || interactiveSubmitting) {
      return;
    }
    const labels = Object.fromEntries(interactive.fields.map((field) => [field.id, field.label]));
    setInteractiveSubmitting(true);
    try {
      await onSubmitInteractive(buildInteractiveText(message, interactiveDraft, labels));
    } finally {
      setInteractiveSubmitting(false);
    }
  };

  return (
    <div className={`flex w-full py-1.5 ${assistant ? "justify-start" : "justify-end"}`}>
      <article
        className={`max-w-[92%] rounded-2xl px-3 py-2.5 text-[13px] shadow-xs md:max-w-[44rem] ${
          message.kind === "error"
            ? "border border-rose-200 bg-rose-50 text-rose-900"
            : assistant
              ? "bg-white text-slate-800 ring-1 ring-slate-200"
              : "bg-slate-900 text-white"
        }`}
      >
        <div className={`mb-1 flex items-center gap-2 text-[11px] ${assistant ? "text-slate-500" : "text-white/70"}`}>
          <span className="truncate font-medium">{message.from}</span>
          <span>{formatTimestamp(message.createdAt)}</span>
        </div>
        {message.kind === "error" ? (
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1 text-xs font-medium text-rose-700">
              <CircleAlert className="h-3.5 w-3.5" />
              {message.payload?.error?.title ?? "Error"}
            </div>
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
            {message.payload?.error?.detail ? (
              <p className="whitespace-pre-wrap break-words text-xs text-rose-700">{message.payload.error.detail}</p>
            ) : null}
          </div>
        ) : message.kind === "interactive" && interactive ? (
          <div className="space-y-2.5">
            <p className="font-medium text-slate-900">{interactive.title}</p>
            {interactive.description ? <p className="text-xs text-slate-600">{interactive.description}</p> : null}
            <div className="space-y-2">
              {interactive.fields.map((field) => {
                const value = interactiveDraft[field.id] ?? field.initialValue ?? "";
                return (
                  <label key={field.id} className="block space-y-1 text-xs text-slate-700">
                    <span className="font-medium">{field.label}</span>
                    {field.multiline ? (
                      <textarea
                        value={value}
                        placeholder={field.placeholder}
                        onChange={(event) =>
                          setInteractiveDraft((current) => ({
                            ...current,
                            [field.id]: event.target.value,
                          }))
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                        rows={3}
                      />
                    ) : (
                      <input
                        value={value}
                        placeholder={field.placeholder}
                        onChange={(event) =>
                          setInteractiveDraft((current) => ({
                            ...current,
                            [field.id]: event.target.value,
                          }))
                        }
                        className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-slate-500"
                      />
                    )}
                  </label>
                );
              })}
            </div>
            <button
              type="button"
              className="inline-flex h-8 items-center rounded-md bg-slate-900 px-3 text-xs font-medium text-white disabled:opacity-50"
              onClick={handleInteractiveSubmit}
              disabled={interactiveSubmitting}
            >
              {interactiveSubmitting ? "Sending..." : interactive.submitLabel ?? "Submit"}
            </button>
          </div>
        ) : message.content.trim().length > 0 ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : null}
        {(message.attachments?.length ?? 0) > 0 ? (
          <ul className={`mt-2 space-y-1 text-[11px] ${assistant ? "text-slate-500" : "text-white/75"}`}>
            {message.attachments?.map((attachment) => (
              <li key={attachment.assetId}>{attachment.name}</li>
            ))}
          </ul>
        ) : null}
      </article>
    </div>
  );
};

const EmptyState = ({ title, message }: { title: string; message: string }) => (
  <div className="flex h-full items-center justify-center px-6 py-10 text-center">
    <div className="max-w-sm space-y-3 text-slate-600">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <MessageSquareText className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="text-sm">{message}</p>
    </div>
  </div>
);

export interface WebChatViewProps {
  channel: WebChatChannel | null;
  initialMessages?: WebChatMessage[];
  disabled?: boolean;
  className?: string;
  showHeader?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  routeNotice?: WebChatNotice | null;
  statusSlot?: ReactNode;
  renderComposer?: (props: WebChatComposerRenderProps) => ReactNode;
  renderMessage?: (input: WebChatMessageRenderInput) => ReactNode;
  onSendMessage?: (payload: WebChatComposerSubmitPayload) => Promise<void>;
  onLatestVisibleAssistantMessageIdChange?: (messageId: string | null) => void;
  socketFactory?: WebChatSocketFactory;
}

export const WebChatView = ({
  channel,
  initialMessages,
  disabled = false,
  className = "",
  showHeader = true,
  emptyTitle = "No messages yet",
  emptyMessage = "Send a message to start this chat channel.",
  routeNotice = null,
  statusSlot = null,
  renderComposer,
  renderMessage,
  onSendMessage,
  onLatestVisibleAssistantMessageIdChange,
  socketFactory,
}: WebChatViewProps) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const rowNodesRef = useRef(new Map<string, HTMLElement>());
  const visibleAssistantIdsRef = useRef(new Map<string, boolean>());
  const latestVisibleMessageIdRef = useRef<string | null>(null);
  const prependAnchorRef = useRef<{ count: number; scrollHeight: number; scrollTop: number } | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [sending, setSending] = useState(false);

  const {
    connectionState,
    messages,
    focused,
    hasMoreBefore,
    loadingInitial,
    loadingMore,
    errorMessage,
    loadOlder,
    sendText,
  } = useWebChatChannel({ channel, initialMessages, socketFactory });

  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => MESSAGE_ROW_ESTIMATE,
    overscan: ROW_OVERSCAN,
    initialRect: { width: 0, height: MESSAGE_ROW_ESTIMATE * 5 },
  });

  const handleSubmit = useCallback(
    async (payload: WebChatComposerSubmitPayload) => {
      if (!channel) {
        return;
      }
      setSending(true);
      try {
        if (onSendMessage) {
          await onSendMessage(payload);
        } else {
          if (payload.assets.length > 0) {
            throw new Error("attachments require a host send handler");
          }
          await sendText(payload.text);
        }
      } finally {
        setSending(false);
      }
    },
    [channel, onSendMessage, sendText],
  );

  const composerProps = useMemo<WebChatComposerRenderProps | null>(() => {
    if (!channel) {
      return null;
    }
    return {
      channel,
      disabled: disabled || connectionState !== "connected" || sending,
      sending,
      connectionState,
      onSubmit: handleSubmit,
    };
  }, [channel, connectionState, disabled, handleSubmit, sending]);

  const renderedComposer = composerProps
    ? renderComposer
      ? renderComposer(composerProps)
      : <DefaultWebChatComposer {...composerProps} />
    : null;

  const syncLatestVisibleAssistantMessageId = useCallback(() => {
    if (!onLatestVisibleAssistantMessageIdChange || !channel) {
      return;
    }
    let next: string | null = null;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (!message || !isAssistantMessage(channel, message)) {
        continue;
      }
      if (visibleAssistantIdsRef.current.get(message.messageId) === true) {
        next = message.messageId;
        break;
      }
    }
    if (latestVisibleMessageIdRef.current === next) {
      return;
    }
    latestVisibleMessageIdRef.current = next;
    onLatestVisibleAssistantMessageIdChange(next);
  }, [channel, messages, onLatestVisibleAssistantMessageIdChange]);

  useEffect(() => {
    if (!onLatestVisibleAssistantMessageIdChange) {
      return;
    }
    visibleAssistantIdsRef.current.clear();
    latestVisibleMessageIdRef.current = null;
    onLatestVisibleAssistantMessageIdChange(null);
  }, [channel?.chatId, onLatestVisibleAssistantMessageIdChange]);

  useEffect(() => {
    const root = viewportRef.current;
    if (!root || !channel || !onLatestVisibleAssistantMessageIdChange) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          const messageId = target.dataset.messageId;
          if (!messageId || target.dataset.assistantMessage !== "true") {
            continue;
          }
          visibleAssistantIdsRef.current.set(messageId, entry.isIntersecting && entry.intersectionRatio >= 0.2);
        }
        syncLatestVisibleAssistantMessageId();
      },
      { root, threshold: [0.2, 0.5, 0.8] },
    );
    rowNodesRef.current.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [channel, messages, onLatestVisibleAssistantMessageIdChange, syncLatestVisibleAssistantMessageId]);

  useEffect(() => {
    if (!stickToBottom) {
      return;
    }
    const viewport = viewportRef.current;
    const targetWindow = viewport?.ownerDocument.defaultView;
    if (!viewport || !targetWindow) {
      return;
    }
    let settleFrame: number | null = null;
    const frame = targetWindow.requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight;
      settleFrame = targetWindow.requestAnimationFrame(() => {
        viewport.scrollTop = viewport.scrollHeight;
      });
    });
    return () => {
      targetWindow.cancelAnimationFrame(frame);
      if (settleFrame !== null) {
        targetWindow.cancelAnimationFrame(settleFrame);
      }
    };
  }, [messages.length, stickToBottom]);

  useEffect(() => {
    const anchor = prependAnchorRef.current;
    const viewport = viewportRef.current;
    if (!anchor || !viewport || loadingMore) {
      return;
    }
    if (messages.length > anchor.count) {
      viewport.scrollTop = Math.max(0, anchor.scrollTop + (viewport.scrollHeight - anchor.scrollHeight));
    }
    prependAnchorRef.current = null;
  }, [loadingMore, messages.length]);

  useEffect(() => {
    const node = contentRef.current;
    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (!stickToBottom || !viewportRef.current) {
        return;
      }
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [stickToBottom]);

  const handleScroll = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    const nextStickToBottom = distanceFromBottom <= STICKY_BOTTOM_OFFSET;
    setStickToBottom((current) => (current === nextStickToBottom ? current : nextStickToBottom));
    if (viewport.scrollTop <= LOAD_MORE_OFFSET && hasMoreBefore && !loadingMore) {
      prependAnchorRef.current = {
        count: messages.length,
        scrollHeight: viewport.scrollHeight,
        scrollTop: viewport.scrollTop,
      };
      loadOlder();
    }
  }, [hasMoreBefore, loadOlder, loadingMore, messages.length]);

  const renderRow = (message: WebChatMessage, index: number, style?: CSSProperties) => {
    const assistant = isAssistantMessage(channel, message);
    const handleInteractiveSubmit = async (text: string): Promise<void> => {
      await handleSubmit({ text, assets: [] });
    };
    const content = renderMessage
      ? renderMessage({ channel: channel!, message, isAssistant: assistant, onSubmitInteractive: handleInteractiveSubmit })
      : <DefaultMessageRow channel={channel!} message={message} onSubmitInteractive={handleInteractiveSubmit} />;
    return (
      <section
        key={message.messageId}
        ref={(node) => {
          const current = rowNodesRef.current.get(message.messageId);
          if (current && current !== node) {
            rowNodesRef.current.delete(message.messageId);
          }
          if (node) {
            rowVirtualizer.measureElement(node);
            rowNodesRef.current.set(message.messageId, node);
          }
        }}
        data-index={index}
        data-message-id={message.messageId}
        data-assistant-message={assistant ? "true" : "false"}
        className={style ? "absolute top-0 left-0 w-full" : "w-full"}
        style={style}
      >
        {content}
      </section>
    );
  };

  return (
    <section
      className={`grid h-full min-w-0 flex-1 grid-cols-[minmax(0,1fr)] ${showHeader ? "grid-rows-[auto_auto_minmax(0,1fr)_auto]" : "grid-rows-[auto_minmax(0,1fr)_auto]"} rounded-[1.45rem] bg-[linear-gradient(180deg,rgba(248,250,252,0.96)_0%,rgba(241,245,249,0.92)_100%)] shadow-sm ring-1 ring-slate-200/80 ${className}`.trim()}
      data-testid="web-chat-view"
    >
      {showHeader ? (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-2.5 py-2 md:px-3 md:py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{channel?.title ?? DEFAULT_MESSAGE_CHAT_TITLE}</p>
            <p className="truncate text-[11px] text-slate-500">{channel ? channel.chatId : "Select a channel"}</p>
          </div>
          <div className="flex items-center gap-2">
            {statusSlot}
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium ${connectionChipClassName(connectionState)}`}>
              {connectionState === "connecting" ? <LoaderCircle className="h-3 w-3 animate-spin" /> : null}
              <span>{focused ? `${connectionLabel(connectionState)} · focused` : connectionLabel(connectionState)}</span>
            </span>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 px-3 pt-3 md:px-4">
        {routeNotice ? (
          <div className={`rounded-2xl border px-3 py-2 text-sm ${routeNotice.tone === "destructive" ? "border-rose-200 bg-rose-50 text-rose-700" : routeNotice.tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
            {routeNotice.message}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="mt-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</div>
        ) : null}
      </div>

      <div className="min-h-0 px-3 pb-3 md:px-4">
        <div
          ref={viewportRef}
          className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[color-mix(in_srgb,currentColor,transparent)] h-full min-h-0 overflow-auto [overflow-anchor:none]"
          data-testid="web-chat-scroll-viewport"
          role="log"
          aria-label="Channel conversation"
          onScroll={handleScroll}
        >
          <div ref={contentRef} className="min-h-full">
            {loadingMore ? (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-500">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                Loading earlier messages...
              </div>
            ) : null}

            {loadingInitial && messages.length === 0 ? (
              <div className="flex h-full min-h-[16rem] items-center justify-center gap-2 text-sm text-slate-500">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Loading channel history...
              </div>
            ) : messages.length === 0 ? (
              <EmptyState title={emptyTitle} message={emptyMessage} />
            ) : rowVirtualizer.getVirtualItems().length > 0 ? (
              <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
                {rowVirtualizer.getVirtualItems().map((item) =>
                  renderRow(messages[item.index]!, item.index, {
                    transform: `translateY(${item.start}px)`,
                  }),
                )}
              </div>
            ) : (
              <div className="space-y-0.5">{messages.map((message, index) => renderRow(message, index))}</div>
            )}
          </div>
        </div>
      </div>

      {renderedComposer}
    </section>
  );
};

const DEFAULT_MESSAGE_CHAT_TITLE = "Chat";
