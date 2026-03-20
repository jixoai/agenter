import type { RuntimeChatCycle, RuntimeChatMessage } from "@agenter/client-sdk";

import { splitCycleInputs } from "./cycle-facts";

export type MessageAttachment = NonNullable<RuntimeChatMessage["attachments"]>[number];

export interface ProjectedConversationMessage {
  id: string;
  role: "user" | "assistant";
  cycleId: number | null;
  channel?: RuntimeChatMessage["channel"];
  content: string;
  timestamp: number;
  attachments?: MessageAttachment[];
  tool?: RuntimeChatMessage["tool"];
  transient?: boolean;
}

export type ConversationRow =
  | {
      key: string;
      type: "message";
      message: ProjectedConversationMessage;
    }
  | {
      key: string;
      type: "status";
      cycleId: number | null;
      text: string;
      tone: "muted" | "active" | "danger";
      timestamp: number;
    }
  | {
      key: string;
      type: "time-divider";
      label: string;
      timestamp: number;
      emphasis: "time" | "date";
    };

const hasRenderableContent = (message: Pick<RuntimeChatMessage, "content" | "attachments">): boolean =>
  message.content.trim().length > 0 || (message.attachments?.length ?? 0) > 0;

const isUserFacingAssistantMessage = (
  message: Pick<RuntimeChatMessage, "role" | "channel" | "content" | "attachments">,
): boolean => {
  return (
    message.role === "assistant" &&
    (message.channel === undefined || message.channel === "to_user") &&
    hasRenderableContent(message)
  );
};

const isChatRenderableMessage = (message: RuntimeChatMessage): boolean => {
  if (message.role === "user") {
    return hasRenderableContent(message);
  }
  return isUserFacingAssistantMessage(message);
};

const compareMessageId = (leftId: string, rightId: string): number => {
  const left = Number(leftId);
  const right = Number(rightId);
  if (Number.isFinite(left) && Number.isFinite(right) && left !== right) {
    return left - right;
  }
  return leftId.localeCompare(rightId);
};

const DAY_GAP_MS = 24 * 60 * 60 * 1000;
const TIME_GAP_MS = 2 * 60 * 1000;
const TIME_THROTTLE_MS = 30 * 60 * 1000;

const sameDay = (left: number, right: number): boolean => {
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
};

const formatDividerLabel = (timestamp: number, emphasis: "time" | "date"): string => {
  const date = new Date(timestamp);
  return emphasis === "date"
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        weekday: "short",
      }).format(date)
    : new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(date);
};

const sameAttachmentSet = (
  left: readonly MessageAttachment[] | undefined,
  right: readonly MessageAttachment[] | undefined,
): boolean => {
  if ((left?.length ?? 0) !== (right?.length ?? 0)) {
    return false;
  }
  return (left ?? []).every((attachment, index) => attachment.assetId === right?.[index]?.assetId);
};

const matchesPersistedUserMessage = (
  cycle: RuntimeChatCycle,
  messages: readonly RuntimeChatMessage[],
  content: string,
  attachments: readonly MessageAttachment[],
): boolean => {
  const cycleCreatedAt = cycle.createdAt;
  return messages.some((message) => {
    if (message.role !== "user") {
      return false;
    }
    if (message.content !== content) {
      return false;
    }
    if (!sameAttachmentSet(message.attachments, attachments)) {
      return false;
    }
    return Math.abs(message.timestamp - cycleCreatedAt) <= 15_000;
  });
};

const toPersistedMessageRow = (message: RuntimeChatMessage): ConversationRow => ({
  key: `message:${message.id}`,
  type: "message",
  message: {
    id: message.id,
    role: message.role,
    cycleId: message.cycleId ?? null,
    channel: message.channel,
    content: message.content,
    timestamp: message.timestamp,
    attachments: message.attachments,
    tool: message.tool,
  },
});

const toPendingUserRows = (cycle: RuntimeChatCycle, messages: readonly RuntimeChatMessage[]): ConversationRow[] => {
  if (!cycle.id.startsWith("pending:")) {
    return [];
  }
  const { userInputs } = splitCycleInputs(cycle);
  return userInputs.flatMap((input, index) => {
    const content = input.parts
      .filter((part): part is Extract<(typeof input.parts)[number], { type: "text" }> => part.type === "text")
      .map((part) => part.text)
      .join("\n");
    const attachments = input.parts
      .filter((part): part is Exclude<(typeof input.parts)[number], { type: "text" }> => part.type !== "text")
      .map<MessageAttachment>((part) => ({
        assetId: part.assetId,
        kind: part.kind,
        name: part.name,
        mimeType: part.mimeType,
        sizeBytes: part.sizeBytes,
        url: part.url,
      }));

    if (!hasRenderableContent({ content, attachments })) {
      return [];
    }
    if (matchesPersistedUserMessage(cycle, messages, content, attachments)) {
      return [];
    }
    return [
      {
        key: `pending-user:${cycle.id}:${index}`,
        type: "message" as const,
        message: {
          id: `pending-user:${cycle.id}:${index}`,
          role: "user" as const,
          cycleId: cycle.cycleId ?? null,
          content,
          timestamp: cycle.createdAt,
          attachments,
          transient: true,
        },
      },
    ];
  });
};

