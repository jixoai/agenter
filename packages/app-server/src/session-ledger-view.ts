import type { MessageKind, MessagePayload } from "@agenter/message-system";
import type {
  SessionAiCallRecord,
  SessionCollectedInput,
  SessionMessagePartInput,
  SessionMessageRecord,
  SessionMessageUpsertInput,
} from "@agenter/session-system";

import { collectClientMessageIds, toChatCycleId, type ChatCycle, type ChatCycleCompactTrigger } from "./chat-cycles";
import type { ChatMessage, ChatSessionAsset, ChatToolInvocation } from "./types";

interface HeartbeatMessagePayload {
  text?: string;
  chatId?: string;
  format?: ChatMessage["format"];
  channel?: ChatMessage["channel"];
  heartbeatKind?: ChatMessage["heartbeatKind"];
  compactTrigger?: ChatMessage["compactTrigger"];
  callRoundIndex?: number;
  currentRoundIndex?: number;
  visibleAt?: number;
  updatedAt?: number;
  messageKind?: MessageKind;
  messagePayload?: MessagePayload;
  attachments?: ChatSessionAsset[];
  tool?: ChatToolInvocation;
}

interface AiCallResponseEnvelope {
  response?: unknown;
  outcome?: unknown;
}

export interface RuntimeModelCallRecord {
  id: number;
  cycleId: number | null;
  roundIndex: number;
  kind: string;
  status: SessionAiCallRecord["status"];
  provider: string;
  model: string;
  requestUrl: string;
  request: unknown;
  response: unknown;
  error: unknown;
  outcome: unknown;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  isComplete: boolean;
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const normalizeCompactTrigger = (value: unknown): ChatCycleCompactTrigger | null => {
  return value === "manual" || value === "threshold" || value === "error" || value === "attention_retry" ? value : null;
};

const buildCompactSeparatorText = (trigger: ChatCycleCompactTrigger | null): string => {
  if (!trigger) {
    return "Prompt window compacted. Later Heartbeat rows continue from the rebuilt context.";
  }
  return `Prompt window compacted (${trigger}). Later Heartbeat rows continue from the rebuilt context.`;
};

const readHeartbeatMessagePayload = (message: SessionMessageRecord): HeartbeatMessagePayload => {
  if (message.parts.length === 0) {
    return { text: message.text };
  }
  const firstPart = message.parts[0];
  const payload = firstPart?.payload;
  const record = asRecord(payload);
  if (!record) {
    return { text: message.text };
  }
  const heartbeatKind =
    record.heartbeatKind === "compact_separator" || firstPart?.partType === "compact" ? "compact_separator" : "message";
  return {
    text: typeof record.text === "string" ? record.text : message.text,
    chatId: typeof record.chatId === "string" ? record.chatId : undefined,
    format: record.format === "plain" || record.format === "markdown" ? record.format : undefined,
    channel:
      record.channel === "to_user" || record.channel === "self_talk" || record.channel === "tool"
        ? record.channel
        : undefined,
    heartbeatKind,
    compactTrigger: normalizeCompactTrigger(record.compactTrigger),
    callRoundIndex: typeof record.callRoundIndex === "number" ? record.callRoundIndex : undefined,
    currentRoundIndex: typeof record.currentRoundIndex === "number" ? record.currentRoundIndex : undefined,
    visibleAt: typeof record.visibleAt === "number" ? record.visibleAt : undefined,
    updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : undefined,
    messageKind: typeof record.messageKind === "string" ? (record.messageKind as MessageKind) : undefined,
    messagePayload: record.messagePayload as MessagePayload | undefined,
    attachments: Array.isArray(record.attachments) ? structuredClone(record.attachments as ChatSessionAsset[]) : undefined,
    tool: record.tool ? (structuredClone(record.tool) as ChatToolInvocation) : undefined,
  };
};

export const toHeartbeatMessageUpsertInput = (input: {
  message: ChatMessage;
  roundIndex: number;
  aiCallId?: number | null;
}): SessionMessageUpsertInput => {
  const heartbeatKind = input.message.heartbeatKind ?? "message";
  const parts: SessionMessagePartInput[] = [
    {
      partType: heartbeatKind === "compact_separator" ? "compact" : "message",
      payload: {
        text: input.message.content,
        chatId: input.message.chatId,
        format: input.message.format ?? "markdown",
        channel: input.message.channel,
        heartbeatKind,
        compactTrigger: input.message.compactTrigger ?? null,
        visibleAt: input.message.visibleAt,
        updatedAt: input.message.updatedAt,
        messageKind: input.message.messageKind,
        messagePayload: input.message.messagePayload,
        attachments: input.message.attachments ? structuredClone(input.message.attachments) : undefined,
        tool: input.message.tool ? structuredClone(input.message.tool) : undefined,
      } satisfies HeartbeatMessagePayload,
      isComplete: true,
    },
  ];
  return {
    messageId: input.message.id,
    aiCallId: input.aiCallId ?? null,
    roundIndex: input.roundIndex,
    scope: "heartbeat",
    role: input.message.role,
    createdAt: input.message.timestamp,
    updatedAt: input.message.updatedAt ?? input.message.timestamp,
    parts,
  };
};

export const toHeartbeatCompactSeparatorUpsertInput = (input: {
  aiCallId: number;
  timestamp: number;
  callRoundIndex: number;
  currentRoundIndex: number;
  compactTrigger: ChatCycleCompactTrigger | null;
}): SessionMessageUpsertInput => ({
  messageId: `heartbeat:compact:${input.aiCallId}`,
  aiCallId: input.aiCallId,
  roundIndex: input.currentRoundIndex,
  scope: "heartbeat",
  role: "system",
  createdAt: input.timestamp,
  updatedAt: input.timestamp,
  parts: [
    {
      partType: "compact",
      payload: {
        text: buildCompactSeparatorText(input.compactTrigger),
        format: "plain",
        heartbeatKind: "compact_separator",
        compactTrigger: input.compactTrigger,
        callRoundIndex: input.callRoundIndex,
        currentRoundIndex: input.currentRoundIndex,
      } satisfies HeartbeatMessagePayload,
      isComplete: true,
    },
  ],
});

export const projectHeartbeatMessageToChatMessage = (message: SessionMessageRecord): ChatMessage => {
  const payload = readHeartbeatMessagePayload(message);
  return {
    id: message.messageId,
    chatId: payload.chatId,
    role: message.role === "assistant" ? "assistant" : message.role === "system" ? "system" : "user",
    content: payload.text ?? message.text,
    messageKind: payload.messageKind,
    messagePayload: payload.messagePayload,
    timestamp: message.createdAt,
    updatedAt: payload.updatedAt ?? message.updatedAt,
    visibleAt: payload.visibleAt,
    cycleId: message.aiCallId ?? null,
    channel: payload.channel,
    format: payload.format ?? "markdown",
    heartbeatKind: payload.heartbeatKind,
    compactTrigger: payload.compactTrigger,
    attachments: payload.attachments?.map((attachment) => ({ ...attachment })),
    tool: payload.tool ? structuredClone(payload.tool) : undefined,
  };
};

const readAiCallResponseEnvelope = (call: SessionAiCallRecord): AiCallResponseEnvelope => {
  const record = asRecord(call.responseBody);
  if (!record) {
    return {
      response: call.responseBody,
      outcome: call.outcome,
    };
  }
  return {
    response: "response" in record ? record.response : call.responseBody,
    outcome: "outcome" in record ? record.outcome : call.outcome,
  };
};

const readAiCallCycleId = (call: SessionAiCallRecord): number | null => {
  const request = asRecord(call.requestBody);
  const meta = asRecord(request?.meta);
  if (typeof meta?.cycleId === "number" && Number.isInteger(meta.cycleId)) {
    return meta.cycleId;
  }
  return call.roundIndex;
};

const readAiCallWakeSource = (call: SessionAiCallRecord): string | null => {
  const request = asRecord(call.requestBody);
  const meta = asRecord(request?.meta);
  return typeof meta?.wakeSource === "string" && meta.wakeSource.length > 0 ? meta.wakeSource : null;
};

const readAiCallCollectedInputs = (call: SessionAiCallRecord): SessionCollectedInput[] => {
  const request = asRecord(call.requestBody);
  const meta = asRecord(request?.meta);
  return Array.isArray(meta?.collectedInputs) ? structuredClone(meta.collectedInputs as SessionCollectedInput[]) : [];
};

const readCompactTrigger = (call: SessionAiCallRecord): ChatCycleCompactTrigger | null => {
  const { response } = readAiCallResponseEnvelope(call);
  const responseRecord = asRecord(response);
  const decision = asRecord(responseRecord?.decision);
  const trigger = decision?.trigger;
  if (
    trigger === "manual" ||
    trigger === "threshold" ||
    trigger === "error" ||
    trigger === "attention_retry"
  ) {
    return trigger;
  }
  const request = asRecord(call.requestBody);
  const meta = asRecord(request?.meta);
  return normalizeCompactTrigger(meta?.compactTrigger);
};

export const projectAiCallToModelCall = (call: SessionAiCallRecord): RuntimeModelCallRecord => {
  const envelope = readAiCallResponseEnvelope(call);
  return {
    id: call.id,
    cycleId: readAiCallCycleId(call),
    roundIndex: call.roundIndex,
    kind: call.kind,
    status: call.status,
    provider: call.provider,
    model: call.model,
    requestUrl: call.requestUrl,
    request: structuredClone(call.requestBody),
    response: structuredClone(envelope.response ?? null),
    error: structuredClone(call.error),
    outcome: structuredClone(envelope.outcome ?? null),
    createdAt: call.createdAt,
    updatedAt: call.updatedAt,
    completedAt: call.completedAt,
    isComplete: call.isComplete,
  };
};

export const projectAiCallToChatCycle = (input: {
  call: SessionAiCallRecord;
  messageById: Map<string, SessionMessageRecord>;
}): ChatCycle => {
  const inputs = readAiCallCollectedInputs(input.call);
  const outputs = input.call.responseMessageIds
    .map((messageId) => input.messageById.get(messageId))
    .filter((message): message is SessionMessageRecord => message !== undefined)
    .map(projectHeartbeatMessageToChatMessage);
  const cycleId = readAiCallCycleId(input.call);
  return {
    id: toChatCycleId({ cycleId }),
    cycleId,
    seq: input.call.id,
    createdAt: input.call.createdAt,
    wakeSource: readAiCallWakeSource(input.call),
    kind: input.call.kind === "compact" ? "compact" : "model",
    status:
      input.call.status === "running"
        ? "streaming"
        : input.call.status === "error" || input.call.status === "cancelled"
          ? "error"
          : "done",
    clientMessageIds: collectClientMessageIds(inputs),
    inputs,
    outputs,
    liveMessages: [],
    streaming: null,
    modelCallId: input.call.id,
    compactTrigger: input.call.kind === "compact" ? readCompactTrigger(input.call) : null,
  };
};
