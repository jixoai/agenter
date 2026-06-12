import { stringify } from "yaml";

import {
  formatHeartbeatRecordBridgeDuration as formatHeartbeatRecordBridgeDurationFromChips,
  formatHeartbeatRecordDuration,
  resolveHeartbeatRecordPartKind,
  type HeartbeatRecordChipKind,
} from "./heartbeat-record-chips";
import type { HeartbeatPart, HeartbeatPartItem, HeartbeatRecordPartSummary } from "./types";

export type HeartbeatRecordPayload = Record<string, unknown>;

export interface HeartbeatRecordDetailPartRow {
  message: HeartbeatPartItem;
  part: HeartbeatPart;
  summary: HeartbeatRecordPartSummary | null;
  key: string;
  kind: HeartbeatRecordChipKind;
  durationLabel: string;
}

export const isHeartbeatRecordPayload = (value: unknown): value is HeartbeatRecordPayload =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const formatHeartbeatRecordPayload = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  return stringify(value ?? null).trim();
};

export const readHeartbeatRecordPayloadValue = (payload: unknown, keys: readonly string[]): unknown => {
  if (!isHeartbeatRecordPayload(payload)) {
    return undefined;
  }
  for (const key of keys) {
    if (key in payload) {
      return payload[key];
    }
  }
  return undefined;
};

export const collectHeartbeatRecordParts = (
  messages: readonly HeartbeatPartItem[],
  partTypes: readonly string[],
): HeartbeatPart[] => messages.flatMap((message) => message.parts.filter((part) => partTypes.includes(part.partType)));

export const buildHeartbeatDetailPartStableRef = (
  part: Pick<HeartbeatPart, "messageId" | "partIndex">,
): string => `${part.messageId}:${part.partIndex}`;

export const buildHeartbeatDetailPartMatchKeys = (part: HeartbeatPart): readonly string[] => {
  const partId = String(part.partId);
  const stableRef = buildHeartbeatDetailPartStableRef(part);
  const keys = new Set<string>([
    partId,
    `${part.messageId}:${partId}`,
    stableRef,
    `${part.messageId}:${part.partType}:${part.createdAt}`,
  ]);
  return [...keys];
};

export const indentHeartbeatYaml = (value: string): string =>
  value
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");

export const formatHeartbeatRecordBridgeDuration = formatHeartbeatRecordBridgeDurationFromChips;

export const buildHeartbeatRecordDetailRows = (
  messages: readonly HeartbeatPartItem[],
  summaries: ReadonlyMap<string, HeartbeatRecordPartSummary>,
): HeartbeatRecordDetailPartRow[] =>
  messages.flatMap((message) =>
    message.parts.map((part) => {
      const summary = buildHeartbeatDetailPartMatchKeys(part)
        .map((key) => summaries.get(key) ?? null)
        .find((candidate): candidate is HeartbeatRecordPartSummary => candidate !== null) ?? null;
      const completedAt = summary?.completedAt ?? (part.isComplete ? part.updatedAt : null);
      const startedAt = summary?.startedAt ?? part.createdAt;
      return {
        message,
        part,
        summary,
        key: `${message.messageId}:${part.partIndex}`,
        kind:
          summary === null
            ? resolveHeartbeatRecordPartKind({
                messageId: part.messageId,
                partId: String(part.partId),
                role: part.role,
                type: part.partType,
                mimeType: part.mimeType,
                aiCallId: part.aiCallId,
                startedAt,
                completedAt,
                label: part.partType,
                isComplete: part.isComplete,
              })
            : resolveHeartbeatRecordPartKind(summary),
        durationLabel: formatHeartbeatRecordDuration(completedAt === null ? null : completedAt - startedAt),
      };
    }),
  );
