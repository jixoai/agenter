import type { MessageKind, MessagePayload } from "@agenter/message-system";
import type {
  SessionMessagePartInput,
  SessionMessageRecord,
  SessionMessageRole,
  SessionMessageScope,
  SessionMessageUpsertInput,
} from "@agenter/session-system";

import type { ChatCycleCompactTrigger } from "./chat-cycles";
import type { TextOnlyModelMessage } from "./model-client";
import type { ChatMessage, ChatSessionAsset, ChatToolInvocation } from "./types";

export const HEARTBEAT_MESSAGE_PART_SCOPE = "heartbeat_part" satisfies SessionMessageScope;
export const HEARTBEAT_AUXILIARY_SCOPE = "request_aux" satisfies SessionMessageScope;
export const HEARTBEAT_INSPECTION_SCOPES = [HEARTBEAT_MESSAGE_PART_SCOPE, HEARTBEAT_AUXILIARY_SCOPE] as const satisfies readonly SessionMessageScope[];

interface HeartbeatEventTextPayload {
  type: "text";
  content: string;
  chatId?: string;
  format?: ChatMessage["format"];
  channel?: ChatMessage["channel"];
  heartbeatKind?: ChatMessage["heartbeatKind"];
  compactTrigger?: ChatMessage["compactTrigger"];
  visibleAt?: number;
  updatedAt?: number;
  messageKind?: MessageKind;
  messagePayload?: MessagePayload;
  attachments?: ChatSessionAsset[];
  tool?: ChatToolInvocation;
}

const normalizeRole = (role: string | undefined): SessionMessageRole => {
  if (role === "assistant" || role === "system" || role === "tool" || role === "config") {
    return role;
  }
  return "user";
};

const toTextPart = (content: string): SessionMessagePartInput => ({
  partType: "text",
  payload: {
    type: "text",
    content,
  },
  isComplete: true,
});

const toMessageParts = (content: TextOnlyModelMessage["content"]): SessionMessagePartInput[] => {
  if (content === null || content === undefined) {
    return [toTextPart("")];
  }
  if (typeof content === "string") {
    return [toTextPart(content)];
  }
  if (content.length === 0) {
    return [toTextPart("")];
  }
  return content.map((part) => {
    if (part.type === "text") {
      return {
        partType: "text",
        payload: {
          type: "text",
          content: part.content,
        },
        isComplete: true,
      };
    }
    return {
      partType: part.type,
      payload: structuredClone(part),
      isComplete: true,
    };
  });
};

export const buildHeartbeatRequestMessageId = (aiCallId: number, index: number): string =>
  `heartbeat-part:ai-call:${aiCallId}:request:${index}`;

export const buildHeartbeatResponseMessageId = (aiCallId: number): string =>
  `heartbeat-part:ai-call:${aiCallId}:response:assistant`;

export const buildHeartbeatCompactSeparatorMessageId = (aiCallId: number): string =>
  `heartbeat-part:ai-call:${aiCallId}:compact`;

const buildCompactSeparatorText = (trigger: ChatCycleCompactTrigger | null): string => {
  if (!trigger) {
    return "Prompt window compacted. Later Heartbeat rows continue from the rebuilt context.";
  }
  return `Prompt window compacted (${trigger}). Later Heartbeat rows continue from the rebuilt context.`;
};

export const toHeartbeatEventMessageUpsertInput = (input: {
  message: ChatMessage;
  roundIndex: number;
  aiCallId?: number | null;
}): SessionMessageUpsertInput => ({
  messageId: input.message.id,
  aiCallId: input.aiCallId ?? null,
  roundIndex: input.roundIndex,
  scope: HEARTBEAT_MESSAGE_PART_SCOPE,
  role: input.message.role,
  createdAt: input.message.timestamp,
  updatedAt: input.message.updatedAt ?? input.message.timestamp,
  parts: [
    {
      partType: "text",
      payload: {
        type: "text",
        content: input.message.content,
        chatId: input.message.chatId,
        format: input.message.format ?? "markdown",
        channel: input.message.channel,
        heartbeatKind: input.message.heartbeatKind,
        compactTrigger: input.message.compactTrigger ?? null,
        visibleAt: input.message.visibleAt,
        updatedAt: input.message.updatedAt,
        messageKind: input.message.messageKind,
        messagePayload: input.message.messagePayload,
        attachments: input.message.attachments ? structuredClone(input.message.attachments) : undefined,
        tool: input.message.tool ? structuredClone(input.message.tool) : undefined,
      } satisfies HeartbeatEventTextPayload,
      isComplete: true,
    },
  ],
});

