import type {
  AttentionActiveContextMatch,
  AttentionCommit,
  AttentionCommitChange,
  AttentionCycleFrame,
  AttentionHookRecord,
  AttentionSystemSnapshot,
} from "@agenter/attention-system";

import type { SessionRuntimeAttentionState } from "./session-runtime";

const MAX_RUNTIME_CONTEXT_COMMITS = 200;
const MAX_RUNTIME_ACTIVE_COMMITS = 12;
const MAX_RUNTIME_CONTEXT_CONTENT_CHARS = 2_048;
const MAX_RUNTIME_CHANGE_VALUE_CHARS = 256;

const truncateString = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}... [truncated ${value.length - maxChars} chars]`;
};

const projectAttentionChange = (change: AttentionCommitChange): AttentionCommitChange => {
  if (change.type === "clean") {
    return { type: "clean" };
  }
  return {
    ...change,
    value: truncateString(change.value, MAX_RUNTIME_CHANGE_VALUE_CHARS),
  };
};

const projectAttentionCommit = (commit: AttentionCommit): AttentionCommit => ({
  ...commit,
  parentCommitIds: [...commit.parentCommitIds],
  meta: {
    ...commit.meta,
    tags: Array.isArray(commit.meta.tags) ? [...commit.meta.tags] : undefined,
  },
  scores: { ...commit.scores },
  change: projectAttentionChange(commit.change),
});

const projectAttentionSnapshot = (snapshot: AttentionSystemSnapshot): AttentionSystemSnapshot => ({
  contexts: snapshot.contexts.map((context) => {
    const recentCommits = context.commits.slice(-MAX_RUNTIME_CONTEXT_COMMITS).map(projectAttentionCommit);
    return {
      ...context,
      content: truncateString(context.content, MAX_RUNTIME_CONTEXT_CONTENT_CHARS),
      scoreMap: { ...context.scoreMap },
      commits: recentCommits,
      commitCount: context.commits.length,
      commitsTruncated: recentCommits.length < context.commits.length,
    };
  }),
});

const projectAttentionActiveMatch = (match: AttentionActiveContextMatch): AttentionActiveContextMatch => ({
  contextId: match.contextId,
  context: {
    ...match.context,
    content: truncateString(match.context.content, MAX_RUNTIME_CONTEXT_CONTENT_CHARS),
    scoreMap: { ...match.context.scoreMap },
  },
  recentCommits: match.recentCommits.slice(-MAX_RUNTIME_ACTIVE_COMMITS).map(projectAttentionCommit),
});

const cloneCycleFrame = (frame: AttentionCycleFrame): AttentionCycleFrame => ({
  ...frame,
  protocolMode: frame.protocolMode ?? "none",
  inputCommitRefs: (frame.inputCommitRefs ?? []).map((ref) => ({ ...ref })),
  inputContextIds: [...frame.inputContextIds],
  activeContextIds: [...frame.activeContextIds],
  producedCommitRefs: frame.producedCommitRefs.map((ref) => ({ ...ref })),
  modelCallIds: [...frame.modelCallIds],
  hookIds: [...frame.hookIds],
});

const cloneHookRecord = (record: AttentionHookRecord): AttentionHookRecord => ({
  ...record,
  target: record.target ? { ...record.target } : undefined,
  output: record.output ? { ...record.output } : undefined,
});

export const createRuntimeAttentionPreview = (state: SessionRuntimeAttentionState): SessionRuntimeAttentionState => ({
  snapshot: projectAttentionSnapshot(state.snapshot),
  active: state.active.map(projectAttentionActiveMatch),
  cycleFrames: state.cycleFrames.map(cloneCycleFrame),
  hooks: state.hooks.map(cloneHookRecord),
});
