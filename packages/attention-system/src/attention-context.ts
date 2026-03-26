import { randomUUID } from "node:crypto";

import type {
  AttentionCommit,
  AttentionCommitInput,
  AttentionCommitMeta,
  AttentionContextSnapshot,
  AttentionContextState,
} from "./attention-item";
import type { AttentionCommitChange, AttentionCommitMatch, AttentionQueryInput } from "./attention-types";

const MAX_SCORE = 100;
const MIN_SCORE = 0;

const nowIso = (): string => new Date().toISOString();
const generateCommitId = (): string => `commit-${randomUUID()}`;

export const normalizeAttentionScore = (score: number): number => {
  const normalized = Number.isFinite(score) ? Math.trunc(score) : 0;
  if (normalized < MIN_SCORE) {
    return MIN_SCORE;
  }
  if (normalized > MAX_SCORE) {
    return MAX_SCORE;
  }
  return normalized;
};

export const normalizeAttentionScores = (scores: Record<string, number>): Record<string, number> => {
  const next: Record<string, number> = {};
  for (const [key, value] of Object.entries(scores)) {
    next[key] = normalizeAttentionScore(value);
  }
  return next;
};

const cloneMeta = (meta: AttentionCommitMeta): AttentionCommitMeta => ({
  ...meta,
  tags: Array.isArray(meta.tags) ? [...meta.tags] : undefined,
});

const cloneChange = (change: AttentionCommitChange): AttentionCommitChange => ({ ...change });

const cloneCommit = (commit: AttentionCommit): AttentionCommit => ({
  ...commit,
  parentCommitIds: [...commit.parentCommitIds],
  meta: cloneMeta(commit.meta),
  scores: { ...commit.scores },
  change: cloneChange(commit.change),
});

const cloneState = (state: AttentionContextState): AttentionContextState => ({
  ...state,
  scoreMap: { ...state.scoreMap },
});

const splitLines = (value: string): string[] => (value.length === 0 ? [] : value.split("\n"));

const applyUnifiedDiff = (base: string, diffText: string): string => {
  const baseLines = splitLines(base);
  const diffLines = diffText.split("\n");
  const result: string[] = [];
  const hunkPattern = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
  let baseIndex = 0;
  let inHunk = false;

  for (const line of diffLines) {
    const hunk = line.match(hunkPattern);
    if (hunk) {
      inHunk = true;
      const oldStart = Math.max(1, Number.parseInt(hunk[1] ?? "1", 10));
      while (baseIndex < oldStart - 1 && baseIndex < baseLines.length) {
        result.push(baseLines[baseIndex] ?? "");
        baseIndex += 1;
      }
      continue;
    }
    if (!inHunk || line.startsWith("\\")) {
      continue;
    }
    const marker = line[0] ?? " ";
    const content = line.slice(1);
    if (marker === " ") {
      result.push(baseLines[baseIndex] ?? content);
      baseIndex += 1;
      continue;
    }
    if (marker === "-") {
      baseIndex += 1;
      continue;
    }
    if (marker === "+") {
      result.push(content);
    }
  }

  while (baseIndex < baseLines.length) {
    result.push(baseLines[baseIndex] ?? "");
    baseIndex += 1;
  }

  return result.join("\n");
};

export const applyAttentionChange = (
  state: AttentionContextState,
  change: AttentionCommitChange,
): AttentionContextState => {
  if (change.type === "update") {
    return {
      ...state,
      content: change.value,
      contentFormat: change.format ?? state.contentFormat,
    };
  }
  if (change.type === "diff") {
    return {
      ...state,
      content: applyUnifiedDiff(state.content, change.value),
      contentFormat: change.format ?? state.contentFormat,
    };
  }
  return {
    ...state,
    content: "",
  };
};

const matchesText = (commit: AttentionCommit, query: string): boolean => {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) {
    return true;
  }
  const haystacks = [
    commit.summary,
    commit.change.type === "clean" ? "" : commit.change.value,
    JSON.stringify(commit.meta),
  ];
  return haystacks.some((value) => value.toLowerCase().includes(normalized));
};

const uniqueCommits = (commits: AttentionCommit[]): AttentionCommit[] => {
  const seen = new Set<string>();
  const next: AttentionCommit[] = [];
  for (const commit of commits) {
    if (seen.has(commit.commitId)) {
      continue;
    }
    seen.add(commit.commitId);
    next.push(commit);
  }
  return next;
};

