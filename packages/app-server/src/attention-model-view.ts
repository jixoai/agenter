import { createHash } from "node:crypto";

import type {
  AttentionActiveContextMatch,
  AttentionCommit,
  AttentionCommitMatch,
  AttentionCommitMeta,
  AttentionContextState,
} from "@agenter/attention-system";

const MAX_META_DEPTH = 2;
const MAX_META_KEYS = 12;
const MAX_META_ITEMS = 8;
const MAX_META_STRING_CHARS = 160;
const MAX_CHANGE_VALUE_CHARS = 1_600;
const DIGEST_PREVIEW_LENGTH = 12;

const HASH_KEY_PATTERN = /hash$/i;
const HEX_DIGEST_PATTERN = /^[0-9a-f]{32,}$/i;

const buildDigestPreview = (value: string): string =>
  createHash("sha256").update(value).digest("hex").slice(0, DIGEST_PREVIEW_LENGTH);

const truncateString = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}... [truncated ${value.length - maxLength} chars]`;
};

const compactHashValue = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }
  if (HEX_DIGEST_PATTERN.test(trimmed)) {
    return `sha256:${trimmed.slice(0, DIGEST_PREVIEW_LENGTH).toLowerCase()}`;
  }
  return `sha256:${buildDigestPreview(trimmed)}`;
};

const compactMetaValue = (key: string, value: unknown, depth: number): unknown => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    if (HASH_KEY_PATTERN.test(key)) {
      return compactHashValue(value);
    }
    return truncateString(value, MAX_META_STRING_CHARS);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    if (depth >= MAX_META_DEPTH) {
      return `[array(${value.length}) sha256:${buildDigestPreview(JSON.stringify(value))}]`;
    }
    const preview = value
      .slice(0, MAX_META_ITEMS)
      .map((entry, index) => compactMetaValue(`${key}[${index}]`, entry, depth + 1));
    if (value.length > MAX_META_ITEMS) {
      preview.push(`... [${value.length - MAX_META_ITEMS} more items]`);
    }
    return preview;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (depth >= MAX_META_DEPTH) {
      return `[object(${entries.length}) sha256:${buildDigestPreview(JSON.stringify(value))}]`;
    }
    const projected = Object.fromEntries(
      entries.slice(0, MAX_META_KEYS).map(([childKey, childValue]) => [
        childKey,
        compactMetaValue(childKey, childValue, depth + 1),
      ]),
    ) as Record<string, unknown>;
    if (entries.length > MAX_META_KEYS) {
      projected.__truncated = `${entries.length - MAX_META_KEYS} more keys`;
    }
    return projected;
  }
  return String(value);
};

const projectAttentionMeta = (meta: AttentionCommitMeta): AttentionCommitMeta =>
  Object.fromEntries(Object.entries(meta).map(([key, value]) => [key, compactMetaValue(key, value, 0)])) as AttentionCommitMeta;

const projectAttentionCommit = (commit: AttentionCommit): AttentionCommit => ({
  ...commit,
  meta: projectAttentionMeta(commit.meta),
  scores: { ...commit.scores },
  change:
    commit.change.type === "clean"
      ? { type: "clean" }
      : {
          ...commit.change,
          value: truncateString(commit.change.value, MAX_CHANGE_VALUE_CHARS),
        },
});

const projectAttentionContext = (context: AttentionContextState): AttentionContextState => ({
  ...context,
  scoreMap: { ...context.scoreMap },
  content: truncateString(context.content, MAX_CHANGE_VALUE_CHARS),
});

export const projectAttentionCommitMatchForModel = (match: AttentionCommitMatch): AttentionCommitMatch => ({
  contextId: match.contextId,
  context: projectAttentionContext(match.context),
  commit: projectAttentionCommit(match.commit),
});

export const projectAttentionActiveContextForModel = (
  match: AttentionActiveContextMatch,
): AttentionActiveContextMatch => ({
  contextId: match.contextId,
  context: projectAttentionContext(match.context),
  recentCommits: match.recentCommits.map(projectAttentionCommit),
});
