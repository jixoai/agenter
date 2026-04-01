import type { ModelCallDeltaItem, ModelCallItem, RuntimeChatCycle } from "@agenter/client-sdk";

import type { ToolInvocationView } from "../../components/ui/tool-invocation-card";

export type CycleModelCallTranscriptLane = "input" | "output";
export type CycleModelCallTranscriptMessagePresentation = "input" | "assistant" | "technical";

interface CycleModelCallTranscriptBase {
  key: string;
  index: number;
  lane: CycleModelCallTranscriptLane;
  role: string;
  label: string;
  timestamp?: number;
}

export interface CycleModelCallTranscriptMessageRow extends CycleModelCallTranscriptBase {
  type: "message";
  content: string;
  presentation: CycleModelCallTranscriptMessagePresentation;
}

export interface CycleModelCallTranscriptToolRow extends CycleModelCallTranscriptBase {
  type: "tool";
  invocation: ToolInvocationView;
}

export type CycleModelCallTranscriptRow = CycleModelCallTranscriptMessageRow | CycleModelCallTranscriptToolRow;

export interface CycleModelCallWorkbench {
  modelCall: ModelCallItem | null;
  deltas: ModelCallDeltaItem[];
  transcript: CycleModelCallTranscriptRow[];
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
  rows: CycleModelCallTranscriptRow[];
  nextIndex: number;
  seenAssistantTexts: Set<string>;
  seenToolInvocationIds: Set<string>;
}

interface PendingToolInvocation {
  seq: number;
  timestamp: number;
  invocation: ToolInvocationView;
}

const hasOwn = (record: LooseRecord, key: string): boolean => Object.prototype.hasOwnProperty.call(record, key);

const asRecord = (value: unknown): LooseRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as LooseRecord;
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

const asFiniteNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const normalizeText = (value: string): string => value.trim();

const createBuilder = (): ConversationBuilder => ({
  rows: [],
  nextIndex: 0,
  seenAssistantTexts: new Set<string>(),
  seenToolInvocationIds: new Set<string>(),
});

const stringifyUnknown = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const toCodeFence = (value: unknown, language = "json"): string => {
  const body = stringifyUnknown(value).trim();
  if (body.length === 0) {
    return "";
  }
  return [`\`\`\`${language}`, body, "```"].join("\n");
};

const compactStructuredValue = (value: unknown): unknown => {
  const record = asRecord(value);
  if (!record) {
    return value;
  }

  const source = asRecord(record.source);
  if (!source) {
    return record;
  }

  const compactSource: LooseRecord = {};
  const sourceType = asString(source.type);
  if (sourceType.length > 0) {
    compactSource.type = sourceType;
  }
  const mimeType = asString(source.mimeType);
  if (mimeType.length > 0) {
    compactSource.mimeType = mimeType;
  }
  if (typeof source.value === "string") {
    compactSource.valueBytes = source.value.length;
  }
  return {
    ...record,
    source: compactSource,
  };
};

const renderMessagePartAsMarkdown = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim();
  }

  const record = asRecord(value);
  if (!record) {
    return toCodeFence(value);
  }

  const directText = asString(record.text).trim();
  if (directText.length > 0) {
    return directText;
  }

  const contentText = asString(record.content).trim();
  if (contentText.length > 0) {
    return contentText;
  }

  return toCodeFence(compactStructuredValue(record));
};

const toMarkdownMessageContent = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value
      .map((part) => renderMessagePartAsMarkdown(part))
      .filter((part) => part.length > 0)
      .join("\n\n")
      .trim();
  }
  return renderMessagePartAsMarkdown(value).trim();
};

const pushMessageRow = (
  builder: ConversationBuilder,
  input: {
    key: string;
    lane: CycleModelCallTranscriptLane;
    role: string;
    label: string;
    content: string;
    presentation: CycleModelCallTranscriptMessagePresentation;
    timestamp?: number;
  },
): void => {
  const content = input.content.trim();
  if (content.length === 0) {
    return;
  }
  builder.rows.push({
    key: input.key,
    index: builder.nextIndex,
    type: "message",
    lane: input.lane,
    role: input.role,
    label: input.label,
    content,
    presentation: input.presentation,
    timestamp: input.timestamp,
  });
  builder.nextIndex += 1;
};

