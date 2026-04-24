export type MessageFollowUpReminderState = "pending" | "fired" | "suppressed";

export interface MessageFollowUpReminder {
  chatId: string;
  anchorMessageId: number;
  senderActorId: string;
  createdAt: number;
  dueAt: number;
  state: MessageFollowUpReminderState;
  firedAt?: number;
  suppressedAt?: number;
  suppressedByMessageId?: number;
}

const buildReminderKey = (input: {
  chatId: string;
  anchorMessageId: number;
  senderActorId: string;
}): string => `${input.chatId}\u0000${input.anchorMessageId}\u0000${input.senderActorId}`;

/**
 * Runtime-private one-shot follow-up reminder sidecar for room messages.
 * This state intentionally stays out of MessageRecord, room snapshots, and
 * transport payloads so future TaskSystem-backed scheduling can replace only
 * the timing bridge instead of changing the external `message send` contract.
 */
export class MessageFollowUpReminderScheduler {
  private readonly reminders = new Map<string, MessageFollowUpReminder>();

  arm(input: {
    chatId: string;
    anchorMessageId: number;
    senderActorId: string;
    dueAt: number;
    createdAt?: number;
  }): MessageFollowUpReminder {
    const reminder: MessageFollowUpReminder = {
      chatId: input.chatId,
      anchorMessageId: input.anchorMessageId,
      senderActorId: input.senderActorId,
      createdAt: input.createdAt ?? Date.now(),
      dueAt: input.dueAt,
      state: "pending",
    };
    this.reminders.set(buildReminderKey(input), reminder);
    return reminder;
  }

  hasPending(): boolean {
    for (const reminder of this.reminders.values()) {
      if (reminder.state === "pending") {
        return true;
      }
    }
    return false;
  }

  nextDueAt(): number | null {
    let nextDueAt: number | null = null;
    for (const reminder of this.reminders.values()) {
      if (reminder.state !== "pending") {
        continue;
      }
      nextDueAt = nextDueAt === null ? reminder.dueAt : Math.min(nextDueAt, reminder.dueAt);
    }
    return nextDueAt;
  }

  suppressSuperseded(chatId: string, latestVisibleMessageId: number, now = Date.now()): MessageFollowUpReminder[] {
    const suppressed: MessageFollowUpReminder[] = [];
    for (const reminder of this.reminders.values()) {
      if (reminder.state !== "pending" || reminder.chatId !== chatId || reminder.anchorMessageId >= latestVisibleMessageId) {
        continue;
      }
      reminder.state = "suppressed";
      reminder.suppressedAt = now;
      reminder.suppressedByMessageId = latestVisibleMessageId;
      suppressed.push({ ...reminder });
    }
    return suppressed;
  }

  consumeDue(
    input: {
      now?: number;
      isAnchorStillLatest: (reminder: MessageFollowUpReminder) => boolean;
    },
  ): {
    fired: MessageFollowUpReminder[];
    suppressed: MessageFollowUpReminder[];
  } {
    const now = input.now ?? Date.now();
    const fired: MessageFollowUpReminder[] = [];
    const suppressed: MessageFollowUpReminder[] = [];
    for (const reminder of this.reminders.values()) {
      if (reminder.state !== "pending" || reminder.dueAt > now) {
        continue;
      }
      if (input.isAnchorStillLatest(reminder)) {
        reminder.state = "fired";
        reminder.firedAt = now;
        fired.push({ ...reminder });
        continue;
      }
      reminder.state = "suppressed";
      reminder.suppressedAt = now;
      suppressed.push({ ...reminder });
    }
    return { fired, suppressed };
  }

  clear(): void {
    this.reminders.clear();
  }
}
