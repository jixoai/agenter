import type { MessageFrom } from "$lib/components/ai-elements/message/index.js";
import type { ToolUiState } from "$lib/components/ai-elements/tool/ToolHeader.svelte";
import type { HeartbeatPartItem } from "@agenter/client-sdk";

type HeartbeatPart = HeartbeatPartItem["parts"][number];
type ToolCallPayload = {
  invocationId?: string;
  tool?: string;
  input?: unknown;
};
type ToolResultPayload = {
  invocationId?: string;
  tool?: string;
  output?: unknown;
  error?: string | null;
};
type ParsedToolTrace = Extract<HeartbeatDisplayBlock, { kind: "tool" }>;

const foldedPartTypes = new Set(["systemPrompt", "tools", "config", "compact"]);

const partTypeLabels: Record<string, string> = {
  systemPrompt: "System prompt",
  tools: "Tools",
  config: "Config",
  compact: "Compact",
  text: "Text",
  thinking: "Thinking",
  tool_call: "Tool call",
  tool_result: "Tool result",
};

const stringifyJson = (value: unknown): string => JSON.stringify(value, null, 2);

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

export const formatHeartbeatPartTypeLabel = (partType: string): string => {
  return partTypeLabels[partType] ?? partType.replaceAll("_", " ");
};

export const readHeartbeatPartText = (part: HeartbeatPart): string | null => {
  const payload = part.payload;
  if (typeof payload === "string") {
    return payload;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  if ("content" in payload && typeof payload.content === "string") {
    return payload.content;
  }
  if ("text" in payload && typeof payload.text === "string") {
    return payload.text;
  }
  return null;
};

export const toHeartbeatPartRawText = (part: HeartbeatPart): string => {
  const text = readHeartbeatPartText(part);
  return text ?? stringifyJson(part.payload);
};

export const isHeartbeatRowFoldedByDefault = (entry: HeartbeatPartItem): boolean => {
  return entry.parts.some((part) => foldedPartTypes.has(part.partType));
};

export const isHeartbeatCompactRow = (entry: HeartbeatPartItem): boolean =>
  entry.parts.some((part) => part.partType === "compact");

export const getHeartbeatRowLabel = (entry: HeartbeatPartItem): string => {
  const leadType = entry.parts[0]?.partType;
  if (leadType && foldedPartTypes.has(leadType)) {
    return formatHeartbeatPartTypeLabel(leadType);
  }
  return entry.role;
};

export const getHeartbeatRowPreview = (entry: HeartbeatPartItem): string => {
  for (const part of entry.parts) {
    const text = readHeartbeatPartText(part)?.trim();
    if (text && text.length > 0) {
      return text;
    }
  }
  return entry.text.trim() || `${entry.parts.length} parts`;
};

export const getHeartbeatRowPreviewLine = (entry: HeartbeatPartItem): string => {
  const preview = getHeartbeatRowPreview(entry).replace(/\s+/g, " ").trim();
  return preview.length > 160 ? `${preview.slice(0, 157)}...` : preview;
};

export const getHeartbeatRowMeta = (entry: HeartbeatPartItem): string[] => {
  const meta: string[] = [];
  if (entry.aiCallId !== null) {
    meta.push(`call #${entry.aiCallId}`);
  }
  if (!entry.isComplete) {
    meta.push("streaming");
  }
  return meta;
};

const tokenizeCommand = (input: string): string[] => input.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];

const summarizeCommandPreview = (command: string): string => {
  const tokens = tokenizeCommand(command.trim());
  if (tokens.length === 0) {
    return "";
  }
  const previewTokens: string[] = [];
  for (const token of tokens) {
    if (previewTokens.length >= 2) {
      break;
    }
    if (previewTokens.length > 0 && (/^['"{[]/u.test(token) || token.startsWith("--"))) {
      break;
    }
    previewTokens.push(token);
  }
  const preview = previewTokens.join(" ").trim();
  return preview.length > 0 ? preview : command.trim();
};

const shortenPreview = (value: string): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 72 ? `${normalized.slice(0, 69)}...` : normalized;
};

export const getHeartbeatToolPreview = (input: unknown): string | null => {
  if (typeof input === "string") {
    const summary = summarizeCommandPreview(input);
    return summary.length > 0 ? shortenPreview(summary) : null;
  }
  const record = asRecord(input);
  if (!record) {
    return null;
  }
  const commandCandidate = typeof record.command === "string" ? record.command : typeof record.cmd === "string" ? record.cmd : null;
  if (commandCandidate) {
    const summary = summarizeCommandPreview(commandCandidate);
    return summary.length > 0 ? shortenPreview(summary) : null;
  }
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string" && value.trim().length > 0) {
      return shortenPreview(`${key}: ${value}`);
    }
  }
  return null;
};

export const getHeartbeatMessageFrom = (entry: HeartbeatPartItem): MessageFrom =>
  entry.role === "user" ? "user" : "assistant";

export const getHeartbeatActorLabel = (entry: HeartbeatPartItem): string => {
  switch (entry.role) {
    case "assistant":
      return "AI";
    case "user":
      return "You";
    case "config":
      return "CFG";
    case "tool":
      return "TL";
    default:
      return "SYS";
  }
};

export const estimateHeartbeatEntrySize = (entry: HeartbeatPartItem): number => {
  if (isHeartbeatCompactRow(entry)) {
    return 92;
  }
  if (isHeartbeatRowFoldedByDefault(entry)) {
    return 112;
  }
  const visibleBlockCount = buildHeartbeatDisplayBlocks(entry).length;
  return 96 + visibleBlockCount * 88;
};