export interface AttentionContextConfig {
  contextId: string;
  owner: string;
  content?: string;
  contentFormat?: string;
  scoreMap?: Record<string, number>;
  createdAt?: string;
  updatedAt?: string;
}

export const buildAttentionContextStateFromCommits = (input: {
  contextId: string;
  owner: string;
  commits: AttentionCommit[];
  createdAt?: string;
  updatedAt?: string;
  content?: string;
  contentFormat?: string;
  scoreMap?: Record<string, number>;
}): AttentionContextState => {
  const createdAt = input.createdAt ?? input.commits[0]?.createdAt ?? nowIso();
  let state: AttentionContextState = {
    contextId: input.contextId,
    owner: input.owner,
    content: input.content ?? "",
    contentFormat: input.contentFormat,
    scoreMap: normalizeAttentionScores(input.scoreMap ?? {}),
    headCommitId: null,
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
  };

  for (const commit of input.commits) {
    state = applyAttentionChange(state, commit.change);
    state = {
      ...state,
      scoreMap: {
        ...state.scoreMap,
        ...normalizeAttentionScores(commit.scores),
      },
      headCommitId: commit.commitId,
      updatedAt: commit.createdAt,
    };
  }

  return state;
};

export class AttentionContext {
  readonly contextId: string;
  readonly owner: string;
  private state: AttentionContextState;
  private readonly commits = new Map<string, AttentionCommit>();
  private readonly commitOrder: string[] = [];
  private readonly changeListeners = new Set<(commit: AttentionCommit, context: AttentionContextState) => void>();

  constructor(config: AttentionContextConfig, snapshot?: AttentionContextSnapshot) {
    this.contextId = snapshot?.contextId ?? config.contextId;
    this.owner = snapshot?.owner ?? config.owner;

    if (snapshot) {
      this.state = cloneState({
        contextId: snapshot.contextId,
        owner: snapshot.owner,
        content: snapshot.content,
        contentFormat: snapshot.contentFormat,
        scoreMap: snapshot.scoreMap,
        headCommitId: snapshot.headCommitId,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
      });
      for (const commit of snapshot.commits) {
        this.commits.set(commit.commitId, cloneCommit(commit));
        this.commitOrder.push(commit.commitId);
      }
      return;
    }

    const createdAt = config.createdAt ?? nowIso();
    this.state = {
      contextId: this.contextId,
      owner: this.owner,
      content: config.content ?? "",
      contentFormat: config.contentFormat,
      scoreMap: normalizeAttentionScores(config.scoreMap ?? {}),
      headCommitId: null,
      createdAt,
      updatedAt: config.updatedAt ?? createdAt,
    };
  }

  commit(input: AttentionCommitInput): { context: AttentionContextState; commit: AttentionCommit } {
    const createdAt = nowIso();
    const commit: AttentionCommit = {
      commitId: generateCommitId(),
      contextId: this.contextId,
      parentCommitIds: input.parentCommitIds?.length
        ? [...input.parentCommitIds]
        : this.state.headCommitId
          ? [this.state.headCommitId]
          : [],
      meta: cloneMeta({
        author: typeof input.meta?.author === "string" && input.meta.author.length > 0 ? input.meta.author : this.owner,
        source:
          typeof input.meta?.source === "string" && input.meta.source.length > 0 ? input.meta.source : "attention",
        ...(input.meta ?? {}),
        createdAt,
      }),
      scores: normalizeAttentionScores(input.scores ?? {}),
      summary: input.summary.trim(),
      change: cloneChange(input.change),
      createdAt,
    };

    let nextState = cloneState(this.state);
    nextState = applyAttentionChange(nextState, commit.change);
    nextState = {
      ...nextState,
      scoreMap: {
        ...nextState.scoreMap,
        ...commit.scores,
      },
      headCommitId: commit.commitId,
      updatedAt: createdAt,
    };

    this.state = nextState;
    this.commits.set(commit.commitId, commit);
    this.commitOrder.push(commit.commitId);
    this.emit(commit);

    return {
      context: this.getState(),
      commit: cloneCommit(commit),
    };
  }

  getState(): AttentionContextState {
    return cloneState(this.state);
  }

