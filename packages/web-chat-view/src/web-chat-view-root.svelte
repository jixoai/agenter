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
    getBottomAnchoredDistanceToLatest,
    normalizeAnchoredVirtualListScrollRequest,
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
    readScrollTriggerQuery,
    type ScrollVirtualConfig,
  } from "@agenter/svelte-components";
  import { onDestroy, tick, untrack } from "svelte";

  import ChatAvatar from "./chat-avatar.svelte";
  import DefaultComposer from "./default-composer.svelte";
  import { Button, Link, Messages } from "./framework7-components";
  import Framework7Runtime from "./framework7-runtime.svelte";
  import MessageRow from "./message-row.svelte";
  import {
    createCommentResourcePayload,
    mergeResourceReferences,
    resolveMessageResourceReferences,
  } from "./resource-contract";
  import { Badge } from "./ui/badge";
  import {
    buildTranscriptRenderModels,
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
    WebChatCommentDraftRequest,
    WebChatConnectionState,
    WebChatCommentResourcePayload,
    WebChatMessage,
    WebChatMessageReference,
    WebChatResourceReference,
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
    resolveMessageResources,
    onCreateCommentDraft,
    composerCapabilities,
    resolveComposerMentionSuggestions,
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
  let scrollToLatestButtonHostRef: HTMLDivElement | null = $state(null as HTMLDivElement | null);
  let footerRef: HTMLElement | null = $state(null as HTMLElement | null);
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
  let transcriptOverflowing = $state(false);
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
  let composerDraftInsertions = $state<{ id: string; text: string }[]>([]);
  let composerCommentResourceInsertions = $state<WebChatCommentResourcePayload[]>([]);
  let draftedCommentResources = $state<WebChatCommentResourcePayload[]>([]);
  let liveComposerResourceReferences = $state<WebChatResourceReference[]>([]);
  let pendingInitialLatestAlignmentChatId = $state<string | null>(null);
  let pendingInitialLatestAlignmentToken = 0;
  let initialLatestAlignmentPending = $state(false);
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
  const referencedMessageById = $derived.by(() => {
    const byId = new Map<number, WebChatMessageReference>();
    for (const message of transcriptMessages) {
      if (typeof message.messageId !== "number") {
        continue;
      }
      byId.set(message.messageId, {
        messageId: message.messageId,
        from: message.from,
        kind: message.kind,
        content: message.content,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        recalledAt: message.recalledAt,
      });
    }
    return byId;
  });
  const effectiveSocketFactory = $derived(socketFactory ?? defaultSocketFactory);
  const effectiveViewerActorId = $derived(resolveViewerActorId(channel, viewerActorId));
  const transcriptRows = $derived(
    buildTranscriptRenderModels(transcriptMessages, channel, effectiveViewerActorId),
  );
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
    transcriptMessages.length === 0
      ? "chat-scroll-content chat-scroll-content-empty"
      : "chat-scroll-content",
  );
  const showScrollToLatestAffordance = $derived(
    transcriptMessages.length > 0 && transcriptOverflowing && !timelineAtLatest,
  );
  const transcriptVirtual = $derived.by(() => {
    if (transcriptRows.length === 0) {
      return undefined;
    }
    return {
      estimateSize: (_index, row) => estimateMessageRowSize(row.message),
      getItemKey: (_index, row) => row.message.viewKey,
      measureElement: true,
      overscan: 8,
      useAnimationFrameWithResizeObserver: true,
    } satisfies Omit<ScrollVirtualConfig<(typeof transcriptRows)[number]>, "items">;
  });

  const composerProps = $derived.by(() => {
    if (!channel) {
      return null;
    }
    const attachmentsEnabled = submitMessage ? composerCapabilities?.attachmentEnabled ?? true : false;
    const transcriptResourceReferences = transcriptMessages.flatMap((message) =>
      mergeResourceReferences(
        resolveMessageResourceReferences({
          attachments: message.attachments ?? [],
          metadata: message.metadata,
          content: message.content,
          messageId: message.messageId,
          viewKey: message.viewKey,
          senderActorId: message.senderContactId ?? null,
          from: message.from,
        }),
        resolveMessageResources?.({
          channel,
          message,
          viewerActorId: effectiveViewerActorId,
          isAssistant: isAssistantMessage(channel, message),
          onSubmitInteractive: async (text) => {
            await handleSubmit({ text, assets: [] });
          },
        }) ?? [],
      ),
    );
    const effectiveResourceReferences = mergeResourceReferences(
      mergeResourceReferences(composerCapabilities?.resourceReferences ?? [], transcriptResourceReferences),
      liveComposerResourceReferences,
    ).concat([
      ...draftedCommentResources.map((resource) => ({
        id: resource.id,
        label: resource.label,
        tokenText: resource.tokenText,
        kind: "comment" as const,
        detailText: resource.commentText,
        extension: "cmt",
        commentText: resource.commentText,
        commentAnchor: {
          sourceMessageId: resource.sourceMessageId,
          sourceViewKey: resource.sourceViewKey,
          sourceLineNumber: resource.sourceLineNumber,
          selectedText: resource.selectedText,
          sourceActorId: resource.sourceActorId,
          sourceActorLabel: resource.sourceActorLabel,
          sourceUri: resource.sourceUri,
        },
      })),
    ]);
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
        resourceReferences: effectiveResourceReferences,
        resolveMentionSuggestions:
          resolveComposerMentionSuggestions
            ? async (query: string) =>
                await resolveComposerMentionSuggestions({
                  channel,
                  viewerActorId: effectiveViewerActorId,
                  query,
                })
            : composerCapabilities?.resolveMentionSuggestions,
      },
      liveResourceReferences: effectiveResourceReferences,
      draftInsertions: composerDraftInsertions,
      commentResourceInsertions: composerCommentResourceInsertions,
      onDraftInsertionApplied: (id: string) => {
        composerDraftInsertions = composerDraftInsertions.filter((item) => item.id !== id);
      },
      onCommentResourceInsertionApplied: (id: string) => {
        composerCommentResourceInsertions = composerCommentResourceInsertions.filter((item) => item.id !== id);
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
    const stickyBottomMessage = timelineAtLatest ? latestTranscriptMessage : null;
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
        senderContactId: sender.senderContactId,
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
        draftedCommentResources = [];
        return;
      }
      if (payload.assets.length > 0) {
        throw new Error("attachments require a host send handler");
      }
      if ((payload.commentResources?.length ?? 0) > 0) {
        throw new Error("comment resources require a host send handler");
      }
      await sendText(payload.text);
    } finally {
      sending = false;
    }
  }

  const queueCommentDraft = async (input: WebChatCommentDraftRequest): Promise<void> => {
    if (!channel) {
      return;
    }
    const existingCommentCount =
      (composerCapabilities?.resourceReferences ?? []).filter((reference) => reference.kind === "comment").length +
      draftedCommentResources.length;
    const payload = createCommentResourcePayload({
      id:
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      index: existingCommentCount + 1,
      commentText: input.commentText,
      sourceMessageId: input.sourceMessageId,
      sourceViewKey: input.sourceViewKey,
      sourceLineNumber: input.sourceLineNumber,
      selectedText: input.selectedText,
      sourceActorId: input.sourceActorId,
      sourceActorLabel: input.sourceActorLabel,
      sourceUri: input.sourceUri,
    });
    draftedCommentResources = [...draftedCommentResources, payload];
    composerCommentResourceInsertions = [...composerCommentResourceInsertions, payload];
    composerDraftInsertions = [
      ...composerDraftInsertions,
      {
        id: `token-${payload.id}`,
        text: `${payload.tokenText} `,
      },
    ];
    await onCreateCommentDraft?.(input);
  };

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

  const escapeSelectorValue = (value: string): string =>
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(value)
      : value.replace(/["\\]/gu, "\\$&");

  const resolveMessageSelector = (viewKey: string): string =>
    `[data-view-key="${escapeSelectorValue(viewKey)}"]`;

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

  const pinLatestIfNeeded = async (reason: string): Promise<void> => {
    const timeline = timelineRef;
    const viewport = viewportRef;
    if (!timeline || !viewport || !timelineAtLatest || !transcriptOverflowing) {
      return;
    }
    if (getBottomAnchoredDistanceToLatest(viewport) > 80) {
      return;
    }
    await timeline.request(
      normalizeAnchoredVirtualListScrollRequest({
        intent: "seek",
        target: { kind: "edge", edge: "latest" },
        source: "reconcile",
        priority: "background",
        behavior: "auto",
        settle: "settle",
        debugLabel: reason,
      }),
    );
  };

  const normalizeInitialEntryFraming = (viewport: HTMLDivElement): void => {
    const overflowPx = Math.round(viewport.scrollHeight - viewport.clientHeight);
    if (overflowPx > 1) {
      return;
    }
    const firstRow = viewport.querySelector<HTMLElement>("[data-view-key]");
    if (!(firstRow instanceof HTMLElement)) {
      return;
    }
    const viewportRect = viewport.getBoundingClientRect();
    const rowRect = firstRow.getBoundingClientRect();
    const hiddenTopPx = Math.round(viewportRect.top - rowRect.top);
    const readableThresholdPx = Math.min(128, Math.max(48, Math.round(rowRect.height * 0.55)));
    if (hiddenTopPx <= 0 || hiddenTopPx > readableThresholdPx) {
      return;
    }
    viewport.scrollTop = Math.max(0, viewport.scrollTop - hiddenTopPx);
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
    pendingInitialLatestAlignmentChatId = chatId;
    pendingInitialLatestAlignmentToken += 1;
    initialLatestAlignmentPending = chatId !== null;
    clearVisibility();
  });

  $effect(() => {
    const chatId = channel?.chatId ?? null;
    const pendingChatId = pendingInitialLatestAlignmentChatId;
    const messageCount = transcriptMessages.length;
    const timeline = timelineRef;
    const viewport = viewportRef;
    if (
      !chatId ||
      pendingChatId !== chatId ||
      loadingInitial ||
      !timeline ||
      !viewport
    ) {
      if (!chatId || (messageCount === 0 && !loadingInitial)) {
        initialLatestAlignmentPending = false;
      }
      return;
    }
    if (messageCount === 0) {
      return;
    }

    const alignmentToken = pendingInitialLatestAlignmentToken;
    const waitForFrame = (): Promise<void> =>
      new Promise((resolve) => {
        const targetWindow = viewport.ownerDocument?.defaultView;
        if (targetWindow?.requestAnimationFrame) {
          targetWindow.requestAnimationFrame(() => resolve());
          return;
        }
        setTimeout(resolve, 0);
      });

    void (async () => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        await tick();
        await waitForFrame();
        if (
          alignmentToken !== pendingInitialLatestAlignmentToken ||
          pendingInitialLatestAlignmentChatId !== chatId
        ) {
          return;
        }
        const activeViewport = viewportRef;
        const activeTimeline = timelineRef;
        if (!activeViewport || !activeTimeline) {
          return;
        }
        void activeTimeline.request(
          normalizeAnchoredVirtualListScrollRequest({
            intent: "seek",
            target: { kind: "edge", edge: "latest" },
            source: "navigation",
            priority: "background",
            behavior: "auto",
            settle: "settle",
            debugLabel: "web-chat-initial-room-latest",
          }),
        );
        await waitForFrame();
        normalizeInitialEntryFraming(activeViewport);
        if (
          activeViewport.scrollHeight <= activeViewport.clientHeight + 1 ||
          getBottomAnchoredDistanceToLatest(activeViewport) <= 1
        ) {
          pendingInitialLatestAlignmentChatId = null;
          initialLatestAlignmentPending = false;
          return;
        }
      }
      if (
        alignmentToken === pendingInitialLatestAlignmentToken &&
        pendingInitialLatestAlignmentChatId === chatId
      ) {
        pendingInitialLatestAlignmentChatId = null;
        initialLatestAlignmentPending = false;
      }
    })();
  });

  $effect(() => {
    scrollControllerRef = internalScrollControllerRef;
  });

  $effect(() => {
    const controller = internalScrollControllerRef;
    const viewport = viewportRef;
    const content = contentRef;
    const latestButtonHost = scrollToLatestButtonHostRef;
    if (!controller || !viewport || !content || !latestButtonHost) {
      return;
    }
    return untrack(() => {
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
        element: latestButtonHost,
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
      const unsubscribeQuery = controller.subscribe((query) => {
        const overflow = readScrollTriggerQuery(query, overflowTriggerName, emptyOverflowQuery);
        transcriptOverflowing = overflow.overflowing;
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
        const appendMessageAnchors = transportDelta.insertedKeys.map((viewKey) => ({
          selector: resolveMessageSelector(viewKey),
        }));
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
          case transportDelta.changed &&
            transportDelta.direction === "append" &&
            !wasAtLatest &&
            appendMessageAnchors.length > 0:
            return runProgramTx(
              program,
              async (tx) => {
                tx.mutation.append({
                  inserted: appendMessageAnchors,
                });
                tx.anchor.preserve();
                await tx.commit();
              },
              {
                priority: "background",
                interruptionPolicy: "protected",
                debugLabel: "web-chat-append-preserve-away",
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
        unsubscribeQuery();
        transcriptOverflowing = false;
        uninstallProgram();
      };
    });
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

  $effect(() => {
    const footer = footerRef;
    if (!footer || typeof ResizeObserver === "undefined") {
      return;
    }
    let disposed = false;
    let scheduled = false;
    let lastObservedSize = "";
    const schedulePinLatest = (): void => {
      if (scheduled || disposed) {
        return;
      }
      scheduled = true;
      queueMicrotask(async () => {
        scheduled = false;
        if (disposed) {
          return;
        }
        await tick();
        if (disposed) {
          return;
        }
        void pinLatestIfNeeded("web-chat-footer-resize-pin-latest");
      });
    };
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = Math.round(entry?.contentRect.width ?? footer.clientWidth);
      const height = Math.round(entry?.contentRect.height ?? footer.clientHeight);
      const nextSize = `${width}x${height}`;
      if (nextSize === lastObservedSize) {
        return;
      }
      lastObservedSize = nextSize;
      schedulePinLatest();
    });
    observer.observe(footer);
    return () => {
      disposed = true;
      observer.disconnect();
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
  <Framework7Runtime />
  <div class="chat-shell" part="shell" data-embedded={showHeader ? "false" : "true"}>
    {#if showHeader && channel && effectiveChannelPresentation}
      <header class="chat-header" part="header">
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
              <div class="chat-card-title">{effectiveChannelPresentation.label}</div>
              <div class="chat-card-description chat-header-description">
                {effectiveChannelPresentation.subtitle ?? describeChannelAudience(channel)}
              </div>
            </div>
          </div>
        </div>
        <div class="chat-status-block" part="status-block">
          <Badge class="chat-status-chip" part="status-chip" data-state={connectionState}>
            {connectionState}
          </Badge>
          {#if focused}
            <Badge part="focus-chip">Focused</Badge>
          {/if}
        </div>
      </header>
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
      <div class="chat-empty-shell">
        <div class="empty-state" part="empty-state">
          <h3>{emptyTitle}</h3>
          <p>{emptyMessage}</p>
        </div>
      </div>
    {:else}
      <div class="chat-stage" part="body">
        <div
          class="chat-transcript-shell"
          part="transcript-shell"
          data-initial-latest-pending={initialLatestAlignmentPending && transcriptOverflowing ? "true" : "false"}
        >
          {#if transcriptPreambleNotice}
            <div class="chat-transcript-notice" part="transcript-notice" data-tone={transcriptPreambleNotice.tone ?? "info"}>
              {transcriptPreambleNotice.message}
            </div>
          {/if}
          <Messages class="chat-messages-surface" init={false}>
            <AnchoredVirtualList
              bind:viewportRef
              bind:contentRef
              bind:scrollHandleRef={timelineRef}
              bind:scrollControllerRef={internalScrollControllerRef}
              bind:atLatest={timelineAtLatest}
              class="chat-scroll"
              viewportClass={`chat-scroll-viewport ${showHeader ? "" : "chat-scroll-viewport-embedded"} ${
                initialLatestAlignmentPending && transcriptOverflowing ? "chat-scroll-viewport-initial-hidden" : ""
              }`}
              contentClass={transcriptContentClass}
              viewportTestId="web-chat-scroll-viewport"
              onViewportScroll={handleScroll}
              items={transcriptRows}
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

              {#snippet item(row)}
                <section
                  data-view-key={row.message.viewKey}
                  data-assistant-message={isAssistantMessage(channel, row.message) ? "true" : "false"}
                  data-insert-motion={insertMotionByViewKey[row.message.viewKey] ?? "none"}
                  data-insert-motion-key={row.message.viewKey}
                >
                  <MessageRow
                    {channel}
                    viewerActorId={effectiveViewerActorId}
                    message={row.message}
                    groupFirst={row.groupFirst}
                    groupLast={row.groupLast}
                    groupTail={row.groupTail}
                    referencedMessage={
                      typeof row.message.ref === "number" ? referencedMessageById.get(row.message.ref) ?? null : null
                    }
                    {resolveActorPresentation}
                    {resolveMessageActions}
                    {resolveMessageReadProgress}
                    {resolveMessageResources}
                    onCreateCommentDraft={queueCommentDraft}
                    onSubmitInteractive={async (text) => {
                      await handleSubmit({ text, assets: [] });
                    }}
                  />
                </section>
              {/snippet}
            </AnchoredVirtualList>
          </Messages>
          <div bind:this={scrollToLatestButtonHostRef} class="chat-scroll-latest" data-visible={showScrollToLatestAffordance}>
            <Button
              aria-label="Scroll to latest"
              aria-hidden={!showScrollToLatestAffordance}
              class="chat-scroll-latest-button"
              iconOnly
              part="scroll-latest"
              type="button"
              tabindex={showScrollToLatestAffordance ? undefined : -1}
              title="Scroll to latest"
              variant="ghost"
              size="icon-sm"
            >
              <ArrowDown class="size-[1.05rem]" />
            </Button>
          </div>
        </div>

        {#if composerProps && (showComposerWhenDisabled || !disabled)}
          <footer bind:this={footerRef} class={`chat-footer ${showHeader ? "" : "chat-footer-embedded"}`}>
            <DefaultComposer {...composerProps} />
          </footer>
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
    --web-chat-border: rgba(219, 225, 234, 0.9);
    --web-chat-surface: rgba(255, 255, 255, 0.98);
    --web-chat-foreground: #0f172a;
    --web-chat-muted: #64748b;
    --web-chat-body-font-size: 13px;
    --web-chat-body-line-height: 1.2;
    --web-chat-caption-font-size: 10px;
    --web-chat-bubble-font-size: 12px;
    --f7-message-bubble-border-radius: 15px;
    --f7-message-bubble-padding-vertical: 5px;
    --f7-message-bubble-padding-horizontal: 9px;
    --f7-messagebar-height: 46px;
    --f7-messagebar-textarea-height: 31px;
    --f7-messagebar-textarea-font-size: 13px;
    --f7-messagebar-textarea-line-height: 1.28;
    --f7-messagebar-textarea-padding: 5px 9px 4px;
    --f7-messagebar-textarea-border-radius: 16px;
    container-type: inline-size;
    block-size: 100%;
    min-block-size: 0;
    color: var(--web-chat-foreground);
    font-size: var(--web-chat-body-font-size);
    line-height: var(--web-chat-body-line-height);
  }

  .chat-shell,
  .chat-stage,
  .chat-transcript-shell,
  .chat-scroll,
  .chat-scroll-viewport {
    block-size: 100%;
    min-block-size: 0;
  }

  .chat-shell {
    display: flex;
    flex-direction: column;
    background: var(--f7-messages-content-bg-color, transparent);
    position: relative;
  }

  .chat-shell[data-embedded="true"] {
    background: transparent;
  }

  .chat-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 0.75rem;
    padding: 0.7rem 1rem 0.66rem;
    border-bottom: 1px solid color-mix(in srgb, var(--web-chat-border) 82%, transparent);
    background: var(--f7-bars-bg-color, rgba(248, 248, 252, 0.82));
    backdrop-filter: saturate(180%) blur(20px);
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

  .chat-card-title {
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.3;
    color: var(--f7-text-color, #111827);
  }

  .chat-card-description {
    margin: 0;
    font-size: 0.82rem;
    line-height: 1.42;
    color: var(--f7-text-color-secondary, #6b7280);
  }

  .chat-transcript-shell {
    position: relative;
    isolation: isolate;
  }

  :global(.chat-scroll-viewport-initial-hidden) {
    opacity: 0;
    pointer-events: none;
  }

  .chat-transcript-edge-affordance {
    display: flex;
    justify-content: center;
    padding: 0.58rem 0.9rem 0.18rem;
    color: var(--web-chat-muted);
    font-size: 0.74rem;
    line-height: 1.4;
  }

  .chat-scroll-latest {
    position: absolute;
    inset-inline-end: 1rem;
    inset-block-end: 0.72rem;
    z-index: 8;
    opacity: 0;
    pointer-events: none;
    transform: translateY(8px) scale(0.94);
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
    width: 2.15rem;
    min-width: 2.15rem;
    height: 2.15rem;
    border: 1px solid color-mix(in srgb, var(--f7-theme-color, #007aff) 24%, white 42%);
    border-radius: 999px;
    background: color-mix(in srgb, var(--web-chat-surface) 88%, white 12%);
    color: var(--f7-theme-color, #007aff);
    box-shadow: 0 8px 18px -20px rgba(15, 23, 42, 0.22);
    backdrop-filter: saturate(180%) blur(16px);
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
    margin: 0.75rem 0.8rem 0;
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

  .chat-stage {
    display: grid;
    flex: 1 1 auto;
    grid-template-rows: minmax(0, 1fr) auto;
    min-block-size: 0;
    position: relative;
  }

  .chat-transcript-shell {
    display: grid;
    min-block-size: 0;
  }

  .chat-scroll-viewport {
    padding: 0;
    transition: opacity 120ms ease;
  }

  .chat-scroll {
    display: block;
    min-block-size: 0;
  }

  .chat-messages-surface {
    display: block;
    block-size: 100%;
    min-block-size: 0;
    margin: 0;
    padding-bottom: 0;
    background: transparent;
  }

  :global(.chat-messages-surface.messages) {
    display: block;
    min-block-size: 100%;
    margin: 0;
    background: transparent;
  }

  .chat-scroll-content {
    display: grid;
    gap: 0;
    min-block-size: auto;
    padding-block-end: 0.04rem;
    padding-inline: 0.4rem 0.6rem;
    align-content: start;
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
    padding: 0 0 calc(env(safe-area-inset-bottom));
    border-top: 1px solid color-mix(in srgb, var(--web-chat-border) 62%, transparent);
    background: var(--f7-toolbar-bg-color, rgba(247, 247, 250, 0.9));
    backdrop-filter: saturate(180%) blur(18px);
  }

  .chat-scroll-viewport-embedded {
    padding: 0 0.02rem 0.08rem;
  }

  .chat-footer-embedded {
    padding-inline: 0.12rem;
    border-top-color: color-mix(in srgb, var(--web-chat-border) 54%, transparent);
    background: var(--f7-toolbar-bg-color, rgba(247, 247, 250, 0.94));
  }

  .chat-empty-shell {
    block-size: 100%;
    display: grid;
    padding: 1rem;
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
    .web-chat-view {
      --web-chat-body-font-size: 13px;
      --web-chat-body-line-height: 1.2;
      --web-chat-caption-font-size: 10px;
      --web-chat-bubble-font-size: 12px;
      --f7-message-bubble-border-radius: 15px;
      --f7-message-bubble-padding-vertical: 5px;
      --f7-message-bubble-padding-horizontal: 9px;
      --f7-messagebar-height: 46px;
      --f7-messagebar-textarea-height: 31px;
      --f7-messagebar-textarea-font-size: 13px;
      --f7-messagebar-textarea-padding: 5px 9px 4px;
    }

    .chat-header {
      gap: 0.625rem;
      padding: 0.68rem 0.72rem 0.62rem;
    }

    .chat-status-block {
      justify-self: start;
    }

    .chat-notice {
      margin-inline: 0.65rem;
    }

    .chat-scroll-viewport {
      padding-inline: 0;
      padding-top: 0;
      padding-bottom: 0;
    }

    .chat-scroll-viewport-embedded {
      padding-inline: 0;
      padding-block: 0 0.06rem;
    }

    .chat-scroll-content {
      padding-inline: 0;
    }

    .chat-footer {
      padding-inline: 0;
    }

    .chat-footer-embedded {
      padding-inline: 0.08rem;
    }
  }
</style>
