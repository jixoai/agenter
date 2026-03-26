import type { AttentionQueryItem, RuntimeAttentionState } from "@agenter/client-sdk";

import type { AttentionCommitView, AttentionContextView } from "./attention-view-model";

export interface ParsedAttentionQuery {
  raw: string;
  contextId?: string;
  hash?: string;
  depth?: number;
  author?: string;
  source?: string;
  text?: string;
  minScore?: number;
}

const splitQueryTokens = (raw: string): string[] => {
  const tokens = raw.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  return tokens.map((token) => token.replace(/^("|')(.*)\1$/, "$2"));
};

const parsePositiveInt = (value: string): number | undefined => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
};

export const parseAttentionQuery = (raw: string): ParsedAttentionQuery => {
  const normalized = raw.trim();
  const parsed: ParsedAttentionQuery = { raw: normalized };
  const textTokens: string[] = [];

  for (const token of splitQueryTokens(normalized)) {
    const separatorIndex = token.indexOf(":");
    if (separatorIndex <= 0) {
      textTokens.push(token);
      continue;
    }

    const key = token.slice(0, separatorIndex).toLowerCase();
    const value = token.slice(separatorIndex + 1).trim();
    if (!value) {
      continue;
    }

    switch (key) {
      case "context":
        parsed.contextId = value;
        break;
      case "score":
      case "hash":
        parsed.hash = value;
        break;
      case "deep":
      case "depth": {
        const depth = parsePositiveInt(value);
        if (depth !== undefined) {
          parsed.depth = depth;
        }
        break;
      }
      case "author":
        parsed.author = value;
        break;
      case "source":
        parsed.source = value;
        break;
      case "minscore": {
        const minScore = parsePositiveInt(value);
        if (minScore !== undefined) {
          parsed.minScore = minScore;
        }
        break;
      }
      default:
        textTokens.push(token);
        break;
    }
  }

  if (textTokens.length > 0) {
    parsed.text = textTokens.join(" ");
  }

  return parsed;
};

const matchesMinScore = (scores: Record<string, number>, minScore: number): boolean =>
  Object.values(scores).some((score) => score >= minScore);

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

const compareQueryItems = (left: AttentionQueryItem, right: AttentionQueryItem): number => {
  const leftTime = Date.parse(left.commit.createdAt);
  const rightTime = Date.parse(right.commit.createdAt);
  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }
  return left.commit.commitId.localeCompare(right.commit.commitId);
};

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
        if (!matchesMinScore(match.commit.scores, input.minScore)) {
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

export const queryAttentionLocally = (
  attention: RuntimeAttentionState,
  parsed: ParsedAttentionQuery,
  limit = 120,
): AttentionQueryItem[] => {
  const minScore = parsed.minScore ?? 1;
  const scopedContexts = parsed.contextId
    ? attention.snapshot.contexts.filter((context) => context.contextId === parsed.contextId)
    : attention.snapshot.contexts;
  const scopedItems = toCommitMatches(scopedContexts);

  let matches: AttentionQueryItem[] = parsed.hash
    ? queryRelatedLocally(scopedItems, parsed.hash, { depth: parsed.depth ?? 3, minScore })
    : scopedItems.filter((match) => matchesMinScore(match.commit.scores, minScore));

  if (parsed.author) {
    matches = matches.filter((match) => match.commit.meta.author === parsed.author);
  }
  if (parsed.source) {
    matches = matches.filter((match) => match.commit.meta.source === parsed.source);
  }
  if (parsed.text) {
    const query = parsed.text.toLowerCase();
    matches = matches.filter((match) => {
      const changeText = match.commit.change.type === "clean" ? "" : match.commit.change.value;
      const haystacks = [match.commit.summary, changeText, JSON.stringify(match.commit.meta)];
      return haystacks.some((value) => value.toLowerCase().includes(query));
    });
  }

  return matches.sort(compareQueryItems).slice(0, limit);
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
