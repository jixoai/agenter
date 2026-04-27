import type {
  MessageActorId,
  MessageControlPlane,
  MessageControlPlaneEntry,
  MessageRecord,
  ReverseTimeCursor,
} from "@agenter/message-system";

import type {
  RuntimeSystemIngressEnvelope,
  RuntimeSystemKernelAdapter,
  RuntimeSystemKernelHost,
} from "./types";

interface PendingUnreadReadAck {
  chatId: string;
  accessToken: string;
  targetMessageId: number;
  selectedMessageIds: number[];
}

export interface RuntimeMessageKernelAdapterOptions {
  messageSystem: MessageControlPlane;
  messageActorId: MessageActorId;
  isLoopPaused: () => boolean;
  getMaxFocusedRoomCount: () => number;
  getMaxBatchReadRoomMessageCount: () => number;
  getActorRoom: (
    chatId: string,
    options?: {
      includeArchived?: boolean;
      touchPresence?: boolean;
    },
  ) => MessageControlPlaneEntry | undefined;
  isUnreadInboundMessage: (message: MessageRecord) => boolean;
  buildMessageIngressEnvelope: (input: {
    message: MessageRecord;
    channel: MessageControlPlaneEntry & { accessToken: string };
  }) => RuntimeSystemIngressEnvelope | null;
  onCompactMessage: (message: MessageRecord) => void;
  queueCompactCycle: (trigger: "manual") => void;
  onError: (message: string) => void;
}

export class RuntimeMessageKernelAdapter implements RuntimeSystemKernelAdapter {
  readonly name = "message";

  private host: RuntimeSystemKernelHost | null = null;
  private readonly pendingUnreadMessageIds = new Set<number>();
  private stagedUnreadReadAcks: PendingUnreadReadAck[] = [];
  private activeCycleUnreadReadAcks: PendingUnreadReadAck[] = [];
  private activeCycleUnreadReadCommitted = false;
  private readonly pendingLifecycleIngress: RuntimeSystemIngressEnvelope[] = [];

  constructor(private readonly options: RuntimeMessageKernelAdapterOptions) {}

  mount(host: RuntimeSystemKernelHost): void {
    this.host = host;
  }

  async bootstrap(): Promise<void> {
    await this.flushPendingLifecycleIngress();
  }

  hasUnreadWork(): boolean {
    return this.options.messageSystem.getActorUnreadState(this.options.messageActorId).unreadTotal > this.pendingUnreadMessageIds.size;
  }

  beginCycle(): void {
    this.activeCycleUnreadReadAcks = this.consumeStagedUnreadReadAcks();
    this.activeCycleUnreadReadCommitted = false;
  }

  finalizeCycle(): void {
    if (!this.activeCycleUnreadReadCommitted) {
      this.releaseUnreadReadAcks(this.activeCycleUnreadReadAcks);
    }
    this.activeCycleUnreadReadAcks = [];
    this.activeCycleUnreadReadCommitted = false;
  }

  reset(): void {
    this.pendingUnreadMessageIds.clear();
    this.stagedUnreadReadAcks = [];
    this.activeCycleUnreadReadAcks = [];
    this.activeCycleUnreadReadCommitted = false;
    this.pendingLifecycleIngress.length = 0;
  }

  async commitActiveCycleReadAcks(): Promise<void> {
    if (this.activeCycleUnreadReadCommitted || this.activeCycleUnreadReadAcks.length === 0) {
      return;
    }
    const acks = [...this.activeCycleUnreadReadAcks];
    this.activeCycleUnreadReadCommitted = true;
    await this.commitReadAcks(acks);
  }

  async commitStagedReadAcks(): Promise<void> {
    const acks = this.consumeStagedUnreadReadAcks();
    if (acks.length === 0) {
      return;
    }
    await this.commitReadAcks(acks);
  }

  commitLifecycleIngress(envelope: RuntimeSystemIngressEnvelope): void {
    this.pendingLifecycleIngress.push(envelope);
    void this.flushPendingLifecycleIngress();
  }

