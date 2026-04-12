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

const readHeartbeatMessagePayload = (message: SessionMessageRecord): HeartbeatMessagePayload => {
  if (message.parts.length === 0) {
    return { text: message.text };
  }
  const payload = message.parts[0]?.payload;
  const record = asRecord(payload);
  if (!record) {
    return { text: message.text };
  }
  return {
    text: typeof record.text === "string" ? record.text : message.text,
    chatId: typeof record.chatId === "string" ? record.chatId : undefined,
    format: record.format === "plain" || record.format === "markdown" ? record.format : undefined,
    channel:
      record.channel === "to_user" || record.channel === "self_talk" || record.channel === "tool"
        ? record.channel
        : undefined,
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
  const parts: SessionMessagePartInput[] = [
    {
      partType: "message",
      payload: {
        text: input.message.content,
        chatId: input.message.chatId,
        format: input.message.format ?? "markdown",
        channel: input.message.channel,
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

export const projectHeartbeatMessageToChatMessage = (message: SessionMessageRecord): ChatMessage => {
  const payload = readHeartbeatMessagePayload(message);
  return {
    id: message.messageId,
    chatId: payload.chatId,
    role: message.role === "assistant" ? "assistant" : "user",
    content: payload.text ?? message.text,
    messageKind: payload.messageKind,
    messagePayload: payload.messagePayload,
    timestamp: message.createdAt,
    updatedAt: payload.updatedAt ?? message.updatedAt,
    visibleAt: payload.visibleAt,
    cycleId: message.aiCallId ?? null,
    channel: payload.channel,
    format: payload.format ?? "markdown",
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
  return meta?.compactTrigger === "manual" ||
    meta?.compactTrigger === "threshold" ||
    meta?.compactTrigger === "error" ||
    meta?.compactTrigger === "attention_retry"
    ? (meta.compactTrigger as ChatCycleCompactTrigger)
    : null;
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
