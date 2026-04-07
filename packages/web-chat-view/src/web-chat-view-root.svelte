<script lang="ts">
  import type {
    MessageTransportClientMessage,
    MessageTransportServerMessage,
    ReverseTimeCursor,
  } from "@agenter/message-system/types";
  import { Scaffold, ScrollView, type ScrollVirtualConfig } from "@agenter/svelte-components";
  import { onMount, untrack } from "svelte";

  import ChatAvatar from "./chat-avatar.svelte";
  import DefaultWebChatComposer from "./default-composer.svelte";
  import MessageRow from "./message-row.svelte";
  import { Badge } from "./ui/badge";
  import * as Card from "./ui/card";
  import {
    compareMessages,
    estimateMessageRowSize,
    isAssistantMessage,
    mergeMessages,
    normalizeMessageRecords,
    resolveViewerActorId,
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
    viewerActorId = null,
    initialMessages = [],
    initialSnapshotResolved = false,
    disabled = false,
    class: className = "",
    showHeader = true,
    emptyTitle = "No messages yet",
    emptyMessage = "Send a message to start this chat channel.",
    emptyTranscriptTitle = emptyTitle,
    emptyTranscriptMessage = emptyMessage,
    routeNotice = null,
    channelPresentation = null,
    resolveActorPresentation,
    resolveMessageActions,
    resolveMessageReadProgress,
    composerCapabilities,
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
  const effectiveViewerActorId = $derived(resolveViewerActorId(channel, viewerActorId));
  const effectiveChannelPresentation = $derived.by(() => {
    if (!channel) {
      return null;
    }
    return (
      channelPresentation ?? {
        label: channel.title,
        subtitle: `${channel.participants.length} participants · ${channel.kind}`,
        iconUrl: null,
        kind: "room" as const,
      }
    );
  });
  const composerHint = $derived(
    submitMessage
      ? "Enter to send, Shift+Enter for newline"
      : connectionState === "connected"
        ? "Enter to send, Shift+Enter for newline"
        : "Waiting for channel transport",
  );
  const transcriptNotice = $derived.by(() => {
    if (errorMessage) {
      return {
        tone: "destructive" as const,
        message: errorMessage,
      };
    }
    return routeNotice;
  });
  const surfaceNotice = $derived(showHeader ? transcriptNotice : null);
  const transcriptPreambleNotice = $derived(!showHeader ? transcriptNotice : null);
  const transcriptContentClass = $derived(
    transcriptMessages.length === 0 ? "chat-scroll-content chat-scroll-content-empty" : "chat-scroll-content",
  );
  const transcriptVirtual = $derived.by(() => {
    if (transcriptMessages.length === 0) {
      return undefined;
    }
    return {
      items: transcriptMessages,
      estimateSize: (_index, message) => estimateMessageRowSize(message),
      getItemKey: (_index, message) => message.messageId,
      measureElement: true,
      overscan: 8,
      useAnimationFrameWithResizeObserver: true,
    } satisfies ScrollVirtualConfig<WebChatMessage>;
  });

  const composerProps = $derived.by(() => {
    if (!channel) {
      return null;
    }
    const attachmentsEnabled = submitMessage ? composerCapabilities?.attachmentEnabled ?? true : false;
    return {
      channel,
      disabled: disabled || sending || (!submitMessage && connectionState !== "connected"),
      sending,
      connectionState,
      hintText: composerHint,
      capabilities: {
        ...composerCapabilities,
        attachmentEnabled: attachmentsEnabled,
        imageEnabled: attachmentsEnabled && (composerCapabilities?.imageEnabled ?? true),
        screenshotEnabled: attachmentsEnabled && (composerCapabilities?.screenshotEnabled ?? true),
      },
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
    initialSnapshotResolved: boolean;
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

    loadingInitial = !input.initialSnapshotResolved && input.seedMessages.length === 0;
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
    const sender = resolveUserSender(channel, effectiveViewerActorId);
    const payload: MessageTransportClientMessage = {
      type: "send",
      message: {
        senderActorId: sender.senderActorId,
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
      initialSnapshotResolved,
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
    const currentChatId = channel?.chatId;
    if (!currentChatId || !initialSnapshotResolved || !loadingInitial) {
      return;
    }
    loadingInitial = false;
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
    const observedRows = new Map<string, HTMLElement>();
    const syncObservedRows = (): void => {
      const nextRows = new Map<string, HTMLElement>();
      viewportRef?.querySelectorAll<HTMLElement>("[data-message-id]").forEach((row) => {
        const messageId = row.dataset.messageId;
        if (!messageId) {
          return;
        }
        nextRows.set(messageId, row);
        const currentRow = observedRows.get(messageId);
        if (!currentRow) {
          observedRows.set(messageId, row);
          observer.observe(row);
          return;
        }
        if (currentRow !== row) {
          observer.unobserve(currentRow);
          observedRows.set(messageId, row);
          observer.observe(row);
        }
      });
      for (const [messageId, row] of observedRows) {
        if (nextRows.get(messageId) === row) {
          continue;
        }
        observer.unobserve(row);
        observedRows.delete(messageId);
        visibleMessageIds.delete(messageId);
        visibleAssistantIds.delete(messageId);
      }
      syncLatestVisibleIds();
    };
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
    syncObservedRows();
    const mutationObserver =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => {
            syncObservedRows();
          });
    mutationObserver?.observe(viewportRef, { childList: true, subtree: true });
    return () => {
      mutationObserver?.disconnect();
      observer.disconnect();
      observedRows.clear();
    };
  });

  onMount(() => {
    if (!contentRef || typeof ResizeObserver === "undefined") {
      return;
    }
    let frame = 0;
    const scheduleStickToBottom = (): void => {
      if (frame !== 0) {
        cancelAnimationFrame(frame);
      }
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!stickToBottom || !viewportRef) {
          return;
        }
        viewportRef.scrollTop = viewportRef.scrollHeight;
      });
    };
    const observer = new ResizeObserver(() => {
      scheduleStickToBottom();
    });
    observer.observe(contentRef);
    return () => {
      if (frame !== 0) {
        cancelAnimationFrame(frame);
      }
      observer.disconnect();
    };
  });
