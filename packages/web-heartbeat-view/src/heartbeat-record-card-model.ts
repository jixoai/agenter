import {
  describeRecordStatus,
  formatHeartbeatRecordCardDuration,
  formatHeartbeatRecordDuration,
  isRecordRunning,
  type HeartbeatRecordChipKind,
} from "./heartbeat-record-chips";
import type { HeartbeatRecordItem } from "./types";

export interface HeartbeatRecordCardMeta {
  kindLabel: string;
  statusLabel: string;
  durationLabel: string;
  modelLabel: string | null;
  metaLabel: string;
  supportLabel: string | null;
  title: string;
}

export interface HeartbeatRecordObjectNode {
  kind: HeartbeatRecordChipKind | "compact" | "config";
  label: string;
  title: string;
}

export interface HeartbeatRecordObjectBodyModel {
  before: HeartbeatRecordObjectNode;
  after: HeartbeatRecordObjectNode;
}

export const formatHeartbeatRecordTime = (value: number): string =>
  new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));

export const getHeartbeatRecordKindLabel = (record: HeartbeatRecordItem): string => {
  if (record.kind === "model_call") {
    return "Model run";
  }
  if (record.kind === "compact") {
    return "Compact";
  }
  if (record.kind === "config") {
    return "Config";
  }
  return record.kind;
};

export const getHeartbeatRecordModelLabel = (record: HeartbeatRecordItem): string | null =>
  record.summary.provider || record.summary.model
    ? [record.summary.provider, record.summary.model].filter(Boolean).join(" / ")
    : null;

export const getHeartbeatRecordCardMeta = (record: HeartbeatRecordItem, nowMs?: number): HeartbeatRecordCardMeta => {
  const kindLabel = getHeartbeatRecordKindLabel(record);
  const statusLabel = describeRecordStatus(record.status);
  const durationEnd = record.completedAt ?? (isRecordRunning(record.status) && nowMs ? nowMs : record.updatedAt);
  const durationLabel = formatHeartbeatRecordCardDuration(durationEnd - record.startedAt);
  const modelLabel = getHeartbeatRecordModelLabel(record);
  const metaLabel = (() => {
    if (record.kind === "compact") {
      if (record.status === "running") {
        return "context compressing";
      }
      if (record.status === "error") {
        return "context unchanged";
      }
      return "context reclaimed";
    }
    if (record.kind === "config") {
      if (record.status === "running") {
        return "next-call knobs";
      }
      if (record.status === "error") {
        return "next-call knobs";
      }
      return "next-call knobs";
    }
    return modelLabel ?? `${record.summary.counts.parts} parts`;
  })();
  const supportLabel = (() => {
    if (record.kind === "compact") {
      return "New Context";
    }
    if (record.kind === "config") {
      return "Diff Config";
    }
    return null;
  })();
  const title = [
    `${kindLabel} ${statusLabel}`,
    modelLabel,
    `${record.summary.counts.parts} parts`,
    `${record.summary.counts.toolCalls} tool calls`,
    record.summary.firstFrameMs === null
      ? null
      : `first frame ${formatHeartbeatRecordDuration(record.summary.firstFrameMs)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    kindLabel,
    statusLabel,
    durationLabel,
    modelLabel,
    metaLabel,
    supportLabel,
    title,
  };
};

export const getHeartbeatCompactBodyModel = (record: HeartbeatRecordItem): HeartbeatRecordObjectBodyModel => {
  const partCount = Math.max(1, record.summary.counts.parts);
  return {
    before: {
      kind: "compact",
      label: `${partCount} fact${partCount > 1 ? "s" : ""}`,
      title: `Compact source span: ${partCount} source fact${partCount > 1 ? "s" : ""}`,
    },
    after: {
      kind: record.status === "error" ? "error" : isRecordRunning(record.status) ? "pending" : "text",
      label: isRecordRunning(record.status) ? "streaming" : record.status === "error" ? "error" : "new",
      title: `Compact result state: ${describeRecordStatus(record.status)}`,
    },
  };
};

export const getHeartbeatConfigBodyModel = (record: HeartbeatRecordItem): HeartbeatRecordObjectBodyModel => {
  const partCount = Math.max(1, record.summary.counts.parts);
  return {
    before: {
      kind: "config",
      label: `${partCount} changed`,
      title: `Config changed controls: ${partCount}`,
    },
    after: {
      kind: record.status === "error" ? "error" : isRecordRunning(record.status) ? "pending" : "text",
      label: isRecordRunning(record.status) ? "saving" : record.status === "error" ? "error" : "applied",
      title: `Config apply state: ${describeRecordStatus(record.status)}`,
    },
  };
};