  getCommit(commitId: string): AttentionCommit | undefined {
    const commit = this.commits.get(commitId);
    return commit ? cloneCommit(commit) : undefined;
  }

  listCommits(): AttentionCommit[] {
    return this.commitOrder.map((commitId) => cloneCommit(this.commits.get(commitId)!));
  }

  listRecentCommits(limit = 12): AttentionCommit[] {
    return this.commitOrder.slice(-Math.max(1, limit)).map((commitId) => cloneCommit(this.commits.get(commitId)!));
  }

  listActiveScores(minScore = 1): Record<string, number> {
    return Object.fromEntries(
      Object.entries(this.state.scoreMap).filter(([, value]) => value >= Math.max(0, Math.trunc(minScore))),
    );
  }

  isActive(minScore = 1): boolean {
    return Object.keys(this.listActiveScores(minScore)).length > 0;
  }

  unresolvedScoreCount(minScore = 1): number {
    return Object.keys(this.listActiveScores(minScore)).length;
  }

  queryCommits(input: AttentionQueryInput = {}): AttentionCommitMatch[] {
    const minScore = Math.max(0, Math.trunc(input.minScore ?? 1));
    const sourceCommits = input.hash
      ? this.queryRelatedByHash(input.hash, input.depth ?? 3, minScore)
      : this.listCommits().filter((commit) => {
          if (minScore <= 0) {
            return true;
          }
          return Object.keys(commit.scores).some((hash) => (this.state.scoreMap[hash] ?? 0) >= minScore);
        });

    let matches = sourceCommits;
    if (input.author) {
      matches = matches.filter((commit) => commit.meta.author === input.author);
    }
    if (input.source) {
      matches = matches.filter((commit) => commit.meta.source === input.source);
    }
    const queryText = input.text;
    if (queryText) {
      matches = matches.filter((commit) => matchesText(commit, queryText));
    }

    const commitOrderIndex = new Map(this.commitOrder.map((commitId, index) => [commitId, index]));
    matches.sort((left, right) => {
      const leftTime = Date.parse(left.createdAt);
      const rightTime = Date.parse(right.createdAt);
      if (leftTime !== rightTime) {
        return rightTime - leftTime;
      }
      return (commitOrderIndex.get(right.commitId) ?? -1) - (commitOrderIndex.get(left.commitId) ?? -1);
    });

    const offset = Math.max(0, Math.trunc(input.offset ?? 0));
    const limit = Math.max(1, Math.trunc(input.limit ?? (matches.length || 1)));
    return matches.slice(offset, offset + limit).map((commit) => ({
      contextId: this.contextId,
      context: this.getState(),
      commit,
    }));
  }

  onChange(listener: (commit: AttentionCommit, context: AttentionContextState) => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  snapshot(): AttentionContextSnapshot {
    const commits = this.listCommits();
    return {
      ...this.getState(),
      commits,
      commitCount: commits.length,
      commitsTruncated: false,
    };
  }

  private emit(commit: AttentionCommit): void {
    const clonedCommit = cloneCommit(commit);
    const clonedState = this.getState();
    for (const listener of this.changeListeners) {
      listener(clonedCommit, clonedState);
    }
  }

  private queryRelatedByHash(hash: string, depth: number, minScore: number): AttentionCommit[] {
    const allCommits = this.listCommits();
    const effectiveDepth = Math.max(1, Math.trunc(depth));
    const related: AttentionCommit[] = [];
    const visitedCommitIds = new Set<string>();
    let frontier = new Set<string>([hash]);

    for (let level = 0; level < effectiveDepth && frontier.size > 0; level += 1) {
      const nextFrontier = new Set<string>();
      for (const currentHash of frontier) {
        if (minScore > 0 && (this.state.scoreMap[currentHash] ?? 0) < minScore) {
          continue;
        }
        for (const commit of allCommits) {
          if (!(currentHash in commit.scores) || visitedCommitIds.has(commit.commitId)) {
            continue;
          }
          visitedCommitIds.add(commit.commitId);
          related.push(commit);
          for (const linkedHash of Object.keys(commit.scores)) {
            if (linkedHash !== currentHash) {
              nextFrontier.add(linkedHash);
            }
          }
        }
      }
      frontier = nextFrontier;
    }

    return uniqueCommits(related);
  }
}
