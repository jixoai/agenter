import type {
  ModelCallDeltaItem,
  ModelCallItem,
  RuntimeChatCycle,
} from "@agenter/client-sdk";

import type { ToolInvocationView } from "../../components/ui/tool-invocation-card";

export type ConversationRowSource = "request" | "cycle" | "delta";

export type ModelCallConversationRow =
  | {
      key: string;
      kind: "user" | "assistant";
      source: ConversationRowSource;
      timestamp: number;
      content: string;
    }
  | {
      key: string;
      kind: "tool";
      source: "cycle" | "delta";
      timestamp: number;
      invocation: ToolInvocationView;
    };

export interface CycleModelCallWorkbench {
  modelCall: ModelCallItem | null;
  deltas: ModelCallDeltaItem[];
  conversation: ModelCallConversationRow[];
  config: {
    systemPrompt: string;
    request: unknown;
    requestMeta: Record<string, unknown>;
    tools: unknown[];
    response: unknown;
    error: unknown;
  };
}

type LooseRecord = Record<string, unknown>;

const asRecord = (value: unknown): LooseRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as LooseRecord;
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

const asBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }
  return null;
};

const toText = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  if (!Array.isArray(value)) {
    return "";
  }
  const chunks: string[] = [];
  for (const part of value) {
    if (typeof part === "string") {
      if (part.trim().length > 0) {
        chunks.push(part);
      }
      continue;
    }
    const record = asRecord(part);
    if (!record) {
      continue;
    }
    const directText = asString(record.text);
    if (directText.trim().length > 0) {
      chunks.push(directText);
      continue;
    }
    const contentText = asString(record.content);
    if (contentText.trim().length > 0) {
      chunks.push(contentText);
    }
  }
  return chunks.join("\n");
};

const normalizeTimestamp = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return fallback;
};

const findCycleModelCall = (cycle: RuntimeChatCycle, modelCalls: ModelCallItem[]): ModelCallItem | null => {
  if (cycle.modelCallId !== null) {
    const byId = modelCalls.find((entry) => entry.id === cycle.modelCallId);
    if (byId) {
      return byId;
    }
  }
  if (cycle.cycleId !== null) {
    const byCycle = modelCalls.find((entry) => entry.cycleId === cycle.cycleId);
    if (byCycle) {
      return byCycle;
    }
  }
  return null;
};

const resolveCycleDeltas = (
  cycle: RuntimeChatCycle,
  modelCall: ModelCallItem | null,
  modelCallDeltas: ModelCallDeltaItem[],
): ModelCallDeltaItem[] => {
  return modelCallDeltas
    .filter((entry) => {
      if (modelCall) {
        return entry.modelCallId === modelCall.id;
      }
      if (cycle.cycleId !== null) {
        return entry.cycleId === cycle.cycleId;
      }
      return false;
    })
    .slice()
    .sort((left, right) => left.seq - right.seq);
};

const buildRequestRows = (request: LooseRecord | null, baseTimestamp: number): ModelCallConversationRow[] => {
  if (!request) {
    return [];
  }
  const rows: ModelCallConversationRow[] = [];
  const messages = asArray(request.messages);
  messages.forEach((entry, index) => {
    const record = asRecord(entry);
    if (!record) {
      return;
    }
    const role = asString(record.role);
    if (role !== "user" && role !== "assistant") {
      return;
    }
    const content = toText(record.content);
    if (content.trim().length === 0) {
      return;
    }
    rows.push({
      key: `request:${index}:${role}`,
      kind: role,
      source: "request",
      timestamp: baseTimestamp - 1_000 + index,
      content,
    });
  });
  return rows;
};

const buildFallbackCycleInputRows = (cycle: RuntimeChatCycle, baseTimestamp: number): ModelCallConversationRow[] => {
  return cycle.inputs
    .filter((input) => input.source === "message" && input.role === "user")
    .map((input, index) => ({
      key: `cycle-input:${cycle.id}:${index}`,
      kind: "user" as const,
      source: "cycle" as const,
      timestamp: baseTimestamp - 500 + index,
      content: input.parts
        .filter((part): part is Extract<(typeof input.parts)[number], { type: "text" }> => part.type === "text")
        .map((part) => part.text)
        .join("\n"),
    }))
    .filter((entry) => entry.content.trim().length > 0);
};

