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

export const buildHeartbeatResponseSegmentMessageId = (aiCallId: number, segmentIndex: number): string =>
  `heartbeat-part:ai-call:${aiCallId}:response:assistant:${segmentIndex}`;

export const buildHeartbeatToolInvocationMessageId = (aiCallId: number, invocationId: string): string =>
  `heartbeat-part:ai-call:${aiCallId}:tool:${invocationId}`;

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

export interface HeartbeatAssistantResponseSegment {
  partType: "thinking" | "text";
  content: string;
  startedAt: number;
  updatedAt: number;
  isComplete: boolean;
}

export const toHeartbeatResponseSegmentMessageUpsertInputs = (input: {
  aiCallId: number;
  roundIndex: number;
  segments: readonly HeartbeatAssistantResponseSegment[];
}): SessionMessageUpsertInput[] =>
  input.segments
    .filter((segment) => segment.content.length > 0)
    .map((segment, segmentIndex) => ({
      messageId: buildHeartbeatResponseSegmentMessageId(input.aiCallId, segmentIndex),
      aiCallId: input.aiCallId,
      roundIndex: input.roundIndex,
      scope: HEARTBEAT_MESSAGE_PART_SCOPE,
      role: "assistant",
      createdAt: segment.startedAt,
      updatedAt: segment.updatedAt,
      parts: [
        {
          partType: segment.partType,
          payload:
            segment.partType === "thinking"
              ? {
                  type: "thinking",
                  text: segment.content,
                }
              : {
                  type: "text",
                  content: segment.content,
                },
          isComplete: segment.isComplete,
        },
      ],
    }));

export const toHeartbeatToolInvocationMessageUpsertInput = (input: {
  aiCallId: number;
  roundIndex: number;
  updatedAt: number;
  invocation: {
    invocationId: string;
    tool: string;
    input: unknown;
    output?: unknown;
    error?: string;
    startedAt: number;
    finishedAt: number;
  };
}): SessionMessageUpsertInput => {
  const hasResult = input.invocation.output !== undefined || input.invocation.error !== undefined;
  const parts: SessionMessagePartInput[] = [
    {
      partType: "tool_call",
      payload: {
        invocationId: input.invocation.invocationId,
        tool: input.invocation.tool,
        input: input.invocation.input,
        startedAt: input.invocation.startedAt,
      },
      isComplete: hasResult,
    },
  ];
  if (hasResult) {
    parts.push({
      partType: "tool_result",
      payload: {
        invocationId: input.invocation.invocationId,
        tool: input.invocation.tool,
        output: input.invocation.output,
        error: input.invocation.error ?? null,
        finishedAt: input.invocation.finishedAt,
      },
      isComplete: true,
    });
  }
  return {
    messageId: buildHeartbeatToolInvocationMessageId(input.aiCallId, input.invocation.invocationId),
    aiCallId: input.aiCallId,
    roundIndex: input.roundIndex,
    scope: HEARTBEAT_MESSAGE_PART_SCOPE,
    role: "assistant",
    createdAt: input.invocation.startedAt,
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
