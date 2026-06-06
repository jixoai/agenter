import type { HeartbeatRecordItem, HeartbeatRecordPartSummary, HeartbeatRecordStatus } from "./types";

export type HeartbeatRecordChipKind =
  | "input"
  | "text"
  | "image"
  | "video"
  | "file"
  | "thinking"
  | "refusal"
  | "tool"
  | "pending"
  | "error"
  | "combo"
  | "unknown";

export interface HeartbeatRecordChip {
  id: string;
  kind: HeartbeatRecordChipKind;
  label: string;
  title: string;
  startedAt: number;
  completedAt: number | null;
  count: number;
  parts: HeartbeatRecordPartSummary[];
}

export interface HeartbeatRecordLine {
  id: string;
  durationMs: number | null;
  label: string;
  title: string;
}

export interface HeartbeatRecordTimelineSegment {
  chip: HeartbeatRecordChip;
  lineBefore: HeartbeatRecordLine | null;
}

export interface HeartbeatRecordTimeline {
  chips: HeartbeatRecordChip[];
  segments: HeartbeatRecordTimelineSegment[];
  hiddenCount: number;
}

type ChipDensity = "narrow" | "medium" | "full";

const kindPriority: Record<HeartbeatRecordChipKind, number> = {
  input: 0,
  combo: 1,
  thinking: 2,
  tool: 3,
  text: 4,
  error: 5,
  pending: 6,
  refusal: 7,
  image: 8,
  video: 9,
  file: 10,
  unknown: 11,
};

const sizeFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});

export const formatHeartbeatRecordDuration = (durationMs: number | null): string => {
  if (durationMs === null || !Number.isFinite(durationMs) || durationMs < 0) {
    return "";
  }
  if (durationMs < 1000) {
    return `${Math.round(durationMs)}ms`;
  }
  if (durationMs < 60_000) {
    return `${sizeFormatter.format(durationMs / 1000)}s`;
  }
  return `${sizeFormatter.format(durationMs / 60_000)}m`;
};

const estimateTextTokens = (text: string): number => {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
    const words = Array.from(segmenter.segment(trimmed)).filter((segment) => segment.isWordLike).length;
    if (words > 0) {
      return Math.max(words, Math.ceil(trimmed.length / 4));
    }
  }
  return Math.ceil(trimmed.length / 4);
};

const readTextPayload = (payload: unknown): string => {
  if (typeof payload === "string") {
    return payload;
  }
  if (payload && typeof payload === "object") {
    const value = payload as Record<string, unknown>;
    if (typeof value.text === "string") {
      return value.text;
    }
    if (typeof value.content === "string") {
      return value.content;
    }
  }
  return "";
};

const readPayloadNumber = (payload: unknown, keys: readonly string[]): number | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const value = payload as Record<string, unknown>;
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return null;
};

