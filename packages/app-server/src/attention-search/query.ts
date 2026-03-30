import { parseSearchSyntax, type SearchSyntaxNode, type SearchSyntaxTextNode } from "@agenter/search-syntax";

import type { AttentionSearchControls, AttentionSearchDocument, AttentionSearchSeed, CompiledAttentionSearch } from "./types";

const normalize = (value: string): string => value.trim().toLowerCase();

const normalizeField = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }
  return value.trim().toLowerCase();
};

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

const textContains = (haystack: string, needle: string, quoted: boolean): boolean => {
  const left = haystack.toLowerCase();
  const right = needle.toLowerCase();
  if (right.endsWith("*") && right.length > 1 && !quoted) {
    return left.split(/[^a-z0-9_:-]+/i).some((token) => token.startsWith(right.slice(0, -1)));
  }
  return left.includes(right);
};

const evalText = (node: SearchSyntaxTextNode, doc: AttentionSearchDocument): boolean => {
  const field = normalizeField(node.field);
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
  if (field === "commit" || field === "commitid") {
    return normalize(doc.commitId) === normalize(node.value);
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

const evalComparison = (
  node: Extract<SearchSyntaxNode, { type: "comparison" }>,
  doc: AttentionSearchDocument,
): boolean => {
  const field = normalizeField(node.field);
  const compareValue =
    field === "createdat" || field === "created" || field === "updatedat" || field === "updated"
      ? parseDateLike(node.value)
      : parseInteger(node.value);
  if (compareValue === undefined) {
    return false;
  }
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
  if (left === undefined) {
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
};

const evaluateNode = (node: SearchSyntaxNode, doc: AttentionSearchDocument): boolean => {
  if (node.type === "text") {
    return evalText(node, doc);
  }
  if (node.type === "comparison") {
    return evalComparison(node, doc);
  }
  if (node.type === "not") {
    return !evaluateNode(node.child, doc);
  }
  if (node.operator === "AND") {
    return node.children.every((child) => evaluateNode(child, doc));
  }
  return node.children.some((child) => evaluateNode(child, doc));
};

const flattenTopLevelConjunction = (node: SearchSyntaxNode): SearchSyntaxNode[] => {
  if (node.type === "boolean" && node.operator === "AND") {
    return node.children.flatMap(flattenTopLevelConjunction);
  }
  return [node];
};

const extractControlClause = (node: SearchSyntaxNode): AttentionSearchControls | null => {
  if (node.type !== "text") {
    return null;
  }
  const field = normalizeField(node.field);
  if (field === "context" || field === "contextid") {
    return { contextId: node.value };
  }
  if (field === "author") {
    return { author: node.value };
  }
  if (field === "source") {
    return { source: node.value };
  }
  if (field === "hash" || field === "score") {
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

const buildResidualAst = (clauses: readonly SearchSyntaxNode[]): SearchSyntaxNode | null => {
  if (clauses.length === 0) {
    return null;
  }
  if (clauses.length === 1) {
    return clauses[0] ?? null;
  }
  return {
    type: "boolean",
    operator: "AND",
    children: [...clauses],
  };
};

const analyzeSeeds = (node: SearchSyntaxNode): { useFts: boolean; seeds: AttentionSearchSeed[] } => {
  if (node.type === "not") {
    return { useFts: false, seeds: [] };
  }
  if (node.type === "boolean") {
    if (node.operator !== "AND") {
      return { useFts: false, seeds: [] };
    }
    const analyses = node.children.map(analyzeSeeds);
    return analyses.every((entry) => entry.useFts || entry.seeds.length === 0)
      ? {
          useFts: analyses.some((entry) => entry.useFts),
          seeds: analyses.flatMap((entry) => entry.seeds),
        }
      : { useFts: false, seeds: [] };
  }
  if (node.type === "comparison" || node.quoted) {
    return { useFts: false, seeds: [] };
  }
  const field = normalizeField(node.field);
  if (field === null || field === "text" || field === "summary" || field === "change") {
    return {
      useFts: true,
      seeds: [{ value: node.value, field: field === "change" ? "change" : field === "summary" ? "summary" : "text" }],
    };
  }
  return { useFts: false, seeds: [] };
};

const hasGraphControlOutsideConjunction = (node: SearchSyntaxNode, safe = true): boolean => {
  if (node.type === "boolean") {
    return node.children.some((child) => hasGraphControlOutsideConjunction(child, safe && node.operator === "AND"));
  }
  if (node.type === "not") {
    return hasGraphControlOutsideConjunction(node.child, false);
  }
  const field = normalizeField(node.field);
  return !safe && (field === "hash" || field === "score" || field === "depth" || field === "deep");
};

export const compileAttentionSearch = (query: string): CompiledAttentionSearch => {
  const ast = parseSearchSyntax(query);
  if (hasGraphControlOutsideConjunction(ast)) {
    throw new Error("hash/score/depth controls must stay in top-level conjunctions");
  }
  const controls: AttentionSearchControls = {};
  const residualClauses: SearchSyntaxNode[] = [];
  for (const clause of flattenTopLevelConjunction(ast)) {
    const control = extractControlClause(clause);
    if (control) {
      Object.assign(controls, control);
      continue;
    }
    residualClauses.push(clause);
  }
  const residualAst = buildResidualAst(residualClauses);
  const { useFts, seeds } = residualAst ? analyzeSeeds(residualAst) : { useFts: false, seeds: [] };
  return {
    ast,
    controls,
    seeds,
    useFts,
    evaluate: (doc) => (residualAst ? evaluateNode(residualAst, doc) : true),
  };
};