const buildToolRows = (
  cycle: RuntimeChatCycle,
  deltas: ModelCallDeltaItem[],
): ModelCallConversationRow[] => {
  const byInvocation = new Map<string, Extract<ModelCallConversationRow, { kind: "tool" }>>();

  for (const delta of deltas) {
    const data = asRecord(delta.data);
    if (!data || (delta.kind !== "tool_call" && delta.kind !== "tool_result")) {
      continue;
    }
    const invocationId = asString(data.toolCallId) || `delta-tool-${delta.id}`;
    const previous = byInvocation.get(invocationId);
    const toolName = asString(data.toolName) || previous?.invocation.toolName || "tool";
    const ok = asBoolean(data.ok);
    const nextStatus =
      delta.kind === "tool_call"
        ? "running"
        : ok === false
          ? "failed"
          : ok === true
            ? "success"
            : previous?.invocation.status ?? "running";

    byInvocation.set(invocationId, {
      key: `delta-tool:${invocationId}`,
      kind: "tool",
      source: "delta",
      timestamp: normalizeTimestamp(delta.timestamp, Date.now()),
      invocation: {
        invocationId,
        toolName,
        status: nextStatus,
        startedAt: previous?.invocation.startedAt ?? normalizeTimestamp(delta.timestamp, Date.now()),
        finishedAt: delta.kind === "tool_result" ? normalizeTimestamp(delta.timestamp, Date.now()) : previous?.invocation.finishedAt,
        call:
          delta.kind === "tool_call" || previous?.invocation.call
            ? {
                value: delta.kind === "tool_call" ? data.input ?? data.args ?? previous?.invocation.call?.value ?? null : previous?.invocation.call?.value ?? null,
                rawText: delta.kind === "tool_call" ? asString(data.argsText) || undefined : previous?.invocation.call?.rawText,
              }
            : null,
        result:
          delta.kind === "tool_result" || previous?.invocation.result
            ? {
                value: delta.kind === "tool_result" ? data.result ?? null : previous?.invocation.result?.value ?? null,
              }
            : null,
        error: delta.kind === "tool_result" ? asString(data.error) || null : previous?.invocation.error ?? null,
      },
    });
  }

  for (const message of [...cycle.outputs, ...cycle.liveMessages]) {
    if (!message.tool) {
      continue;
    }
    byInvocation.set(message.tool.invocationId, {
      key: `cycle-tool:${message.tool.invocationId}`,
      kind: "tool",
      source: "cycle",
      timestamp: normalizeTimestamp(message.timestamp, Date.now()),
      invocation: {
        invocationId: message.tool.invocationId,
        toolName: message.tool.name,
        status: message.tool.status,
        startedAt: message.tool.startedAt,
        finishedAt: message.tool.finishedAt,
        call: message.tool.call ?? null,
        result: message.tool.result ?? null,
        error: message.tool.error ?? null,
      },
    });
  }

  return [...byInvocation.values()].sort((left, right) => left.timestamp - right.timestamp);
};

const buildAssistantRows = (
  cycle: RuntimeChatCycle,
  deltas: ModelCallDeltaItem[],
): ModelCallConversationRow[] => {
  const rows: ModelCallConversationRow[] = [];
  for (const message of [...cycle.outputs, ...cycle.liveMessages]) {
    if (message.role !== "assistant" || message.channel !== "to_user" || message.content.trim().length === 0) {
      continue;
    }
    rows.push({
      key: `assistant:${message.id}`,
      kind: "assistant",
      source: "cycle",
      timestamp: normalizeTimestamp(message.timestamp, Date.now()),
      content: message.content,
    });
  }
  const latestDraft = [...deltas].reverse().find((entry) => entry.kind === "assistant_draft");
  const latestDraftContent = asString(asRecord(latestDraft?.data)?.content);
  const latestAssistant = rows.at(-1)?.content.trim();
  if (latestDraft && latestDraftContent.trim().length > 0 && latestAssistant !== latestDraftContent.trim()) {
    rows.push({
      key: `assistant-draft:${latestDraft.id}`,
      kind: "assistant",
      source: "delta",
      timestamp: normalizeTimestamp(latestDraft.timestamp, Date.now()),
      content: latestDraftContent,
    });
  }
  return rows;
};

export const buildCycleModelCallWorkbench = (input: {
  cycle: RuntimeChatCycle;
  modelCalls: ModelCallItem[];
  modelCallDeltas: ModelCallDeltaItem[];
}): CycleModelCallWorkbench => {
  const modelCall = findCycleModelCall(input.cycle, input.modelCalls);
  const request = asRecord(modelCall?.request);
  const baseTimestamp = normalizeTimestamp(modelCall?.createdAt ?? input.cycle.createdAt, Date.now());
  const deltas = resolveCycleDeltas(input.cycle, modelCall, input.modelCallDeltas);
  const requestRows = buildRequestRows(request, baseTimestamp);
  const cycleInputRows = requestRows.some((entry) => entry.kind === "user") ? [] : buildFallbackCycleInputRows(input.cycle, baseTimestamp);
  const toolRows = buildToolRows(input.cycle, deltas);
  const assistantRows = buildAssistantRows(input.cycle, deltas);
  const conversation = [...requestRows, ...cycleInputRows, ...toolRows, ...assistantRows].sort(
    (left, right) => left.timestamp - right.timestamp,
  );

  const systemPrompt = [
    asString(request?.systemPrompt),
    ...asArray(request?.messages)
      .map((message) => asRecord(message))
      .filter((message): message is LooseRecord => message !== null && asString(message.role) === "system")
      .map((message) => toText(message.content)),
  ]
    .join("\n\n")
    .trim();

  return {
    modelCall,
    deltas,
    conversation,
    config: {
      systemPrompt,
      request: modelCall?.request ?? null,
      requestMeta: asRecord(request?.meta) ?? {},
      tools: asArray(request?.tools),
      response: modelCall?.response ?? null,
      error: modelCall?.error ?? null,
    },
  };
};
