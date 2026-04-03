<script lang="ts">
  import type {
    MessageTransportClientMessage,
    MessageTransportServerMessage,
    ReverseTimeCursor,
  } from "@agenter/message-system/types";
  import { onMount, untrack } from "svelte";

  import DefaultWebChatComposer from "./default-composer.svelte";
  import MessageRow from "./message-row.svelte";
  import {
    compareMessages,
    isAssistantMessage,
    mergeMessages,
    normalizeMessageRecords,
    resolveUserSender,
  } from "./message-utils";
  import type {
    WebChatComposerRenderProps,
    WebChatComposerSubmitPayload,
    WebChatConnectionState,
    WebChatMessage,
    WebChatRootProps,
    WebChatSocketFactory,
    WebChatSocketLike,
  } from "./types";

  const CONNECTING_READY_STATE = 0;
  const OPEN_READY_STATE = 1;
  const LOAD_MORE_OFFSET = 160;
  const STICKY_BOTTOM_OFFSET = 48;

  let {
    channel,
    initialMessages = [],
    disabled = false,
    class: className = "",
    showHeader = true,
    emptyTitle = "No messages yet",
    emptyMessage = "Send a message to start this chat channel.",
    routeNotice = null,
    submitMessage,
    latestVisibleAssistantMessageIdHandler,
    latestVisibleMessageIdHandler,
    socketFactory,
  }: WebChatRootProps = $props();

  let viewportRef: HTMLDivElement | null = $state(null as HTMLDivElement | null);
  let contentRef: HTMLDivElement | null = $state(null as HTMLDivElement | null);
  let messages: WebChatMessage[] = $state([] as WebChatMessage[]);
  let connectionState: WebChatConnectionState = $state("idle" as WebChatConnectionState);
  let errorMessage: string | null = $state(null as string | null);
  let focused = $state(false);
  let hasMoreBefore = $state(false);
  let loadingInitial = $state(false);
  let loadingMore = $state(false);
  let sending = $state(false);
  let stickToBottom = $state(true);

  let nextBefore: ReverseTimeCursor | null = null;
  let socketRef: WebChatSocketLike | null = null;
  let prependAnchor: { count: number; scrollHeight: number; scrollTop: number } | null = null;
  let activeTransportKey = "";
  const visibleMessageIds = new Map<string, boolean>();
  const visibleAssistantIds = new Map<string, boolean>();
  let latestVisibleMessageId: string | null = null;
  let latestVisibleAssistantMessageId: string | null = null;

  const defaultSocketFactory: WebChatSocketFactory = (url) => new WebSocket(url);

  const transcriptMessages = $derived([...messages].sort(compareMessages));
  const effectiveSocketFactory = $derived(socketFactory ?? defaultSocketFactory);
  const composerHint = $derived(
    submitMessage
      ? "Enter to send, Shift+Enter for newline"
      : connectionState === "connected"
        ? "Enter to send, Shift+Enter for newline"
        : "Waiting for channel transport",
  );

  const composerProps = $derived.by(() => {
    if (!channel) {
      return null;
    }
    return {
      channel,
      disabled: disabled || sending || (!submitMessage && connectionState !== "connected"),
      sending,
      connectionState,
      hintText: composerHint,
      onSubmit: handleSubmit,
    } satisfies WebChatComposerRenderProps;
  });

  const parseServerMessage = (raw: unknown): MessageTransportServerMessage | null => {
    if (typeof raw !== "string") {
      return null;
    }
    try {
      return JSON.parse(raw) as MessageTransportServerMessage;
    } catch {
      return null;
    }
  };

  const syncLatestVisibleIds = (): void => {
    let nextMessageId: string | null = null;
    let nextAssistantId: string | null = null;
    for (let index = transcriptMessages.length - 1; index >= 0; index -= 1) {
      const message = transcriptMessages[index];
      if (!message) {
        continue;
      }
      if (nextMessageId === null && visibleMessageIds.get(message.messageId) === true) {
        nextMessageId = message.messageId;
      }
      if (
        nextAssistantId === null &&
        isAssistantMessage(channel, message) &&
        visibleAssistantIds.get(message.messageId) === true
      ) {
        nextAssistantId = message.messageId;
      }
      if (nextMessageId !== null && nextAssistantId !== null) {
        break;
      }
    }
    if (latestVisibleMessageId !== nextMessageId) {
      latestVisibleMessageId = nextMessageId;
      latestVisibleMessageIdHandler?.(nextMessageId);
    }
    if (latestVisibleAssistantMessageId !== nextAssistantId) {
      latestVisibleAssistantMessageId = nextAssistantId;
      latestVisibleAssistantMessageIdHandler?.(nextAssistantId);
    }
  };

  const clearVisibility = (): void => {
    const hadVisibleMessage = latestVisibleMessageId !== null;
    const hadVisibleAssistantMessage = latestVisibleAssistantMessageId !== null;
    visibleMessageIds.clear();
    visibleAssistantIds.clear();
    latestVisibleMessageId = null;
    latestVisibleAssistantMessageId = null;
    if (hadVisibleMessage) {
      latestVisibleMessageIdHandler?.(null);
    }
    if (hadVisibleAssistantMessage) {
      latestVisibleAssistantMessageIdHandler?.(null);
    }
  };

  const closeSocket = (socket: WebChatSocketLike | null): void => {
    if (!socket) {
      return;
    }
    if (socket.readyState === CONNECTING_READY_STATE) {
      const settle = (): void => {
        socket.removeEventListener("open", closeAfterOpen);
        socket.removeEventListener("close", settle);
        socket.removeEventListener("error", settle);
      };
      const closeAfterOpen = (): void => {
        socket.close();
        settle();
      };
      socket.addEventListener("open", closeAfterOpen);
      socket.addEventListener("close", settle);
      socket.addEventListener("error", settle);
      return;
    }
    if (socket.readyState === OPEN_READY_STATE) {
      socket.close();
    }
  };

  const connectTransport = (input: {
    chatId: string | null;
    transportUrl: string | null;
    factory: WebChatSocketFactory;
    seedMessages: WebChatMessage[];
  }): (() => void) | undefined => {
    messages = input.seedMessages;
    errorMessage = null;
    hasMoreBefore = false;
    nextBefore = null;
    loadingMore = false;

    if (!input.chatId) {
      connectionState = "idle";
      loadingInitial = false;
      return undefined;
    }
    if (!input.transportUrl) {
      connectionState = "closed";
      loadingInitial = false;
      return undefined;
    }

    loadingInitial = true;
    connectionState = "connecting";
    let disposed = false;
    let localSocket: WebChatSocketLike | null = null;

    queueMicrotask(() => {
      if (disposed) {
        return;
      }
      const transportUrl = input.transportUrl;
      if (!transportUrl) {
        return;
      }
      localSocket = input.factory(transportUrl);
      socketRef = localSocket;
      const isCurrentSocket = () => socketRef === localSocket;

      const handleOpen = (): void => {
        if (!isCurrentSocket()) {
          return;
        }
        connectionState = "connected";
      };

      const handleMessage = (event: Event | MessageEvent): void => {
        if (!isCurrentSocket()) {
          return;
        }
        const serverMessage = parseServerMessage(event instanceof MessageEvent ? event.data : null);
        if (!serverMessage) {
          return;
        }
        if (serverMessage.type === "snapshot") {
          messages = normalizeMessageRecords(serverMessage.snapshot.items);
          nextBefore = serverMessage.snapshot.nextBefore;
          hasMoreBefore = serverMessage.snapshot.hasMoreBefore;
          focused = serverMessage.snapshot.channel.focused;
          loadingInitial = false;
          loadingMore = false;
          errorMessage = null;
          return;
        }
        if (serverMessage.type === "messages") {
          messages = mergeMessages(messages, normalizeMessageRecords(serverMessage.items));
          return;
        }
        if (serverMessage.type === "page") {
          nextBefore = serverMessage.page.nextBefore;
          hasMoreBefore = serverMessage.page.hasMoreBefore;
          messages = mergeMessages(messages, normalizeMessageRecords(serverMessage.page.items));
          loadingMore = false;
          return;
        }
        if (serverMessage.type === "focus") {
          focused = serverMessage.focused;
          return;
        }
        errorMessage = serverMessage.message;
        loadingInitial = false;
        loadingMore = false;
        connectionState = "error";
      };

      const handleClose = (): void => {
        if (!isCurrentSocket()) {
          return;
        }
        loadingInitial = false;
        loadingMore = false;
        connectionState = "closed";
      };

      const handleError = (): void => {
        if (!isCurrentSocket()) {
          return;
        }
        loadingInitial = false;
        loadingMore = false;
        connectionState = "error";
        errorMessage = "chat transport failed";
      };

      localSocket.addEventListener("open", handleOpen);
      localSocket.addEventListener("message", handleMessage);
      localSocket.addEventListener("close", handleClose);
      localSocket.addEventListener("error", handleError);
    });

    return () => {
      disposed = true;
      if (socketRef === localSocket) {
        socketRef = null;
      }
      closeSocket(localSocket);
    };
  };

  const sendText = async (text: string): Promise<void> => {
    if (!channel || !socketRef || socketRef.readyState !== OPEN_READY_STATE) {
      throw new Error("chat transport is not connected");
    }
    const normalized = text.trim();
    if (normalized.length === 0) {
      return;
    }
    const sender = resolveUserSender(channel);
    const payload: MessageTransportClientMessage = {
      type: "send",
      message: {
        from: sender.from,
        to: sender.to,
        content: normalized,
      },
    };
    socketRef.send(JSON.stringify(payload));
  };

  async function handleSubmit(payload: WebChatComposerSubmitPayload): Promise<void> {
    if (!channel) {
      return;
    }
    sending = true;
    try {
      if (submitMessage) {
        await submitMessage(payload);
        return;
      }
      if (payload.assets.length > 0) {
        throw new Error("attachments require a host send handler");
      }
      await sendText(payload.text);
    } finally {
      sending = false;
    }
  }

  const loadOlder = (): void => {
    if (!socketRef || socketRef.readyState !== OPEN_READY_STATE || !nextBefore || loadingMore) {
      return;
    }
    loadingMore = true;
    const payload: MessageTransportClientMessage = {
      type: "page",
      before: nextBefore,
      limit: 80,
    };
    socketRef.send(JSON.stringify(payload));
  };

  const handleScroll = (): void => {
    if (!viewportRef) {
      return;
    }
    const distanceFromBottom = viewportRef.scrollHeight - viewportRef.scrollTop - viewportRef.clientHeight;
    const nextStickToBottom = distanceFromBottom <= STICKY_BOTTOM_OFFSET;
    if (stickToBottom !== nextStickToBottom) {
      stickToBottom = nextStickToBottom;
    }
    if (viewportRef.scrollTop <= LOAD_MORE_OFFSET && hasMoreBefore && !loadingMore) {
      prependAnchor = {
        count: transcriptMessages.length,
        scrollHeight: viewportRef.scrollHeight,
        scrollTop: viewportRef.scrollTop,
      };
      loadOlder();
    }
  };

  $effect(() => {
    const chatId = channel?.chatId ?? null;
    const transportUrl = channel?.transportUrl ?? null;
    const factory = effectiveSocketFactory;
    const transportKey = `${chatId ?? ""}::${transportUrl ?? ""}`;
    if (transportKey === activeTransportKey) {
      return;
    }
    activeTransportKey = transportKey;
    const seedMessages = untrack(() => normalizeMessageRecords(initialMessages));
    return connectTransport({
      chatId,
      transportUrl,
      factory,
      seedMessages,
    });
  });

  $effect(() => {
    focused = channel?.focused ?? false;
  });

  $effect(() => {
    const currentChatId = channel?.chatId;
    const seedMessages = initialMessages;
    if (!seedMessages.length || !currentChatId) {
      return;
    }
    messages = mergeMessages(untrack(() => messages), normalizeMessageRecords(seedMessages));
  });

  $effect(() => {
    const chatId = channel?.chatId;
    clearVisibility();
    void chatId;
  });

  $effect(() => {
    if (!stickToBottom || !viewportRef) {
      return;
    }
    const targetWindow = viewportRef.ownerDocument.defaultView;
    if (!targetWindow) {
      return;
    }
    let settleFrame: number | null = null;
    const frame = targetWindow.requestAnimationFrame(() => {
      if (!viewportRef) {
        return;
      }
      viewportRef.scrollTop = viewportRef.scrollHeight;
      settleFrame = targetWindow.requestAnimationFrame(() => {
        if (viewportRef) {
          viewportRef.scrollTop = viewportRef.scrollHeight;
        }
      });
    });
    return () => {
      targetWindow.cancelAnimationFrame(frame);
      if (settleFrame !== null) {
        targetWindow.cancelAnimationFrame(settleFrame);
      }
    };
  });

  $effect(() => {
    if (!prependAnchor || !viewportRef || loadingMore) {
      return;
    }
    if (messages.length > prependAnchor.count) {
      viewportRef.scrollTop = Math.max(
        0,
        prependAnchor.scrollTop + (viewportRef.scrollHeight - prependAnchor.scrollHeight),
      );
    }
    prependAnchor = null;
  });

  $effect(() => {
    if (!viewportRef || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          const messageId = target.dataset.messageId;
          if (!messageId) {
            continue;
          }
          const visible = entry.isIntersecting && entry.intersectionRatio >= 0.2;
          visibleMessageIds.set(messageId, visible);
          if (target.dataset.assistantMessage === "true") {
            visibleAssistantIds.set(messageId, visible);
          }
        }
        syncLatestVisibleIds();
      },
      { root: viewportRef, threshold: [0.2, 0.5, 0.8] },
    );
    const rows = viewportRef.querySelectorAll<HTMLElement>("[data-message-id]");
    rows.forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  });

  onMount(() => {
    if (!contentRef || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (!stickToBottom || !viewportRef) {
        return;
      }
      viewportRef.scrollTop = viewportRef.scrollHeight;
    });
    observer.observe(contentRef);
    return () => observer.disconnect();
  });
