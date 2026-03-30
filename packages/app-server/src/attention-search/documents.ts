import type { AttentionCommitMatch } from "@agenter/attention-system";

import type { AttentionSearchDocument } from "./types";

export const toAttentionCommitKey = (contextId: string, commitId: string): string => `${contextId}:${commitId}`;

export const buildAttentionSearchDocument = (match: AttentionCommitMatch): AttentionSearchDocument => {
  const changeValue = "value" in match.commit.change && typeof match.commit.change.value === "string" ? match.commit.change.value : "";
  const metaJson = JSON.stringify(match.commit.meta);
  const activeScores = Object.values(match.context.scoreMap).filter((value) => value >= 1);
  const searchText = [
    match.contextId,
    match.commit.commitId,
    match.commit.meta.author,
    match.commit.meta.source,
    match.commit.summary,
    changeValue,
    metaJson,
  ]
    .filter((value) => value.length > 0)
    .join("\n");
  return {
    commitKey: toAttentionCommitKey(match.contextId, match.commit.commitId),
    contextId: match.contextId,
    commitId: match.commit.commitId,
    author: match.commit.meta.author,
    source: match.commit.meta.source,
    summary: match.commit.summary,
    changeType: match.commit.change.type,
    changeValue,
    metaJson,
    searchText,
    createdAtMs: Date.parse(match.commit.createdAt),
    updatedAtMs: Date.parse(match.context.updatedAt),
    unresolvedScoreCount: activeScores.length,
    maxActiveScore: activeScores.length === 0 ? 0 : Math.max(...activeScores),
    scoreKeys: Object.keys(match.commit.scores),
  };
};

export const buildAttentionSearchDocuments = (matches: readonly AttentionCommitMatch[]): AttentionSearchDocument[] =>
  matches.map(buildAttentionSearchDocument);
