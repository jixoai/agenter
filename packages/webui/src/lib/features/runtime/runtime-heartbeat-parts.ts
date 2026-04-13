import type { HeartbeatPartItem } from "@agenter/client-sdk";

type HeartbeatPart = HeartbeatPartItem["parts"][number];

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
  meta.push(`round ${entry.roundIndex}`);
  if (!entry.isComplete) {
    meta.push("streaming");
  }
  return meta;
};