</script>

<div class={`web-chat-view ${className}`} data-connected={connectionState}>
  {#if showHeader && channel}
    <header class="header">
      <div class="header-copy">
        <div class="eyebrow">Room transcript</div>
        <h2>{channel.title}</h2>
      </div>
      <div class="status-block">
        <span class="status-chip" data-state={connectionState}>{connectionState}</span>
        {#if focused}
          <span class="focus-chip">Focused</span>
        {/if}
      </div>
    </header>
  {/if}

  {#if routeNotice || errorMessage}
    <div class="notice" data-tone={errorMessage ? "destructive" : routeNotice?.tone ?? "info"}>
      {errorMessage ?? routeNotice?.message}
    </div>
  {/if}

  <div class="body">
    {#if !channel}
      <div class="empty-state">
        <h3>{emptyTitle}</h3>
        <p>{emptyMessage}</p>
      </div>
    {:else}
      <div class="transcript-shell">
        <div
          bind:this={viewportRef}
          class="transcript-viewport"
          data-testid="web-chat-scroll-viewport"
          onscroll={handleScroll}
        >
          <div bind:this={contentRef} class="transcript-content">
            {#if loadingInitial && transcriptMessages.length === 0}
              <div class="empty-state">
                <h3>Loading channel history...</h3>
                <p>Connecting to the room transport.</p>
              </div>
            {:else if transcriptMessages.length === 0}
              <div class="empty-state">
                <h3>{emptyTitle}</h3>
                <p>{emptyMessage}</p>
              </div>
            {:else}
              {#each transcriptMessages as message (message.messageId)}
                <section
                  data-message-id={message.messageId}
                  data-assistant-message={isAssistantMessage(channel, message) ? "true" : "false"}
                >
                  <MessageRow
                    {channel}
                    {message}
                    onSubmitInteractive={async (text) => {
                      await handleSubmit({ text, assets: [] });
                    }}
                  />
                </section>
              {/each}
            {/if}
          </div>
        </div>
        {#if composerProps}
          <DefaultWebChatComposer {...composerProps} />
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  .web-chat-view {
    --web-chat-border: #dbe1ea;
    --web-chat-surface: rgba(255, 255, 255, 0.96);
    --web-chat-foreground: #0f172a;
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    height: 100%;
    min-height: 0;
    border-radius: 1.5rem;
    border: 1px solid rgba(219, 225, 234, 0.85);
    background:
      radial-gradient(circle at top left, rgba(148, 163, 184, 0.12), transparent 40%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.98));
    color: var(--web-chat-foreground);
    box-shadow: 0 24px 64px rgba(15, 23, 42, 0.08);
  }

  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.25rem 0.75rem;
  }

  .header-copy h2,
  .empty-state h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.35;
  }

  .eyebrow {
    margin-bottom: 0.35rem;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #64748b;
  }

  .status-block {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .status-chip,
  .focus-chip {
    border-radius: 999px;
    padding: 0.35rem 0.65rem;
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .status-chip {
    border: 1px solid rgba(203, 213, 225, 0.95);
    background: rgba(248, 250, 252, 0.92);
    color: #475569;
  }

  .status-chip[data-state="connected"] {
    border-color: rgba(45, 212, 191, 0.45);
    background: rgba(240, 253, 250, 0.95);
    color: #0f766e;
  }

  .status-chip[data-state="connecting"] {
    border-color: rgba(251, 191, 36, 0.45);
    background: rgba(255, 251, 235, 0.95);
    color: #b45309;
  }

  .status-chip[data-state="error"] {
    border-color: rgba(244, 63, 94, 0.45);
    background: rgba(255, 241, 242, 0.95);
    color: #be123c;
  }

  .focus-chip {
    border: 1px solid rgba(148, 163, 184, 0.26);
    background: rgba(15, 23, 42, 0.05);
    color: #334155;
  }

  .notice {
    margin: 0 1.25rem 0.75rem;
    border-radius: 1rem;
    border: 1px solid rgba(148, 163, 184, 0.22);
    padding: 0.75rem 0.9rem;
    font-size: 0.84rem;
    line-height: 1.5;
    color: #334155;
    background: rgba(248, 250, 252, 0.86);
  }

  .notice[data-tone="warning"] {
    border-color: rgba(251, 191, 36, 0.4);
    background: rgba(255, 251, 235, 0.92);
    color: #b45309;
  }

  .notice[data-tone="destructive"] {
    border-color: rgba(244, 63, 94, 0.32);
    background: rgba(255, 241, 242, 0.92);
    color: #be123c;
  }

  .body,
  .transcript-shell {
    min-height: 0;
  }

  .body {
    display: grid;
  }

  .transcript-shell {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    height: 100%;
  }

  .transcript-viewport {
    min-height: 0;
    overflow: auto;
    padding: 0 1rem 0.5rem;
    scrollbar-width: thin;
    scrollbar-color: rgba(100, 116, 139, 0.45) transparent;
  }

  .transcript-content {
    min-height: 100%;
    display: grid;
    align-content: end;
    gap: 0;
    padding-bottom: 1rem;
  }

  .empty-state {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 0.5rem;
    min-height: 14rem;
    padding: 2rem 1.5rem;
    text-align: center;
    color: #64748b;
  }

  .empty-state p {
    margin: 0;
    max-width: 24rem;
    font-size: 0.9rem;
    line-height: 1.6;
  }
</style>
