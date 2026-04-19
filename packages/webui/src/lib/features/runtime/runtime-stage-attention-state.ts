import type { RuntimeAttentionState, SessionNotificationItem } from "@agenter/client-sdk";

import type {
  RuntimeAttentionContextItem,
  RuntimeAttentionScoreEntry,
  RuntimeContextJumpTarget,
} from "./runtime-attention-contexts";

export interface RuntimeAttentionScoreSummary {
  activeCount: number;
  maxScore: number;
  totalScore: number;
  previewEntries: RuntimeAttentionScoreEntry[];
  overflowCount: number;
}

export interface RuntimeAttentionQueueItem {
  id: string;
  attentionContextId: string;
  label: string;
  sourceType: "chat" | "terminal" | "source";
  sourceId: string;
  src: string;
  content: string;
  timestamp: number;
  jumpTarget: RuntimeContextJumpTarget | null;
}

const normalizeSearchQuery = (value: string): string => value.trim().toLowerCase();

const formatSearchableScore = (score: RuntimeAttentionScoreEntry): string => `${score.key} ${score.value}`;

const buildContextSearchText = (item: RuntimeAttentionContextItem): string =>
  [
    item.label,
    item.contextId,
    item.owner,
    item.commitLabel,
    ...item.scores.map(formatSearchableScore),
    ...item.recentCommits.flatMap((commit) => [commit.summary, commit.source]),
  ]
    .join("\n")
    .toLowerCase();

const buildHookSearchText = (hook: RuntimeAttentionState["hooks"][number]): string =>
  [hook.bridgeId, hook.status, hook.contextId, hook.hookId, hook.commitId, hook.error ?? ""].join("\n").toLowerCase();

const buildQueueSearchText = (item: RuntimeAttentionQueueItem): string =>
  [
    item.label,
    item.attentionContextId,
    item.sourceType,
    item.sourceId,
    item.src,
    item.content,
  ]
    .join("\n")
    .toLowerCase();

const resolveQueueSourceType = (sourceNamespace: string): RuntimeAttentionQueueItem["sourceType"] => {
  if (sourceNamespace === "msg") {
    return "chat";
  }
  if (sourceNamespace === "tty") {
    return "terminal";
  }
  return "source";
};

export const buildRuntimeAttentionScoreSummary = (
  scores: ReadonlyArray<RuntimeAttentionScoreEntry>,
): RuntimeAttentionScoreSummary | null => {
  if (scores.length === 0) {
    return null;
  }

  const previewEntries = scores.slice(0, 2);
  return {
    activeCount: scores.length,
    maxScore: scores.reduce((max, score) => Math.max(max, score.value), 0),
    totalScore: scores.reduce((sum, score) => sum + score.value, 0),
    previewEntries,
    overflowCount: Math.max(0, scores.length - previewEntries.length),
  };
};

export const filterRuntimeAttentionContextItems = (
  items: ReadonlyArray<RuntimeAttentionContextItem>,
  query: string,
): RuntimeAttentionContextItem[] => {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return [...items];
  }
  return items.filter((item) => buildContextSearchText(item).includes(normalizedQuery));
};

export const filterRuntimeAttentionHooks = (
  hooks: ReadonlyArray<RuntimeAttentionState["hooks"][number]>,
  query: string,
): RuntimeAttentionState["hooks"] => {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return [...hooks];
  }
  return hooks.filter((hook) => buildHookSearchText(hook).includes(normalizedQuery));
};

export const buildRuntimeAttentionQueueItems = (
  notifications: ReadonlyArray<SessionNotificationItem>,
  contextItems: ReadonlyArray<RuntimeAttentionContextItem>,
): RuntimeAttentionQueueItem[] => {
  const contextMap = new Map(contextItems.map((item) => [item.contextId, item]));
  return [...notifications]
    .sort((left, right) => right.timestamp - left.timestamp || left.id.localeCompare(right.id))
    .map((notification) => {
      const context = contextMap.get(notification.attentionContextId);
      return {
        id: notification.id,
        attentionContextId: notification.attentionContextId,
        label: context?.label ?? notification.sourceId ?? notification.bucketKey,
        sourceType: resolveQueueSourceType(notification.sourceNamespace),
        sourceId: notification.sourceId,
        src: notification.src,
        content: notification.content,
        timestamp: notification.timestamp,
        jumpTarget: context?.jumpTarget ?? null,
      };
    });
};

export const filterRuntimeAttentionQueueItems = (
  items: ReadonlyArray<RuntimeAttentionQueueItem>,
  query: string,
): RuntimeAttentionQueueItem[] => {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return [...items];
  }
  return items.filter((item) => buildQueueSearchText(item).includes(normalizedQuery));
};
