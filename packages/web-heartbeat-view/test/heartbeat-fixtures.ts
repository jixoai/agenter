import type { HeartbeatGroupItem, HeartbeatPartItem } from "../src";

type PartInput = {
  partId: number;
  partIndex?: number;
  messageId: string;
  aiCallId?: number | null;
  roundIndex?: number;
  scope?: HeartbeatPartItem["scope"];
  role?: HeartbeatPartItem["role"];
  partType: string;
  payload: unknown;
  mimeType?: string | null;
  createdAt?: number;
  updatedAt?: number;
  isComplete?: boolean;
};

export const heartbeatPart = (input: PartInput): HeartbeatPartItem["parts"][number] => ({
  partId: input.partId,
  partIndex: input.partIndex ?? input.partId,
  messageId: input.messageId,
  windowId: null,
  aiCallId: input.aiCallId === undefined ? 1 : input.aiCallId,
  roundIndex: input.roundIndex ?? 1,
  scope: input.scope ?? "heartbeat_part",
  role: input.role ?? "assistant",
  partType: input.partType,
  mimeType: input.mimeType ?? null,
  payload: input.payload,
  createdAt: input.createdAt ?? 1_000 + input.partId,
  updatedAt: input.updatedAt ?? 1_000 + input.partId,
  isComplete: input.isComplete ?? true,
});

export const heartbeatEntry = (input: {
  id: number;
  messageId?: string;
  aiCallId?: number | null;
  roundIndex?: number;
  scope?: HeartbeatPartItem["scope"];
  role?: HeartbeatPartItem["role"];
  parts: HeartbeatPartItem["parts"];
  createdAt?: number;
  updatedAt?: number;
  isComplete?: boolean;
  text?: string;
}): HeartbeatPartItem => ({
  id: input.id,
  messageId: input.messageId ?? `message-${input.id}`,
  windowId: null,
  aiCallId: input.aiCallId === undefined ? 1 : input.aiCallId,
  roundIndex: input.roundIndex ?? 1,
  scope: input.scope ?? "heartbeat_part",
  role: input.role ?? "assistant",
  createdAt: input.createdAt ?? 1_000 + input.id,
  updatedAt: input.updatedAt ?? 1_000 + input.id,
  isComplete: input.isComplete ?? input.parts.every((part) => part.isComplete),
  parts: input.parts,
  text: input.text ?? "",
});

export const heartbeatGroup = (input: {
  id: number;
  groupId?: string;
  kind?: HeartbeatGroupItem["kind"];
  aiCallId?: number | null;
  items: HeartbeatPartItem[];
  createdAt?: number;
  updatedAt?: number;
  isComplete?: boolean;
}): HeartbeatGroupItem => ({
  id: input.id,
  groupId: input.groupId ?? `heartbeat-group:${input.kind ?? "call"}:${input.aiCallId ?? input.id}`,
  kind: input.kind ?? "call",
  aiCallId: input.aiCallId === undefined ? 1 : input.aiCallId,
  createdAt: input.createdAt ?? Math.min(...input.items.map((item) => item.createdAt)),
  updatedAt: input.updatedAt ?? Math.max(...input.items.map((item) => item.updatedAt)),
  isComplete: input.isComplete ?? input.items.every((item) => item.isComplete),
  items: input.items,
});