</script>

<div
  class={`web-chat-view ${className}`}
  class:embedded={!showHeader}
  part="surface"
  data-connected={connectionState}
  data-focused={focused ? "true" : "false"}
>
  <div class="chat-card" part="shell" data-embedded={showHeader ? "false" : "true"}>
    {#if showHeader && channel && effectiveChannelPresentation}
      <Card.Header class="chat-header border-b" part="header">
        <div class="chat-header-copy" part="header-copy">
          <div class="chat-header-main">
            <ChatAvatar
              label={effectiveChannelPresentation.label}
              subtitle={effectiveChannelPresentation.subtitle}
              src={effectiveChannelPresentation.iconUrl}
              class="size-11 rounded-[1.2rem]"
            />
            <div class="min-w-0">
              <div class="chat-eyebrow" part="eyebrow">Room transcript</div>
              <Card.Title>{effectiveChannelPresentation.label}</Card.Title>
              <Card.Description class="chat-header-description">
                {effectiveChannelPresentation.subtitle ?? `${channel.participants.length} participants · ${channel.kind}`}
              </Card.Description>
            </div>
          </div>
        </div>
        <Card.Action class="chat-status-block" part="status-block">
          <Badge class="chat-status-chip" variant="outline" part="status-chip" data-state={connectionState}>
            {connectionState}
          </Badge>
          {#if focused}
            <Badge variant="secondary" part="focus-chip">Focused</Badge>
          {/if}
        </Card.Action>
      </Card.Header>
    {/if}

    {#if surfaceNotice}
      <div
        class="chat-notice"
        part="notice"
        data-tone={surfaceNotice.tone ?? "info"}
      >
        {surfaceNotice.message}
      </div>
    {/if}

    {#if !channel}
      <Card.Content class="chat-empty-shell">
        <div class="empty-state" part="empty-state">
          <h3>{emptyTitle}</h3>
          <p>{emptyMessage}</p>
        </div>
      </Card.Content>
    {:else}
      <Scaffold.Root class="chat-scaffold">
        <Scaffold.Body class="chat-body" part="body">
          <div class="chat-transcript-shell" part="transcript-shell">
            {#if transcriptPreambleNotice}
              <div class="chat-transcript-notice" part="transcript-notice" data-tone={transcriptPreambleNotice.tone ?? "info"}>
                {transcriptPreambleNotice.message}
              </div>
            {/if}
            <ScrollView
              bind:viewportRef
              bind:contentRef
              class="chat-scroll"
              viewportClass={`chat-scroll-viewport ${showHeader ? "" : "chat-scroll-viewport-embedded"}`}
              contentClass={transcriptContentClass}
              viewportTestId="web-chat-scroll-viewport"
              onViewportScroll={handleScroll}
              virtual={transcriptVirtual}
            >
              {#if loadingInitial && transcriptMessages.length === 0}
                <div class="empty-state" part="empty-state loading-state">
                  <h3>Loading channel history...</h3>
                  <p>Connecting to the room transport.</p>
                </div>
              {:else if transcriptMessages.length === 0}
                <div class="empty-state" part="empty-state transcript-empty-state">
                  <h3>{emptyTranscriptTitle}</h3>
                  <p>{emptyTranscriptMessage}</p>
                </div>
              {/if}
              {#snippet item(message)}
                <section
                  data-message-id={message.messageId}
                  data-assistant-message={isAssistantMessage(channel, message) ? "true" : "false"}
                >
                  <MessageRow
                    {channel}
                    viewerActorId={effectiveViewerActorId}
                    {message}
                    {resolveActorPresentation}
                    {resolveMessageActions}
                    {resolveMessageReadProgress}
                    onSubmitInteractive={async (text) => {
                      await handleSubmit({ text, assets: [] });
                    }}
                  />
                </section>
              {/snippet}
            </ScrollView>
          </div>
        </Scaffold.Body>

        {#if composerProps}
          <Scaffold.Footer class={`chat-footer border-t ${showHeader ? "" : "chat-footer-embedded"}`}>
            <DefaultWebChatComposer {...composerProps} />
          </Scaffold.Footer>
        {/if}
      </Scaffold.Root>
    {/if}
  </div>
</div>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  .web-chat-view {
    --web-chat-border: rgba(219, 225, 234, 0.9);
    --web-chat-surface: rgba(255, 255, 255, 0.98);
    --web-chat-foreground: #0f172a;
    --web-chat-muted: #64748b;
    container-type: inline-size;
    block-size: 100%;
    min-block-size: 0;
    color: var(--web-chat-foreground);
  }

  .chat-card,
  .chat-scaffold,
  .chat-body,
  .chat-transcript-shell,
  .chat-scroll,
  .chat-scroll-viewport {
    block-size: 100%;
    min-block-size: 0;
  }

  .chat-card {
    display: flex;
    flex-direction: column;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96)),
      radial-gradient(circle at top, rgba(20, 184, 166, 0.06), transparent 58%);
    border-color: var(--web-chat-border);
    border-radius: 1.15rem;
    border-style: solid;
    border-width: 1px;
    box-shadow: 0 28px 54px -44px rgba(15, 23, 42, 0.3);
    overflow: clip;
  }

  .chat-card[data-embedded="true"] {
    border: 0;
    border-radius: 0;
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--background), white 18%) 0%,
        color-mix(in srgb, var(--card), white 12%) 48%,
        color-mix(in srgb, var(--background), var(--card) 74%) 100%
      );
    box-shadow: none;
  }

  .chat-header {
    gap: 0.75rem;
    padding-block: 1rem 0.875rem;
  }

  .chat-header-copy {
    min-inline-size: 0;
  }

  .chat-header-main {
    display: flex;
    align-items: flex-start;
    gap: 0.9rem;
    min-inline-size: 0;
  }

  .chat-header-description {
    line-height: 1.45;
  }

  .chat-eyebrow {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--web-chat-muted);
  }

  .chat-status-block {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-self: end;
  }

  :global(.chat-status-chip[data-state="connected"]) {
    background: rgba(240, 253, 250, 0.95);
    border-color: rgba(45, 212, 191, 0.35);
    color: #0f766e;
  }

  :global(.chat-status-chip[data-state="connecting"]) {
    background: rgba(255, 251, 235, 0.95);
    border-color: rgba(251, 191, 36, 0.35);
    color: #b45309;
  }

  :global(.chat-status-chip[data-state="error"]) {
    background: rgba(255, 241, 242, 0.95);
    border-color: rgba(244, 63, 94, 0.35);
    color: #be123c;
  }

  .chat-notice {
    margin: 0.875rem 1rem 0;
    border: 1px solid rgba(148, 163, 184, 0.24);
    border-radius: 1rem;
    padding: 0.8rem 0.9rem;
    background: rgba(248, 250, 252, 0.9);
    color: #334155;
    font-size: 0.84rem;
    line-height: 1.55;
  }

  .chat-notice[data-tone="warning"] {
    background: rgba(255, 251, 235, 0.95);
    border-color: rgba(251, 191, 36, 0.4);
    color: #b45309;
  }

  .chat-notice[data-tone="destructive"] {
    background: rgba(255, 241, 242, 0.95);
    border-color: rgba(244, 63, 94, 0.35);
    color: #be123c;
  }

  .chat-scaffold {
    flex: 1 1 auto;
    grid-template-rows: minmax(0, 1fr) auto;
  }

  .chat-body,
  .chat-transcript-shell {
    display: grid;
  }

  .chat-body {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0)),
      radial-gradient(circle at top, rgba(20, 184, 166, 0.05), transparent 52%);
  }

  .chat-scroll-viewport {
    padding: 1rem 1rem 0.75rem;
  }

  .chat-scroll-content {
    display: grid;
    gap: 0.15rem;
    min-block-size: 100%;
    padding-block-end: 1rem;
  }

  .chat-transcript-notice {
    margin: 0 0 0.85rem;
    border: 1px solid rgba(148, 163, 184, 0.24);
    border-radius: 1rem;
    padding: 0.8rem 0.9rem;
    background: rgba(248, 250, 252, 0.9);
    color: #334155;
    font-size: 0.84rem;
    line-height: 1.55;
  }

  .chat-transcript-notice[data-tone="warning"] {
    background: rgba(255, 251, 235, 0.95);
    border-color: rgba(251, 191, 36, 0.4);
    color: #b45309;
  }

  .chat-transcript-notice[data-tone="destructive"] {
    background: rgba(255, 241, 242, 0.95);
    border-color: rgba(244, 63, 94, 0.35);
    color: #be123c;
  }

  .chat-scroll-content-empty {
    align-content: center;
  }

  .chat-footer {
    padding: 0;
    background: linear-gradient(180deg, rgba(248, 250, 252, 0.16), rgba(248, 250, 252, 0.98));
  }

  .chat-scroll-viewport-embedded {
    padding: 0.55rem 0 0.5rem;
  }

  .chat-footer-embedded {
    background:
      linear-gradient(180deg, rgba(248, 250, 252, 0) 0%, rgba(248, 250, 252, 0.96) 26%, rgba(248, 250, 252, 0.99) 100%);
  }

  .chat-empty-shell {
    block-size: 100%;
    display: grid;
    padding-block: 0;
  }

  .empty-state {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 0.5rem;
    min-block-size: 10rem;
    padding: 2rem 1.5rem;
    text-align: center;
    color: var(--web-chat-muted);
  }

  .empty-state h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.35;
  }

  .empty-state p {
    margin: 0;
    max-inline-size: 24rem;
    font-size: 0.9rem;
    line-height: 1.6;
  }

  @container (max-width: 38rem) {
    .chat-header {
      gap: 0.875rem;
    }

    .chat-status-block {
      justify-self: start;
    }

    .chat-notice {
      margin-inline: 0.75rem;
    }

    .chat-scroll-viewport {
      padding-inline: 0.75rem;
    }

    .chat-scroll-viewport-embedded {
      padding-inline: 0;
      padding-block: 0.4rem 0.4rem;
    }
  }
</style>
