import type {
  AttentionCommit,
  AttentionContextSnapshot,
  AttentionFocusState,
  AttentionSystemSnapshot,
} from "@agenter/attention-system";

import { appAttentionSourceRegistry } from "./attention-src";

export interface SessionNotificationItem {
  id: string;
  sessionId: string;
  src: string;
  sourceNamespace: string;
  sourceId: string;
  bucketKey: string;
  attentionContextId: string;
  attentionCommitId: string;
  workspacePath: string;
  sessionName: string;
  content: string;
  timestamp: number;
}

export interface SessionNotificationSnapshot {
  items: SessionNotificationItem[];
  unreadBySession: Record<string, number>;
  unreadByBucket: Record<string, Record<string, number>>;
}

const EMPTY_SNAPSHOT: SessionNotificationSnapshot = {
  items: [],
  unreadBySession: {},
  unreadByBucket: {},
};

const bumpNestedCount = (
  target: Record<string, Record<string, number>>,
  sessionId: string,
  bucketKey: string,
): void => {
  const nextSessionCounts = target[sessionId] ?? {};
  nextSessionCounts[bucketKey] = (nextSessionCounts[bucketKey] ?? 0) + 1;
  target[sessionId] = nextSessionCounts;
};

const isCommitConsumed = (
  context: AttentionContextSnapshot,
  commit: AttentionCommit,
  focusState: AttentionFocusState,
): boolean => {
  if (context.consumedPushCommitIds.includes(commit.commitId)) {
    return true;
  }
  if (commit.ingressType !== "push") {
    return false;
  }
  return focusState === "focused";
};

const resolveNotificationSource = (
  commit: AttentionCommit,
): {
  src: string;
  sourceNamespace: string;
  sourceId: string;
  bucketKey: string;
} | null => {
  const src = typeof commit.meta.src === "string" ? commit.meta.src.trim() : "";
  if (src.length === 0) {
    return null;
  }
  const resolved = appAttentionSourceRegistry.resolve(src);
  return {
    src,
    sourceNamespace: resolved?.namespace ?? "source",
    sourceId: appAttentionSourceRegistry.sourceId(src) ?? (appAttentionSourceRegistry.bucket(src) ?? src),
    bucketKey: appAttentionSourceRegistry.bucket(src) ?? src,
  };
};

const resolveNotificationContent = (commit: AttentionCommit): string => {
  if (commit.summary.trim().length > 0) {
    return commit.summary;
  }
  if (commit.change.type === "clean") {
    return "";
  }
  return commit.change.value;
};

export const projectSessionNotificationSnapshot = (input: {
  sessionId: string;
  workspacePath: string;
  sessionName: string;
  attention: AttentionSystemSnapshot;
}): SessionNotificationSnapshot => {
  const items: SessionNotificationItem[] = [];
  for (const context of input.attention.contexts) {
    for (const commit of context.commits) {
      if (commit.ingressType !== "push") {
        continue;
      }
      if (isCommitConsumed(context, commit, context.focusState)) {
        continue;
      }
      const source = resolveNotificationSource(commit);
      if (!source) {
        continue;
      }
      items.push({
        id: `${input.sessionId}:${context.contextId}:${commit.commitId}`,
        sessionId: input.sessionId,
        src: source.src,
        sourceNamespace: source.sourceNamespace,
        sourceId: source.sourceId,
        bucketKey: source.bucketKey,
        attentionContextId: context.contextId,
        attentionCommitId: commit.commitId,
        workspacePath: input.workspacePath,
        sessionName: input.sessionName,
        content: resolveNotificationContent(commit),
        timestamp: Date.parse(commit.createdAt),
      });
    }
  }

  items.sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
  if (items.length === 0) {
    return EMPTY_SNAPSHOT;
  }

  const unreadCounts = new Map<string, number>();
  const unreadByBucket: Record<string, Record<string, number>> = {};
  for (const item of items) {
    unreadCounts.set(item.sessionId, (unreadCounts.get(item.sessionId) ?? 0) + 1);
    bumpNestedCount(unreadByBucket, item.sessionId, item.bucketKey);
  }

  return {
    items,
    unreadBySession: Object.fromEntries(unreadCounts),
    unreadByBucket,
  };
};

export const mergeSessionNotificationSnapshots = (
  snapshots: readonly SessionNotificationSnapshot[],
): SessionNotificationSnapshot => {
  if (snapshots.length === 0) {
    return EMPTY_SNAPSHOT;
  }
  const items = snapshots.flatMap((snapshot) => snapshot.items).sort((left, right) => left.timestamp - right.timestamp);
  const unreadBySession: Record<string, number> = {};
  const unreadByBucket: Record<string, Record<string, number>> = {};

  for (const snapshot of snapshots) {
    for (const [sessionId, count] of Object.entries(snapshot.unreadBySession)) {
      unreadBySession[sessionId] = (unreadBySession[sessionId] ?? 0) + count;
    }
    for (const [sessionId, byBucket] of Object.entries(snapshot.unreadByBucket)) {
      for (const [bucketKey, count] of Object.entries(byBucket)) {
        bumpNestedCount(unreadByBucket, sessionId, bucketKey);
        unreadByBucket[sessionId]![bucketKey] = (unreadByBucket[sessionId]![bucketKey] ?? 0) + count - 1;
      }
    }
  }

  return {
    items,
    unreadBySession,
    unreadByBucket,
  };
};

export const toAttentionFocusStateFromVisibility = (input: {
  visible: boolean;
  focused: boolean;
}): AttentionFocusState => {
  if (input.focused) {
    return "focused";
  }
  if (input.visible) {
    return "background";
  }
  return "muted";
};
