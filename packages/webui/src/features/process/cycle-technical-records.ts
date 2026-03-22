import type { RuntimeChatCycle, RuntimeChatMessage } from "@agenter/client-sdk";

import { buildToolMeta, parseToolPayload } from "../chat/tool-payload";

type ToolTraceStatus = "calling" | "done" | "failed";

export type CycleTechnicalRecord =
  | {
      key: string;
      kind: "message";
      message: RuntimeChatMessage;
    }
  | {
      key: string;
      kind: "tool-trace";
      toolTrace: {
        id: string;
        toolName: string;
        status: ToolTraceStatus;
        meta?: string | null;
        callContent?: string;
        resultContent?: string;
      };
    };

const compareMessage = (left: RuntimeChatMessage, right: RuntimeChatMessage): number => {
  if (left.timestamp !== right.timestamp) {
    return left.timestamp - right.timestamp;
  }
  return left.id.localeCompare(right.id);
};

const parseLiveToolTraceId = (messageId: string): string | null => {
  const match = /^live-tool-(?:call|result):(.+)$/.exec(messageId);
  return match?.[1] ?? null;
};

const resolveToolName = (message: RuntimeChatMessage): string => {
  return parseToolPayload(message.content, message.tool?.name).toolName;
};

const resolveToolTraceIdentity = (message: RuntimeChatMessage): string | null => {
  const liveId = parseLiveToolTraceId(message.id);
  if (liveId) {
    return liveId;
  }

  const parsed = parseToolPayload(message.content, message.tool?.name);
  if (parsed.timestamp) {
    return `${parsed.toolName}:${parsed.timestamp}`;
  }

  return null;
};

const resolveToolTraceStatus = (message: RuntimeChatMessage): ToolTraceStatus => {
  if (message.channel !== "tool_result") {
    return "calling";
  }
  return message.tool?.ok === false ? "failed" : "done";
};

const isToolTraceMessage = (message: RuntimeChatMessage): boolean => {
  return message.channel === "tool_call" || message.channel === "tool_result";
};

const collectTechnicalMessages = (cycle: RuntimeChatCycle): RuntimeChatMessage[] =>
  [...cycle.outputs, ...cycle.liveMessages]
    .filter((message) => message.channel !== "to_user")
    .sort(compareMessage);

const findLatestOpenToolTrace = (records: CycleTechnicalRecord[], toolName: string): number => {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (!record || record.kind !== "tool-trace") {
      continue;
    }
    if (record.toolTrace.toolName !== toolName) {
      continue;
    }
    if (!record.toolTrace.resultContent) {
      return index;
    }
  }
  return -1;
};

export const normalizeCycleTechnicalRecords = (cycle: RuntimeChatCycle): CycleTechnicalRecord[] => {
  const records: CycleTechnicalRecord[] = [];
  const toolTraceIndexByIdentity = new Map<string, number>();

  for (const message of collectTechnicalMessages(cycle)) {
    if (!isToolTraceMessage(message)) {
      records.push({
        key: `message:${message.id}`,
        kind: "message",
        message,
      });
      continue;
    }

    const parsed = parseToolPayload(message.content, message.tool?.name);
    const toolName = parsed.toolName;
    const toolTraceId = resolveToolTraceIdentity(message);
    const exactIndex = toolTraceId ? toolTraceIndexByIdentity.get(toolTraceId) ?? -1 : -1;
    const fallbackIndex = exactIndex >= 0 ? exactIndex : findLatestOpenToolTrace(records, toolName);
    const recordIndex = fallbackIndex >= 0 ? fallbackIndex : records.length;

    const current =
      fallbackIndex >= 0 && records[recordIndex]?.kind === "tool-trace"
        ? records[recordIndex]
        : ({
            key: `tool-trace:${toolTraceId ?? `${toolName}:${message.id}`}`,
            kind: "tool-trace",
            toolTrace: {
              id: toolTraceId ?? `${toolName}:${message.id}`,
              toolName,
              status: "calling" as ToolTraceStatus,
              meta: buildToolMeta(parsed),
            },
          } satisfies CycleTechnicalRecord);

    if (current.kind !== "tool-trace") {
      continue;
    }

    current.toolTrace.meta ??= buildToolMeta(parsed);
    current.toolTrace.status = resolveToolTraceStatus(message);

    if (message.channel === "tool_call") {
      current.toolTrace.callContent = message.content;
    } else {
      current.toolTrace.resultContent = message.content;
    }

    if (fallbackIndex >= 0) {
      records[recordIndex] = current;
    } else {
      records.push(current);
    }

    if (toolTraceId) {
      toolTraceIndexByIdentity.set(toolTraceId, recordIndex);
    }
  }

  return records;
};
