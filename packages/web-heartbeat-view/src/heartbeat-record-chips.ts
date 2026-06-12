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

export type HeartbeatRecordToneKind = HeartbeatRecordChipKind | "compact" | "config";

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

export interface HeartbeatRecordChipToken {
  kind: HeartbeatRecordToneKind;
  label: string;
  title: string;
}

export interface HeartbeatRecordChipTone {
  startBorder: string;
  endBorder: string;
  startBackground: string;
  endBackground: string;
  borderGradient: string;
  backgroundGradient: string;
  ink: string;
}

export interface HeartbeatRecordLine {
  id: string;
  durationMs: number | null;
  label: string;
  title: string;
  fromKind: HeartbeatRecordChipKind;
  toKind: HeartbeatRecordChipKind;
}

export interface HeartbeatRecordTimelineSegment {
  chip: HeartbeatRecordChip;
  lineBefore: HeartbeatRecordLine | null;
}

export interface HeartbeatRecordTimeline {
  chips: HeartbeatRecordChip[];
  segments: HeartbeatRecordTimelineSegment[];
  hiddenCount: number;
  density: ChipDensity;
}

export type ChipDensity = "narrow" | "medium" | "full";

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

const pad2 = (value: number): string => value.toString().padStart(2, "0");
const pad3 = (value: number): string => value.toString().padStart(3, "0");

const KIND_BASE_TONE: Record<HeartbeatRecordChipKind, string> = {
  input: "var(--kind-input, oklch(58% 0.16 230deg))",
  text: "var(--kind-text, oklch(58% 0.17 260deg))",
  image: "var(--kind-image, oklch(58% 0.15 150deg))",
  file: "var(--kind-file, oklch(58% 0.04 250deg))",
  video: "var(--kind-video, oklch(58% 0.18 285deg))",
  thinking: "var(--kind-thinking, oklch(58% 0.14 185deg))",
  refusal: "var(--kind-refusal, oklch(58% 0.18 345deg))",
  tool: "var(--kind-tool, oklch(58% 0.16 55deg))",
  pending: "var(--kind-pending, oklch(58% 0.15 85deg))",
  error: "var(--kind-error, oklch(58% 0.18 25deg))",
  combo: "var(--kind-combo, oklch(58% 0.05 250deg))",
  unknown: "var(--kind-unknown, oklch(58% 0.04 250deg))",
};

const KIND_BASE_TONE_EXTENDED: Record<HeartbeatRecordToneKind, string> = {
  ...KIND_BASE_TONE,
  compact: "var(--kind-compact, oklch(58% 0.04 250deg))",
  config: "var(--kind-config, oklch(58% 0.17 305deg))",
};

const KIND_BORDER_MIX: Record<HeartbeatRecordToneKind, number> = {
  input: 56,
  text: 58,
  image: 54,
  file: 62,
  video: 58,
  thinking: 56,
  refusal: 52,
  tool: 52,
  pending: 48,
  error: 50,
  combo: 60,
  unknown: 64,
  compact: 60,
  config: 56,
};

const gradientStops = (
  kinds: readonly HeartbeatRecordToneKind[],
  toneResolver: (kind: HeartbeatRecordToneKind) => string,
): string => {
  const source = kinds.length > 0 ? kinds : ["unknown"];
  if (source.length === 1) {
    const color = toneResolver(source[0] as HeartbeatRecordToneKind);
    return `${color} 0%, ${color} 100%`;
  }
  const denominator = source.length - 1;
  return source
    .map((kind, index) => {
      const color = toneResolver(kind as HeartbeatRecordToneKind);
      return `${color} ${((index / denominator) * 100).toFixed(2)}%`;
    })
    .join(", ");
};

const kindBaseTone = (kind: HeartbeatRecordToneKind): string => KIND_BASE_TONE_EXTENDED[kind] ?? KIND_BASE_TONE_EXTENDED.unknown;
const kindBorderTone = (kind: HeartbeatRecordToneKind): string =>
  `color-mix(in oklch, ${kindBaseTone(kind)}, white ${KIND_BORDER_MIX[kind] ?? KIND_BORDER_MIX.unknown}%)`;
const kindBackgroundTone = (kind: HeartbeatRecordToneKind): string => `color-mix(in oklch, ${kindBaseTone(kind)}, white 92%)`;
const kindInkTone = (kind: HeartbeatRecordToneKind): string => `color-mix(in oklch, ${kindBaseTone(kind)}, black 16%)`;

