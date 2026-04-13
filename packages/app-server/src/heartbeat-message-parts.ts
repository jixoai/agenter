import type { SessionMessagePartInput, SessionMessageRole, SessionMessageScope, SessionMessageUpsertInput } from "@agenter/session-system";

import type { ChatCycleCompactTrigger } from "./chat-cycles";
import type { TextOnlyModelMessage } from "./model-client";

export const HEARTBEAT_MESSAGE_PART_SCOPE = "heartbeat_part" satisfies SessionMessageScope;

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
      text?: string;
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
  const parts: SessionMessagePartInput[] = [];
  if (typeof input.response.assistant?.thinking === "string" && input.response.assistant.thinking.length > 0) {
    parts.push({
      partType: "thinking",
      payload: {
        type: "thinking",
        text: input.response.assistant.thinking,
      },
      isComplete: input.isComplete,
    });
  }
  if (typeof input.response.assistant?.text === "string") {
    parts.push({
      partType: "text",
      payload: {
        type: "text",
        content: input.response.assistant.text,
      },
      isComplete: input.isComplete,
    });
  }
  for (const trace of input.response.toolTrace ?? []) {
    parts.push({
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
      parts.push({
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
