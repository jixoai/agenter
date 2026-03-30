import type { AttentionCommitMatch, AttentionSystem } from "@agenter/attention-system";
import type { SearchSyntaxNode } from "@agenter/search-syntax";

export interface AttentionSearchRequest {
  query?: string;
  offset?: number;
  limit?: number;
}

export interface AttentionSearchDocument {
  commitKey: string;
  contextId: string;
  commitId: string;
  author: string;
  source: string;
  summary: string;
  changeType: string;
  changeValue: string;
  metaJson: string;
  searchText: string;
  createdAtMs: number;
  updatedAtMs: number;
  unresolvedScoreCount: number;
  maxActiveScore: number;
  scoreKeys: string[];
}

export interface AttentionSearchSeed {
  value: string;
  field?: "summary" | "change" | "text" | "author" | "source" | "context";
}

export interface AttentionSearchControls {
  contextId?: string;
  hash?: string;
  depth?: number;
  minScore?: number;
  author?: string;
  source?: string;
}

export interface CompiledAttentionSearch {
  ast: SearchSyntaxNode;
  controls: AttentionSearchControls;
  seeds: AttentionSearchSeed[];
  useFts: boolean;
  evaluate: (doc: AttentionSearchDocument) => boolean;
}

export interface AttentionSearchExecutionContext {
  attentionSystem: AttentionSystem;
  baseMatches: AttentionCommitMatch[];
}