const cycleProgressText = (cycle: RuntimeChatCycle, aiStatus: string): ConversationRow | null => {
  if (cycle.status === "error") {
    return {
      key: `${cycle.id}:status:error`,
      type: "status",
      cycleId: cycle.cycleId ?? null,
      text: "This turn failed before a reply was ready.",
      tone: "danger",
      timestamp: cycle.createdAt,
    };
  }
  if (cycle.status === "done") {
    return null;
  }
  if (cycle.status === "streaming") {
    return {
      key: `${cycle.id}:status:streaming`,
      type: "status",
      cycleId: cycle.cycleId ?? null,
      text: "Agenter is replying…",
      tone: "active",
      timestamp: cycle.createdAt,
    };
  }
  if (aiStatus === "waiting model") {
    return {
      key: `${cycle.id}:status:model`,
      type: "status",
      cycleId: cycle.cycleId ?? null,
      text: "Agenter is preparing a reply…",
      tone: "active",
      timestamp: cycle.createdAt,
    };
  }
  if (cycle.status === "collecting") {
    return {
      key: `${cycle.id}:status:collecting`,
      type: "status",
      cycleId: cycle.cycleId ?? null,
      text: "Agenter is gathering session context…",
      tone: "muted",
      timestamp: cycle.createdAt,
    };
  }
  if (cycle.status === "pending") {
    return {
      key: `${cycle.id}:status:pending`,
      type: "status",
      cycleId: cycle.cycleId ?? null,
      text: "Waiting to start this turn…",
      tone: "muted",
      timestamp: cycle.createdAt,
    };
  }
  if (cycle.status === "applying") {
    return {
      key: `${cycle.id}:status:applying`,
      type: "status",
      cycleId: cycle.cycleId ?? null,
      text: "Agenter is applying updates…",
      tone: "muted",
      timestamp: cycle.createdAt,
    };
  }
  return null;
};

const toTransientAssistantRows = (cycle: RuntimeChatCycle, aiStatus: string): ConversationRow[] => {
  const liveMessages = [...cycle.liveMessages]
    .filter(isUserFacingAssistantMessage)
    .sort((left, right) => left.timestamp - right.timestamp || compareMessageId(left.id, right.id));

  const rows = liveMessages.map<ConversationRow>((message) => ({
    key: `live:${cycle.id}:${message.id}`,
    type: "message",
    message: {
      id: `live:${cycle.id}:${message.id}`,
      role: "assistant",
      cycleId: cycle.cycleId ?? null,
      channel: message.channel,
      content: message.content,
      timestamp: message.timestamp,
      attachments: message.attachments,
      tool: message.tool,
      transient: true,
    },
  }));

  const streamingContent = cycle.streaming?.content.trim() ?? "";
  if (streamingContent.length > 0) {
    rows.push({
      key: `stream:${cycle.id}`,
      type: "message",
      message: {
        id: `stream:${cycle.id}`,
        role: "assistant",
        cycleId: cycle.cycleId ?? null,
        channel: "to_user",
        content: streamingContent,
        timestamp: liveMessages.at(-1)?.timestamp ?? cycle.createdAt,
        transient: true,
      },
    });
    return rows;
  }

  if (rows.length > 0) {
    return rows;
  }

  const statusRow = cycleProgressText(cycle, aiStatus);
  return statusRow ? [statusRow] : [];
};

export const projectConversationRows = (
  messages: RuntimeChatMessage[],
  cycles: RuntimeChatCycle[],
  aiStatus: string,
): ConversationRow[] => {
  const orderedRows = [
    ...messages
    .filter(isChatRenderableMessage)
    .slice()
    .sort((left, right) => left.timestamp - right.timestamp || compareMessageId(left.id, right.id))
    .map(toPersistedMessageRow),
    ...cycles
    .slice()
    .sort((left, right) => left.createdAt - right.createdAt || (left.cycleId ?? 0) - (right.cycleId ?? 0))
    .flatMap((cycle) => [...toPendingUserRows(cycle, messages), ...toTransientAssistantRows(cycle, aiStatus)]),
  ].sort((left, right) => {
    const leftTimestamp = left.type === "message" ? left.message.timestamp : left.timestamp;
    const rightTimestamp = right.type === "message" ? right.message.timestamp : right.timestamp;
    if (leftTimestamp !== rightTimestamp) {
      return leftTimestamp - rightTimestamp;
    }
    if (left.type === "message" && right.type === "message") {
      return compareMessageId(left.message.id, right.message.id);
    }
    if (left.type !== right.type) {
      return left.type === "message" ? -1 : 1;
    }
    return left.key.localeCompare(right.key);
  });

  const rows: ConversationRow[] = [];
  let previousTimestamp: number | null = null;
  let lastTimeDividerAt: number | null = null;

  for (const row of orderedRows) {
    const timestamp = row.type === "message" ? row.message.timestamp : row.timestamp;
    if (previousTimestamp !== null) {
      const crossedDay = !sameDay(previousTimestamp, timestamp);
      const longGap = timestamp - previousTimestamp >= TIME_GAP_MS;
      const throttled = lastTimeDividerAt === null || timestamp - lastTimeDividerAt >= TIME_THROTTLE_MS;
      if (crossedDay || (longGap && throttled)) {
        const emphasis: "time" | "date" = crossedDay ? "date" : "time";
        rows.push({
          key: `time-divider:${timestamp}:${emphasis}`,
          type: "time-divider",
          label: formatDividerLabel(timestamp, emphasis),
          timestamp,
          emphasis,
        });
        lastTimeDividerAt = timestamp;
      }
    }
    rows.push(row);
    previousTimestamp = timestamp;
  }

  return rows;
};
