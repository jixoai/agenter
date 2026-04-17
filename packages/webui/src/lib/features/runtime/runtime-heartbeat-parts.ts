import type { MessageFrom } from "$lib/components/ai-elements/message/index.js";
import type { ToolUiState } from "$lib/components/ai-elements/tool/tool.types.js";
import type { HeartbeatGroupItem, HeartbeatPartItem } from "@agenter/client-sdk";

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

const hasMeaningfulToolInput = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return true;
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

export const getHeartbeatRowNarrativePreview = (entry: HeartbeatPartItem): string => {
  for (const part of entry.parts) {
    if (part.partType === "tool_call" || part.partType === "tool_result") {
      continue;
    }
    const text = readHeartbeatPartText(part)?.trim();
    if (text && text.length > 0) {
      return text;
    }
  }
  return "";
};

export const getHeartbeatRowNarrativePreviewLine = (entry: HeartbeatPartItem): string => {
  const preview = getHeartbeatRowNarrativePreview(entry).replace(/\s+/g, " ").trim();
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

const normalizeToolPreview = (value: string): string => value.replace(/\s+/g, " ").trim();

const sortHeartbeatItemsAscending = (items: ReadonlyArray<HeartbeatPartItem>): HeartbeatPartItem[] =>
  [...items].sort((left, right) => {
    if (left.createdAt !== right.createdAt) {
      return left.createdAt - right.createdAt;
    }
    if (left.updatedAt !== right.updatedAt) {
      return left.updatedAt - right.updatedAt;
    }
    return left.id - right.id;
  });

export const getHeartbeatToolPreview = (input: unknown): string | null => {
  if (typeof input === "string") {
    const summary = normalizeToolPreview(input);
    return summary.length > 0 ? summary : null;
  }
  const record = asRecord(input);
  if (!record) {
    return null;
  }
  const commandCandidate =
    typeof record.command === "string" ? record.command : typeof record.cmd === "string" ? record.cmd : null;
  if (commandCandidate) {
    const summary = normalizeToolPreview(commandCandidate);
    return summary.length > 0 ? summary : null;
  }
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string" && value.trim().length > 0) {
      return normalizeToolPreview(`${key}: ${value}`);
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

const estimateWrappedLineCount = (text: string, charsPerLine = 72): number => {
  let total = 0;
  for (const line of text.split(/\r?\n/u)) {
    total += Math.max(1, Math.ceil(line.length / charsPerLine));
  }
  return Math.max(total, 1);
};

const estimateStructuredLineCount = (value: unknown, depth = 0): number => {
  if (value === null || value === undefined) {
    return 1;
  }
  if (typeof value === "string") {
    return estimateWrappedLineCount(value, depth === 0 ? 52 : 40);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return 1;
  }
  if (Array.isArray(value)) {
    let total = 1;
    for (const item of value.slice(0, 4)) {
      total += Math.min(3, estimateStructuredLineCount(item, depth + 1));
    }
    if (value.length > 4) {
      total += 1;
    }
    return Math.min(total, 10);
  }
  const record = asRecord(value);
  if (!record) {
    return 2;
  }
  const entries = Object.entries(record);
  let total = 1;
  for (const [, nestedValue] of entries.slice(0, 6)) {
    total += 1;
    total += Math.min(2, estimateStructuredLineCount(nestedValue, depth + 1));
  }
  if (entries.length > 6) {
    total += 1;
  }
  return Math.min(total, 12);
};

const estimateHeartbeatPartBlockHeight = (part: HeartbeatPart): number => {
  const metaHeight = (part.mimeType ?? "").length > 0 || !part.isComplete ? 24 : 0;
  if (part.partType === "thinking" && part.isComplete) {
    return 44 + metaHeight;
  }
  const text = readHeartbeatPartText(part);
  if (text !== null) {
    const lineCount = estimateWrappedLineCount(text, part.partType === "thinking" ? 60 : 72);
    return 30 + metaHeight + Math.min(lineCount, 14) * 18;
  }
  return 36 + metaHeight + Math.min(estimateStructuredLineCount(part.payload), 12) * 16;
};

const estimateHeartbeatToolBlockHeight = (input: {
  hasOutput: boolean;
  hasError: boolean;
  isStreaming: boolean;
}): number => {
  if (input.hasError) {
    return 144;
  }
  if (input.hasOutput) {
    return 40;
  }
  return input.isStreaming ? 136 : 116;
};

const getToolInvocationId = (part: HeartbeatPart): string | null => {
  const payload = part.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  return typeof record.invocationId === "string" ? record.invocationId : null;
};

export const estimateHeartbeatEntrySize = (entry: HeartbeatPartItem): number => {
  if (isHeartbeatCompactRow(entry)) {
    return 84 + Math.min(estimateWrappedLineCount(getHeartbeatRowPreview(entry)), 3) * 18;
  }

  const resultPartByInvocationId = new Map<string, HeartbeatPart>();
  const consumedResultPartIds = new Set<number>();
  let blockCount = 0;
  let contentHeight = 0;

  const addBlock = (height: number): void => {
    blockCount += 1;
    contentHeight += height;
  };

  for (const part of entry.parts) {
    if (part.partType !== "tool_result") {
      continue;
    }
    const invocationId = getToolInvocationId(part);
    if (!invocationId || resultPartByInvocationId.has(invocationId)) {
      continue;
    }
    resultPartByInvocationId.set(invocationId, part);
  }

  for (const part of entry.parts) {
    if (part.partType === "tool_call") {
      const invocationId = getToolInvocationId(part);
      const pairedResult =
        invocationId === null
          ? undefined
          : (() => {
              const candidate = resultPartByInvocationId.get(invocationId);
              if (!candidate || candidate.partIndex <= part.partIndex) {
                return undefined;
              }
              consumedResultPartIds.add(candidate.partId);
              return candidate;
            })();
      addBlock(
        estimateHeartbeatToolBlockHeight({
          hasOutput: pairedResult !== undefined,
          hasError: Boolean(asRecord(pairedResult?.payload)?.error),
          isStreaming: !part.isComplete,
        }),
      );
      continue;
    }
    if (part.partType === "tool_result") {
      if (consumedResultPartIds.has(part.partId)) {
        continue;
      }
      addBlock(
        estimateHeartbeatToolBlockHeight({
          hasOutput: true,
          hasError: Boolean(asRecord(part.payload)?.error),
          isStreaming: !part.isComplete,
        }),
      );
      continue;
    }
    addBlock(estimateHeartbeatPartBlockHeight(part));
  }

  if (blockCount === 0) {
    addBlock(36 + Math.min(estimateWrappedLineCount(getHeartbeatRowPreview(entry)), 4) * 18);
  }

  const blockGap = blockCount > 1 ? (blockCount - 1) * 8 : 0;
  return 44 + contentHeight + blockGap + 12;
};

const formatHeartbeatGroupKindLabel = (kind: HeartbeatGroupItem["kind"]): string => {
  switch (kind) {
    case "before-call":
    case "before-call-pending":
      return "Before Call";
    case "compact":
      return "Compact";
    default:
      return "Call";
  }
};

export const getHeartbeatGroupLabel = (group: HeartbeatGroupItem): string => {
  const baseLabel = formatHeartbeatGroupKindLabel(group.kind);
  if (group.aiCallId !== null) {
    return `${baseLabel} #${group.aiCallId}`;
  }
  if (group.kind === "before-call-pending") {
    return `${baseLabel} (Pending)`;
  }
  return baseLabel;
};

export const getHeartbeatGroupMeta = (group: HeartbeatGroupItem): string[] => {
  const meta: string[] = [];
  if (group.items.length > 1) {
    meta.push(`${group.items.length} rows`);
  }
  if (!group.isComplete) {
    meta.push("streaming");
  }
  return meta;
};

export const estimateHeartbeatGroupSize = (group: HeartbeatGroupItem): number => {
  const shellHeight = 112;
  const itemGap = group.items.length > 1 ? (group.items.length - 1) * 16 : 0;
  const itemHeights = group.items.reduce((total, item) => total + estimateHeartbeatEntrySize(item), 0);
  return shellHeight + itemGap + itemHeights;
};

export const buildHeartbeatDisplayGroups = (
  groups: ReadonlyArray<HeartbeatGroupItem>,
): HeartbeatGroupItem[] => {
  const displayGroups: HeartbeatGroupItem[] = [];
  for (let index = 0; index < groups.length; index += 1) {
    const current = groups[index];
    const next = groups[index + 1];
    if (
      current &&
      next &&
      current.kind === "before-call" &&
      next.kind === "compact" &&
      current.aiCallId !== null &&
      current.aiCallId === next.aiCallId
    ) {
      displayGroups.push({
        ...next,
        createdAt: Math.min(current.createdAt, next.createdAt),
        updatedAt: Math.max(current.updatedAt, next.updatedAt),
        isComplete: current.isComplete && next.isComplete,
        items: sortHeartbeatItemsAscending([...current.items, ...next.items]),
      });
      index += 1;
      continue;
    }
    if (current) {
      displayGroups.push(current);
    }
  }
  return displayGroups;
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

export type HeartbeatSubjectSectionBlock = {
  key: string;
  content: HeartbeatDisplayBlock;
  createdAt: number;
  sourceEntryIds: number[];
};

export type HeartbeatSubjectSection = {
  key: string;
  role: HeartbeatPartItem["role"];
  name: string | null;
  entryId: number;
  entries: HeartbeatPartItem[];
  blocks: HeartbeatSubjectSectionBlock[];
};

export type HeartbeatSectionTimeMeta = {
  startedAt: number | null;
  endedAt: number | null;
  durationMs: number | null;
  isRunning: boolean;
  showRange: boolean;
};

type HeartbeatPartRef = {
  entry: HeartbeatPartItem;
  part: HeartbeatPart;
  order: number;
  role: HeartbeatPartItem["role"];
  name: string | null;
  subjectKey: string;
};

type HeartbeatDisplayToken = {
  key: string;
  role: HeartbeatPartItem["role"];
  name: string | null;
  subjectKey: string;
  content: HeartbeatDisplayBlock;
  createdAt: number;
  sourceEntries: HeartbeatPartItem[];
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
  if (value.startsWith('"') && value.endsWith('"')) {
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
        : hasMeaningfulToolInput(record.input)
          ? "input-available"
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

const readHeartbeatSubjectNameFromPayload = (payload: unknown): string | null => {
  const rawName = asRecord(payload)?.name ?? asRecord(payload)?.speaker ?? asRecord(payload)?.author ?? null;
  return typeof rawName === "string" && rawName.trim().length > 0 ? rawName.trim() : null;
};

const readHeartbeatSubjectName = (entry: HeartbeatPartItem, part?: HeartbeatPart): string | null =>
  readHeartbeatSubjectNameFromPayload(part?.payload) ??
  readHeartbeatSubjectNameFromPayload(entry.parts[0]?.payload) ??
  null;

const buildHeartbeatSubjectKey = (role: HeartbeatPartItem["role"], name: string | null): string =>
  `${role}:${name ?? ""}`;

const buildHeartbeatPartRefs = (entries: readonly HeartbeatPartItem[]): HeartbeatPartRef[] => {
  const partRefs: HeartbeatPartRef[] = [];
  let order = 0;

  for (const entry of entries) {
    for (const part of entry.parts) {
      const role = part.role;
      const name = readHeartbeatSubjectName(entry, part);
      partRefs.push({
        entry,
        part,
        order,
        role,
        name,
        subjectKey: buildHeartbeatSubjectKey(role, name),
      });
      order += 1;
    }
  }

  return partRefs;
};

const uniqueSourceEntries = (entries: readonly HeartbeatPartItem[]): HeartbeatPartItem[] => {
  const uniqueEntries = new Map<number, HeartbeatPartItem>();
  for (const entry of entries) {
    if (!uniqueEntries.has(entry.id)) {
      uniqueEntries.set(entry.id, entry);
    }
  }
  return [...uniqueEntries.values()];
};

const buildHeartbeatDisplayTokens = (partRefs: readonly HeartbeatPartRef[]): HeartbeatDisplayToken[] => {
  const tokens: HeartbeatDisplayToken[] = [];
  const renderedInvocationIds = new Set<string>();
  const consumedResultPartIds = new Set<number>();
  const resultPartByInvocationId = new Map<string, HeartbeatPartRef>();

  for (const partRef of partRefs) {
    if (partRef.part.partType !== "tool_result") {
      continue;
    }
    const invocationId = getToolInvocationId(partRef.part);
    if (!invocationId) {
      continue;
    }
    resultPartByInvocationId.set(invocationId, partRef);
  }

  const pushToken = (input: {
    partRef: HeartbeatPartRef;
    content: HeartbeatDisplayBlock;
    sourceEntries?: HeartbeatPartItem[];
  }): void => {
    tokens.push({
      key:
        input.content.kind === "tool"
          ? `${input.partRef.subjectKey}:tool:${input.content.key}`
          : `${input.partRef.subjectKey}:part:${input.content.part.partId}`,
      role: input.partRef.role,
      name: input.partRef.name,
      subjectKey: input.partRef.subjectKey,
      content: input.content,
      createdAt: input.partRef.part.createdAt,
      sourceEntries: uniqueSourceEntries(input.sourceEntries ?? [input.partRef.entry]),
    });
  };

  for (const partRef of partRefs) {
    const part = partRef.part;
    const parsedToolTrace = parseHeartbeatToolTracePart(part);
    if (parsedToolTrace) {
      pushToken({ partRef, content: parsedToolTrace });
      continue;
    }
    if (part.partType === "tool_call") {
      const callPayload = (part.payload ?? {}) as ToolCallPayload;
      const invocationId = typeof callPayload.invocationId === "string" ? callPayload.invocationId : null;
      if (invocationId && renderedInvocationIds.has(invocationId)) {
        continue;
      }
      if (invocationId) {
        renderedInvocationIds.add(invocationId);
      }
      const pairedResultPart =
        invocationId === null
          ? undefined
          : (() => {
              const candidate = resultPartByInvocationId.get(invocationId);
              if (!candidate || candidate.order <= partRef.order) {
                return undefined;
              }
              consumedResultPartIds.add(candidate.part.partId);
              return candidate;
            })();
      const resultPayload = (pairedResultPart?.part.payload ?? {}) as ToolResultPayload;
      const state: ToolUiState =
        pairedResultPart === undefined
          ? hasMeaningfulToolInput(callPayload.input)
            ? "input-available"
            : part.isComplete
              ? "input-available"
              : "input-streaming"
          : resultPayload.error
            ? "output-error"
            : "output-available";
      pushToken({
        partRef,
        content: {
          kind: "tool",
          key: invocationId ?? `${partRef.entry.id}:${part.partId}`,
          tool: callPayload.tool ?? "tool",
          state,
          input: callPayload.input ?? null,
          output: resultPayload.output,
          errorText: resultPayload.error ?? null,
        },
        sourceEntries: pairedResultPart ? [partRef.entry, pairedResultPart.entry] : [partRef.entry],
      });
      continue;
    }
    if (part.partType === "tool_result") {
      if (consumedResultPartIds.has(part.partId)) {
        continue;
      }
      const resultPayload = (part.payload ?? {}) as ToolResultPayload;
      pushToken({
        partRef,
        content: {
          kind: "tool",
          key: getToolInvocationId(part) ?? `${partRef.entry.id}:${part.partId}`,
          tool: resultPayload.tool ?? "tool",
          state: resultPayload.error ? "output-error" : "output-available",
          input: null,
          output: resultPayload.output,
          errorText: resultPayload.error ?? null,
        },
      });
      continue;
    }
    if (part.partType !== "tool_call") {
      pushToken({ partRef, content: { kind: "part", part } });
    }
  }

  return tokens;
};

export const buildHeartbeatDisplayBlocks = (entry: HeartbeatPartItem): HeartbeatDisplayBlock[] =>
  buildHeartbeatDisplayTokens(buildHeartbeatPartRefs([entry])).map((token) => token.content);

const isCompactSeparatorEntry = (entry: HeartbeatPartItem): boolean =>
  entry.parts.some((part) => part.partType === "compact");

const isCompactDisplayEntry = (entry: HeartbeatPartItem): boolean =>
  entry.scope === "request_aux" || isCompactSeparatorEntry(entry);

const buildHeartbeatCompactSection = (group: HeartbeatGroupItem): HeartbeatSubjectSection | null => {
  const relevantEntries = group.items.filter(isCompactDisplayEntry);
  if (relevantEntries.length === 0) {
    return null;
  }
  const tokens = buildHeartbeatDisplayTokens(buildHeartbeatPartRefs(relevantEntries));
  return {
    key: `${group.groupId}:compact`,
    role: relevantEntries[0]?.role ?? "system",
    name: null,
    entryId: relevantEntries[0]?.id ?? group.id,
    entries: relevantEntries,
    blocks: tokens.map((token) => ({
      key: token.key,
      content: token.content,
      createdAt: token.createdAt,
      sourceEntryIds: token.sourceEntries.map((entry) => entry.id),
    })),
  };
};

export const buildHeartbeatSubjectSections = (group: HeartbeatGroupItem): HeartbeatSubjectSection[] => {
  if (group.kind === "compact") {
    const compactSection = buildHeartbeatCompactSection(group);
    return compactSection ? [compactSection] : [];
  }
  const sections: HeartbeatSubjectSection[] = [];
  const tokens = buildHeartbeatDisplayTokens(buildHeartbeatPartRefs(group.items));

  if (tokens.length === 0) {
    return group.items.map((entry, index) => ({
      key: `${group.groupId}:${index}:${buildHeartbeatSubjectKey(entry.role, readHeartbeatSubjectName(entry))}`,
      role: entry.role,
      name: readHeartbeatSubjectName(entry),
      entryId: entry.id,
      entries: [entry],
      blocks: [],
    }));
  }

  for (const token of tokens) {
    const previous = sections.at(-1);
    if (previous && previous.role === token.role && previous.name === token.name) {
      previous.entries = uniqueSourceEntries([...previous.entries, ...token.sourceEntries]);
      previous.blocks.push({
        key: token.key,
        content: token.content,
        createdAt: token.createdAt,
        sourceEntryIds: token.sourceEntries.map((entry) => entry.id),
      });
      continue;
    }
    sections.push({
      key: `${group.groupId}:${sections.length}:${token.subjectKey}`,
      role: token.role,
      name: token.name,
      entryId: token.sourceEntries[0]?.id ?? group.items[0]?.id ?? group.id,
      entries: [...token.sourceEntries],
      blocks: [
        {
          key: token.key,
          content: token.content,
          createdAt: token.createdAt,
          sourceEntryIds: token.sourceEntries.map((entry) => entry.id),
        },
      ],
    });
  }

  return sections;
};

export const getHeartbeatSectionTimeMeta = (
  section: HeartbeatSubjectSection,
  now = Date.now(),
): HeartbeatSectionTimeMeta => {
  if (section.entries.length === 0) {
    return {
      startedAt: null,
      endedAt: null,
      durationMs: null,
      isRunning: false,
      showRange: false,
    };
  }
  const startedAt = Math.min(...section.entries.map((entry) => entry.createdAt));
  const isRunning = section.entries.some((entry) => !entry.isComplete);
  const endedAt = isRunning ? now : Math.max(...section.entries.map((entry) => entry.updatedAt));
  const durationMs = Math.max(0, endedAt - startedAt);
  return {
    startedAt,
    endedAt,
    durationMs,
    isRunning,
    showRange: isRunning || durationMs > 2_000,
  };
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

const buildHeartbeatSectionBlockClipboardText = (block: HeartbeatSubjectSectionBlock): string => {
  if (block.content.kind === "tool") {
    const lines = [
      `[Tool ${block.content.tool}]`,
      `state=${block.content.state}`,
      `input=${stringifyJson(block.content.input)}`,
    ];
    if (block.content.output !== undefined) {
      lines.push(`output=${stringifyJson(block.content.output)}`);
    }
    if (block.content.errorText) {
      lines.push(`error=${block.content.errorText}`);
    }
    return lines.join("\n");
  }
  return `[${formatHeartbeatPartTypeLabel(block.content.part.partType)}]\n${toHeartbeatPartRawText(block.content.part)}`;
};

export const buildHeartbeatSectionClipboardText = (section: HeartbeatSubjectSection): string => {
  const timeMeta = getHeartbeatSectionTimeMeta(section);
  const lines = [
    `role=${section.role}`,
    `name=${section.name ?? ""}`,
    `startedAt=${timeMeta.startedAt ? new Date(timeMeta.startedAt).toISOString() : ""}`,
    `endedAt=${timeMeta.endedAt ? new Date(timeMeta.endedAt).toISOString() : ""}`,
    `durationMs=${timeMeta.durationMs ?? 0}`,
    "",
    ...section.blocks.map((block) => buildHeartbeatSectionBlockClipboardText(block)),
  ];
  return lines.join("\n");
};

export const buildHeartbeatGroupClipboardText = (group: HeartbeatGroupItem): string => {
  const lines = [
    `group=${getHeartbeatGroupLabel(group)}`,
    ...getHeartbeatGroupMeta(group),
    `createdAt=${new Date(group.createdAt).toISOString()}`,
    "",
    ...group.items.flatMap((entry, index) => {
      const entryText = buildHeartbeatEntryClipboardText(entry);
      return index === 0 ? [entryText] : ["", entryText];
    }),
  ];
  return lines.join("\n");
};
