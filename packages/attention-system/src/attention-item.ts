import type { AttentionCommitChange } from "./attention-types";

export type AttentionFocusState = "focused" | "background" | "muted";
export type AttentionIngressType = "commit" | "push";

export interface AttentionCommitMeta {
  author: string;
  source: string;
  src?: string;
  tags?: string[];
  createdAt?: string;
}

export interface AttentionCommit {
  commitId: string;
  contextId: string;
  ingressType: AttentionIngressType;
  parentCommitIds: string[];
  meta: AttentionCommitMeta;
  scores: Record<string, number>;
  summary: string;
  change: AttentionCommitChange;
  createdAt: string;
}

export interface AttentionContextState {
  contextId: string;
  owner: string;
  focusState: AttentionFocusState;
  content: string;
  contentFormat?: string;
  scoreMap: Record<string, number>;
  consumedPushCommitIds: string[];
  headCommitId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttentionContextSnapshot extends AttentionContextState {
  commits: AttentionCommit[];
  commitCount?: number;
  commitsTruncated?: boolean;
}

export interface AttentionCommitInput {
  ingressType?: AttentionIngressType;
  parentCommitIds?: string[];
  meta?: Partial<AttentionCommitMeta>;
  scores?: Record<string, number>;
  summary: string;
  change: AttentionCommitChange;
}
