import { parse } from "yaml";

export type ToolFenceLanguage = "yaml+tool_call" | "yaml+tool_result";

export interface ParsedToolPayload {
  language: ToolFenceLanguage | null;
  body: string;
  data: unknown;
  toolName: string;
  ok?: boolean;
  terminalId?: string;
  outputKind?: string;
  seq?: number;
  cols?: number;
  rows?: number;
  timestamp?: string;
}

const FENCE_PATTERN = /^```(?<lang>[^\n]+)\n(?<body>[\s\S]*?)\n```$/;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const unwrapFence = (content: string): { language: ToolFenceLanguage | null; body: string } => {
  const normalized = content.trim();
  const match = normalized.match(FENCE_PATTERN);
  const language = match?.groups?.lang?.trim();
  const body = match?.groups?.body?.trim() ?? normalized;
  if (language === "yaml+tool_call" || language === "yaml+tool_result") {
    return { language, body };
  }
  return { language: null, body };
};

const readString = (value: Record<string, unknown>, key: string): string | undefined => {
  const next = value[key];
  return typeof next === "string" && next.trim().length > 0 ? next.trim() : undefined;
};

const readNumber = (value: Record<string, unknown>, key: string): number | undefined => {
  const next = value[key];
  return typeof next === "number" && Number.isFinite(next) ? next : undefined;
};

const readRecord = (value: Record<string, unknown>, key: string): Record<string, unknown> | undefined => {
  const next = value[key];
  return isRecord(next) ? next : undefined;
};

export const parseToolPayload = (content: string, fallbackToolName?: string): ParsedToolPayload => {
  const unwrapped = unwrapFence(content);
  const data = (() => {
    try {
      return parse(unwrapped.body);
    } catch {
      return null;
    }
  })();

  const record = isRecord(data) ? data : null;
  const input = record ? readRecord(record, "input") : undefined;
  const output = record ? readRecord(record, "output") : undefined;
  const toolName =
    (record ? readString(record, "tool") : undefined) ??
    fallbackToolName?.trim() ??
    content.match(/tool:\s*([^\n]+)/i)?.[1]?.trim() ??
    "tool";

  return {
    language: unwrapped.language,
    body: unwrapped.body,
    data,
    toolName,
    ok: record && typeof record.ok === "boolean" ? record.ok : undefined,
    terminalId:
      (input ? readString(input, "terminalId") : undefined) ?? (output ? readString(output, "terminalId") : undefined),
    outputKind: output ? readString(output, "kind") : undefined,
    seq: output ? readNumber(output, "seq") : undefined,
    cols: output ? readNumber(output, "cols") : undefined,
    rows: output ? readNumber(output, "rows") : undefined,
    timestamp: record ? readString(record, "timestamp") : undefined,
  };
};

export const buildToolMeta = (payload: ParsedToolPayload): string | null => {
  const parts: string[] = [];
  if (payload.terminalId) {
    parts.push(payload.terminalId);
  }
  if (payload.outputKind) {
    parts.push(payload.outputKind);
  }
  if (typeof payload.seq === "number") {
    parts.push(`#${payload.seq}`);
  }
  if (typeof payload.cols === "number" && typeof payload.rows === "number") {
    parts.push(`${payload.cols}x${payload.rows}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
};
