import type { ModelDebugOutput } from "@agenter/client-sdk";

export interface HistoryMessageView {
  key: string;
  title: string;
  subtitle: string;
  meta: Record<string, unknown>;
  parts: string[];
}

export interface ToolView {
  key: string;
  title: string;
  description: string | null;
  value: unknown;
}

export interface HttpRecordView {
  key: string;
  title: string;
  meta: Record<string, unknown>;
  request: unknown;
  response: unknown;
  error: unknown;
}

export interface LatestCallView {
  summary: Record<string, unknown>;
  requestMeta: Record<string, unknown>;
  systemPrompt: string;
  requestMessages: HistoryMessageView[];
  response: unknown;
  error: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!isRecord(value)) {
    return null;
  }
  return value;
};

export const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export const asString = (value: unknown): string => (typeof value === "string" ? value : "");

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

const toTextParts = (value: unknown): string[] => {
  if (typeof value === "string") {
    return [value];
  }
  if (!Array.isArray(value)) {
    return [];
  }

  const parts: string[] = [];
  for (const part of value) {
    const record = asRecord(part);
    if (record && typeof record.content === "string") {
      parts.push(record.content);
      continue;
    }
    const serialized = stringifyUnknown(part);
    if (serialized.length > 0) {
      parts.push(serialized);
    }
  }
  return parts;
};

export const formatTimestamp = (value: number | undefined): string => {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
};

export const buildHistoryMessages = (debug: ModelDebugOutput): HistoryMessageView[] => {
  return debug.history.map((message, index) => ({
    key: `${message.role}-${message.name ?? "anon"}-${index}`,
    title: `${index + 1}. ${message.role}`,
    subtitle: message.name ? message.name : `${toTextParts(message.content).length} text part(s)`,
    meta: {
      role: message.role,
      name: message.name ?? null,
      textParts: toTextParts(message.content).length,
    },
    parts: toTextParts(message.content),
  }));
};

export const buildLatestTools = (debug: ModelDebugOutput): ToolView[] => {
  const request = asRecord(debug.latestModelCall?.request);
  return asArray(request?.tools).map((tool, index) => {
    const record = asRecord(tool);
    return {
      key: `${record?.name ?? "tool"}-${index}`,
      title: typeof record?.name === "string" ? record.name : `tool-${index + 1}`,
      description: typeof record?.description === "string" ? record.description : null,
      value: tool,
    };
  });
};

export const buildLatestCallView = (debug: ModelDebugOutput): LatestCallView | null => {
  if (!debug.latestModelCall) {
    return null;
  }
  const request = asRecord(debug.latestModelCall.request);
  const systemPrompt = asString(request?.systemPrompt);
  const requestMessages = asArray(request?.messages).map((message, index) => {
    const record = asRecord(message);
    const parts = toTextParts(record?.content);
    return {
      key: `${record?.role ?? "unknown"}-${index}`,
      title: `${index + 1}. ${typeof record?.role === "string" ? record.role : "message"}`,
      subtitle:
        typeof record?.name === "string" && record.name.length > 0 ? record.name : `${parts.length} text part(s)`,
      meta: {
        role: typeof record?.role === "string" ? record.role : null,
        name: typeof record?.name === "string" ? record.name : null,
        textParts: parts.length,
      },
      parts,
    } satisfies HistoryMessageView;
  });

  return {
    summary: {
      id: debug.latestModelCall.id,
      cycleId: debug.latestModelCall.cycleId,
      status: debug.latestModelCall.status,
      provider: debug.latestModelCall.provider,
      model: debug.latestModelCall.model,
      createdAt: formatTimestamp(debug.latestModelCall.createdAt),
      completedAt: formatTimestamp(debug.latestModelCall.completedAt),
      messageCount: asArray(request?.messages).length,
      toolCount: asArray(request?.tools).length,
      systemPromptChars: systemPrompt.length,
    },
    requestMeta: isRecord(request?.meta) ? request.meta : {},
    systemPrompt,
    requestMessages,
    response: debug.latestModelCall.response ?? null,
    error: debug.latestModelCall.error ?? null,
  };
};

export const buildHttpRecords = (debug: ModelDebugOutput): HttpRecordView[] => {
  return debug.recentApiCalls
    .slice()
    .reverse()
    .map((call) => ({
      key: `http-${call.id}`,
      title: `HTTP #${call.id}`,
      meta: {
        modelCallId: call.modelCallId,
        createdAt: formatTimestamp(call.createdAt),
      },
      request: call.request ?? null,
      response: call.response ?? null,
      error: call.error ?? null,
    }));
};
