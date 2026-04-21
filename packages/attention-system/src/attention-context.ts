import { randomUUID } from "node:crypto";

import type {
  AttentionCommit,
  AttentionCommitInput,
  AttentionCommitMeta,
  AttentionContextSnapshot,
  AttentionContextState,
  AttentionFocusState,
} from "./attention-item";
import {
  deriveAttentionContextContent,
  getAttentionContextTemplateSlot,
  initializeAttentionContextSlots,
  normalizeAttentionContextTemplate,
} from "./attention-context-template";
import type { AttentionCommitChange, AttentionCommitMatch, AttentionQueryInput } from "./attention-types";

const MAX_SCORE = 100;
const MIN_SCORE = 0;
const DEFAULT_ATTENTION_COMMIT_TARGET = "default";

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

const resolveAttentionCommitTarget = (target?: string): string => {
  const normalized = target?.trim();
  return normalized && normalized.length > 0 ? normalized : DEFAULT_ATTENTION_COMMIT_TARGET;
};

const cloneMeta = (meta: AttentionCommitMeta): AttentionCommitMeta => ({
  ...meta,
  tags: Array.isArray(meta.tags) ? [...meta.tags] : undefined,
});

const cloneChange = (change: AttentionCommitChange): AttentionCommitChange => ({ ...change });
const hasNotificationTag = (meta: AttentionCommitMeta): boolean =>
  Array.isArray(meta.tags) && meta.tags.includes("notification");

const cloneCommit = (commit: AttentionCommit): AttentionCommit => ({
  ...commit,
  target: commit.target,
  parentCommitIds: [...commit.parentCommitIds],
  meta: cloneMeta(commit.meta),
  scores: { ...commit.scores },
  change: cloneChange(commit.change),
});

