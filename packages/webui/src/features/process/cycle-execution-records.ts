import type { RuntimeChatCycle, RuntimeChatMessage } from "@agenter/client-sdk";

import type { ToolInvocationView } from "../../components/ui/tool-invocation-card";
import { parseToolPayload } from "../chat/tool-payload";

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

const parseLiveToolInvocationId = (messageId: string): string | null => {
  const match = /^live-tool-(?:call|result):(.+)$/.exec(messageId);
  return match?.[1] ?? null;
};

const resolveInvocationStatus = (message: RuntimeChatMessage): ToolInvocationView["status"] => {
  if (message.channel !== "tool_result") {
    return "running";
  }
  return message.tool?.ok === false ? "failed" : "success";
};

const resolveInvocationIdentity = (message: RuntimeChatMessage): string | null => {
  const liveId = parseLiveToolInvocationId(message.id);
  if (liveId) {
    return liveId;
  }
  const parsed = parseToolPayload(message.content, message.tool?.name);
  if (parsed.timestamp) {
    return `${parsed.toolName}:${parsed.timestamp}`;
  }
  return null;
};

const isToolInvocationMessage = (message: RuntimeChatMessage): boolean => {
  return message.channel === "tool_call" || message.channel === "tool_result";
};

const collectExecutionMessages = (cycle: RuntimeChatCycle): RuntimeChatMessage[] =>
  [...cycle.outputs, ...cycle.liveMessages].filter((message) => message.channel !== "to_user").sort(compareMessage);

const findLatestOpenInvocation = (records: CycleExecutionRecord[], toolName: string): number => {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (!record || record.kind !== "tool-invocation") {
      continue;
    }
    if (record.invocation.toolName !== toolName) {
      continue;
    }
    if (!record.invocation.result) {
      return index;
    }
  }
  return -1;
};

const toPayload = (content: string): { value: unknown; rawText: string } => {
  const parsed = parseToolPayload(content);
  return {
    value: parsed.data ?? parsed.body,
    rawText: parsed.body,
  };
};

export const normalizeCycleExecutionRecords = (cycle: RuntimeChatCycle): CycleExecutionRecord[] => {
  const records: CycleExecutionRecord[] = [];
  const invocationIndexByIdentity = new Map<string, number>();

  for (const message of collectExecutionMessages(cycle)) {
    if (!isToolInvocationMessage(message)) {
      records.push({
        key: `message:${message.id}`,
        kind: "message",
        message,
      });
      continue;
    }

    const parsed = parseToolPayload(message.content, message.tool?.name);
    const toolName = parsed.toolName;
    const invocationId = resolveInvocationIdentity(message);
    const exactIndex = invocationId ? (invocationIndexByIdentity.get(invocationId) ?? -1) : -1;
    const fallbackIndex = exactIndex >= 0 ? exactIndex : findLatestOpenInvocation(records, toolName);
    const recordIndex = fallbackIndex >= 0 ? fallbackIndex : records.length;

    const current =
      fallbackIndex >= 0 && records[recordIndex]?.kind === "tool-invocation"
        ? records[recordIndex]
        : ({
            key: `tool-invocation:${invocationId ?? `${toolName}:${message.id}`}`,
            kind: "tool-invocation",
            invocation: {
              invocationId: invocationId ?? `${toolName}:${message.id}`,
              toolName,
              status: "running",
              startedAt: message.timestamp,
            },
          } satisfies CycleExecutionRecord);

    if (current.kind !== "tool-invocation") {
      continue;
    }

    current.invocation.status = resolveInvocationStatus(message);
    if (message.channel === "tool_call") {
      current.invocation.call = toPayload(message.content);
    } else {
      current.invocation.result = toPayload(message.content);
      current.invocation.finishedAt = message.timestamp;
      if (message.tool?.ok === false && typeof parsed.data === "object" && parsed.data !== null) {
        const maybeError = (parsed.data as { error?: unknown }).error;
        if (typeof maybeError === "string" && maybeError.trim().length > 0) {
          current.invocation.error = maybeError.trim();
        }
      }
    }

    if (fallbackIndex >= 0) {
      records[recordIndex] = current;
    } else {
      records.push(current);
    }

    if (invocationId) {
      invocationIndexByIdentity.set(invocationId, recordIndex);
    }
  }

  return records;
};
