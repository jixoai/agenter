import type {
  RuntimeAttentionDeliveryState,
  RuntimeAttentionState,
  SessionNotificationItem,
} from "@agenter/client-sdk";

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

export interface RuntimeAttentionEffectItem {
  effectId: string;
  contextId: string | null;
  commitId: string | null;
  actionId: string;
  actionKind: string;
  actorId: string;
  cycleId: number | null;
  sessionModelCallId: number | null;
  target: string;
  effectKind: string;
  effectRecordId: string;
  timestamp: number;
}

export interface RuntimeAttentionWatchItem {
  watchId: string;
  ownerActionId: string;
  ownerActionKind: string;
  ownerActorId: string;
  target: string;
  status: string;
  dueAt: number;
  resolvedAt: number | null;
  reminderContextId: string | null;
  reminderCommitId: string | null;
  predicateKind: string;
  predicateLabel: string;
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

const compareEffectItemsByRecency = (left: RuntimeAttentionEffectItem, right: RuntimeAttentionEffectItem): number =>
  right.timestamp - left.timestamp ||
  right.effectId.localeCompare(left.effectId);

const candidateRoomIdsForContext = (contextId: string): Set<string> => {
  const candidates = new Set<string>();
  const prefixes = ["ctx-room-", "ctx-chat-", "ctx-"];
  for (const prefix of prefixes) {
    if (contextId.startsWith(prefix) && contextId.length > prefix.length) {
      candidates.add(contextId.slice(prefix.length));
    }
  }
  candidates.add(contextId);
  return candidates;
};

const watchBelongsToContext = (
  watch: RuntimeAttentionDeliveryState["watches"][number],
  contextId: string,
): boolean => {
  if (watch.reminderContextId === contextId) {
    return true;
  }
  if (typeof watch.meta?.contextId === "string" && watch.meta.contextId === contextId) {
    return true;
  }
  const roomIds = candidateRoomIdsForContext(contextId);
  if (watch.target.startsWith("room:") && roomIds.has(watch.target.slice("room:".length))) {
    return true;
  }
  return watch.predicate.kind === "message_latest_visible" && roomIds.has(watch.predicate.chatId);
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

export const buildRuntimeAttentionEffectItems = (input: {
  delivery: RuntimeAttentionDeliveryState | null | undefined;
  contextId: string | null | undefined;
}): RuntimeAttentionEffectItem[] => {
  if (!input.delivery || !input.contextId) {
    return [];
  }
  const selectedProjection = input.delivery.projections.find((projection) => projection.contextId === input.contextId);
  if (!selectedProjection) {
    return [];
  }
  const selectedDispatches = input.delivery.dispatches.filter((dispatch) => dispatch.contextId === input.contextId);
  const selectedReceipts = input.delivery.receipts.filter((receipt) => receipt.contextId === input.contextId);
  const selectedCycleIds = new Set<number>(
    [
      ...selectedDispatches.map((dispatch) => dispatch.cycleId),
      ...selectedReceipts.map((receipt) => receipt.cycleId),
    ]
      .filter((value): value is number => value !== null),
  );
  const selectedModelCallIds = new Set<number>(
    [
      selectedProjection.sessionModelCallId,
      ...selectedDispatches.map((dispatch) => dispatch.sessionModelCallId),
      ...selectedReceipts.map((receipt) => receipt.sessionModelCallId),
    ].filter((value): value is number => value !== null),
  );
  return input.delivery.effects
    .filter((effect) => effect.target.startsWith("room:"))
    .filter((effect) => {
      if (effect.cycleId !== null && selectedCycleIds.has(effect.cycleId)) {
        return true;
      }
      if (effect.sessionModelCallId !== null && selectedModelCallIds.has(effect.sessionModelCallId)) {
        return true;
      }
      return false;
    })
    .map((effect) => ({
      effectId: effect.effectId,
      contextId:
        typeof effect.meta?.contextId === "string"
          ? effect.meta.contextId
          : selectedProjection.contextId,
      commitId:
        typeof effect.meta?.commitId === "string"
          ? effect.meta.commitId
          : selectedProjection.commitId,
      actionId: effect.actionId,
      actionKind: effect.actionKind,
      actorId: effect.actorId,
      cycleId: effect.cycleId,
      sessionModelCallId: effect.sessionModelCallId,
      target: effect.target,
      effectKind: effect.effectKind,
      effectRecordId: effect.effectRecordId,
      timestamp: effect.timestamp,
    }))
    .sort(compareEffectItemsByRecency);
};

export const buildRuntimeAttentionWatchItems = (input: {
  delivery: RuntimeAttentionDeliveryState | null | undefined;
  contextId: string | null | undefined;
}): RuntimeAttentionWatchItem[] => {
  if (!input.delivery || !input.contextId) {
    return [];
  }
  const contextId = input.contextId;
  return input.delivery.watches
    .filter((watch) => watchBelongsToContext(watch, contextId))
    .map((watch) => ({
      watchId: watch.watchId,
      ownerActionId: watch.ownerActionId,
      ownerActionKind: watch.ownerActionKind,
      ownerActorId: watch.ownerActorId,
      target: watch.target,
      status: watch.status,
      dueAt: watch.dueAt,
      resolvedAt: watch.resolvedAt,
      reminderContextId: watch.reminderContextId ?? null,
      reminderCommitId: watch.reminderCommitId ?? null,
      predicateKind: watch.predicate.kind,
      predicateLabel:
        watch.predicate.kind === "message_latest_visible"
          ? `${watch.predicate.chatId}#${watch.predicate.anchorMessageId}`
          : watch.predicate.kind,
    }))
    .sort((left, right) => left.dueAt - right.dueAt || left.watchId.localeCompare(right.watchId));
};
