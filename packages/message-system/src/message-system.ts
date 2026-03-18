import type { CommitWaitHandle, MessageChannelConfig, MessageDiff, MessageDraft } from "./types";

const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const normalizeHash = (value?: string | null): number => {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

interface Waiter {
  afterHash: number;
  resolve: (value: { toHash: string | null }) => void;
  reject: (reason: unknown) => void;
  active: boolean;
}

export class MessageSystem {
  private readonly channels = new Map<string, MessageChannelConfig>();
  private readonly pending: MessageDraft[] = [];
  private readonly waiters = new Set<Waiter>();
  private head = 0;

  constructor(channels: MessageChannelConfig[] = [{ channelId: 'user', displayName: 'User', useAttention: true }]) {
    for (const channel of channels) {
      this.channels.set(channel.channelId, { ...channel });
    }
    if (!this.channels.has('user')) {
      this.channels.set('user', { channelId: 'user', displayName: 'User', useAttention: true });
    }
  }

  listChannels(): MessageChannelConfig[] {
    return [...this.channels.values()].map((channel) => ({ ...channel }));
  }

  getChannel(channelId: string): MessageChannelConfig | undefined {
    const channel = this.channels.get(channelId);
    return channel ? { ...channel } : undefined;
  }

  push(input: {
    channelId?: string;
    content: string;
    timestamp?: number;
    meta?: Record<string, string | number | boolean | null>;
    attachments?: MessageDraft["attachments"];
  }): MessageDraft {
    const channelId = input.channelId ?? 'user';
    if (!this.channels.has(channelId)) {
      throw new Error(`unknown message channel: ${channelId}`);
    }
    const content = input.content.trimEnd();
    if (content.length === 0) {
      throw new Error('message content is required');
    }
    const draft: MessageDraft = {
      id: createId(),
      channelId,
      content,
      timestamp: input.timestamp ?? Date.now(),
      meta: input.meta,
      attachments: input.attachments?.map((attachment) => ({ ...attachment })),
    };
    this.pending.push(draft);
    this.head += 1;
    this.resolveWaiters();
    return { ...draft };
  }

  getHeadHash(): string | null {
    return String(this.head);
  }

  getDirty(): MessageDraft[] {
    return this.pending.map((item) => ({
      ...item,
      meta: item.meta ? { ...item.meta } : undefined,
      attachments: item.attachments?.map((attachment) => ({ ...attachment })),
    }));
  }

  consumeDiff(input: { fromHash?: string | null } = {}): MessageDiff {
    const from = normalizeHash(input.fromHash);
    const to = this.head;
    if (to <= from || this.pending.length === 0) {
      return {
        fromHash: from > 0 ? String(from) : null,
        toHash: String(to),
        changed: false,
        drafts: [],
      };
    }
    const drafts = this.getDirty();
    this.pending.length = 0;
    return {
      fromHash: from > 0 ? String(from) : null,
      toHash: String(to),
      changed: drafts.length > 0,
      drafts,
    };
  }

  waitCommitted(input: { fromHash?: string | null } = {}): CommitWaitHandle<{ toHash: string | null }> {
    const afterHash = normalizeHash(input.fromHash);
    if (this.head > afterHash) {
      return {
        promise: Promise.resolve({ toHash: String(this.head) }),
        reject: () => {},
      };
    }

    let resolveRef: ((value: { toHash: string | null }) => void) | null = null;
    let rejectRef: ((reason: unknown) => void) | null = null;
    const waiter: Waiter = {
      afterHash,
      resolve: (value) => resolveRef?.(value),
      reject: (reason) => rejectRef?.(reason),
      active: true,
    };
    const promise = new Promise<{ toHash: string | null }>((resolve, reject) => {
      resolveRef = resolve;
      rejectRef = reject;
    }).finally(() => {
      waiter.active = false;
      this.waiters.delete(waiter);
    });
    this.waiters.add(waiter);
    return {
      promise,
      reject: (reason) => {
        if (!waiter.active) {
          return;
        }
        waiter.active = false;
        this.waiters.delete(waiter);
        rejectRef?.(reason);
      },
    };
  }

  private resolveWaiters(): void {
    for (const waiter of [...this.waiters]) {
      if (!waiter.active || this.head <= waiter.afterHash) {
        continue;
      }
      waiter.active = false;
      this.waiters.delete(waiter);
      waiter.resolve({ toHash: String(this.head) });
    }
  }
}
