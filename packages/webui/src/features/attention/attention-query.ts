import { diagnoseSearchSyntax, parseSearchSyntax, type SearchSyntaxNode, type SearchSyntaxTextNode } from "@agenter/search-syntax";
import type { AttentionQueryItem, RuntimeAttentionState } from "@agenter/client-sdk";

import type { AttentionCommitView, AttentionContextView } from "./attention-view-model";

export interface ParsedAttentionQuery {
  raw: string;
  ast: SearchSyntaxNode;
}

interface LocalQueryControls {
  contextId?: string;
  hash?: string;
  depth?: number;
  minScore?: number;
}

interface LocalSearchDocument {
  contextId: string;
  commitId: string;
  author: string;
  source: string;
  summary: string;
  changeValue: string;
  metaJson: string;
  searchText: string;
  createdAtMs: number;
  updatedAtMs: number;
  unresolvedScoreCount: number;
  maxActiveScore: number;
  scoreKeys: string[];
}

const matchesMinScore = (scores: Record<string, number>, minScore: number): boolean =>
  Object.values(scores).some((score) => score >= minScore);

const compareQueryItems = (left: AttentionQueryItem, right: AttentionQueryItem): number => {
  const leftTime = Date.parse(left.commit.createdAt);
  const rightTime = Date.parse(right.commit.createdAt);
  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }
  return left.commit.commitId.localeCompare(right.commit.commitId);
};

const toCommitMatches = (
  contexts: AttentionContextView[],
): Array<{ contextId: string; context: AttentionContextView; commit: AttentionCommitView }> =>
  contexts.flatMap((context) =>
    context.commits.map((commit) => ({
      contextId: context.contextId,
      context,
      commit,
    })),
  );

const queryRelatedLocally = (
  items: AttentionQueryItem[],
  hash: string,
  input: { depth: number; minScore: number },
): AttentionQueryItem[] => {
  const visited = new Set<string>();
  const matches: AttentionQueryItem[] = [];
  let frontier = new Set<string>([hash]);

  for (let level = 0; level < input.depth && frontier.size > 0; level += 1) {
    const next = new Set<string>();
    for (const currentHash of frontier) {
      for (const match of items) {
        const commitKey = `${match.contextId}:${match.commit.commitId}`;
        if (!(currentHash in match.commit.scores) || visited.has(commitKey)) {
          continue;
        }
        if (!matchesMinScore(match.context.scoreMap, input.minScore)) {
          continue;
        }
        visited.add(commitKey);
        matches.push(match);
        for (const linkedHash of Object.keys(match.commit.scores)) {
          if (linkedHash !== currentHash) {
            next.add(linkedHash);
          }
        }
      }
    }
    frontier = next;
  }

  return matches;
};

const normalize = (value: string): string => value.trim().toLowerCase();

const parseInteger = (value: string): number | undefined => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
};

