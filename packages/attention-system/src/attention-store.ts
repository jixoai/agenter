import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { AttentionCommit, AttentionContextSnapshot } from "./attention-item";
import { buildAttentionContextStateFromCommits } from "./attention-context";
import type { AttentionCommitChange, AttentionSystemSnapshot, LegacyAttentionSnapshot } from "./attention-types";

interface PersistedV2Item {
  id: string;
  contextId: string;
  meta: { from: string; time: number; [key: string]: unknown };
  scores: Record<string, number>;
  title: string;
  context?: string;
  createdAt: string;
}

interface PersistedV2Context {
  id: string;
  owner: string;
  items: PersistedV2Item[];
}

interface PersistedV2 {
  version: 2;
  contexts: PersistedV2Context[];
}

interface PersistedV3Item {
  id: string;
  contextId: string;
  parentIds: string[];
  meta: Record<string, unknown>;
  scores: Record<string, number>;
  title: string;
  detail?: {
    kind: "replace" | "patch";
    value: string;
    format?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface PersistedV3Context {
  id: string;
  owner: string;
  items: PersistedV3Item[];
}

interface PersistedV3 {
  version: 3;
  contexts: PersistedV3Context[];
}

interface PersistedV4 {
  version: 4;
  contexts: AttentionContextSnapshot[];
}

interface PersistedV5 {
  version: 5;
  contexts: AttentionContextSnapshot[];
}

interface PersistedV6 {
  version: 6;
  contexts: AttentionContextSnapshot[];
}

interface PersistedV7 {
  version: 7;
  contexts: AttentionContextSnapshot[];
}

interface PersistedV8 {
  version: 8;
  contexts: AttentionContextSnapshot[];
}

type PersistedAny =
  | PersistedV8
  | PersistedV2
  | PersistedV3
  | PersistedV4
  | PersistedV5
  | PersistedV6
  | PersistedV7
  | LegacyAttentionSnapshot
  | Record<string, unknown>;

const DEFAULT_SNAPSHOT: AttentionSystemSnapshot = { contexts: [] };

const normalizeTimestamp = (value?: string): string => {
  if (!value) {
    return new Date().toISOString();
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
};

const cloneChange = (change: AttentionCommitChange): AttentionCommitChange => ({ ...change });

const asUnknownRecord = (value: unknown): Record<string, unknown> => (value ?? {}) as Record<string, unknown>;

const sanitizeCommitMeta = (meta: Record<string, unknown>): AttentionCommit["meta"] => ({
  author: typeof meta.author === "string" ? meta.author : "unknown",
  source: typeof meta.source === "string" ? meta.source : "unknown",
  src: typeof meta.src === "string" ? meta.src : undefined,
  tags: Array.isArray(meta.tags) ? meta.tags.filter((tag): tag is string => typeof tag === "string") : undefined,
  createdAt: typeof meta.createdAt === "string" ? meta.createdAt : undefined,
});

const cloneSnapshot = (snapshot: AttentionSystemSnapshot): AttentionSystemSnapshot => ({
  contexts: snapshot.contexts.map((context) => ({
    ...context,
    template: context.template,
    slots: { ...(context.slots ?? {}) },
    scoreMap: { ...context.scoreMap },
    commits: context.commits.map((commit) => {
      const metaRecord = asUnknownRecord(commit.meta);
      return {
        ...commit,
        ingressType: commit.ingressType,
        target: commit.target,
        parentCommitIds: [...commit.parentCommitIds],
        meta: sanitizeCommitMeta(metaRecord),
        scores: { ...commit.scores },
        change: cloneChange(commit.change),
      };
    }),
    consumedPushCommitIds: [...context.consumedPushCommitIds],
  })),
});

const toContextSnapshot = (input: { contextId: string; owner: string; commits: AttentionCommit[] }): AttentionContextSnapshot => ({
  ...buildAttentionContextStateFromCommits(input),
  commits: input.commits.map((commit) => ({
    ...commit,
    ingressType: commit.ingressType,
    target: commit.target,
    parentCommitIds: [...commit.parentCommitIds],
    meta: sanitizeCommitMeta(asUnknownRecord(commit.meta)),
    scores: { ...commit.scores },
    change: cloneChange(commit.change),
  })),
});

const migrateV1ToV4 = (legacy: LegacyAttentionSnapshot): AttentionSystemSnapshot => {
    const commits: AttentionCommit[] = legacy.records.map((record) => ({
      commitId: `legacy-${record.id}`,
      contextId: "default",
      ingressType: "commit",
      parentCommitIds: [],
      meta: {
        author: record.from,
        source: "legacy-v1",
        createdAt: normalizeTimestamp(record.createdAt),
      },
      scores: { [`legacy-${record.id}`]: record.score },
    summary: record.content,
    change: record.remark
      ? { type: "update", value: record.remark, format: "text/plain" }
      : { type: "update", value: record.content, format: "text/plain" },
    createdAt: normalizeTimestamp(record.createdAt),
  }));
  return {
    contexts: [toContextSnapshot({ contextId: "default", owner: "agenter", commits })],
  };
};

const migrateV2ToV4 = (snapshot: PersistedV2): AttentionSystemSnapshot => ({
  contexts: snapshot.contexts.map((context) => {
    const commits: AttentionCommit[] = context.items.map((item) => ({
      commitId: item.id,
      contextId: context.id,
      ingressType: "commit",
      parentCommitIds: [],
      meta: {
        author: item.meta.from,
        source: typeof item.meta.source === "string" ? item.meta.source : "legacy-v2",
        src: sanitizeCommitMeta(item.meta).src,
        createdAt: normalizeTimestamp(item.createdAt),
      },
      scores: { ...item.scores },
      summary: item.title,
      change: item.context
        ? { type: "update", value: item.context, format: "text/plain" }
        : { type: "update", value: item.title, format: "text/plain" },
      createdAt: normalizeTimestamp(item.createdAt),
    }));
    return toContextSnapshot({ contextId: context.id, owner: context.owner, commits });
  }),
});

const migrateV3ToV4 = (snapshot: PersistedV3): AttentionSystemSnapshot => ({
  contexts: snapshot.contexts.map((context) => {
    const commits: AttentionCommit[] = context.items.map((item) => ({
      commitId: item.id,
      contextId: context.id,
      ingressType: "commit",
      parentCommitIds: [...item.parentIds],
      meta: {
        author: typeof item.meta.author === "string" ? item.meta.author : "legacy-v3",
        source: typeof item.meta.source === "string" ? item.meta.source : "legacy-v3",
        src: sanitizeCommitMeta(item.meta).src,
        createdAt: normalizeTimestamp(item.createdAt),
      },
      scores: { ...item.scores },
      summary: item.title,
      change: item.detail
        ? item.detail.kind === "patch"
          ? { type: "diff", value: item.detail.value, format: item.detail.format }
          : { type: "update", value: item.detail.value, format: item.detail.format }
        : { type: "update", value: item.title, format: "text/plain" },
      createdAt: normalizeTimestamp(item.createdAt),
    }));
    return toContextSnapshot({ contextId: context.id, owner: context.owner, commits });
  }),
});

const isV1 = (parsed: PersistedAny): parsed is LegacyAttentionSnapshot =>
  typeof parsed === "object" && parsed !== null && "records" in parsed && Array.isArray(parsed.records);

const isV2 = (parsed: PersistedAny): parsed is PersistedV2 =>
  typeof parsed === "object" && parsed !== null && "version" in parsed && parsed.version === 2 && "contexts" in parsed;

const isV3 = (parsed: PersistedAny): parsed is PersistedV3 =>
  typeof parsed === "object" && parsed !== null && "version" in parsed && parsed.version === 3 && "contexts" in parsed;

const isV4 = (parsed: PersistedAny): parsed is PersistedV4 =>
  typeof parsed === "object" && parsed !== null && "version" in parsed && parsed.version === 4 && "contexts" in parsed;

const isV5 = (parsed: PersistedAny): parsed is PersistedV5 =>
  typeof parsed === "object" && parsed !== null && "version" in parsed && parsed.version === 5 && "contexts" in parsed;

const isV6 = (parsed: PersistedAny): parsed is PersistedV6 =>
  typeof parsed === "object" && parsed !== null && "version" in parsed && parsed.version === 6 && "contexts" in parsed;

const isV7 = (parsed: PersistedAny): parsed is PersistedV7 =>
  typeof parsed === "object" && parsed !== null && "version" in parsed && parsed.version === 7 && "contexts" in parsed;

const isV8 = (parsed: PersistedAny): parsed is PersistedV8 =>
  typeof parsed === "object" && parsed !== null && "version" in parsed && parsed.version === 8 && "contexts" in parsed;

const migrateV4ToV5 = (snapshot: PersistedV4): AttentionSystemSnapshot => ({
  contexts: snapshot.contexts.map((context) => ({
    ...context,
    focusState: context.focusState ?? "focused",
    consumedPushCommitIds: [...(context.consumedPushCommitIds ?? [])],
    commits: context.commits.map((commit) => ({
      ...commit,
      ingressType: commit.ingressType ?? "commit",
      parentCommitIds: [...commit.parentCommitIds],
      meta: sanitizeCommitMeta(asUnknownRecord(commit.meta)),
      scores: { ...commit.scores },
      change: cloneChange(commit.change),
    })),
  })),
});

const migrateContextSnapshotToV8 = (context: AttentionContextSnapshot): AttentionContextSnapshot => {
  const commits = context.commits.map((commit) => ({
    ...commit,
    ingressType: commit.ingressType ?? "commit",
    target: commit.target,
    parentCommitIds: [...commit.parentCommitIds],
    meta: sanitizeCommitMeta(asUnknownRecord(commit.meta)),
    scores: { ...commit.scores },
    change: cloneChange(commit.change),
  }));
  return {
    ...buildAttentionContextStateFromCommits({
      contextId: context.contextId,
      owner: context.owner,
      commits,
      focusState: context.focusState,
      template: context.template,
      slots: context.slots,
      content: context.content,
      contentFormat: context.contentFormat,
      scoreMap: context.scoreMap,
      consumedPushCommitIds: context.consumedPushCommitIds,
      createdAt: context.createdAt,
      updatedAt: context.updatedAt,
    }),
    commits,
    commitCount: commits.length,
    commitsTruncated: false,
  };
};

export class AttentionStore {
  private writeQueue = Promise.resolve();

  constructor(private readonly rootDir: string) {}

  getStatePath(): string {
    return join(this.rootDir, "state.json");
  }

  async load(): Promise<AttentionSystemSnapshot> {
    try {
      const parsed = JSON.parse(await readFile(this.getStatePath(), "utf8")) as PersistedAny;
      if (isV8(parsed)) {
        return cloneSnapshot({ contexts: parsed.contexts.map(migrateContextSnapshotToV8) });
      }
      if (isV7(parsed)) {
        return cloneSnapshot({ contexts: parsed.contexts.map(migrateContextSnapshotToV8) });
      }
      if (isV6(parsed)) {
        return cloneSnapshot({ contexts: parsed.contexts.map(migrateContextSnapshotToV8) });
      }
      if (isV5(parsed)) {
        return cloneSnapshot({ contexts: parsed.contexts.map(migrateContextSnapshotToV8) });
      }
      if (isV4(parsed)) {
        return cloneSnapshot({ contexts: migrateV4ToV5(parsed).contexts.map(migrateContextSnapshotToV8) });
      }
      if (isV3(parsed)) {
        return cloneSnapshot({ contexts: migrateV3ToV4(parsed).contexts.map(migrateContextSnapshotToV8) });
      }
      if (isV2(parsed)) {
        return cloneSnapshot({ contexts: migrateV2ToV4(parsed).contexts.map(migrateContextSnapshotToV8) });
      }
      if (isV1(parsed)) {
        return cloneSnapshot({ contexts: migrateV1ToV4(parsed).contexts.map(migrateContextSnapshotToV8) });
      }
      return cloneSnapshot(DEFAULT_SNAPSHOT);
    } catch {
      return cloneSnapshot(DEFAULT_SNAPSHOT);
    }
  }

  async save(snapshot: AttentionSystemSnapshot): Promise<void> {
    const payload = JSON.stringify({ version: 8, contexts: snapshot.contexts } satisfies PersistedV8, null, 2);
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(this.rootDir, { recursive: true });
      const statePath = this.getStatePath();
      const tempPath = `${statePath}.${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`;
      await writeFile(tempPath, payload, "utf8");
      await rename(tempPath, statePath);
    });
    await this.writeQueue;
  }
}