export type HeartbeatDisplayBlock =
  | { kind: "part"; part: HeartbeatPart }
  | {
      kind: "tool";
      key: string;
      tool: string;
      state: ToolUiState;
      input: unknown;
      output?: unknown;
      errorText?: string | null;
    };

const toolTraceFencePattern = /^```ya?ml\s*\n([\s\S]*?)\n```$/iu;

const parseYamlScalar = (rawValue: string): unknown => {
  const value = rawValue.trim();
  if (value.length === 0) {
    return "";
  }
  if (value === "null") {
    return null;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (/^-?\d+(?:\.\d+)?$/u.test(value)) {
    return Number(value);
  }
  if (value.startsWith("\"") && value.endsWith("\"")) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  return value;
};

const parseToolTraceYamlRecord = (source: string): Record<string, unknown> | null => {
  const record: Record<string, unknown> = {};
  let nestedRecord: Record<string, unknown> | null = null;

  for (const rawLine of source.split(/\r?\n/u)) {
    if (rawLine.trim().length === 0) {
      continue;
    }
    const indent = rawLine.match(/^\s*/u)?.[0].length ?? 0;
    const line = rawLine.trimStart();
    const match = /^([A-Za-z0-9_]+):(?:\s*(.*))?$/u.exec(line);
    if (!match) {
      return null;
    }
    const [, key, value = ""] = match;
    if (indent === 0) {
      if (value.length === 0) {
        nestedRecord = {};
        record[key] = nestedRecord;
        continue;
      }
      nestedRecord = null;
      record[key] = parseYamlScalar(value);
      continue;
    }
    if (indent !== 2 || nestedRecord === null) {
      return null;
    }
    nestedRecord[key] = parseYamlScalar(value);
  }

  return record;
};

const parseHeartbeatToolTracePart = (part: HeartbeatPart): ParsedToolTrace | null => {
  if (part.partType !== "text") {
    return null;
  }
  const text = readHeartbeatPartText(part)?.trim();
  if (!text) {
    return null;
  }
  const fencedMatch = toolTraceFencePattern.exec(text);
  if (!fencedMatch) {
    return null;
  }
  const record = parseToolTraceYamlRecord(fencedMatch[1]);
  if (!record || typeof record.tool !== "string") {
    return null;
  }
  if (!("status" in record) || !("input" in record || "output" in record)) {
    return null;
  }

  const errorText = typeof record.error === "string" ? record.error : null;
  const status = typeof record.status === "string" ? record.status : "";
  const state: ToolUiState =
    status === "error" || errorText
      ? "output-error"
      : "output" in record
        ? "output-available"
        : part.isComplete
          ? "input-available"
          : "input-streaming";

  return {
    kind: "tool",
    key: typeof record.invocationId === "string" ? record.invocationId : `text-tool:${part.partId}`,
    tool: record.tool,
    state,
    input: record.input ?? null,
    output: record.output,
    errorText,
  };
};

const getToolInvocationId = (part: HeartbeatPart): string | null => {
  const payload = part.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  return typeof record.invocationId === "string" ? record.invocationId : null;
};

export const buildHeartbeatDisplayBlocks = (entry: HeartbeatPartItem): HeartbeatDisplayBlock[] => {
  const blocks: HeartbeatDisplayBlock[] = [];
  const consumedInvocationIds = new Set<string>();
  for (const part of entry.parts) {
    const parsedToolTrace = parseHeartbeatToolTracePart(part);
    if (parsedToolTrace) {
      blocks.push(parsedToolTrace);
      continue;
    }
    if (part.partType === "tool_result") {
      const invocationId = getToolInvocationId(part);
      if (invocationId && consumedInvocationIds.has(invocationId)) {
        continue;
      }
    }
    if (part.partType !== "tool_call") {
      blocks.push({ kind: "part", part });
      continue;
    }
    const callPayload = (part.payload ?? {}) as ToolCallPayload;
    const invocationId = typeof callPayload.invocationId === "string" ? callPayload.invocationId : null;
    const resultPart =
      invocationId === null
        ? undefined
        : entry.parts.find(
            (candidate) => candidate.partType === "tool_result" && getToolInvocationId(candidate) === invocationId,
          );
    if (invocationId) {
      consumedInvocationIds.add(invocationId);
    }
    const resultPayload = (resultPart?.payload ?? {}) as ToolResultPayload;
    const state: ToolUiState =
      resultPart === undefined
        ? part.isComplete
          ? "input-available"
          : "input-streaming"
        : resultPayload.error
          ? "output-error"
          : "output-available";
    blocks.push({
      kind: "tool",
      key: invocationId ?? `${entry.id}:${part.partId}`,
      tool: callPayload.tool ?? "tool",
      state,
      input: callPayload.input ?? null,
      output: resultPayload.output,
      errorText: resultPayload.error ?? null,
    });
  }
  return blocks;
};

export const buildHeartbeatEntryClipboardText = (entry: HeartbeatPartItem): string => {
  const lines = [
    `role=${entry.role}`,
    `scope=${entry.scope}`,
    `round=${entry.roundIndex}`,
    ...getHeartbeatRowMeta(entry),
    "",
    ...entry.parts.map((part) => `[${formatHeartbeatPartTypeLabel(part.partType)}]\n${toHeartbeatPartRawText(part)}`),
  ];
  return lines.join("\n");
};
