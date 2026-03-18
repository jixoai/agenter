import type { SessionCollectedInput } from "@agenter/session-system";

import type { ChatMessage } from "./types";

export type ChatCycleKind = "model" | "compact";
export type ChatCycleStatus = "pending" | "collecting" | "streaming" | "applying" | "done" | "error";

export interface ChatCycle {
  id: string;
  cycleId: number | null;
  seq: number | null;
  createdAt: number;
  wakeSource: string | null;
  kind: ChatCycleKind;
  status: ChatCycleStatus;
  clientMessageIds: string[];
  inputs: SessionCollectedInput[];
  outputs: ChatMessage[];
  liveMessages: ChatMessage[];
  streaming: {
    content: string;
  } | null;
  modelCallId: number | null;
}

export const toChatCycleId = (input: { cycleId?: number | null; clientMessageId?: string | null }): string => {
  if (typeof input.cycleId === "number") {
    return `cycle:${input.cycleId}`;
  }
  return `pending:${input.clientMessageId ?? "unknown"}`;
};

export const collectClientMessageIds = (inputs: SessionCollectedInput[]): string[] => {
  const ids = new Set<string>();
  for (const input of inputs) {
    const clientMessageId = input.meta?.clientMessageId;
    if (typeof clientMessageId === "string" && clientMessageId.length > 0) {
      ids.add(clientMessageId);
    }
  }
  return [...ids];
};

export const detectChatCycleKind = (inputs: SessionCollectedInput[]): ChatCycleKind => {
  for (const input of inputs) {
    if (input.role !== "user") {
      continue;
    }
    for (const part of input.parts) {
      if (part.type === "text" && part.text.trim() === "/compact") {
        return "compact";
      }
    }
  }
  return "model";
};
