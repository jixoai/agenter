import type { SessionAiCallRecord, SessionMessageRecord } from "@agenter/session-system";

export type RuntimeHeartbeatGroupKind = "before-call" | "call" | "compact" | "before-call-pending";

export interface RuntimeHeartbeatGroupRecord {
  id: number;
  groupId: string;
  kind: RuntimeHeartbeatGroupKind;
  aiCallId: number | null;
  createdAt: number;
  updatedAt: number;
  isComplete: boolean;
  items: SessionMessageRecord[];
}

const sortMessagesAscending = (messages: readonly SessionMessageRecord[]): SessionMessageRecord[] =>
  [...messages].sort((left, right) => {
    if (left.createdAt !== right.createdAt) {
      return left.createdAt - right.createdAt;
    }
    return left.id - right.id;
  });

const maxUpdatedAt = (messages: readonly SessionMessageRecord[], fallback: number): number =>
  messages.reduce((latest, message) => Math.max(latest, message.updatedAt), fallback);

const isMessageComplete = (message: SessionMessageRecord): boolean => message.parts.every((part) => part.isComplete);

const readPartText = (payload: unknown): string | null => {
  if (typeof payload === "string") {
    return payload;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  if ("content" in payload && typeof payload.content === "string") {
    return payload.content;
  }
  if ("text" in payload && typeof payload.text === "string") {
    return payload.text;
  }
  return null;
};

const isRenderableMessage = (message: SessionMessageRecord): boolean => {
  if (message.parts.length === 0) {
    return false;
  }
  return message.parts.some((part) => {
    if (part.partType !== "text") {
      return true;
    }
    const text = readPartText(part.payload);
    return text !== null && text.trim().length > 0;
  });
};

const collectMessageRecords = (
  messageIds: readonly string[],
  messageById: ReadonlyMap<string, SessionMessageRecord>,
): SessionMessageRecord[] =>
  messageIds.flatMap((messageId) => {
    const message = messageById.get(messageId);
    return message ? [message] : [];
  });

const buildHeartbeatGroupId = (kind: RuntimeHeartbeatGroupKind, aiCallId: number | null, suffix?: string): string => {
  if (aiCallId !== null) {
    return `heartbeat-group:${kind}:${aiCallId}`;
  }
  return `heartbeat-group:${kind}:${suffix ?? "pending"}`;
};

const buildSyntheticGroupId = (aiCallId: number | null, slot: number, fallbackSeed: number): number => {
  if (aiCallId !== null) {
    return aiCallId * 10 + slot;
  }
  return fallbackSeed * 10 + slot;
};

export const projectHeartbeatGroups = (input: {
  aiCalls: readonly SessionAiCallRecord[];
  inspectionMessages: readonly SessionMessageRecord[];
}): RuntimeHeartbeatGroupRecord[] => {
  const messageById = new Map(input.inspectionMessages.map((message) => [message.messageId, message]));
  const aiCallIds = new Set(input.aiCalls.map((call) => call.id));
  const looseHeartbeatRows = sortMessagesAscending(
    input.inspectionMessages.filter((message) => message.scope === "heartbeat_part" && message.aiCallId === null),
  );
  const extraRowsByAiCallId = new Map<number, SessionMessageRecord[]>();
  const referencedMessageIds = new Set<string>();
  for (const call of input.aiCalls) {
    for (const messageId of call.requestMessageIds) {
      referencedMessageIds.add(messageId);
    }
    for (const messageId of call.responseMessageIds) {
      referencedMessageIds.add(messageId);
    }
    for (const messageId of call.auxiliaryMessageIds) {
      referencedMessageIds.add(messageId);
    }
  }
  for (const message of input.inspectionMessages) {
    if (message.aiCallId === null || !aiCallIds.has(message.aiCallId) || referencedMessageIds.has(message.messageId)) {
      continue;
    }
    const current = extraRowsByAiCallId.get(message.aiCallId) ?? [];
    current.push(message);
    extraRowsByAiCallId.set(message.aiCallId, current);
  }

  const groups: RuntimeHeartbeatGroupRecord[] = [];
  let looseIndex = 0;
  let previousAuxiliaryIds: string[] = [];

  for (const call of [...input.aiCalls].sort((left, right) => left.id - right.id)) {
    while (looseIndex < looseHeartbeatRows.length && looseHeartbeatRows[looseIndex]!.createdAt < call.createdAt) {
      looseIndex += 1;
    }
    const looseBeforeCall = looseHeartbeatRows.slice(0, looseIndex);
    looseHeartbeatRows.splice(0, looseIndex);
    looseIndex = 0;

    const changedAuxiliaryIds = call.auxiliaryMessageIds.filter((messageId, index) => previousAuxiliaryIds[index] !== messageId);
    previousAuxiliaryIds = [...call.auxiliaryMessageIds];

    const beforeCallItems = sortMessagesAscending([
      ...collectMessageRecords(changedAuxiliaryIds, messageById),
      ...looseBeforeCall,
    ]);
    if (beforeCallItems.length > 0) {
      groups.push({
        id: buildSyntheticGroupId(call.id, 0, groups.length + 1),
        groupId: buildHeartbeatGroupId("before-call", call.id),
        kind: "before-call",
        aiCallId: call.id,
        createdAt: beforeCallItems[0]!.createdAt,
        updatedAt: maxUpdatedAt(beforeCallItems, call.createdAt),
        isComplete: beforeCallItems.every(isMessageComplete),
        items: beforeCallItems,
      });
    }

    const callItems = sortMessagesAscending([
      ...collectMessageRecords(call.requestMessageIds, messageById),
      ...collectMessageRecords(call.responseMessageIds, messageById),
      ...(extraRowsByAiCallId.get(call.id) ?? []),
    ]).filter(isRenderableMessage);
    if (callItems.length === 0) {
      continue;
    }
    const kind: RuntimeHeartbeatGroupKind = call.kind === "compact" ? "compact" : "call";
    groups.push({
      id: buildSyntheticGroupId(call.id, 1, groups.length + 1),
      groupId: buildHeartbeatGroupId(kind, call.id),
      kind,
      aiCallId: call.id,
      createdAt: callItems[0]!.createdAt,
      updatedAt: Math.max(call.updatedAt, maxUpdatedAt(callItems, call.updatedAt)),
      isComplete: call.isComplete && callItems.every(isMessageComplete),
      items: callItems,
    });
  }

  const referencedAuxiliaryIds = new Set(input.aiCalls.flatMap((call) => call.auxiliaryMessageIds));
  const pendingBeforeCallItems = sortMessagesAscending([
    ...input.inspectionMessages.filter(
      (message) =>
        message.scope === "request_aux" &&
        !referencedAuxiliaryIds.has(message.messageId) &&
        message.aiCallId === null,
    ),
    ...looseHeartbeatRows,
  ]);
  if (pendingBeforeCallItems.length > 0) {
    const latestAiCallId = input.aiCalls.at(-1)?.id ?? 0;
    groups.push({
      id: buildSyntheticGroupId(null, 0, latestAiCallId + 1),
      groupId: buildHeartbeatGroupId("before-call-pending", null, String(latestAiCallId + 1)),
      kind: "before-call-pending",
      aiCallId: null,
      createdAt: pendingBeforeCallItems[0]!.createdAt,
      updatedAt: maxUpdatedAt(pendingBeforeCallItems, pendingBeforeCallItems[0]!.createdAt),
      isComplete: pendingBeforeCallItems.every(isMessageComplete),
      items: pendingBeforeCallItems,
    });
  }

  return groups.sort((left, right) => {
    if (left.createdAt !== right.createdAt) {
      return left.createdAt - right.createdAt;
    }
    return left.id - right.id;
  });
};
