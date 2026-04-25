import type {
  ReversePage,
  ReverseTimeCursor,
  SessionAiCallRecord,
  SessionMessageRecord,
  SessionMessageScope,
} from "@agenter/session-system";
import { SessionDb } from "@agenter/session-system";

import { projectHeartbeatGroups, type RuntimeHeartbeatGroupRecord } from "./heartbeat-groups";
import { HEARTBEAT_AUXILIARY_SCOPE, HEARTBEAT_MESSAGE_PART_SCOPE } from "./heartbeat-message-parts";

const HEARTBEAT_GROUP_BATCH_MIN = 20;
const HEARTBEAT_GROUP_BATCH_MAX = 200;

const clampLimit = (limit: number | undefined): number => Math.max(1, Math.min(limit ?? 200, 1_000));

const sortGroupsDescending = (groups: readonly RuntimeHeartbeatGroupRecord[]): RuntimeHeartbeatGroupRecord[] =>
  [...groups].sort((left, right) => {
    if (left.createdAt !== right.createdAt) {
      return right.createdAt - left.createdAt;
    }
    return right.id - left.id;
  });

const isBeforeCursor = (group: RuntimeHeartbeatGroupRecord, before: ReverseTimeCursor | undefined): boolean =>
  before === undefined ||
  group.createdAt < before.beforeTimeMs ||
  (group.createdAt === before.beforeTimeMs && group.id < before.beforeId);

const dedupeMessages = (messages: readonly SessionMessageRecord[]): SessionMessageRecord[] =>
  [...new Map(messages.map((message) => [message.messageId, message])).values()].sort((left, right) => {
    if (left.createdAt !== right.createdAt) {
      return left.createdAt - right.createdAt;
    }
    return left.id - right.id;
  });

const decodeInitialMaxVisibleAiCallId = (before: ReverseTimeCursor | undefined): number | null => {
  if (!before) {
    return null;
  }
  const candidateAiCallId = Math.floor(before.beforeId / 10);
  if (candidateAiCallId <= 0) {
    return 0;
  }
  return before.beforeId % 10 === 1 ? candidateAiCallId : candidateAiCallId - 1;
};

const resolveBatchSize = (limit: number): number =>
  Math.max(HEARTBEAT_GROUP_BATCH_MIN, Math.min(HEARTBEAT_GROUP_BATCH_MAX, limit * 2));

const listVisibleCalls = (
  db: SessionDb,
  maxVisibleAiCallId: number | null,
  limit: number,
): SessionAiCallRecord[] => {
  if (maxVisibleAiCallId === null) {
    return db.listAiCalls(limit);
  }
  if (maxVisibleAiCallId <= 0) {
    return [];
  }
  return db.listAiCallsBefore(maxVisibleAiCallId + 1, limit);
};

const loadPredecessorContextCalls = (db: SessionDb, oldestVisibleAiCallId: number): SessionAiCallRecord[] => {
  const predecessors: SessionAiCallRecord[] = [];
  let beforeAiCallId = oldestVisibleAiCallId;
  while (beforeAiCallId > 0) {
    const batch = db.listAiCallsBefore(beforeAiCallId, 10);
    if (batch.length === 0) {
      return predecessors;
    }
    for (let index = batch.length - 1; index >= 0; index -= 1) {
      const call = batch[index]!;
      predecessors.unshift(call);
      if (call.kind !== "compact") {
        return predecessors;
      }
      beforeAiCallId = call.id;
    }
    beforeAiCallId = batch[0]!.id;
  }
  return predecessors;
};

const loadNullAiCallMessages = (
  db: SessionDb,
  scopes: readonly SessionMessageScope[],
  input?: {
    afterCreatedAt?: number;
    afterInclusive?: boolean;
    beforeCreatedAt?: number;
    beforeInclusive?: boolean;
  },
): SessionMessageRecord[] => db.listMessagesByScopesWithNullAiCallInRange(scopes, input);