  drainIngress(): RuntimeSystemIngressEnvelope[] | undefined {
    if (this.options.isLoopPaused()) {
      return undefined;
    }
    const roomLimit = this.options.getMaxFocusedRoomCount();
    const messageLimit = this.options.getMaxBatchReadRoomMessageCount();
    if (roomLimit <= 0 || messageLimit <= 0) {
      return undefined;
    }

    const roomSelections = this.options.messageSystem
      .listUnreadRoomSummaries(this.options.messageActorId)
      .map((summary) => ({
        summary,
        channel: this.options.getActorRoom(summary.chatId, {
          includeArchived: true,
          touchPresence: false,
        }),
      }))
      .filter(
        (
          item,
        ): item is {
          summary: ReturnType<MessageControlPlane["listUnreadRoomSummaries"]>[number];
          channel: MessageControlPlaneEntry & { accessToken: string };
        } => item.channel?.accessToken !== undefined,
      )
      .sort((left, right) => {
        if (left.channel.focused !== right.channel.focused) {
          return left.channel.focused ? -1 : 1;
        }
        if ((left.summary.latestUnreadAt ?? 0) !== (right.summary.latestUnreadAt ?? 0)) {
          return (right.summary.latestUnreadAt ?? 0) - (left.summary.latestUnreadAt ?? 0);
        }
        if (left.summary.unreadCount !== right.summary.unreadCount) {
          return right.summary.unreadCount - left.summary.unreadCount;
        }
        return left.summary.chatId.localeCompare(right.summary.chatId);
      })
      .slice(0, roomLimit)
      .map((item) => ({
        channel: item.channel,
        messages: this.collectUnreadMessagesForRoom(item.channel.chatId, messageLimit),
      }))
      .filter((item) => item.messages.length > 0);

    if (roomSelections.length === 0) {
      return undefined;
    }

    const compactSelections = roomSelections
      .map((item) => ({
        channel: item.channel,
        compactMessages: item.messages.filter((message) => message.content.trim() === "/compact"),
      }))
      .filter((item) => item.compactMessages.length > 0);
    if (compactSelections.length > 0) {
      for (const selection of compactSelections) {
        const targetMessageId = selection.compactMessages[selection.compactMessages.length - 1]?.messageId;
        this.reserveUnreadMessages(selection.channel, selection.compactMessages, targetMessageId);
        for (const message of selection.compactMessages) {
          this.options.onCompactMessage(message);
        }
      }
      this.options.queueCompactCycle("manual");
      return undefined;
    }

    const envelopes: RuntimeSystemIngressEnvelope[] = [];
    for (const selection of roomSelections) {
      this.reserveUnreadMessages(selection.channel, selection.messages);
      for (const message of selection.messages) {
        const envelope = this.options.buildMessageIngressEnvelope({
          message,
          channel: selection.channel,
        });
        if (envelope) {
          envelopes.push(envelope);
        }
      }
    }
    return envelopes.length > 0 ? envelopes : undefined;
  }

  private collectUnreadMessagesForRoom(chatId: string, limit: number): MessageRecord[] {
    const selected: MessageRecord[] = [];
    let before: ReverseTimeCursor | null = null;
    do {
      const page = this.options.messageSystem.queryMessages({
        chatId,
        before,
        limit: Math.max(limit * 3, 64),
      });
      selected.push(
        ...page.items.filter(
          (message) => this.options.isUnreadInboundMessage(message) && !this.pendingUnreadMessageIds.has(message.messageId),
        ),
      );
      before = page.nextBefore;
      if (selected.length >= limit) {
        break;
      }
    } while (before);
    return selected.slice(0, limit).reverse();
  }

  private buildUnreadReadAck(
    channel: Pick<MessageControlPlaneEntry, "chatId" | "accessToken">,
    messages: readonly MessageRecord[],
    targetMessageId = messages[messages.length - 1]?.messageId,
  ): PendingUnreadReadAck | null {
    if (!channel.accessToken || !targetMessageId || messages.length === 0) {
      return null;
    }
    return {
      chatId: channel.chatId,
      accessToken: channel.accessToken,
      targetMessageId,
      selectedMessageIds: messages.map((message) => message.messageId),
    };
  }

  reserveUnreadMessages(
    channel: Pick<MessageControlPlaneEntry, "chatId" | "accessToken">,
    messages: readonly MessageRecord[],
    targetMessageId = messages[messages.length - 1]?.messageId,
  ): void {
    const ack = this.buildUnreadReadAck(channel, messages, targetMessageId);
    if (!ack) {
      return;
    }
    for (const messageId of ack.selectedMessageIds) {
      this.pendingUnreadMessageIds.add(messageId);
    }
    this.stageUnreadReadAck(ack);
  }

  private stageUnreadReadAck(ack: PendingUnreadReadAck): void {
    const existing = this.stagedUnreadReadAcks.find((candidate) => candidate.chatId === ack.chatId);
    if (!existing) {
      this.stagedUnreadReadAcks.push({
        ...ack,
        selectedMessageIds: [...ack.selectedMessageIds],
      });
      return;
    }
    existing.accessToken = ack.accessToken;
    existing.targetMessageId = ack.targetMessageId;
    existing.selectedMessageIds = [...new Set([...existing.selectedMessageIds, ...ack.selectedMessageIds])];
  }

  private consumeStagedUnreadReadAcks(): PendingUnreadReadAck[] {
    const staged = this.stagedUnreadReadAcks.map((ack) => ({
      ...ack,
      selectedMessageIds: [...ack.selectedMessageIds],
    }));
    this.stagedUnreadReadAcks = [];
    return staged;
  }

  private releaseUnreadReadAcks(acks: readonly PendingUnreadReadAck[]): void {
    for (const ack of acks) {
      for (const messageId of ack.selectedMessageIds) {
        this.pendingUnreadMessageIds.delete(messageId);
      }
    }
  }

  private async commitReadAcks(acks: readonly PendingUnreadReadAck[]): Promise<void> {
    this.releaseUnreadReadAcks(acks);
    for (const ack of acks) {
      try {
        this.options.messageSystem.markChannelReadAuthorized({
          chatId: ack.chatId,
          accessToken: ack.accessToken,
          messageId: ack.targetMessageId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.options.onError(`message unread ack failed (${ack.chatId}): ${message}`);
      }
    }
  }

  private async flushPendingLifecycleIngress(): Promise<void> {
    if (!this.host || this.pendingLifecycleIngress.length === 0) {
      return;
    }
    const pending = this.pendingLifecycleIngress.splice(0, this.pendingLifecycleIngress.length);
    for (const envelope of pending) {
      await this.host.commitIngress(envelope, { notifyLoop: true });
    }
  }
}
