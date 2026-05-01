import type { SessionRuntimeWatchPredicate, SessionRuntimeWatchRecord, SessionRuntimeWatchStatus } from "@agenter/session-system";

export interface RuntimeWatchRecord extends Omit<SessionRuntimeWatchRecord, "predicate"> {
  predicate: SessionRuntimeWatchPredicate;
}

export interface RuntimeWatchInsert {
  watchId: string;
  ownerActionId: string;
  ownerActionKind: string;
  ownerActorId: string;
  ownerCycleId?: number | null;
  ownerSessionModelCallId?: number | null;
  target: string;
  predicate: SessionRuntimeWatchPredicate;
  dueAt: number;
  status?: SessionRuntimeWatchStatus;
  createdAt?: number;
  updatedAt?: number;
  resolvedAt?: number | null;
  reminderContextId?: string | null;
  reminderCommitId?: string | null;
  meta?: Record<string, unknown>;
}

const cloneWatch = (watch: RuntimeWatchRecord): RuntimeWatchRecord => ({
  ...watch,
  predicate: structuredClone(watch.predicate),
  meta: watch.meta ? structuredClone(watch.meta) : undefined,
});

export class RuntimeWatchStore {
  private readonly watches = new Map<string, RuntimeWatchRecord>();

  upsert(input: RuntimeWatchInsert): RuntimeWatchRecord {
    const existing = this.watches.get(input.watchId);
    const now = Date.now();
    const createdAt = input.createdAt ?? existing?.createdAt ?? now;
    const updatedAt = input.updatedAt ?? (existing ? now : createdAt);
    const next: RuntimeWatchRecord = {
      id: existing?.id ?? 0,
      watchId: input.watchId,
      ownerActionId: input.ownerActionId,
      ownerActionKind: input.ownerActionKind,
      ownerActorId: input.ownerActorId,
      ownerCycleId: input.ownerCycleId ?? null,
      ownerSessionModelCallId: input.ownerSessionModelCallId ?? null,
      target: input.target,
      predicate: structuredClone(input.predicate),
      dueAt: input.dueAt,
      status: input.status ?? "pending",
      createdAt,
      updatedAt,
      resolvedAt: input.resolvedAt ?? null,
      reminderContextId: input.reminderContextId ?? null,
      reminderCommitId: input.reminderCommitId ?? null,
      meta: input.meta ? structuredClone(input.meta) : undefined,
    };
    this.watches.set(next.watchId, next);
    return cloneWatch(next);
  }

  load(records: SessionRuntimeWatchRecord[]): void {
    this.watches.clear();
    for (const record of records) {
      this.watches.set(record.watchId, cloneWatch(record));
    }
  }

  clear(): void {
    this.watches.clear();
  }

  get(watchId: string): RuntimeWatchRecord | null {
    const watch = this.watches.get(watchId);
    return watch ? cloneWatch(watch) : null;
  }

  list(input?: {
    status?: SessionRuntimeWatchStatus;
    target?: string;
    ownerActionId?: string;
  }): RuntimeWatchRecord[] {
    return [...this.watches.values()]
      .filter((watch) => (input?.status ? watch.status === input.status : true))
      .filter((watch) => (input?.target ? watch.target === input.target : true))
      .filter((watch) => (input?.ownerActionId ? watch.ownerActionId === input.ownerActionId : true))
      .sort((left, right) => left.dueAt - right.dueAt || left.createdAt - right.createdAt || left.watchId.localeCompare(right.watchId))
      .map(cloneWatch);
  }

  nextDueAt(): number | null {
    let next: number | null = null;
    for (const watch of this.watches.values()) {
      if (watch.status !== "pending") {
        continue;
      }
      next = next === null ? watch.dueAt : Math.min(next, watch.dueAt);
    }
    return next;
  }

  update(
    watchId: string,
    input: {
      status?: SessionRuntimeWatchStatus;
      updatedAt?: number;
      resolvedAt?: number | null;
      reminderContextId?: string | null;
      reminderCommitId?: string | null;
      meta?: Record<string, unknown>;
    },
  ): RuntimeWatchRecord | null {
    const current = this.watches.get(watchId);
    if (!current) {
      return null;
    }
    const updatedAt = input.updatedAt ?? Date.now();
    const nextStatus = input.status ?? current.status;
    const next: RuntimeWatchRecord = {
      ...current,
      status: nextStatus,
      updatedAt,
      resolvedAt:
        input.resolvedAt !== undefined ? input.resolvedAt : nextStatus === "pending" ? null : current.resolvedAt ?? updatedAt,
      reminderContextId:
        input.reminderContextId !== undefined ? input.reminderContextId : current.reminderContextId ?? null,
      reminderCommitId:
        input.reminderCommitId !== undefined ? input.reminderCommitId : current.reminderCommitId ?? null,
      meta: input.meta !== undefined ? structuredClone(input.meta) : current.meta ? structuredClone(current.meta) : undefined,
    };
    this.watches.set(watchId, next);
    return cloneWatch(next);
  }
}
