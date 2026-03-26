import type { AttentionCommitChange } from "./attention-types";

export interface AttentionCommitMeta {
  author: string;
  source: string;
  systemId?: string;
  subjectId?: string;
  channelId?: string;
  tags?: string[];
  createdAt?: string;
  [key: string]: unknown;
}

export interface AttentionCommit {
  commitId: string;
  contextId: string;
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
  content: string;
  contentFormat?: string;
  scoreMap: Record<string, number>;
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
  parentCommitIds?: string[];
  meta?: Partial<AttentionCommitMeta>;
  scores?: Record<string, number>;
  summary: string;
  change: AttentionCommitChange;
}