const pushToolRow = (
  builder: ConversationBuilder,
  input: {
    key: string;
    label: string;
    invocation: ToolInvocationView;
    timestamp?: number;
  },
): void => {
  builder.rows.push({
    key: input.key,
    index: builder.nextIndex,
    type: "tool",
    lane: "output",
    role: "tool",
    label: input.label,
    invocation: input.invocation,
    timestamp: input.timestamp,
  });
  builder.nextIndex += 1;
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

const appendRequestRows = (builder: ConversationBuilder, request: LooseRecord | null, timestamp?: number): void => {
  if (!request) {
    return;
  }

  asArray(request.messages).forEach((entry, index) => {
    const record = asRecord(entry);
    const role = asString(record?.role) || "unknown";
    const name = asString(record?.name).trim();
    const content = toMarkdownMessageContent(record ? record.content : entry);

    pushMessageRow(builder, {
      key: `request:${index}:${role}`,
      lane: "input",
      role,
      label: name.length > 0 ? name : `message #${index + 1}`,
      content,
      presentation: "input",
      timestamp,
    });
  });
};

const resolveToolStatusFromTrace = (entry: LooseRecord): ToolInvocationView["status"] => {
  const error = asString(entry.error).trim();
  return error.length > 0 ? "failed" : "success";
};

const appendResponseRows = (
  builder: ConversationBuilder,
  response: LooseRecord | null,
  input: { createdAt?: number; completedAt?: number; error: unknown },
): void => {
  if (!response && input.error == null) {
    return;
  }

  const assistant = asRecord(response?.assistant);
  const assistantThinking = asString(assistant?.thinking).trim();
  if (assistantThinking.length > 0) {
    pushMessageRow(builder, {
      key: "response:assistant:thinking",
      lane: "output",
      role: "assistant",
      label: "assistant thinking",
      content: assistantThinking,
      presentation: "technical",
      timestamp: input.createdAt,
    });
  }

  const toolTrace = asArray(response?.toolTrace)
    .map((entry, index) => ({ record: asRecord(entry), index }))
    .sort((left, right) => {
      const leftStart = asFiniteNumber(left.record?.startedAt) ?? Number.MAX_SAFE_INTEGER;
      const rightStart = asFiniteNumber(right.record?.startedAt) ?? Number.MAX_SAFE_INTEGER;
      if (leftStart !== rightStart) {
        return leftStart - rightStart;
      }
      return left.index - right.index;
    });

  for (const { record, index } of toolTrace) {
    if (!record) {
      continue;
    }
    const invocationId = asString(record.invocationId) || `tool-${index + 1}`;
    const toolName = asString(record.tool) || "tool";
    builder.seenToolInvocationIds.add(invocationId);
    pushToolRow(builder, {
      key: `response:tool:${invocationId}`,
      label: `tool · ${toolName}`,
      invocation: {
        invocationId,
        toolName,
        status: resolveToolStatusFromTrace(record),
        call: hasOwn(record, "input") ? { value: record.input } : null,
        result: hasOwn(record, "output") ? { value: record.output } : null,
        error: asString(record.error).trim() || null,
        startedAt: asFiniteNumber(record.startedAt),
        finishedAt: asFiniteNumber(record.finishedAt),
      },
      timestamp: asFiniteNumber(record.startedAt) ?? input.completedAt,
    });
  }

  const assistantText = asString(assistant?.text).trim();
  if (assistantText.length > 0) {
    pushMessageRow(builder, {
      key: "response:assistant:text",
      lane: "output",
      role: "assistant",
      label: "assistant response",
      content: assistantText,
      presentation: "assistant",
      timestamp: input.completedAt ?? input.createdAt,
    });
    builder.seenAssistantTexts.add(normalizeText(assistantText));
  }

  const decision = asRecord(response?.decision);
  if (decision) {
    pushMessageRow(builder, {
      key: "response:decision",
      lane: "output",
      role: "assistant",
      label: "decision",
      content: toCodeFence(decision),
      presentation: "technical",
      timestamp: input.completedAt,
    });
  }

  const responseMeta: LooseRecord = {};
  if (response) {
    for (const [key, value] of Object.entries(response)) {
      if (key === "assistant" || key === "toolTrace" || key === "decision") {
        continue;
      }
      responseMeta[key] = value;
    }
  }

  if (Object.keys(responseMeta).length > 0) {
    pushMessageRow(builder, {
      key: "response:meta",
      lane: "output",
      role: "assistant",
      label: "response meta",
      content: toCodeFence(responseMeta),
      presentation: "technical",
      timestamp: input.completedAt,
    });
  }

  if (input.error != null) {
    pushMessageRow(builder, {
      key: "response:error",
      lane: "output",
      role: "assistant",
      label: "model error",
      content: toCodeFence(input.error),
      presentation: "technical",
      timestamp: input.completedAt ?? input.createdAt,
    });
  }
};

const ensurePendingToolInvocation = (
  pendingInvocations: Map<string, PendingToolInvocation>,
  toolCallId: string,
  fallbackSeq: number,
  fallbackTimestamp: number,
): PendingToolInvocation => {
  const existing = pendingInvocations.get(toolCallId);
  if (existing) {
    existing.seq = Math.min(existing.seq, fallbackSeq);
    existing.timestamp = Math.min(existing.timestamp, fallbackTimestamp);
    return existing;
  }

  const next: PendingToolInvocation = {
    seq: fallbackSeq,
    timestamp: fallbackTimestamp,
    invocation: {
      invocationId: toolCallId,
      toolName: "tool",
      status: "waiting",
    },
  };
  pendingInvocations.set(toolCallId, next);
  return next;
};

const appendDeltaRows = (
  builder: ConversationBuilder,
  deltas: ModelCallDeltaItem[],
  input: { hasResponse: boolean },
): void => {
  let latestDraft: { seq: number; timestamp: number; content: string } | null = null;
  let latestRunFinished: { seq: number; timestamp: number; data: LooseRecord | null } | null = null;
  const pendingInvocations = new Map<string, PendingToolInvocation>();

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
      if (builder.seenToolInvocationIds.has(toolCallId)) {
        continue;
      }
      const pending = ensurePendingToolInvocation(pendingInvocations, toolCallId, delta.seq, delta.timestamp);
      pending.invocation.toolName = asString(data?.toolName) || pending.invocation.toolName;
      pending.invocation.status = "running";
      pending.invocation.startedAt = pending.invocation.startedAt ?? delta.timestamp;
      if (hasOwn(data ?? {}, "input") || asString(data?.argsText).trim().length > 0) {
        pending.invocation.call = {
          value: hasOwn(data ?? {}, "input") ? data?.input : null,
          rawText: asString(data?.argsText).trim() || undefined,
        };
      }
      continue;
    }

    const toolCallId = asString(data?.toolCallId) || `delta-tool-result:${delta.seq}`;
    if (builder.seenToolInvocationIds.has(toolCallId)) {
      continue;
    }
    const pending = ensurePendingToolInvocation(pendingInvocations, toolCallId, delta.seq, delta.timestamp);
    const toolName = asString(data?.toolName);
    if (toolName.length > 0) {
      pending.invocation.toolName = toolName;
    }
    const error = asString(data?.error).trim();
    const ok = typeof data?.ok === "boolean" ? data.ok : error.length === 0;
    pending.invocation.status = ok ? "success" : "failed";
    pending.invocation.finishedAt = delta.timestamp;
    pending.invocation.error = error.length > 0 ? error : null;
    if (hasOwn(data ?? {}, "result") || hasOwn(data ?? {}, "output")) {
      pending.invocation.result = {
        value: hasOwn(data ?? {}, "result") ? data?.result : data?.output,
      };
    }
  }

  const timeline: Array<
    | { kind: "draft"; seq: number; timestamp: number; content: string }
    | { kind: "tool"; seq: number; timestamp: number; toolCallId: string; invocation: ToolInvocationView }
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

  for (const [toolCallId, pending] of pendingInvocations.entries()) {
    timeline.push({
      kind: "tool",
      seq: pending.seq,
      timestamp: pending.timestamp,
      toolCallId,
      invocation: pending.invocation,
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
          pushMessageRow(builder, {
            key: `delta:draft:${entry.seq}`,
            lane: "output",
            role: "assistant",
            label: "assistant draft",
            content: entry.content,
            presentation: "technical",
            timestamp: entry.timestamp,
          });
        }
        return;
      }

      if (entry.kind === "tool") {
        pushToolRow(builder, {
          key: `delta:tool:${entry.toolCallId}:${entry.seq}`,
          label: `tool · ${entry.invocation.toolName}`,
          invocation: entry.invocation,
          timestamp: entry.timestamp,
        });
        return;
      }

      pushMessageRow(builder, {
        key: `delta:run_finished:${entry.seq}`,
        lane: "output",
        role: "assistant",
        label: "run finished",
        content: toCodeFence(entry.data ?? {}),
        presentation: "technical",
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
  appendRequestRows(builder, request, modelCall?.createdAt);
  appendResponseRows(builder, response, {
    createdAt: modelCall?.createdAt,
    completedAt: modelCall?.completedAt,
    error: modelCall?.error ?? null,
  });
  appendDeltaRows(builder, deltas, { hasResponse: response !== null });

  return {
    modelCall,
    deltas,
    transcript: builder.rows,
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
