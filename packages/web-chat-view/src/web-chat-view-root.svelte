<script lang="ts">
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import type {
    MessageTransportClientMessage,
    MessageTransportServerMessage,
    ReverseTimeCursor,
  } from "@agenter/message-system/types";
  import {
    BOTTOM_ANCHORED_INSERT_MOTION_CLEAR_DELAY_MS,
    AnchoredVirtualList,
    createActionTrigger,
    createCollectionDeltaTrigger,
    createEdgeTrigger,
    createInsertBatchTrigger,
    createOverflowTrigger,
    createUserInputTrigger,
    defineScrollTriggerName,
    getBottomAnchoredDistanceToStart,
    type ActionTriggerQuery,
    type AnchoredVirtualListScrollHandle,
    type CollectionDeltaTriggerQuery,
    type EdgeTriggerQuery,
    type InsertBatchTriggerQuery,
    type OverflowTriggerQuery,
    type ScrollController,
    type ScrollProgramController,
    type UserInputTriggerQuery,
    Scaffold,
    readScrollTriggerQuery,
    type ScrollVirtualConfig,
  } from "@agenter/svelte-components";
  import { onDestroy, tick, untrack } from "svelte";

  import ChatAvatar from "./chat-avatar.svelte";
  import DefaultComposer from "./default-composer.svelte";
  import MessageRow from "./message-row.svelte";
  import { Badge } from "./ui/badge";
  import { Button } from "./ui/button";
  import * as Card from "./ui/card";
  import {
    compareMessages,
    estimateMessageRowSize,
    isAssistantMessage,
    mergeMessages,
    normalizeMessageRecords,
    resolveMessageIdentityKey,
    resolveViewerActorId,
    resolveUserSender,
  } from "./message-utils";
  import type {
    WebChatComposerRenderProps,
    WebChatComposerSubmitPayload,
    WebChatChannel,
    WebChatConnectionState,
    WebChatMessage,
    WebChatRootProps,
    WebChatSocketFactory,
    WebChatSocketLike,
    WebChatVisibleMessageFact,
  } from "./types";

  const CONNECTING_READY_STATE = 0;
  const OPEN_READY_STATE = 1;
  const LOAD_MORE_OFFSET = 160;
  const edgeTriggerName = defineScrollTriggerName<EdgeTriggerQuery>("edge");
  const userInputTriggerName = defineScrollTriggerName<UserInputTriggerQuery>("userInput");
  const returnToLatestTriggerName = defineScrollTriggerName<ActionTriggerQuery>("returnToLatest");
  const seekHistoryStartTriggerName = defineScrollTriggerName<ActionTriggerQuery>("seekHistoryStart");
  const transportDeltaTriggerName = defineScrollTriggerName<CollectionDeltaTriggerQuery>("transportDelta");
  const olderPageDeltaTriggerName = defineScrollTriggerName<CollectionDeltaTriggerQuery>("olderPageDelta");
  const latestInsertTriggerName = defineScrollTriggerName<InsertBatchTriggerQuery>("latestInsert");
  const olderInsertTriggerName = defineScrollTriggerName<InsertBatchTriggerQuery>("olderInsert");
  const overflowTriggerName = defineScrollTriggerName<OverflowTriggerQuery>("overflow");
  const emptyEdgeQuery: EdgeTriggerQuery = {
    atLatest: true,
    atStart: true,
    enteredLatest: false,
    leftLatest: false,
    enteredStart: false,
    leftStart: false,
    distanceToLatestPx: 0,
    distanceToStartPx: 0,
  };
  const emptyUserInputQuery: UserInputTriggerQuery = {
    active: false,
    entered: false,
    exited: false,
    kind: "idle",
    pointerType: null,
    momentum: false,
    startedAt: null,
    lastEventAt: null,
  };
  const emptyCollectionDeltaQuery: CollectionDeltaTriggerQuery = {
    changed: false,
    direction: "unknown",
    insertedKeys: [],
    removedKeys: [],
    anchorKey: null,
  };
  const emptyInsertBatchQuery: InsertBatchTriggerQuery = {
    changed: false,
    motion: "latest",
    elements: [],
    extentPx: 0,
    nearestElement: null,
  };
  const emptyOverflowQuery: OverflowTriggerQuery = {
    overflowing: false,
    becameOverflowing: false,
    becameContained: false,
    overflowPx: 0,
    visibleExtentPx: 0,
    contentExtentPx: 0,
  };

  let {
    channel,
    viewerActorId = null,
    initialMessages = [],
    initialSnapshotResolved = false,
    disabled = false,
    showComposerWhenDisabled = true,
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
    latestVisibleAssistantViewKeyHandler,
    latestVisibleMessageIdHandler,
    scrollControllerRef = $bindable<ScrollController | null>(null),
    historyStartActionRef = $bindable<HTMLButtonElement | null>(null),
    socketFactory,
  }: WebChatRootProps = $props();

  let viewportRef: HTMLDivElement | null = $state(null as HTMLDivElement | null);
  let contentRef: HTMLDivElement | null = $state(null as HTMLDivElement | null);
  let timelineRef: AnchoredVirtualListScrollHandle | null = $state(null as AnchoredVirtualListScrollHandle | null);
  let internalScrollControllerRef: ScrollController | null = $state(null as ScrollController | null);
  let scrollToLatestButtonRef: HTMLButtonElement | null = $state(null as HTMLButtonElement | null);
  let messages: WebChatMessage[] = $state([] as WebChatMessage[]);
  let connectionState: WebChatConnectionState = $state("idle" as WebChatConnectionState);
  let errorMessage: string | null = $state(null as string | null);
  let focused = $state(false);
  let hasMoreBefore = $state(false);
  let loadingInitial = $state(false);
  let loadingMore = $state(false);
  let sending = $state(false);
  let timelineAtLatest = $state(true);
  let visibilityChatId = $state<string | null>(null);
  let insertMotionByViewKey = $state<Record<string, "latest" | "older">>({});
  let insertMotionClearHandle = 0;

  let nextBefore: ReverseTimeCursor | null = null;
  let socketRef: WebChatSocketLike | null = null;
  let activeTransportKey = "";
  const visibleMessageViewKeys = new Map<string, boolean>();
  const visibleAssistantViewKeys = new Map<string, boolean>();
  let latestVisibleMessage: WebChatVisibleMessageFact | null = null;
  let latestVisibleAssistantViewKey: string | null = null;
  let latestTranscriptMessageVisible = $state(false);
  let latestVisibleMessageEmission = $state<{
    chatId: string | null;
    viewerActorId: string | null;
    viewKey: string | null;
    rowId: number | null;
  }>({
    chatId: null,
    viewerActorId: null,
    viewKey: null,
    rowId: null,
  });

  const sameVisibleMessage = (
    left: WebChatVisibleMessageFact | null,
    right: WebChatVisibleMessageFact | null,
  ): boolean => {
    return (
      left?.viewKey === right?.viewKey &&
      (left?.messageId ?? null) === (right?.messageId ?? null) &&
      left?.rowId === right?.rowId
    );
  };
  const describeChannelAudience = (currentChannel: WebChatChannel): string => {
    const count = currentChannel.participants.length;
    const singular = currentChannel.kind === "room" ? "user" : "participant";
    const plural = currentChannel.kind === "room" ? "users" : "participants";
    return `${count} ${count === 1 ? singular : plural} · ${currentChannel.kind}`;
  };

  const defaultSocketFactory: WebChatSocketFactory = (url) => new WebSocket(url);
  const clearInsertMotion = (viewKeys?: string[]): void => {
    if (!viewKeys || viewKeys.length === 0) {
      insertMotionByViewKey = {};
      return;
    }
    const nextState = { ...insertMotionByViewKey };
    for (const viewKey of viewKeys) {
      delete nextState[viewKey];
    }
    insertMotionByViewKey = nextState;
  };
  const scheduleInsertMotionClear = (viewKeys: string[]): void => {
    if (typeof window === "undefined" || viewKeys.length === 0) {
      return;
    }
    if (insertMotionClearHandle !== 0) {
      window.clearTimeout(insertMotionClearHandle);
    }
    insertMotionClearHandle = window.setTimeout(() => {
      insertMotionClearHandle = 0;
      clearInsertMotion(viewKeys);
    }, BOTTOM_ANCHORED_INSERT_MOTION_CLEAR_DELAY_MS);
  };
  const markInsertedMessages = (viewKeys: string[], motion: "latest" | "older"): void => {
    if (viewKeys.length === 0) {
      return;
    }
    insertMotionByViewKey = {
      ...insertMotionByViewKey,
      ...Object.fromEntries(viewKeys.map((viewKey) => [viewKey, motion])),
    };
    scheduleInsertMotionClear(viewKeys);
  };
  const collectNewMessageViewKeys = (
    currentMessages: readonly WebChatMessage[],
    incomingMessages: readonly WebChatMessage[],
  ): string[] => {
    const currentIds = new Set(currentMessages.map(resolveMessageIdentityKey));
    return incomingMessages
      .filter((message) => !currentIds.has(resolveMessageIdentityKey(message)))
      .map((message) => message.viewKey);
  };
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
        subtitle: describeChannelAudience(channel),
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
      estimateSize: (_index, message) => estimateMessageRowSize(message),
      getItemKey: (_index, message) => message.viewKey,
      measureElement: true,
      overscan: 8,
      useAnimationFrameWithResizeObserver: true,
    } satisfies Omit<ScrollVirtualConfig<WebChatMessage>, "items">;
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
    let nextMessage: WebChatVisibleMessageFact | null = null;
    let nextAssistantViewKey: string | null = null;
    const latestTranscriptMessage = transcriptMessages[transcriptMessages.length - 1] ?? null;
    latestTranscriptMessageVisible = latestTranscriptMessage
      ? visibleMessageViewKeys.get(latestTranscriptMessage.viewKey) === true
      : false;
    const stickyBottomMessage =
      timelineAtLatest && latestTranscriptMessageVisible ? latestTranscriptMessage : null;
    const isVisibleMessage = (message: WebChatMessage): boolean => {
      if (message.viewKey === latestTranscriptMessage?.viewKey) {
        return latestTranscriptMessageVisible;
      }
      return visibleMessageViewKeys.get(message.viewKey) === true;
    };
    if (stickyBottomMessage) {
      nextMessage = {
        viewKey: stickyBottomMessage.viewKey,
        ...(typeof stickyBottomMessage.messageId === "number" ? { messageId: stickyBottomMessage.messageId } : {}),
        rowId: stickyBottomMessage.rowId,
      };
    }
    for (let index = transcriptMessages.length - 1; index >= 0; index -= 1) {
      const message = transcriptMessages[index];
      if (!message) {
        continue;
      }
      if (nextMessage === null && isVisibleMessage(message)) {
        nextMessage = {
          viewKey: message.viewKey,
          ...(typeof message.messageId === "number" ? { messageId: message.messageId } : {}),
          rowId: message.rowId,
        };
      }
      if (
        nextAssistantViewKey === null &&
        isAssistantMessage(channel, message) &&
        visibleAssistantViewKeys.get(message.viewKey) === true
      ) {
        nextAssistantViewKey = message.viewKey;
      }
      if (nextMessage !== null && nextAssistantViewKey !== null) {
        break;
      }
    }
    if (!sameVisibleMessage(latestVisibleMessage, nextMessage)) {
      latestVisibleMessage = nextMessage;
      latestVisibleMessageIdHandler?.(nextMessage);
      latestVisibleMessageEmission = {
        chatId: channel?.chatId ?? null,
        viewerActorId: effectiveViewerActorId ?? null,
        viewKey: nextMessage?.viewKey ?? null,
        rowId: nextMessage?.rowId ?? null,
      };
    }
    if (latestVisibleAssistantViewKey !== nextAssistantViewKey) {
      latestVisibleAssistantViewKey = nextAssistantViewKey;
      latestVisibleAssistantViewKeyHandler?.(nextAssistantViewKey);
    }
  };

  const clearVisibility = (): void => {
    const hadVisibleMessage = latestVisibleMessage !== null;
    const hadVisibleAssistantMessage = latestVisibleAssistantViewKey !== null;
    visibleMessageViewKeys.clear();
    visibleAssistantViewKeys.clear();
    latestTranscriptMessageVisible = false;
    latestVisibleMessage = null;
    latestVisibleAssistantViewKey = null;
    if (hadVisibleMessage) {
      latestVisibleMessageIdHandler?.(null);
    }
    if (hadVisibleAssistantMessage) {
      latestVisibleAssistantViewKeyHandler?.(null);
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
    clearInsertMotion();

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
          const nextItems = normalizeMessageRecords(serverMessage.items);
          const nextMessageViewKeys = collectNewMessageViewKeys(messages, nextItems);
          messages = mergeMessages(messages, nextItems);
          markInsertedMessages(nextMessageViewKeys, "latest");
          return;
        }
        if (serverMessage.type === "page") {
          const nextItems = normalizeMessageRecords(serverMessage.page.items);
          const nextMessageViewKeys = collectNewMessageViewKeys(messages, nextItems);
          nextBefore = serverMessage.page.nextBefore;
          hasMoreBefore = serverMessage.page.hasMoreBefore;
          messages = mergeMessages(messages, nextItems);
          markInsertedMessages(nextMessageViewKeys, "older");
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
    const distanceFromStart = getBottomAnchoredDistanceToStart(viewportRef);
    if (distanceFromStart <= LOAD_MORE_OFFSET && hasMoreBefore && !loadingMore) {
      loadOlder();
    }
  };

  const runProgramTx = async (
    program: ScrollProgramController,
    effect: Parameters<ScrollProgramController["tx"]>[0],
    options: Parameters<ScrollProgramController["tx"]>[1],
  ): Promise<void> => {
    const transaction = await program.tx(effect, options);
    void transaction.finished.catch(() => {
      /* shared tx interruption is an expected control-flow outcome */
    });
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
    const chatId = channel?.chatId ?? null;
    if (chatId === visibilityChatId) {
      return;
    }
    visibilityChatId = chatId;
    clearVisibility();
  });

  $effect(() => {
    scrollControllerRef = internalScrollControllerRef;
  });

  $effect(() => {
    const controller = internalScrollControllerRef;
    const viewport = viewportRef;
    const content = contentRef;
    const latestButton = scrollToLatestButtonRef;
    if (!controller || !viewport || !content || !latestButton) {
      return;
    }

    const observedDom = {
      viewport,
      content,
    } satisfies Parameters<ReturnType<typeof createEdgeTrigger>["observe"]>[0];

    const disconnectEdge = createEdgeTrigger({
      latestThreshold: 48,
      startThreshold: LOAD_MORE_OFFSET,
    }).observe(observedDom).connect(controller, { name: edgeTriggerName });
    const disconnectUserInput = createUserInputTrigger().observe(observedDom).connect(controller, {
      name: userInputTriggerName,
    });
    const disconnectReturnToLatest = createActionTrigger().observe({
      element: latestButton,
    }).connect(controller, { name: returnToLatestTriggerName });
    const disconnectSeekHistoryStart =
      historyStartActionRef instanceof HTMLButtonElement
        ? createActionTrigger().observe({
            element: historyStartActionRef,
          }).connect(controller, { name: seekHistoryStartTriggerName })
        : () => {};
    const disconnectTransportDelta = createCollectionDeltaTrigger({
      getKeys: () => transcriptMessages.map((message) => message.viewKey),
      directionFilter: ["append", "replace"],
    }).observe(observedDom).connect(controller, { name: transportDeltaTriggerName });
    const disconnectOlderPageDelta = createCollectionDeltaTrigger({
      getKeys: () => transcriptMessages.map((message) => message.viewKey),
      directionFilter: ["prepend"],
    }).observe(observedDom).connect(controller, { name: olderPageDeltaTriggerName });
    const disconnectLatestInsert = createInsertBatchTrigger({
      motion: "latest",
    }).observe(observedDom).connect(controller, { name: latestInsertTriggerName });
    const disconnectOlderInsert = createInsertBatchTrigger({
      motion: "older",
    }).observe(observedDom).connect(controller, { name: olderInsertTriggerName });
      const disconnectOverflow = createOverflowTrigger().observe(observedDom).connect(controller, {
        name: overflowTriggerName,
      });
      let previousEdgeAtLatest = true;
      let previousEdgeAtStart = false;

      const uninstallProgram = controller.install((program) => {
      const edge = readScrollTriggerQuery(program.query, edgeTriggerName, emptyEdgeQuery);
      const userInput = readScrollTriggerQuery(program.query, userInputTriggerName, emptyUserInputQuery);
      const transportDelta = readScrollTriggerQuery(
        program.query,
        transportDeltaTriggerName,
        emptyCollectionDeltaQuery,
      );
      const olderPageDelta = readScrollTriggerQuery(
        program.query,
        olderPageDeltaTriggerName,
        emptyCollectionDeltaQuery,
      );
      const latestInsert = readScrollTriggerQuery(program.query, latestInsertTriggerName, emptyInsertBatchQuery);
      const olderInsert = readScrollTriggerQuery(program.query, olderInsertTriggerName, {
        ...emptyInsertBatchQuery,
        motion: "older",
      });
      const overflow = readScrollTriggerQuery(program.query, overflowTriggerName, emptyOverflowQuery);
      const returnToLatest = readScrollTriggerQuery(program.query, returnToLatestTriggerName, {
        fired: false,
        count: 0,
        sourceElement: null,
        lastFiredAt: null,
      });
      const seekHistoryStart = readScrollTriggerQuery(program.query, seekHistoryStartTriggerName, {
        fired: false,
        count: 0,
        sourceElement: null,
        lastFiredAt: null,
      });
      const wasAtLatest = edge.atLatest || edge.leftLatest || previousEdgeAtLatest;
      const wasAtStart = edge.atStart || edge.leftStart || previousEdgeAtStart;
      previousEdgeAtLatest = edge.atLatest;
      previousEdgeAtStart = edge.atStart;

      switch (true) {
        case returnToLatest.fired:
          return runProgramTx(
            program,
            async (tx) => {
              await tx.scroll.pinLatest({
                behavior: "smooth",
                debugLabel: "web-chat-scroll-to-latest",
              });
            },
            {
              priority: "user-blocking",
              debugLabel: "web-chat-scroll-to-latest",
            },
          );
        case seekHistoryStart.fired:
          return runProgramTx(
            program,
            async (tx) => {
              await tx.scroll.seekStart({
                behavior: "smooth",
                debugLabel: "web-chat-seek-history-start",
              });
            },
            {
              priority: "user-blocking",
              debugLabel: "web-chat-seek-history-start",
            },
          );
        case transportDelta.changed && transportDelta.direction === "replace" && wasAtLatest:
          return runProgramTx(
            program,
            async (tx) => {
              await tx.scroll.pinLatest({
                behavior: "auto",
                debugLabel: "web-chat-initial-seek-latest",
              });
            },
            {
              priority: "background",
              debugLabel: "web-chat-initial-seek-latest",
            },
          );
        case overflow.becameOverflowing || overflow.becameContained:
        case userInput.entered:
          return;
      }
    });

    return () => {
      disconnectEdge();
      disconnectUserInput();
      disconnectReturnToLatest();
      disconnectSeekHistoryStart();
      disconnectTransportDelta();
      disconnectOlderPageDelta();
      disconnectLatestInsert();
      disconnectOlderInsert();
      disconnectOverflow();
      uninstallProgram();
    };
  });

  $effect(() => {
    timelineAtLatest;
    const latestMessage = transcriptMessages[transcriptMessages.length - 1] ?? null;
    latestMessage?.viewKey;
    latestMessage?.rowId;
    syncLatestVisibleIds();
  });

  $effect(() => {
    const chatId = channel?.chatId ?? null;
    const viewerActorId = effectiveViewerActorId ?? null;
    const message = latestVisibleMessage;
    if (!chatId || !message) {
      return;
    }
    if (
      latestVisibleMessageEmission.chatId !== chatId ||
      latestVisibleMessageEmission.viewKey !== message.viewKey ||
      latestVisibleMessageEmission.rowId !== message.rowId ||
      latestVisibleMessageEmission.viewerActorId === viewerActorId
    ) {
      return;
    }
    latestVisibleMessageEmission = {
      chatId,
      viewerActorId,
      viewKey: message.viewKey,
      rowId: message.rowId,
    };
    latestVisibleMessageIdHandler?.(message);
  });

  $effect(() => {
    if (!viewportRef || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observedRows = new Map<string, HTMLElement>();
    const syncObservedRows = (): void => {
      const nextRows = new Map<string, HTMLElement>();
      viewportRef?.querySelectorAll<HTMLElement>("[data-view-key]").forEach((row) => {
        const viewKey = row.dataset.viewKey;
        if (!viewKey) {
          return;
        }
        nextRows.set(viewKey, row);
        const currentRow = observedRows.get(viewKey);
        if (!currentRow) {
          observedRows.set(viewKey, row);
          observer.observe(row);
          return;
        }
        if (currentRow !== row) {
          observer.unobserve(currentRow);
          observedRows.set(viewKey, row);
          observer.observe(row);
        }
      });
      for (const [viewKey, row] of observedRows) {
        if (nextRows.get(viewKey) === row) {
          continue;
        }
        observer.unobserve(row);
        observedRows.delete(viewKey);
        visibleMessageViewKeys.delete(viewKey);
        visibleAssistantViewKeys.delete(viewKey);
      }
      syncLatestVisibleIds();
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          const viewKey = target.dataset.viewKey;
          if (!viewKey) {
            continue;
          }
          const visible = entry.isIntersecting && entry.intersectionRatio >= 0.2;
          visibleMessageViewKeys.set(viewKey, visible);
          if (target.dataset.assistantMessage === "true") {
            visibleAssistantViewKeys.set(viewKey, visible);
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

  onDestroy(() => {
    if (typeof window !== "undefined" && insertMotionClearHandle !== 0) {
      window.clearTimeout(insertMotionClearHandle);
    }
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
                {effectiveChannelPresentation.subtitle ?? describeChannelAudience(channel)}
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
            <AnchoredVirtualList
              bind:viewportRef
              bind:contentRef
              bind:scrollHandleRef={timelineRef}
              bind:scrollControllerRef={internalScrollControllerRef}
              bind:atLatest={timelineAtLatest}
              class="chat-scroll"
              viewportClass={`chat-scroll-viewport ${showHeader ? "" : "chat-scroll-viewport-embedded"}`}
              contentClass={transcriptContentClass}
              viewportTestId="web-chat-scroll-viewport"
              onViewportScroll={handleScroll}
              items={transcriptMessages}
              virtual={transcriptVirtual}
            >
              {#snippet start()}
                {#if loadingMore}
                  <div class="chat-transcript-edge-affordance" part="transcript-edge-affordance">
                    Loading older messages…
                  </div>
                {/if}
              {/snippet}

              {#snippet empty()}
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
              {/snippet}

              {#snippet item(message)}
                <section
                  data-view-key={message.viewKey}
                  data-assistant-message={isAssistantMessage(channel, message) ? "true" : "false"}
                  data-insert-motion={insertMotionByViewKey[message.viewKey] ?? "none"}
                  data-insert-motion-key={message.viewKey}
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
            </AnchoredVirtualList>
            <div class="chat-scroll-latest" data-visible={!latestTranscriptMessageVisible}>
              <Button
                bind:ref={scrollToLatestButtonRef}
                aria-label="Scroll to latest"
                aria-hidden={latestTranscriptMessageVisible}
                class="chat-scroll-latest-button"
                part="scroll-latest"
                size="icon"
                tabindex={latestTranscriptMessageVisible ? -1 : undefined}
                title="Scroll to latest"
                type="button"
                variant="outline"
              >
                <ArrowDown class="size-4" />
              </Button>
            </div>
          </div>
        </Scaffold.Body>

        {#if composerProps && (showComposerWhenDisabled || !disabled)}
          <Scaffold.Footer class={`chat-footer border-t ${showHeader ? "" : "chat-footer-embedded"}`}>
            <DefaultComposer {...composerProps} />
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

  .chat-transcript-shell {
    position: relative;
  }

  .chat-transcript-edge-affordance {
    display: flex;
    justify-content: center;
    padding: 0.75rem 1rem 0.25rem;
    color: var(--web-chat-muted);
    font-size: 0.8rem;
    line-height: 1.4;
  }

  .chat-scroll-latest {
    position: absolute;
    inset-inline-end: 1rem;
    inset-block-end: 1rem;
    z-index: 2;
    opacity: 0;
    pointer-events: none;
    transform: translateY(8px) scale(0.96);
    transition:
      opacity 160ms ease,
      transform 160ms ease;
  }

  .chat-scroll-latest[data-visible="true"] {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0) scale(1);
  }

  .chat-scroll-latest-button {
    border-color: color-mix(in srgb, var(--web-chat-border), transparent 16%);
    background: color-mix(in srgb, var(--web-chat-surface), transparent 12%);
    box-shadow: 0 18px 34px -24px rgba(15, 23, 42, 0.38);
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
    padding: 0.72rem 0.8rem 0.35rem;
  }

  .chat-scroll-content {
    display: grid;
    gap: 0.15rem;
    min-block-size: 100%;
    padding-block-end: 0.55rem;
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
    background: linear-gradient(180deg, rgba(248, 250, 252, 0.06), rgba(248, 250, 252, 0.94));
  }

  .chat-scroll-viewport-embedded {
    padding: 0.28rem 0 0.2rem;
  }

  .chat-footer-embedded {
    background:
      linear-gradient(180deg, rgba(248, 250, 252, 0) 0%, rgba(248, 250, 252, 0.88) 20%, rgba(248, 250, 252, 0.97) 100%);
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
      padding-inline: 0.6rem;
      padding-top: 0.56rem;
    }

    .chat-scroll-viewport-embedded {
      padding-inline: 0;
      padding-block: 0.18rem 0.12rem;
    }
  }
</style>
