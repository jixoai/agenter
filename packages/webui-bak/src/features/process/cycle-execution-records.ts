import type { RuntimeChatCycle, RuntimeChatMessage } from "@agenter/client-sdk";

import type { ToolInvocationView } from "../../components/ui/tool-invocation-card";

export type CycleExecutionRecord =
  | {
      key: string;
      kind: "message";
      message: RuntimeChatMessage;
    }
  | {
      key: string;
      kind: "tool-invocation";
      invocation: ToolInvocationView;
    };

const compareMessage = (left: RuntimeChatMessage, right: RuntimeChatMessage): number => {
  if (left.timestamp !== right.timestamp) {
    return left.timestamp - right.timestamp;
  }
  return left.id.localeCompare(right.id);
};

const isToolInvocationMessage = (message: RuntimeChatMessage): boolean => {
  return message.channel === "tool" && Boolean(message.tool);
};

const collectExecutionMessages = (cycle: RuntimeChatCycle): RuntimeChatMessage[] =>
  [...cycle.outputs, ...cycle.liveMessages].filter((message) => message.channel !== "to_user").sort(compareMessage);

type RuntimeToolPayload = NonNullable<RuntimeChatMessage["tool"]>["call"];

const toPayload = (payload: RuntimeToolPayload) => {
  if (!payload) {
    return undefined;
  }
  return {
    value: payload.value,
    rawText: payload.rawText,
  };
};

export const normalizeCycleExecutionRecords = (cycle: RuntimeChatCycle): CycleExecutionRecord[] => {
  const records: CycleExecutionRecord[] = [];

  for (const message of collectExecutionMessages(cycle)) {
    if (!isToolInvocationMessage(message)) {
      records.push({
        key: `message:${message.id}`,
        kind: "message",
        message,
      });
      continue;
    }
    const invocation = message.tool!;
    records.push({
      key: `tool-invocation:${invocation.invocationId}:${message.id}`,
      kind: "tool-invocation",
      invocation: {
        invocationId: invocation.invocationId,
        toolName: invocation.name,
        status: invocation.status,
        startedAt: invocation.startedAt,
        finishedAt: invocation.finishedAt,
        call: toPayload(invocation.call),
        result: toPayload(invocation.result),
        error: invocation.error,
      },
    });
  }

  return records;
};