const cloneState = (state: AttentionContextState): AttentionContextState => ({
  ...state,
  template: normalizeAttentionContextTemplate(state.template),
  slots: { ...(state.slots ?? {}) },
  scoreMap: { ...state.scoreMap },
  consumedPushCommitIds: [...state.consumedPushCommitIds],
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

const buildAttentionContextState = (input: {
  contextId: string;
  owner: string;
  focusState?: AttentionFocusState;
  template?: string;
  slots?: Record<string, string>;
  content?: string;
  contentFormat?: string;
  scoreMap?: Record<string, number>;
  consumedPushCommitIds?: string[];
  headCommitId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}): AttentionContextState => {
  const createdAt = input.createdAt ?? nowIso();
  const template = normalizeAttentionContextTemplate(input.template);
  const slots = initializeAttentionContextSlots({
    template,
    slots: input.slots,
    legacyContent: input.content,
  });
  return {
    contextId: input.contextId,
    owner: input.owner,
    focusState: input.focusState ?? "focused",
    template,
    slots,
    content: deriveAttentionContextContent(template, slots),
    contentFormat: input.contentFormat,
    scoreMap: normalizeAttentionScores(input.scoreMap ?? {}),
    consumedPushCommitIds: [...(input.consumedPushCommitIds ?? [])],
    headCommitId: input.headCommitId ?? null,
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
  };
};

export const applyAttentionChange = (
  state: AttentionContextState,
  change: AttentionCommitChange,
  input: {
    target?: string;
    allowReadonly?: boolean;
  } = {},
): AttentionContextState => {
  const target = resolveAttentionCommitTarget(input.target);
  const template = normalizeAttentionContextTemplate(state.template);
  const slot = getAttentionContextTemplateSlot(template, target);
  if (!slot) {
    throw new Error(`attention slot "${target}" not found`);
  }
  if (slot.readonly && input.allowReadonly !== true) {
    throw new Error(`attention slot "${target}" is readonly`);
  }

  const currentValue = state.slots?.[target] ?? "";
  const nextValue =
    change.type === "update" ? change.value : change.type === "diff" ? applyUnifiedDiff(currentValue, change.value) : "";
  const nextSlots = {
    ...(state.slots ?? {}),
    [target]: nextValue,
  };

  return {
    ...state,
    template,
    slots: nextSlots,
    content: deriveAttentionContextContent(template, nextSlots),
    contentFormat: change.type === "clean" ? state.contentFormat : change.format ?? state.contentFormat,
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
  focusState?: AttentionFocusState;
  template?: string;
  slots?: Record<string, string>;
  content?: string;
  contentFormat?: string;
  scoreMap?: Record<string, number>;
  consumedPushCommitIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export const buildAttentionContextStateFromCommits = (input: {
  contextId: string;
  owner: string;
  commits: AttentionCommit[];
  focusState?: AttentionFocusState;
  template?: string;
  slots?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
  content?: string;
  contentFormat?: string;
  scoreMap?: Record<string, number>;
  consumedPushCommitIds?: string[];
}): AttentionContextState => {
  const createdAt = input.createdAt ?? input.commits[0]?.createdAt ?? nowIso();
  let state = buildAttentionContextState({
    contextId: input.contextId,
    owner: input.owner,
    focusState: input.focusState,
    template: input.template,
    slots: input.slots,
    content: input.content,
    contentFormat: input.contentFormat,
    scoreMap: input.scoreMap,
    consumedPushCommitIds: input.consumedPushCommitIds,
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
  });

  for (const commit of input.commits) {
    state = applyAttentionChange(state, commit.change, {
      target: commit.target,
      allowReadonly: true,
    });
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
      for (const commit of snapshot.commits) {
        this.commits.set(commit.commitId, cloneCommit(commit));
        this.commitOrder.push(commit.commitId);
      }
      this.state = buildAttentionContextStateFromCommits({
        contextId: snapshot.contextId,
        owner: snapshot.owner,
        commits: snapshot.commits,
        focusState: snapshot.focusState,
        template: snapshot.template,
        slots: snapshot.slots,
        content: snapshot.content,
        contentFormat: snapshot.contentFormat,
        scoreMap: snapshot.scoreMap,
        consumedPushCommitIds: snapshot.consumedPushCommitIds,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
      });
      return;
    }

    this.state = buildAttentionContextState({
      contextId: this.contextId,
      owner: this.owner,
      focusState: config.focusState,
      template: config.template,
      slots: config.slots,
      content: config.content,
      contentFormat: config.contentFormat,
      scoreMap: config.scoreMap,
      consumedPushCommitIds: config.consumedPushCommitIds,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    });
  }

  commit(input: AttentionCommitInput): { context: AttentionContextState; commit: AttentionCommit } {
    return this.commitWithPolicy(input, { allowReadonly: false });
  }

  commitSystem(input: AttentionCommitInput): { context: AttentionContextState; commit: AttentionCommit } {
    return this.commitWithPolicy(input, { allowReadonly: true });
  }

  setFocusState(focusState: AttentionFocusState): AttentionContextState {
    if (this.state.focusState === focusState) {
      return this.getState();
    }
    this.state = {
      ...this.state,
      focusState,
      updatedAt: nowIso(),
    };
    return this.getState();
  }

  listPushCommits(input: { includeConsumed?: boolean; limit?: number } = {}): AttentionCommit[] {
    const includeConsumed = input.includeConsumed ?? false;
    const consumed = new Set(this.state.consumedPushCommitIds);
    const commits = this.commitOrder
      .map((commitId) => this.commits.get(commitId)!)
      .filter((commit) => commit.ingressType === "push")
      .filter((commit) => includeConsumed || !consumed.has(commit.commitId))
      .map((commit) => cloneCommit(commit));
    const limit = input.limit;
    if (typeof limit === "number" && limit > 0 && commits.length > limit) {
      return commits.slice(-limit);
    }
    return commits;
  }

  consumePushes(commitIds?: readonly string[]): AttentionCommit[] {
    const candidateIds =
      commitIds && commitIds.length > 0
        ? commitIds.filter((commitId) => this.commits.get(commitId)?.ingressType === "push")
        : this.commitOrder.filter((commitId) => this.commits.get(commitId)?.ingressType === "push");
    if (candidateIds.length === 0) {
      return [];
    }
    const consumed = new Set(this.state.consumedPushCommitIds);
    const newlyConsumed: AttentionCommit[] = [];
    for (const commitId of candidateIds) {
      if (consumed.has(commitId)) {
        continue;
      }
      const commit = this.commits.get(commitId);
      if (!commit || commit.ingressType !== "push") {
        continue;
      }
      consumed.add(commitId);
      newlyConsumed.push(cloneCommit(commit));
    }
    if (newlyConsumed.length === 0) {
      return [];
    }
    this.state = {
      ...this.state,
      consumedPushCommitIds: [...consumed],
      updatedAt: nowIso(),
    };
    return newlyConsumed;
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
    const latestByHash = new Map<
      string,
      { score: number; ingressType: AttentionCommit["ingressType"]; commitId: string; notification: boolean }
    >();
    for (const commitId of this.commitOrder) {
      const commit = this.commits.get(commitId)!;
      for (const [hash, score] of Object.entries(commit.scores)) {
        latestByHash.set(hash, {
          score,
          ingressType: commit.ingressType,
          commitId: commit.commitId,
          notification: hasNotificationTag(commit.meta),
        });
      }
    }
    const consumedPushCommitIds = new Set(this.state.consumedPushCommitIds);
    return Object.fromEntries(
      [...latestByHash.entries()]
        .filter(([, value]) => {
          if (value.score < Math.max(0, Math.trunc(minScore))) {
            return false;
          }
          if (value.ingressType === "commit") {
            return true;
          }
          if (consumedPushCommitIds.has(value.commitId)) {
            return false;
          }
          if (value.notification) {
            return true;
          }
          return this.state.focusState !== "muted";
        })
        .map(([hash, value]) => [hash, value.score]),
    );
  }

  isActive(minScore = 1): boolean {
    return Object.keys(this.listActiveScores(minScore)).length > 0;
  }

  unresolvedScoreCount(minScore = 1): number {
    return Object.keys(this.listActiveScores(minScore)).length;
  }

  pendingPushCount(): number {
    return this.listPushCommits().length;
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
    if (input.text) {
      matches = matches.filter((commit) => matchesText(commit, input.text));
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

  private commitWithPolicy(
    input: AttentionCommitInput,
    options: {
      allowReadonly: boolean;
    },
  ): { context: AttentionContextState; commit: AttentionCommit } {
    const createdAt = nowIso();
    const commit: AttentionCommit = {
      commitId: generateCommitId(),
      contextId: this.contextId,
      ingressType: input.ingressType ?? "commit",
      target: resolveAttentionCommitTarget(input.target),
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
    nextState = applyAttentionChange(nextState, commit.change, {
      target: commit.target,
      allowReadonly: options.allowReadonly,
    });
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