export const toHeartbeatRequestMessageUpsertInputs = (input: {
  aiCallId: number;
  roundIndex: number;
  createdAt: number;
  messages: TextOnlyModelMessage[];
}): SessionMessageUpsertInput[] =>
  input.messages.map((message, index) => ({
    messageId: buildHeartbeatRequestMessageId(input.aiCallId, index),
    aiCallId: input.aiCallId,
    roundIndex: input.roundIndex,
    scope: HEARTBEAT_MESSAGE_PART_SCOPE,
    role: normalizeRole(message.role),
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    parts: toMessageParts(message.content),
  }));

export const toHeartbeatResponseMessageUpsertInput = (input: {
  aiCallId: number;
  roundIndex: number;
  createdAt: number;
  updatedAt: number;
  isComplete: boolean;
  response: {
    assistant?: {
      thinking?: string;
      thinkingStartedAt?: number;
      text?: string;
      textStartedAt?: number;
    };
    toolTrace?: Array<{
      invocationId: string;
      tool: string;
      input: unknown;
      output?: unknown;
      error?: string;
      startedAt: number;
      finishedAt: number;
    }>;
  };
}): SessionMessageUpsertInput | null => {
  const orderedParts: Array<{ orderAt: number; insertionIndex: number; part: SessionMessagePartInput }> = [];
  let insertionIndex = 0;
  const pushOrderedPart = (orderAt: number, part: SessionMessagePartInput): void => {
    orderedParts.push({
      orderAt,
      insertionIndex,
      part,
    });
    insertionIndex += 1;
  };
  if (typeof input.response.assistant?.thinking === "string" && input.response.assistant.thinking.length > 0) {
    pushOrderedPart(input.response.assistant.thinkingStartedAt ?? input.createdAt, {
      partType: "thinking",
      payload: {
        type: "thinking",
        text: input.response.assistant.thinking,
      },
      isComplete: input.isComplete,
    });
  }
  if (typeof input.response.assistant?.text === "string") {
    pushOrderedPart(input.response.assistant.textStartedAt ?? input.updatedAt, {
      partType: "text",
      payload: {
        type: "text",
        content: input.response.assistant.text,
      },
      isComplete: input.isComplete,
    });
  }
  for (const trace of input.response.toolTrace ?? []) {
    pushOrderedPart(trace.startedAt, {
      partType: "tool_call",
      payload: {
        invocationId: trace.invocationId,
        tool: trace.tool,
        input: trace.input,
        startedAt: trace.startedAt,
      },
      isComplete: true,
    });
    if (trace.output !== undefined || trace.error !== undefined) {
      pushOrderedPart(trace.finishedAt, {
        partType: "tool_result",
        payload: {
          invocationId: trace.invocationId,
          tool: trace.tool,
          output: trace.output,
          error: trace.error ?? null,
          finishedAt: trace.finishedAt,
        },
        isComplete: true,
      });
    }
  }
  const parts = orderedParts
    .sort((left, right) => left.orderAt - right.orderAt || left.insertionIndex - right.insertionIndex)
    .map((entry) => entry.part);
  if (parts.length === 0) {
    return null;
  }
  return {
    messageId: buildHeartbeatResponseMessageId(input.aiCallId),
    aiCallId: input.aiCallId,
    roundIndex: input.roundIndex,
    scope: HEARTBEAT_MESSAGE_PART_SCOPE,
    role: "assistant",
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
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
  messageId: buildHeartbeatCompactSeparatorMessageId(input.aiCallId),
  aiCallId: input.aiCallId,
  roundIndex: input.currentRoundIndex,
  scope: HEARTBEAT_MESSAGE_PART_SCOPE,
  role: "system",
  createdAt: input.timestamp,
  updatedAt: input.timestamp,
  parts: [
    {
      partType: "compact",
      payload: {
        type: "compact",
        text: buildCompactSeparatorText(input.compactTrigger),
        format: "plain",
        heartbeatKind: "compact_separator",
        compactTrigger: input.compactTrigger,
        callRoundIndex: input.callRoundIndex,
        currentRoundIndex: input.currentRoundIndex,
      },
      isComplete: true,
    },
  ],
});
