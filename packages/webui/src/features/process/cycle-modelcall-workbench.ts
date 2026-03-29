import type {
  ModelCallDeltaItem,
  ModelCallItem,
  RuntimeChatCycle,
} from "@agenter/client-sdk";

export type ModelCallConversationLane = "input" | "output";
export type ModelCallConversationFormat = "markdown" | "json";

export interface ModelCallConversationRow {
  key: string;
  index: number;
  lane: ModelCallConversationLane;
  role: string;
  label: string;
  format: ModelCallConversationFormat;
  content?: string;
  payload?: unknown;
  timestamp?: number;
}

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

interface ConversationBuilder {
  rows: ModelCallConversationRow[];
  nextIndex: number;
  seenAssistantTexts: Set<string>;
  seenToolInvocationIds: Set<string>;
}

interface DeltaSnapshot {
  seq: number;
  timestamp: number;
  data: LooseRecord | null;
}

const hasOwn = (record: LooseRecord, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

const asRecord = (value: unknown): LooseRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as LooseRecord;
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

const normalizeText = (value: string): string => value.trim();

const splitMessageContent = (value: unknown): { text: string; structured: unknown[] } => {
  if (typeof value === "string") {
    return { text: value, structured: [] };
  }

  if (value === null || value === undefined) {
    return { text: "", structured: [] };
  }

  const textParts: string[] = [];
  const structuredParts: unknown[] = [];

  const collectPart = (part: unknown): void => {
    if (typeof part === "string") {
      textParts.push(part);
      return;
    }

    const record = asRecord(part);
    if (!record) {
      structuredParts.push(part);
      return;
    }

    const directText = asString(record.text).trim();
    if (directText.length > 0) {
      textParts.push(directText);
      return;
    }

    const contentText = asString(record.content).trim();
    if (contentText.length > 0) {
      textParts.push(contentText);
      return;
    }

    structuredParts.push(part);
  };

  if (Array.isArray(value)) {
    for (const part of value) {
      collectPart(part);
    }
  } else {
    collectPart(value);
  }

  return {
    text: textParts.join("\n").trim(),
    structured: structuredParts,
  };
};

const createBuilder = (): ConversationBuilder => ({
  rows: [],
  nextIndex: 0,
  seenAssistantTexts: new Set<string>(),
  seenToolInvocationIds: new Set<string>(),
});

const pushMarkdownRow = (
  builder: ConversationBuilder,
  input: {
    key: string;
    lane: ModelCallConversationLane;
    role: string;
    label: string;
    content: string;
    timestamp?: number;
  },
): void => {
  builder.rows.push({
    key: input.key,
    index: builder.nextIndex,
    lane: input.lane,
    role: input.role,
    label: input.label,
    format: "markdown",
    content: input.content,
    timestamp: input.timestamp,
  });
  builder.nextIndex += 1;
};

const pushJsonRow = (
  builder: ConversationBuilder,
  input: {
    key: string;
    lane: ModelCallConversationLane;
    role: string;
    label: string;
    payload: unknown;
    timestamp?: number;
  },
): void => {
  builder.rows.push({
    key: input.key,
    index: builder.nextIndex,
    lane: input.lane,
    role: input.role,
    label: input.label,
    format: "json",
    payload: input.payload,
    timestamp: input.timestamp,
  });
  builder.nextIndex += 1;
};

const pushMessageContentRows = (
  builder: ConversationBuilder,
  input: {
    keyPrefix: string;
    lane: ModelCallConversationLane;
    role: string;
    label: string;
    content: unknown;
    timestamp?: number;
    markAssistantText?: boolean;
    skipSeenAssistantText?: boolean;
  },
): void => {
  const { text, structured } = splitMessageContent(input.content);
  const normalized = normalizeText(text);

  if (normalized.length > 0) {
    const alreadySeen = builder.seenAssistantTexts.has(normalized);
    if (!(input.skipSeenAssistantText && alreadySeen)) {
      pushMarkdownRow(builder, {
        key: `${input.keyPrefix}:text`,
        lane: input.lane,
        role: input.role,
        label: input.label,
        content: text,
        timestamp: input.timestamp,
      });
    }
    if (input.markAssistantText) {
      builder.seenAssistantTexts.add(normalized);
    }
  }

  if (structured.length > 0) {
    pushJsonRow(builder, {
      key: `${input.keyPrefix}:payload`,
      lane: input.lane,
      role: input.role,
      label: `${input.label} payload`,
      payload: structured.length === 1 ? structured[0] : structured,
      timestamp: input.timestamp,
    });
  }
};

const findCycleModelCall = (cycle: RuntimeChatCycle, modelCalls: ModelCallItem[]): ModelCallItem | null => {
  if (cycle.modelCallId !== null) {
    const byId = modelCalls.find((entry) => entry.id === cycle.modelCallId);
    if (byId) {
      return byId;
    }
  }

  if (cycle.cycleId === null) {
    return null;
  }

  const candidates = modelCalls.filter((entry) => entry.cycleId === cycle.cycleId);
  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((latest, current) => (current.id > latest.id ? current : latest));
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

const appendRequestRows = (builder: ConversationBuilder, request: LooseRecord | null): void => {
  if (!request) {
    return;
  }

  asArray(request.messages).forEach((entry, index) => {
    const record = asRecord(entry);
    const role = asString(record?.role) || "unknown";
    const content = record ? record.content : entry;

    pushMessageContentRows(builder, {
      keyPrefix: `request:${index}:${role}`,
      lane: "input",
      role,
      label: `message #${index + 1}`,
      content,
    });
  });
};

const appendResponseRows = (builder: ConversationBuilder, response: LooseRecord | null): void => {
  if (!response) {
    return;
  }

  const assistant = asRecord(response.assistant);
  const assistantThinking = asString(assistant?.thinking).trim();
  if (assistantThinking.length > 0) {
    pushMarkdownRow(builder, {
      key: "response:assistant:thinking",
      lane: "output",
      role: "assistant",
      label: "assistant thinking",
      content: assistantThinking,
    });
  }

  const assistantText = asString(assistant?.text).trim();
  if (assistantText.length > 0) {
    pushMessageContentRows(builder, {
      keyPrefix: "response:assistant:text",
      lane: "output",
      role: "assistant",
      label: "assistant response",
      content: assistantText,
      markAssistantText: true,
    });
  }

  asArray(response.toolTrace).forEach((entry, index) => {
    const record = asRecord(entry);
    if (!record) {
      pushJsonRow(builder, {
        key: `response:tool:${index}:payload`,
        lane: "output",
        role: "tool",
        label: `tool trace #${index + 1}`,
        payload: entry,
      });
      return;
    }

    const invocationId = asString(record.invocationId) || `tool-${index + 1}`;
    const toolName = asString(record.tool) || "tool";
    builder.seenToolInvocationIds.add(invocationId);

    if (hasOwn(record, "input")) {
      pushJsonRow(builder, {
        key: `response:tool:${invocationId}:call`,
        lane: "output",
        role: "tool",
        label: `tool call · ${toolName}`,
        payload: {
          invocationId,
          tool: toolName,
          input: record.input,
          startedAt: record.startedAt,
        },
      });
    }

    if (hasOwn(record, "output") || hasOwn(record, "error")) {
      pushJsonRow(builder, {
        key: `response:tool:${invocationId}:result`,
        lane: "output",
        role: "tool",
        label: `tool result · ${toolName}`,
        payload: {
          invocationId,
          tool: toolName,
          output: record.output,
          error: record.error,
          finishedAt: record.finishedAt,
        },
      });
    }
  });

  const decision = asRecord(response.decision);
  if (decision) {
    pushJsonRow(builder, {
      key: "response:decision",
      lane: "output",
      role: "assistant",
      label: "decision",
      payload: decision,
    });
  }

  const responseMeta: LooseRecord = {};
  for (const [key, value] of Object.entries(response)) {
    if (key === "assistant" || key === "toolTrace" || key === "decision") {
      continue;
    }
    responseMeta[key] = value;
  }

  if (Object.keys(responseMeta).length > 0) {
    pushJsonRow(builder, {
      key: "response:meta",
      lane: "output",
      role: "assistant",
      label: "response meta",
      payload: responseMeta,
    });
  }
};

const appendDeltaRows = (
  builder: ConversationBuilder,
  deltas: ModelCallDeltaItem[],
  input: { hasResponse: boolean },
): void => {
  let latestDraft: { seq: number; timestamp: number; content: string } | null = null;
  let latestRunFinished: DeltaSnapshot | null = null;
  const toolCalls = new Map<string, DeltaSnapshot>();
  const toolResults = new Map<string, DeltaSnapshot>();

  for (const delta of deltas) {
    const data = asRecord(delta.data);

    if (delta.kind === "assistant_draft") {
      const content = asString(data?.content).trim();
      if (content.length > 0) {
        latestDraft = {
          seq: delta.seq,
          timestamp: delta.timestamp,
          content,
        };
      }
      continue;
    }

    if (delta.kind === "run_finished") {
      latestRunFinished = {
        seq: delta.seq,
        timestamp: delta.timestamp,
        data,
      };
      continue;
    }

    if (delta.kind === "tool_call") {
      const toolCallId = asString(data?.toolCallId) || `delta-tool-call:${delta.seq}`;
      toolCalls.set(toolCallId, {
        seq: delta.seq,
        timestamp: delta.timestamp,
        data,
      });
      continue;
    }

    if (delta.kind === "tool_result") {
      const toolCallId = asString(data?.toolCallId) || `delta-tool-result:${delta.seq}`;
      toolResults.set(toolCallId, {
        seq: delta.seq,
        timestamp: delta.timestamp,
        data,
      });
    }
  }

  const timeline: Array<
    | { kind: "draft"; seq: number; timestamp: number; content: string }
    | { kind: "tool_call"; seq: number; timestamp: number; toolCallId: string; data: LooseRecord | null }
    | { kind: "tool_result"; seq: number; timestamp: number; toolCallId: string; data: LooseRecord | null }
    | { kind: "run_finished"; seq: number; timestamp: number; data: LooseRecord | null }
  > = [];

  if (latestDraft) {
    timeline.push({
      kind: "draft",
      seq: latestDraft.seq,
      timestamp: latestDraft.timestamp,
      content: latestDraft.content,
    });
  }

  for (const [toolCallId, snapshot] of toolCalls.entries()) {
    timeline.push({
      kind: "tool_call",
      seq: snapshot.seq,
      timestamp: snapshot.timestamp,
      toolCallId,
      data: snapshot.data,
    });
  }

  for (const [toolCallId, snapshot] of toolResults.entries()) {
    timeline.push({
      kind: "tool_result",
      seq: snapshot.seq,
      timestamp: snapshot.timestamp,
      toolCallId,
      data: snapshot.data,
    });
  }

  if (latestRunFinished && !input.hasResponse) {
    timeline.push({
      kind: "run_finished",
      seq: latestRunFinished.seq,
      timestamp: latestRunFinished.timestamp,
      data: latestRunFinished.data,
    });
  }

  timeline
    .slice()
    .sort((left, right) => left.seq - right.seq)
    .forEach((entry) => {
      if (entry.kind === "draft") {
        const normalized = normalizeText(entry.content);
        if (normalized.length > 0 && !builder.seenAssistantTexts.has(normalized)) {
          pushMarkdownRow(builder, {
            key: `delta:draft:${entry.seq}`,
            lane: "output",
            role: "assistant",
            label: "assistant draft",
            content: entry.content,
            timestamp: entry.timestamp,
          });
        }
        return;
      }

      if (entry.kind === "tool_call") {
        if (builder.seenToolInvocationIds.has(entry.toolCallId)) {
          return;
        }
        const toolName = asString(entry.data?.toolName) || "tool";
        pushJsonRow(builder, {
          key: `delta:tool_call:${entry.toolCallId}:${entry.seq}`,
          lane: "output",
          role: "tool",
          label: `tool call · ${toolName}`,
          payload: entry.data ?? { toolCallId: entry.toolCallId },
          timestamp: entry.timestamp,
        });
        return;
      }

      if (entry.kind === "tool_result") {
        if (builder.seenToolInvocationIds.has(entry.toolCallId)) {
          return;
        }
        const toolName = asString(entry.data?.toolName) || "tool";
        pushJsonRow(builder, {
          key: `delta:tool_result:${entry.toolCallId}:${entry.seq}`,
          lane: "output",
          role: "tool",
          label: `tool result · ${toolName}`,
          payload: entry.data ?? { toolCallId: entry.toolCallId },
          timestamp: entry.timestamp,
        });
        return;
      }

      pushJsonRow(builder, {
        key: `delta:run_finished:${entry.seq}`,
        lane: "output",
        role: "assistant",
        label: "run finished",
        payload: entry.data ?? {},
        timestamp: entry.timestamp,
      });
    });
};

export const buildCycleModelCallWorkbench = (input: {
  cycle: RuntimeChatCycle;
  modelCalls: ModelCallItem[];
  modelCallDeltas: ModelCallDeltaItem[];
}): CycleModelCallWorkbench => {
  const modelCall = findCycleModelCall(input.cycle, input.modelCalls);
  const request = asRecord(modelCall?.request);
  const response = asRecord(modelCall?.response);
  const deltas = resolveCycleDeltas(input.cycle, modelCall, input.modelCallDeltas);

  const builder = createBuilder();
  appendRequestRows(builder, request);
  appendResponseRows(builder, response);
  appendDeltaRows(builder, deltas, { hasResponse: response !== null });

  return {
    modelCall,
    deltas,
    conversation: builder.rows,
    config: {
      systemPrompt: asString(request?.systemPrompt),
      request: modelCall?.request ?? null,
      requestMeta: asRecord(request?.meta) ?? {},
      tools: asArray(request?.tools),
      response: modelCall?.response ?? null,
      error: modelCall?.error ?? null,
    },
  };
};
