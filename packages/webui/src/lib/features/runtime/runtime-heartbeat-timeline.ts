import type { ModelCallDeltaItem, ModelCallItem, RequestAuxItem, RuntimeChatMessage } from "@agenter/client-sdk";

export type RuntimeHeartbeatTimelineItem =
  | {
      id: string;
      kind: "heartbeat";
      timestamp: number;
      sortId: number;
      message: RuntimeChatMessage;
    }
  | {
      id: string;
      kind: "request_aux";
      timestamp: number;
      sortId: number;
      entry: RequestAuxItem;
    }
  | {
      id: string;
      kind: "model_call";
      timestamp: number;
      sortId: number;
      entry: ModelCallItem;
      liveDeltas: ModelCallDeltaItem[];
    };

const heartbeatRank = (message: RuntimeChatMessage): number => {
  if (message.role === "user") {
    return 0;
  }
  if (message.heartbeatKind === "compact_separator") {
    return 3;
  }
  return 4;
};

const compareDeltas = (left: ModelCallDeltaItem, right: ModelCallDeltaItem): number => {
  if (left.timestamp !== right.timestamp) {
    return left.timestamp - right.timestamp;
  }
  if (left.seq !== right.seq) {
    return left.seq - right.seq;
  }
  return left.id - right.id;
};

const compareTimelineItems = (left: RuntimeHeartbeatTimelineItem, right: RuntimeHeartbeatTimelineItem): number => {
  if (left.timestamp !== right.timestamp) {
    return left.timestamp - right.timestamp;
  }

  const leftRank =
    left.kind === "heartbeat" ? heartbeatRank(left.message) : left.kind === "request_aux" ? 1 : 2;
  const rightRank =
    right.kind === "heartbeat" ? heartbeatRank(right.message) : right.kind === "request_aux" ? 1 : 2;
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  if (left.sortId !== right.sortId) {
    return left.sortId - right.sortId;
  }
  return left.id.localeCompare(right.id);
};

export const buildRuntimeHeartbeatTimeline = (input: {
  messages: RuntimeChatMessage[];
  requestAux: RequestAuxItem[];
  modelCalls: ModelCallItem[];
  modelCallDeltas: ModelCallDeltaItem[];
}): RuntimeHeartbeatTimelineItem[] => {
  const deltaByModelCallId = new Map<number, ModelCallDeltaItem[]>();
  for (const delta of input.modelCallDeltas) {
    const current = deltaByModelCallId.get(delta.modelCallId) ?? [];
    current.push(delta);
    deltaByModelCallId.set(delta.modelCallId, current);
  }

  const timeline: RuntimeHeartbeatTimelineItem[] = [
    ...input.messages.map((message, index) => ({
      id: `heartbeat:${message.id}`,
      kind: "heartbeat" as const,
      timestamp: message.timestamp,
      sortId: Number(message.id) || index,
      message,
    })),
    ...input.requestAux.map((entry) => ({
      id: `request-aux:${entry.id}`,
      kind: "request_aux" as const,
      timestamp: entry.createdAt,
      sortId: entry.id,
      entry,
    })),
    ...input.modelCalls.map((entry) => ({
      id: `model-call:${entry.id}`,
      kind: "model_call" as const,
      timestamp: entry.createdAt,
      sortId: entry.id,
      entry,
      liveDeltas: [...(deltaByModelCallId.get(entry.id) ?? [])].sort(compareDeltas),
    })),
  ];

  return timeline.sort(compareTimelineItems);
};