const formatBytes = (bytes: number | null): string => {
  if (bytes === null) {
    return "";
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${sizeFormatter.format(bytes / 1024)}KB`;
  }
  return `${sizeFormatter.format(bytes / (1024 * 1024))}MB`;
};

export const resolveHeartbeatRecordPartKind = (part: HeartbeatRecordPartSummary): HeartbeatRecordChipKind => {
  const type = part.type.toLowerCase();
  if (type.includes("thinking") || type.includes("reasoning")) {
    return "thinking";
  }
  if (type === "tool_call" || type === "tool_result" || type.includes("tool")) {
    return "tool";
  }
  if (type.includes("image")) {
    return "image";
  }
  if (type.includes("video")) {
    return "video";
  }
  if (type.includes("file") || type.includes("attachment")) {
    return "file";
  }
  if (type.includes("refusal")) {
    return "refusal";
  }
  if (type.includes("error")) {
    return "error";
  }
  if (type === "text" || type.includes("markdown")) {
    return "text";
  }
  return "unknown";
};

const chipLabel = (kind: HeartbeatRecordChipKind, parts: readonly HeartbeatRecordPartSummary[]): string => {
  if (kind === "input") {
    const visibleKinds = new Set(parts.map((part) => resolveHeartbeatRecordPartKind(part)));
    const labels = Array.from(visibleKinds)
      .filter((value) => value !== "tool")
      .map((value) => (value === "text" ? "txt" : value));
    return labels.length > 0 ? labels.join("+") : "input";
  }
  if (kind === "text") {
    const tokens = parts.reduce((sum, part) => sum + estimateTextTokens(readTextPayload(part.label)), 0);
    return tokens > 0 ? `${tokens} tok` : "text";
  }
  if (kind === "thinking") {
    const duration = sumPartDuration(parts);
    return formatHeartbeatRecordDuration(duration) || "think";
  }
  if (kind === "tool") {
    return parts.length > 1 ? String(parts.length) : "";
  }
  if (kind === "image" || kind === "file") {
    const bytes = parts.reduce((sum, part) => sum + (readPayloadNumber(part, ["size", "bytes", "fileSize"]) ?? 0), 0);
    return formatBytes(bytes || null) || kind;
  }
  if (kind === "video") {
    const duration = parts.reduce(
      (sum, part) => sum + (readPayloadNumber(part, ["durationMs", "duration", "videoLengthMs"]) ?? 0),
      0,
    );
    return formatHeartbeatRecordDuration(duration || null) || "video";
  }
  if (kind === "pending") {
    return "";
  }
  if (kind === "error") {
    return "error";
  }
  if (kind === "refusal") {
    return "";
  }
  return kind;
};

const sumPartDuration = (parts: readonly HeartbeatRecordPartSummary[]): number | null => {
  let total = 0;
  let found = false;
  for (const part of parts) {
    if (part.completedAt !== null) {
      total += Math.max(0, part.completedAt - part.startedAt);
      found = true;
    }
  }
  return found ? total : null;
};

const createChip = (
  kind: HeartbeatRecordChipKind,
  parts: readonly HeartbeatRecordPartSummary[],
  fallbackStartedAt: number,
  fallbackCompletedAt: number | null,
): HeartbeatRecordChip => {
  const startedAt = parts.length > 0 ? Math.min(...parts.map((part) => part.startedAt)) : fallbackStartedAt;
  const completedValues = parts.map((part) => part.completedAt).filter((value): value is number => value !== null);
  const completedAt = completedValues.length > 0 ? Math.max(...completedValues) : fallbackCompletedAt;
  const labels = parts
    .map((part) => [part.role, part.type, part.label].filter(Boolean).join(" "))
    .filter((value) => value.trim().length > 0);
  const label = chipLabel(kind, parts);
  return {
    id: `${kind}:${parts.map((part) => part.partId).join(",") || startedAt}`,
    kind,
    label,
    title: labels.length > 0 ? labels.join(" | ") : kind,
    startedAt,
    completedAt,
    count: Math.max(1, parts.length),
    parts: [...parts],
  };
};

const isUserInputPart = (part: HeartbeatRecordPartSummary): boolean =>
  part.role === "user" && part.type !== "tool_result" && part.type !== "tool_call_result";

const groupOutputParts = (parts: readonly HeartbeatRecordPartSummary[]): HeartbeatRecordChip[] => {
  const chips: HeartbeatRecordChip[] = [];
  let currentKind: HeartbeatRecordChipKind | null = null;
  let currentParts: HeartbeatRecordPartSummary[] = [];
  const flush = (): void => {
    if (currentKind && currentParts.length > 0) {
      const first = currentParts[0]!;
      chips.push(createChip(currentKind, currentParts, first.startedAt, first.completedAt));
    }
    currentKind = null;
    currentParts = [];
  };
  for (const part of parts) {
    const kind = resolveHeartbeatRecordPartKind(part);
    if (kind === "tool" && (part.type === "tool_result" || part.type === "tool_call_result")) {
      continue;
    }
    if (kind !== currentKind || kind === "tool" || kind === "error") {
      flush();
      currentKind = kind;
      currentParts = [part];
    } else {
      currentParts.push(part);
    }
  }
  flush();
  return chips;
};

const densityForWidth = (width: number): ChipDensity => {
  if (width < 360) {
    return "narrow";
  }
  if (width < 560) {
    return "medium";
  }
  return "full";
};

const estimateChipWidth = (chip: HeartbeatRecordChip, density: ChipDensity): number => {
  const base = density === "narrow" ? 34 : density === "medium" ? 42 : 52;
  const labelWidth = density === "narrow" ? 0 : Math.min(72, chip.label.length * 7);
  return base + labelWidth;
};

const estimateLineWidth = (line: HeartbeatRecordLine, density: ChipDensity): number => {
  const base = density === "narrow" ? 14 : 22;
  const label = density === "full" ? Math.min(52, line.label.length * 6) : 0;
  return base + label;
};

const lineBetween = (previous: HeartbeatRecordChip, next: HeartbeatRecordChip, index: number): HeartbeatRecordLine => {
  const previousBoundary = index === 1 ? previous.startedAt : (previous.completedAt ?? previous.startedAt);
  const nextBoundary = next.completedAt ?? next.startedAt;
  const durationMs = Number.isFinite(nextBoundary - previousBoundary) ? Math.max(0, nextBoundary - previousBoundary) : null;
  return {
    id: `${previous.id}->${next.id}`,
    durationMs,
    label: formatHeartbeatRecordDuration(durationMs),
    title:
      index === 1
        ? `Closed interval from input start to ${next.kind}: ${formatHeartbeatRecordDuration(durationMs)}`
        : `Interval after ${previous.kind} until ${next.kind}: ${formatHeartbeatRecordDuration(durationMs)}`,
  };
};

const createComboChip = (hidden: readonly HeartbeatRecordChip[]): HeartbeatRecordChip => {
  const parts = hidden.flatMap((chip) => chip.parts);
  const thinkingMs = hidden
    .filter((chip) => chip.kind === "thinking")
    .reduce((sum, chip) => sum + (sumPartDuration(chip.parts) ?? 0), 0);
  const toolCount = hidden.filter((chip) => chip.kind === "tool").reduce((sum, chip) => sum + chip.count, 0);
  const label = [
    thinkingMs > 0 ? formatHeartbeatRecordDuration(thinkingMs) : "",
    toolCount > 0 ? `${toolCount} tool${toolCount > 1 ? "s" : ""}` : "",
    parts.length > 0 ? `${parts.length} parts` : "",
  ]
    .filter(Boolean)
    .slice(0, 2)
    .join(" · ");
  const first = hidden[0];
  const last = hidden[hidden.length - 1];
  return {
    id: `combo:${hidden.map((chip) => chip.id).join("|")}`,
    kind: "combo",
    label,
    title: `Merged middle span: ${hidden.map((chip) => `${chip.kind}${chip.label ? ` ${chip.label}` : ""}`).join(", ")}`,
    startedAt: first?.startedAt ?? 0,
    completedAt: last?.completedAt ?? null,
    count: hidden.length,
    parts,
  };
};

const buildSegments = (chips: readonly HeartbeatRecordChip[]): HeartbeatRecordTimelineSegment[] =>
  chips.map((chip, index) => ({
    chip,
    lineBefore: index === 0 ? null : lineBetween(chips[index - 1]!, chip, index),
  }));

const timelineFits = (chips: readonly HeartbeatRecordChip[], width: number, density: ChipDensity): boolean => {
  const segments = buildSegments(chips);
  const estimate = segments.reduce(
    (sum, segment) =>
      sum +
      estimateChipWidth(segment.chip, density) +
      (segment.lineBefore ? estimateLineWidth(segment.lineBefore, density) : 0),
    0,
  );
  return estimate <= Math.max(180, width);
};

const fitTimeline = (chips: readonly HeartbeatRecordChip[], width: number): HeartbeatRecordTimeline => {
  if (chips.length <= 3) {
    return { chips: [...chips], segments: buildSegments(chips), hiddenCount: 0 };
  }
  const density = densityForWidth(width);
  if (timelineFits(chips, width, density)) {
    return { chips: [...chips], segments: buildSegments(chips), hiddenCount: 0 };
  }
  const input = chips[0]!;
  const tail: HeartbeatRecordChip[] = [];
  for (let index = chips.length - 1; index > 0; index -= 1) {
    tail.unshift(chips[index]!);
    const hidden = chips.slice(1, index);
    const combo = hidden.length > 0 ? [createComboChip(hidden)] : [];
    const candidate = [input, ...combo, ...tail];
    if (!timelineFits(candidate, width, density)) {
      tail.shift();
      break;
    }
  }
  const minTail = tail.length > 0 ? tail : [chips[chips.length - 1]!];
  const firstTailIndex = chips.indexOf(minTail[0]!);
  const hidden = chips.slice(1, firstTailIndex);
  const fitted = [input, ...(hidden.length > 0 ? [createComboChip(hidden)] : []), ...minTail].sort(
    (left, right) => left.startedAt - right.startedAt || kindPriority[left.kind] - kindPriority[right.kind],
  );
  return {
    chips: fitted,
    segments: buildSegments(fitted),
    hiddenCount: hidden.length,
  };
};

export const buildHeartbeatRecordTimeline = (record: HeartbeatRecordItem, width = 390): HeartbeatRecordTimeline => {
  const parts = [...record.summary.parts].sort((left, right) => left.startedAt - right.startedAt);
  const inputParts = parts.filter(isUserInputPart);
  const inputChip = createChip("input", inputParts, record.startedAt, inputParts.at(-1)?.completedAt ?? record.startedAt);
  const outputParts = parts.filter((part) => !isUserInputPart(part));
  const chips = [inputChip, ...groupOutputParts(outputParts)];
  if (record.status === "running" && chips.every((chip) => chip.kind !== "pending")) {
    chips.push(createChip("pending", [], record.updatedAt, null));
  }
  if (record.status === "error" && chips.every((chip) => chip.kind !== "error")) {
    chips.push(createChip("error", [], record.updatedAt, record.completedAt ?? record.updatedAt));
  }
  return fitTimeline(chips, width);
};

export const describeRecordStatus = (status: HeartbeatRecordStatus): string => status.replaceAll("_", " ");

export const isRecordRunning = (status: HeartbeatRecordStatus): boolean => status === "running";