export const buildHeartbeatRecordChipTone = (
  toneKinds: readonly HeartbeatRecordToneKind[],
): HeartbeatRecordChipTone => {
  const source = (toneKinds.length > 0 ? toneKinds.filter((kind) => kind in KIND_BASE_TONE_EXTENDED) : ["unknown"]) as HeartbeatRecordToneKind[];
  const startKind = source[0] ?? "unknown";
  const endKind = source.at(-1) ?? startKind;
  const borderStops = gradientStops(source, kindBorderTone);
  const backgroundStops = gradientStops(source, kindBackgroundTone);
  return {
    startBorder: kindBorderTone(startKind),
    endBorder: kindBorderTone(endKind),
    startBackground: kindBackgroundTone(startKind),
    endBackground: kindBackgroundTone(endKind),
    borderGradient: `linear-gradient(90deg in oklch, ${borderStops})`,
    backgroundGradient: `linear-gradient(90deg in oklch, ${backgroundStops})`,
    ink: kindInkTone(endKind),
  };
};

export const buildHeartbeatRecordChipToneStyle = (toneKinds: readonly HeartbeatRecordToneKind[]): string => {
  const tone = buildHeartbeatRecordChipTone(toneKinds);
  return [
    `--chip-start-border:${tone.startBorder}`,
    `--chip-end-border:${tone.endBorder}`,
    `--chip-start-bg:${tone.startBackground}`,
    `--chip-end-bg:${tone.endBackground}`,
    `--chip-border-gradient:${tone.borderGradient}`,
    `--chip-bg-gradient:${tone.backgroundGradient}`,
    `--chip-ink:${tone.ink}`,
  ].join(";");
};

export const formatHeartbeatRecordDuration = (durationMs: number | null): string => {
  if (durationMs === null || !Number.isFinite(durationMs) || durationMs < 0) {
    return "";
  }
  const wholeMs = Math.floor(durationMs);
  const hours = Math.floor(wholeMs / 3_600_000);
  const minutes = Math.floor((wholeMs % 3_600_000) / 60_000);
  const seconds = Math.floor((wholeMs % 60_000) / 1000);
  const millis = wholeMs % 1000;
  if (hours > 0) {
    return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  }
  return `${pad2(minutes)}:${pad2(seconds)}.${pad3(millis)}`;
};