const parseDateLike = (value: string): number | undefined => {
  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) {
    return asNumber;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const buildDocument = (item: AttentionQueryItem): LocalSearchDocument => {
  const changeValue = "value" in item.commit.change && typeof item.commit.change.value === "string" ? item.commit.change.value : "";
  const metaJson = JSON.stringify(item.commit.meta);
  const activeScores = Object.values(item.context.scoreMap).filter((value) => value >= 1);
  return {
    contextId: item.contextId,
    commitId: item.commit.commitId,
    author: item.commit.meta.author,
    source: item.commit.meta.source,
    summary: item.commit.summary,
    changeValue,
    metaJson,
    searchText: [item.contextId, item.commit.summary, changeValue, metaJson, item.commit.meta.author, item.commit.meta.source].join("\n"),
    createdAtMs: Date.parse(item.commit.createdAt),
    updatedAtMs: Date.parse(item.context.updatedAt),
    unresolvedScoreCount: activeScores.length,
    maxActiveScore: activeScores.length === 0 ? 0 : Math.max(...activeScores),
    scoreKeys: Object.keys(item.commit.scores),
  };
};

const textContains = (haystack: string, needle: string, quoted: boolean): boolean => {
  const left = haystack.toLowerCase();
  const right = needle.toLowerCase();
  if (right.endsWith("*") && right.length > 1 && !quoted) {
    return left.split(/[^a-z0-9_:-]+/i).some((token) => token.startsWith(right.slice(0, -1)));
  }
  return left.includes(right);
};

const evalText = (node: SearchSyntaxTextNode, doc: LocalSearchDocument): boolean => {
  const field = node.field ? normalize(node.field) : null;
  if (!field || field === "text") {
    return textContains(doc.searchText, node.value, node.quoted);
  }
  if (field === "context" || field === "contextid") {
    return normalize(doc.contextId) === normalize(node.value);
  }
  if (field === "author") {
    return normalize(doc.author) === normalize(node.value);
  }
  if (field === "source") {
    return normalize(doc.source) === normalize(node.value);
  }
  if (field === "summary") {
    return textContains(doc.summary, node.value, node.quoted);
  }
  if (field === "change" || field === "content" || field === "detail") {
    return textContains(doc.changeValue, node.value, node.quoted);
  }
  if (field === "score" || field === "hash") {
    return doc.scoreKeys.some((key) => normalize(key) === normalize(node.value));
  }
  return textContains(doc.metaJson, `${field}:${node.value}`, true) || textContains(doc.searchText, node.value, node.quoted);
};

const evalNode = (node: SearchSyntaxNode, doc: LocalSearchDocument): boolean => {
  if (node.type === "text") {
    return evalText(node, doc);
  }
  if (node.type === "comparison") {
    const field = normalize(node.field);
    const compareValue =
      field === "createdat" || field === "created" || field === "updatedat" || field === "updated"
        ? parseDateLike(node.value)
        : parseInteger(node.value);
    const left =
      field === "createdat" || field === "created"
        ? doc.createdAtMs
        : field === "updatedat" || field === "updated"
          ? doc.updatedAtMs
          : field === "scorecount" || field === "unresolved"
            ? doc.unresolvedScoreCount
            : field === "maxscore" || field === "active"
              ? doc.maxActiveScore
              : undefined;
    if (compareValue === undefined || left === undefined) {
      return false;
    }
    if (node.operator === ">") {
      return left > compareValue;
    }
    if (node.operator === ">=") {
      return left >= compareValue;
    }
    if (node.operator === "<") {
      return left < compareValue;
    }
    if (node.operator === "<=") {
      return left <= compareValue;
    }
    return left === compareValue;
  }
  if (node.type === "not") {
    return !evalNode(node.child, doc);
  }
  if (node.operator === "AND") {
    return node.children.every((child) => evalNode(child, doc));
  }
  return node.children.some((child) => evalNode(child, doc));
};

const flattenTopLevelConjunction = (node: SearchSyntaxNode): SearchSyntaxNode[] => {
  if (node.type === "boolean") {
    if (node.operator === "AND") {
      return node.children.flatMap(flattenTopLevelConjunction);
    }
  }
  return [node];
};

const extractControlClause = (node: SearchSyntaxNode): LocalQueryControls | null => {
  if (node.type !== "text") {
    return null;
  }
  const field = node.field ? normalize(node.field) : null;
  if (field === "context" || field === "contextid") {
    return { contextId: node.value };
  }
  if (field === "score" || field === "hash") {
    return { hash: node.value };
  }
  if (field === "depth" || field === "deep") {
    const depth = parseInteger(node.value);
    return depth === undefined ? null : { depth };
  }
  if (field === "minscore") {
    const minScore = parseInteger(node.value);
    return minScore === undefined ? null : { minScore };
  }
  return null;
};

export const diagnoseAttentionQuery = (raw: string) => diagnoseSearchSyntax(raw.trim());

export const parseAttentionQuery = (raw: string): ParsedAttentionQuery => ({
  raw: raw.trim(),
  ast: parseSearchSyntax(raw.trim()),
});

export const queryAttentionLocally = (
  attention: RuntimeAttentionState,
  parsed: ParsedAttentionQuery,
  limit = 120,
): AttentionQueryItem[] => {
  const controls: LocalQueryControls = {};
  const residualClauses: SearchSyntaxNode[] = [];
  for (const clause of flattenTopLevelConjunction(parsed.ast)) {
    const control = extractControlClause(clause);
    if (control) {
      Object.assign(controls, control);
      continue;
    }
    residualClauses.push(clause);
  }
  const residualAst =
    residualClauses.length === 0
      ? null
      : residualClauses.length === 1
        ? residualClauses[0] ?? null
        : {
            type: "boolean" as const,
            operator: "AND" as const,
            children: residualClauses,
          };
  const minScore = controls.minScore ?? (controls.hash ? 0 : 1);
  const scopedContexts = controls?.contextId
    ? attention.snapshot.contexts.filter((context) => context.contextId === controls.contextId)
    : attention.snapshot.contexts;
  const scopedItems = toCommitMatches(scopedContexts).map((entry) => ({
    contextId: entry.contextId,
    context: entry.context,
    commit: entry.commit,
  }));

  const baseMatches = controls?.hash
    ? queryRelatedLocally(scopedItems, controls.hash, { depth: controls.depth ?? 3, minScore })
    : scopedItems.filter((match) => (minScore <= 0 ? true : matchesMinScore(match.context.scoreMap, minScore)));

  return baseMatches
    .filter((entry) => (residualAst ? evalNode(residualAst, buildDocument(entry)) : true))
    .sort(compareQueryItems)
    .slice(0, limit);
};

export const buildAttentionScoreQuery = (input: { contextId?: string | null; hash: string; depth?: number }): string => {
  const parts: string[] = [];
  if (input.contextId) {
    parts.push(`context:${input.contextId}`);
  }
  parts.push(`score:${input.hash}`);
  parts.push(`deep:${input.depth ?? 2}`);
  return parts.join(" ");
};
