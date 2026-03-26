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

type PersistedAny = PersistedV2 | PersistedV3 | PersistedV4 | LegacyAttentionSnapshot | Record<string, unknown>;

const DEFAULT_SNAPSHOT: AttentionSystemSnapshot = { contexts: [] };

const normalizeTimestamp = (value?: string): string => {
  if (!value) {
    return new Date().toISOString();
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
};

const cloneChange = (change: AttentionCommitChange): AttentionCommitChange => ({ ...change });

const cloneSnapshot = (snapshot: AttentionSystemSnapshot): AttentionSystemSnapshot => ({
  contexts: snapshot.contexts.map((context) => ({
    ...context,
    scoreMap: { ...context.scoreMap },
    commits: context.commits.map((commit) => ({
      ...commit,
      parentCommitIds: [...commit.parentCommitIds],
      meta: { ...commit.meta, tags: Array.isArray(commit.meta.tags) ? [...commit.meta.tags] : undefined },
      scores: { ...commit.scores },
      change: cloneChange(commit.change),
    })),
  })),
});

const toContextSnapshot = (input: { contextId: string; owner: string; commits: AttentionCommit[] }): AttentionContextSnapshot => ({
  ...buildAttentionContextStateFromCommits(input),
  commits: input.commits.map((commit) => ({
    ...commit,
    parentCommitIds: [...commit.parentCommitIds],
    meta: { ...commit.meta, tags: Array.isArray(commit.meta.tags) ? [...commit.meta.tags] : undefined },
    scores: { ...commit.scores },
    change: cloneChange(commit.change),
  })),
});

const migrateV1ToV4 = (legacy: LegacyAttentionSnapshot): AttentionSystemSnapshot => {
  const commits: AttentionCommit[] = legacy.records.map((record) => ({
    commitId: `legacy-${record.id}`,
    contextId: "default",
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
      parentCommitIds: [],
      meta: {
        author: item.meta.from,
        source: typeof item.meta.source === "string" ? item.meta.source : "legacy-v2",
        systemId: typeof item.meta.systemId === "string" ? item.meta.systemId : undefined,
        subjectId: typeof item.meta.subjectId === "string" ? item.meta.subjectId : undefined,
        channelId: typeof item.meta.channelId === "string" ? item.meta.channelId : undefined,
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
      parentCommitIds: [...item.parentIds],
      meta: {
        author: typeof item.meta.author === "string" ? item.meta.author : "legacy-v3",
        source: typeof item.meta.source === "string" ? item.meta.source : "legacy-v3",
        systemId: typeof item.meta.systemId === "string" ? item.meta.systemId : undefined,
        subjectId: typeof item.meta.subjectId === "string" ? item.meta.subjectId : undefined,
        channelId: typeof item.meta.channelId === "string" ? item.meta.channelId : undefined,
        createdAt: normalizeTimestamp(item.createdAt),
        ...item.meta,
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

export class AttentionStore {
  private writeQueue = Promise.resolve();

  constructor(private readonly rootDir: string) {}

  getStatePath(): string {
    return join(this.rootDir, "state.json");
  }

  async load(): Promise<AttentionSystemSnapshot> {
    try {
      const parsed = JSON.parse(await readFile(this.getStatePath(), "utf8")) as PersistedAny;
      if (isV4(parsed)) {
        return cloneSnapshot({ contexts: parsed.contexts });
      }
      if (isV3(parsed)) {
        return migrateV3ToV4(parsed);
      }
      if (isV2(parsed)) {
        return migrateV2ToV4(parsed);
      }
      if (isV1(parsed)) {
        return migrateV1ToV4(parsed);
      }
      return cloneSnapshot(DEFAULT_SNAPSHOT);
    } catch {
      return cloneSnapshot(DEFAULT_SNAPSHOT);
    }
  }

  async save(snapshot: AttentionSystemSnapshot): Promise<void> {
    const payload = JSON.stringify({ version: 4, contexts: snapshot.contexts } satisfies PersistedV4, null, 2);
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