const buildWindowGroups = (
  db: SessionDb,
  visibleCalls: readonly SessionAiCallRecord[],
  includePending: boolean,
): RuntimeHeartbeatGroupRecord[] => {
  const predecessorContextCalls =
    visibleCalls.length > 0 ? loadPredecessorContextCalls(db, visibleCalls[0]!.id) : [];
  const allCalls = [...predecessorContextCalls, ...visibleCalls];
  const visibleCallIds = new Set(visibleCalls.map((call) => call.id));
  const predecessorCallIds = new Set(predecessorContextCalls.map((call) => call.id));
  const immediatePredecessor = predecessorContextCalls.at(-1) ?? null;
  const latestVisibleCall = visibleCalls.at(-1) ?? null;
  const referencedMessageIds = [
    ...new Set(
      allCalls.flatMap((call) => [...call.requestMessageIds, ...call.responseMessageIds, ...call.auxiliaryMessageIds]),
    ),
  ];
  const referencedMessages = db.listMessagesByIds(referencedMessageIds);
  const aiCallMessages = db.listMessagesByScopesAndAiCallIds(
    [HEARTBEAT_MESSAGE_PART_SCOPE, HEARTBEAT_AUXILIARY_SCOPE],
    allCalls.map((call) => call.id),
  );
  const looseHeartbeatRows = loadNullAiCallMessages(db, [HEARTBEAT_MESSAGE_PART_SCOPE], {
    afterCreatedAt: immediatePredecessor?.createdAt,
    afterInclusive: false,
    beforeCreatedAt: includePending ? undefined : latestVisibleCall?.createdAt,
    beforeInclusive: false,
  });
  const pendingAuxiliaryRows = includePending
    ? loadNullAiCallMessages(db, [HEARTBEAT_AUXILIARY_SCOPE], {
        afterCreatedAt: latestVisibleCall?.createdAt,
        afterInclusive: true,
      })
    : [];
  const inspectionMessages = dedupeMessages([
    ...referencedMessages,
    ...aiCallMessages,
    ...looseHeartbeatRows,
    ...pendingAuxiliaryRows,
  ]);
  const groups = projectHeartbeatGroups({
    aiCalls: allCalls,
    inspectionMessages,
  });
  return groups.filter((group) => {
    if (group.aiCallId === null) {
      return includePending;
    }
    if (predecessorCallIds.has(group.aiCallId)) {
      return false;
    }
    return visibleCallIds.has(group.aiCallId);
  });
};

const buildPendingOnlyGroups = (db: SessionDb): RuntimeHeartbeatGroupRecord[] =>
  projectHeartbeatGroups({
    aiCalls: [],
    inspectionMessages: dedupeMessages([
      ...loadNullAiCallMessages(db, [HEARTBEAT_MESSAGE_PART_SCOPE]),
      ...loadNullAiCallMessages(db, [HEARTBEAT_AUXILIARY_SCOPE]),
    ]),
  });

export const pageHeartbeatGroupsFromDb = (
  db: SessionDb,
  input?: { before?: ReverseTimeCursor; limit?: number },
): ReversePage<RuntimeHeartbeatGroupRecord> => {
  const limit = clampLimit(input?.limit);
  const before = input?.before;
  const batchSize = resolveBatchSize(limit);
  const groupsDescending: RuntimeHeartbeatGroupRecord[] = [];
  let maxVisibleAiCallId = decodeInitialMaxVisibleAiCallId(before);
  let firstWindow = true;
  let exhausted = false;

  while (groupsDescending.length <= limit) {
    const visibleCalls = listVisibleCalls(db, maxVisibleAiCallId, batchSize);
    if (visibleCalls.length === 0) {
      if (firstWindow && before === undefined) {
        for (const group of sortGroupsDescending(buildPendingOnlyGroups(db))) {
          groupsDescending.push(group);
        }
      }
      exhausted = true;
      break;
    }
    const windowGroups = sortGroupsDescending(buildWindowGroups(db, visibleCalls, firstWindow && before === undefined));
    for (const group of windowGroups) {
      if (!isBeforeCursor(group, before)) {
        continue;
      }
      groupsDescending.push(group);
      if (groupsDescending.length > limit) {
        break;
      }
    }
    firstWindow = false;
    maxVisibleAiCallId = visibleCalls[0]!.id - 1;
    if (visibleCalls.length < batchSize || maxVisibleAiCallId <= 0) {
      exhausted = true;
      break;
    }
  }

  const pageDescending = groupsDescending.slice(0, limit);
  const items = [...pageDescending].reverse();
  const oldest = items[0] ?? null;
  const hasMoreBefore = groupsDescending.length > limit || !exhausted;
  return {
    items,
    nextBefore:
      hasMoreBefore && oldest
        ? {
            beforeTimeMs: oldest.createdAt,
            beforeId: oldest.id,
          }
        : null,
    hasMoreBefore,
  };
};
