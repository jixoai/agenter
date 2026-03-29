import type { AttentionCommit, AttentionCommitInput, AttentionContextSnapshot, AttentionContextState } from "./attention-item";

export interface AttentionChangeUpdate {
  type: "update";
  value: string;
  format?: string;
}

export interface AttentionChangeDiff {
  type: "diff";
  value: string;
  format?: string;
}

export interface AttentionChangeClean {
  type: "clean";
}

export type AttentionCommitChange = AttentionChangeUpdate | AttentionChangeDiff | AttentionChangeClean;

export interface AttentionContextDescriptor {
  contextId: string;
  owner: string;
  headCommitId: string | null;
  unresolvedScoreCount: number;
  updatedAt: string;
}

export interface AttentionQueryInput {
  contextId?: string;
  hash?: string;
  depth?: number;
  minScore?: number;
  author?: string;
  source?: string;
  text?: string;
  offset?: number;
  limit?: number;
}

export interface AttentionCommitMatch {
  contextId: string;
  context: AttentionContextState;
  commit: AttentionCommit;
}

export interface AttentionActiveContextMatch {
  contextId: string;
  context: AttentionContextState;
  recentCommits: AttentionCommit[];
}

export interface AttentionContextRef {
  contextId: string;
}

export interface AttentionCommitRef {
  contextId: string;
  commitId: string;
}

export type AttentionProtocolMode = "none" | "bootstrap" | "delta" | "compact";

export interface AttentionCycleFrame {
  cycleId: number;
  seq: number;
  createdAt: number;
  wakeSource: string | null;
  protocolMode: AttentionProtocolMode;
  inputContextIds: string[];
  inputCommitRefs: AttentionCommitRef[];
  activeContextIds: string[];
  producedCommitRefs: AttentionCommitRef[];
  modelCallIds: number[];
  hookIds: string[];
}

export interface AttentionHookRecord {
  id: string;
  cycleId: number | null;
  hookId: string;
  systemId: string;
  contextId: string;
  commitId: string;
  status: "delivered" | "failed" | "ignored";
  createdAt: number;
  target?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
}

export interface AttentionCommitHookResult {
  hookId: string;
  systemId: string;
  status: "delivered" | "failed" | "ignored";
  target?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
}

export interface AttentionCommitToolInput extends AttentionCommitInput {
  contextId: string;
}

export interface LegacyAttentionRecord {
  id: number;
  content: string;
  from: string;
  score: number;
  remark: string;
  createdAt: string;
  updatedAt: string;
}

export interface LegacyAttentionSnapshot {
  nextId: number;
  records: LegacyAttentionRecord[];
}

export interface AttentionSystemSnapshot {
  contexts: AttentionContextSnapshot[];
}