export const formatHeartbeatRecordCardDuration = (durationMs: number | null): string => {
  if (durationMs === null || !Number.isFinite(durationMs) || durationMs < 0) {
    return "";
  }
  const wholeMs = Math.floor(durationMs);
  if (wholeMs < 1000) {
    return `${wholeMs}ms`;
  }
  const totalSeconds = Math.floor(wholeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${pad2(hours)}h ${pad2(minutes)}:${pad2(seconds)}s`;
  }
  return `${minutes}:${pad2(seconds)}s`;
};

export interface HeartbeatRecordBridgeDuration {
  primaryLabel: string;
  secondaryLabel: string;
  title: string;
}

export const formatHeartbeatRecordBridgeDuration = (durationMs: number | null): HeartbeatRecordBridgeDuration => {
  if (durationMs === null || !Number.isFinite(durationMs) || durationMs < 0) {
    return {
      primaryLabel: "",
      secondaryLabel: "",
      title: "",
    };
  }
  const wholeMs = Math.floor(durationMs);
  const hours = Math.floor(wholeMs / 3_600_000);
  const minutes = Math.floor((wholeMs % 3_600_000) / 60_000);
  const seconds = Math.floor((wholeMs % 60_000) / 1000);
  const millis = wholeMs % 1000;
  if (hours > 0) {
    return {
      primaryLabel: `${pad2(hours)}h`,
      secondaryLabel: `${pad2(minutes)}:${pad2(seconds)}s`,
      title: `${pad2(hours)}h ${pad2(minutes)}:${pad2(seconds)}s`,
    };
  }
  return {
    primaryLabel: `${pad2(minutes)}:${pad2(seconds)}`,
    secondaryLabel: `.${pad3(millis)}`,
    title: `${pad2(minutes)}:${pad2(seconds)}.${pad3(millis)}`,
  };
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

const readPartMetricNumber = (part: HeartbeatRecordPartSummary, keys: readonly string[]): number | null =>
  readPayloadNumber(part, keys);

const readTextTokenCount = (part: HeartbeatRecordPartSummary): number =>
  readPartMetricNumber(part, ["tokenCount", "tokens"]) ?? estimateTextTokens(readTextPayload(part.label));

const readPartSizeBytes = (part: HeartbeatRecordPartSummary): number =>
  readPartMetricNumber(part, ["sizeBytes", "bytes", "size", "fileSize", "byteLength"]) ?? 0;

const readPartDurationMs = (part: HeartbeatRecordPartSummary): number =>
  readPartMetricNumber(part, ["durationMs", "duration", "videoLengthMs"]) ?? 0;

const isToolResultPart = (part: HeartbeatRecordPartSummary): boolean =>
  part.type === "tool_result" || part.type === "tool_call_result";

const isToolCallPart = (part: HeartbeatRecordPartSummary): boolean =>
  resolveHeartbeatRecordPartKind(part) === "tool" && !isToolResultPart(part);

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

interface HeartbeatRecordChipMetrics {
  textTokens: number;
  imageBytes: number;
  fileBytes: number;
  videoMs: number;
  thinkingMs: number;
  toolCount: number;
  refusalCount: number;
  errorCount: number;
  unknownCount: number;
}

const emptyChipMetrics = (): HeartbeatRecordChipMetrics => ({
  textTokens: 0,
  imageBytes: 0,
  fileBytes: 0,
  videoMs: 0,
  thinkingMs: 0,
  toolCount: 0,
  refusalCount: 0,
  errorCount: 0,
  unknownCount: 0,
});

const aggregateChipMetrics = (parts: readonly HeartbeatRecordPartSummary[]): HeartbeatRecordChipMetrics => {
  const metrics = emptyChipMetrics();
  for (const part of parts) {
    const kind = resolveHeartbeatRecordPartKind(part);
    switch (kind) {
      case "text":
        metrics.textTokens += readTextTokenCount(part);
        break;
      case "image":
        metrics.imageBytes += readPartSizeBytes(part);
        break;
      case "file":
        metrics.fileBytes += readPartSizeBytes(part);
        break;
      case "video":
        metrics.videoMs += readPartDurationMs(part);
        break;
      case "thinking":
        metrics.thinkingMs += part.completedAt === null ? 0 : Math.max(0, part.completedAt - part.startedAt);
        break;
      case "tool":
        metrics.toolCount += isToolCallPart(part) ? 1 : 0;
        break;
      case "refusal":
        metrics.refusalCount += 1;
        break;
      case "error":
        metrics.errorCount += 1;
        break;
      default:
        metrics.unknownCount += 1;
        break;
    }
  }
  return metrics;
};

const compactBytesLabel = (label: string): string => label.replaceAll("KB", "K").replaceAll("MB", "M").replaceAll("GB", "G");

const compactDurationLabel = (durationMs: number, density: ChipDensity): string => {
  if (durationMs < 1000) {
    return density === "narrow" ? `${Math.max(1, Math.round(durationMs / 1000))}s` : `${Math.round(durationMs)}ms`;
  }
  if (durationMs < 10_000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }
  if (durationMs < 60_000) {
    return density === "narrow" ? `${Math.round(durationMs / 1000)}s` : `${(durationMs / 1000).toFixed(1)}s`;
  }
  return `${Math.round(durationMs / 60_000)}m`;
};

const estimateTokenWidth = (token: HeartbeatRecordChipToken, density: ChipDensity): number => {
  const base = density === "narrow" ? 16 : 18;
  const labelUnit = density === "narrow" ? 4.8 : density === "medium" ? 5.3 : 5.8;
  const gap = token.label.length > 0 ? 5 : 0;
  return base + gap + token.label.length * labelUnit;
};

export const buildHeartbeatRecordChipTokens = (
  chip: HeartbeatRecordChip,
  density: ChipDensity,
): HeartbeatRecordChipToken[] => {
  const tokens: HeartbeatRecordChipToken[] = [];
  const pushPrimaryIcon = chip.kind === "input" || chip.kind === "combo";
  const baseParts = chip.kind === "input" ? chip.parts.filter((part) => part.type !== "tool_result" && part.type !== "tool_call_result") : chip.parts;
  const metrics = aggregateChipMetrics(baseParts);
  const addMetricToken = (kind: HeartbeatRecordChipKind, label: string, title: string): void => {
    if (label.length === 0 && kind !== "refusal" && kind !== "error" && kind !== "pending" && kind !== "unknown") {
      return;
    }
    tokens.push({ kind, label, title });
  };

  if (pushPrimaryIcon && density !== "narrow") {
    tokens.push({
      kind: chip.kind,
      label: "",
      title: chip.kind === "input" ? "User message input boundary" : "Merged middle span",
    });
  }

  if (chip.kind === "input" || chip.kind === "combo") {
    if (metrics.textTokens > 0) {
      addMetricToken("text", `${metrics.textTokens}t`, `${metrics.textTokens} text tokens`);
    }
    if (metrics.imageBytes > 0) {
      addMetricToken("image", compactBytesLabel(formatBytes(metrics.imageBytes)), `${formatBytes(metrics.imageBytes)} image payload`);
    }
    if (metrics.fileBytes > 0) {
      addMetricToken("file", compactBytesLabel(formatBytes(metrics.fileBytes)), `${formatBytes(metrics.fileBytes)} file payload`);
    }
    if (metrics.videoMs > 0) {
      addMetricToken("video", compactDurationLabel(metrics.videoMs, density), `${formatHeartbeatRecordDuration(metrics.videoMs)} video payload`);
    }
    if (metrics.thinkingMs > 0) {
      addMetricToken("thinking", compactDurationLabel(metrics.thinkingMs, density), `${formatHeartbeatRecordDuration(metrics.thinkingMs)} thinking span`);
    }
    if (metrics.toolCount > 1) {
      addMetricToken("tool", String(metrics.toolCount), `${metrics.toolCount} tool calls`);
    } else if (metrics.toolCount === 1) {
      addMetricToken("tool", "", "Tool call");
    }
    if (metrics.refusalCount > 0) {
      addMetricToken("refusal", "", "Refusal");
    }
    if (metrics.errorCount > 0) {
      addMetricToken("error", "", "Error");
    }
    if (metrics.unknownCount > 0) {
      addMetricToken("unknown", String(metrics.unknownCount), `${metrics.unknownCount} unknown parts`);
    }
    return tokens;
  }

  switch (chip.kind) {
    case "text": {
      const label = chip.label.length > 0 ? chip.label : `${metrics.textTokens} tok`;
      tokens.push({ kind: "text", label, title: chip.title || "Text part" });
      break;
    }
    case "thinking": {
      const duration = sumPartDuration(chip.parts);
      tokens.push({
        kind: "thinking",
        label: duration === null ? chip.label : compactDurationLabel(duration, density),
        title: chip.title || "Thinking span",
      });
      break;
    }
    case "tool": {
      tokens.push({
        kind: "tool",
        label: chip.count > 1 ? String(chip.count) : "",
        title: chip.title || "Tool call",
      });
      break;
    }
    case "image": {
      const label = chip.label.length > 0 ? chip.label : compactBytesLabel(formatBytes(metrics.imageBytes));
      tokens.push({ kind: "image", label, title: chip.title || "Image payload" });
      break;
    }
    case "file": {
      const label = chip.label.length > 0 ? chip.label : compactBytesLabel(formatBytes(metrics.fileBytes));
      tokens.push({ kind: "file", label, title: chip.title || "File payload" });
      break;
    }
    case "video": {
      const label = chip.label.length > 0 ? chip.label : compactDurationLabel(metrics.videoMs, density);
      tokens.push({ kind: "video", label, title: chip.title || "Video payload" });
      break;
    }
    case "refusal":
      tokens.push({ kind: "refusal", label: chip.label, title: chip.title || "Refusal" });
      break;
    case "error":
      tokens.push({ kind: "error", label: chip.label, title: chip.title || "Error" });
      break;
    case "pending":
      tokens.push({ kind: "pending", label: chip.label, title: chip.title || "Pending latest edge" });
      break;
    case "unknown":
      tokens.push({
        kind: "unknown",
        label: chip.label.length > 0 ? chip.label : String(Math.max(1, chip.count)),
        title: chip.title || "Unknown part",
      });
      break;
    default:
      tokens.push({ kind: chip.kind, label: chip.label, title: chip.title || chip.kind });
      break;
  }
  return tokens;
};

const estimateChipWidth = (chip: HeartbeatRecordChip, density: ChipDensity): number => {
  const tokens = buildHeartbeatRecordChipTokens(chip, density);
  const chipPadding = density === "narrow" ? 10 : 12;
  const gapWidth = Math.max(0, tokens.length - 1) * (density === "narrow" ? 2 : 5);
  const tokenWidth = tokens.reduce((sum, token) => sum + estimateTokenWidth(token, density), 0);
  const densityAllowance = density === "full" && (chip.parts.length ?? 0) >= 3 ? 10 : 0;
  const safety = density === "full" ? 24 : density === "medium" ? 30 : 36;
  return Math.ceil(chipPadding + gapWidth + tokenWidth + densityAllowance + safety);
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
    const tokens = parts.reduce((sum, part) => sum + readTextTokenCount(part), 0);
    return tokens > 0 ? `${tokens} tok` : "text";
  }
  if (kind === "thinking") {
    const duration = sumPartDuration(parts);
    return formatHeartbeatRecordDuration(duration) || "think";
  }
  if (kind === "tool") {
    const toolCallCount = parts.filter(isToolCallPart).length;
    return toolCallCount > 1 ? String(toolCallCount) : "";
  }
  if (kind === "image" || kind === "file") {
    const bytes = parts.reduce((sum, part) => sum + readPartSizeBytes(part), 0);
    return formatBytes(bytes || null) || kind;
  }
  if (kind === "video") {
    const duration = parts.reduce((sum, part) => sum + readPartDurationMs(part), 0);
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
  const count = kind === "tool" ? Math.max(1, parts.filter(isToolCallPart).length) : Math.max(1, parts.length);
  return {
    id: `${kind}:${parts.map((part) => part.partId).join(",") || startedAt}`,
    kind,
    label,
    title: labels.length > 0 ? labels.join(" | ") : kind,
    startedAt,
    completedAt,
    count,
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
    if (kind !== currentKind || kind === "error") {
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

export const estimateHeartbeatRecordLineWidth = (line: HeartbeatRecordLine, density: ChipDensity): number => {
  const base = density === "full" ? 20 : density === "medium" ? 16 : 12;
  const labelUnit = density === "full" ? 3.4 : density === "medium" ? 3.1 : 2.8;
  return Math.max(base, line.label.length * labelUnit + 4);
};

const lineBetween = (previous: HeartbeatRecordChip, next: HeartbeatRecordChip, index: number): HeartbeatRecordLine => {
  const previousBoundary = index === 1 ? previous.startedAt : (previous.completedAt ?? previous.startedAt);
  const nextBoundary = next.completedAt ?? next.startedAt;
  const durationMs = Number.isFinite(nextBoundary - previousBoundary) ? Math.max(0, nextBoundary - previousBoundary) : null;
  const label = formatHeartbeatRecordCardDuration(durationMs);
  return {
    id: `${previous.id}->${next.id}`,
    durationMs,
    label,
    fromKind: previous.kind,
    toKind: next.kind,
    title:
      index === 1
        ? `Closed interval from input start to ${next.kind}: ${label}`
        : `Interval after ${previous.kind} until ${next.kind}: ${label}`,
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
      (segment.lineBefore ? estimateHeartbeatRecordLineWidth(segment.lineBefore, density) : 0),
    0,
  );
  return estimate <= Math.max(180, width);
};

const fitTimeline = (chips: readonly HeartbeatRecordChip[], width: number): HeartbeatRecordTimeline => {
  const density = densityForWidth(width);
  if (chips.length <= 3) {
    return { chips: [...chips], segments: buildSegments(chips), hiddenCount: 0, density };
  }
  if (timelineFits(chips, width, density)) {
    return { chips: [...chips], segments: buildSegments(chips), hiddenCount: 0, density };
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
    density,
  };
};

const buildHeartbeatRecordChips = (record: HeartbeatRecordItem, nowMs?: number): HeartbeatRecordChip[] => {
  const parts = [...record.summary.parts].sort((left, right) => left.startedAt - right.startedAt);
  const inputParts = parts.filter(isUserInputPart);
  const inputChip = createChip("input", inputParts, record.startedAt, inputParts.at(-1)?.completedAt ?? record.startedAt);
  const outputParts = parts.filter((part) => !isUserInputPart(part));
  const chips = [inputChip, ...groupOutputParts(outputParts)];
  if (record.status === "running" && chips.every((chip) => chip.kind !== "pending")) {
    chips.push(createChip("pending", [], record.updatedAt, nowMs ?? null));
  }
  if (record.status === "error" && chips.every((chip) => chip.kind !== "error")) {
    chips.push(createChip("error", [], record.updatedAt, record.completedAt ?? record.updatedAt));
  }
  return chips;
};

export const buildHeartbeatRecordFullTimeline = (record: HeartbeatRecordItem, nowMs?: number): HeartbeatRecordTimeline => {
  const chips = buildHeartbeatRecordChips(record, nowMs);
  return {
    chips,
    segments: buildSegments(chips),
    hiddenCount: 0,
    density: "full",
  };
};

export const buildHeartbeatRecordTimeline = (
  record: HeartbeatRecordItem,
  width = 390,
  nowMs?: number,
): HeartbeatRecordTimeline => {
  const chips = buildHeartbeatRecordChips(record, nowMs);
  return fitTimeline(chips, width);
};

export const describeRecordStatus = (status: HeartbeatRecordStatus): string => status.replaceAll("_", " ");

export const isRecordRunning = (status: HeartbeatRecordStatus): boolean => status === "running";
