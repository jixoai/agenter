import { AttentionControlPlane } from "@agenter/attention-system";
import type { MessageDb } from "./message-db";
import type {
  MessageFollowUpDeliveryReceipt,
  MessageFollowUpDueInput,
  MessageFollowUpTaskRecord,
  MessageRecord,
} from "./types";

const FOLLOW_UP_RETRY_MS = 1000;

export type MessageFollowUpSink = (
  input: MessageFollowUpDueInput,
) => Promise<MessageFollowUpDeliveryReceipt | void> | MessageFollowUpDeliveryReceipt | void;

export type MessageFollowUpCommitReminder = (
  input: MessageFollowUpDueInput,
) => Promise<MessageFollowUpDeliveryReceipt | void> | MessageFollowUpDeliveryReceipt | void;

export class MessageFollowUpRuntime {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly sinks = new Map<string, MessageFollowUpSink>();
  private closed = false;

  constructor(
    private readonly options: {
      db: MessageDb;
      getMessage: (chatId: string, messageId: number) => MessageRecord | undefined;
      resolveLatestActiveVisibleMessage: (chatId: string) => MessageRecord | undefined;
      commitReminder: MessageFollowUpCommitReminder;
    },
  ) {
    this.reload();
  }

  close(): void {
    this.closed = true;
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.sinks.clear();
  }

  registerSink(ownerSessionId: string, sink: MessageFollowUpSink): () => void {
    this.sinks.set(ownerSessionId, sink);
    this.rearmOwnerTasks(ownerSessionId);
    return () => {
      const current = this.sinks.get(ownerSessionId);
      if (current === sink) {
        this.sinks.delete(ownerSessionId);
      }
    };
  }

  upsertTask(task: MessageFollowUpTaskRecord): void {
    if (this.closed) {
      return;
    }
    this.armTask(task);
  }

  removeTask(task: Pick<MessageFollowUpTaskRecord, "taskId">): void {
    const timer = this.timers.get(task.taskId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(task.taskId);
    }
  }

  listTasks(input: { chatId?: string; ownerSessionId?: string } = {}): MessageFollowUpTaskRecord[] {
    return this.options.db.listMessageFollowUpTasks(input);
  }

  private reload(): void {
    for (const task of this.options.db.listMessageFollowUpTasks()) {
      this.armTask(task);
    }
  }

  private rearmOwnerTasks(ownerSessionId: string): void {
    for (const task of this.options.db.listMessageFollowUpTasks({ ownerSessionId })) {
      this.armTask(task);
    }
  }

  private armTask(task: MessageFollowUpTaskRecord, overrideDelayMs?: number): void {
    this.removeTask(task);
    const waitMs = overrideDelayMs ?? Math.max(0, task.dueAt - Date.now());
    const timer = setTimeout(() => {
      void this.handleDueTask(task.taskId);
    }, waitMs);
    this.timers.set(task.taskId, timer);
  }

  private async handleDueTask(taskId: string): Promise<void> {
    this.timers.delete(taskId);
    if (this.closed) {
      return;
    }
    const task = this.options.db.getMessageFollowUpTask(taskId);
    if (!task) {
      return;
    }
    const latest = this.options.resolveLatestActiveVisibleMessage(task.chatId);
    if (!latest || latest.messageId !== task.messageId) {
      this.options.db.deleteMessageFollowUpTask({
        chatId: task.chatId,
        taskId: task.taskId,
      });
      return;
    }
    const message = this.options.getMessage(task.chatId, task.messageId);
    if (!message) {
      this.options.db.deleteMessageFollowUpTask({
        chatId: task.chatId,
        taskId: task.taskId,
      });
      return;
    }
    const sink = this.sinks.get(task.ownerSessionId);
    if (!sink) {
      try {
        await this.options.commitReminder({
          ...task,
          message,
        });
        this.options.db.deleteMessageFollowUpTask({
          chatId: task.chatId,
          taskId: task.taskId,
        });
      } catch {
        this.armTask(task, FOLLOW_UP_RETRY_MS);
      }
      return;
    }
    try {
      await sink({
        ...task,
        message,
      });
      this.options.db.deleteMessageFollowUpTask({
        chatId: task.chatId,
        taskId: task.taskId,
      });
    } catch {
      this.armTask(task, FOLLOW_UP_RETRY_MS);
    }
  }
}
