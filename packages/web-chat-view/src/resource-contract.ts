import type { MessageAttachment, MessageAttachmentKind } from "@agenter/message-system/types";

import type { PendingAsset } from "./composer/pending-assets";
import type {
  WebChatCommentResourcePayload,
  WebChatCommentResourceAnchor,
  WebChatResourceReference,
} from "./types";

const FALLBACK_RESOURCE_LABEL: Record<MessageAttachmentKind, string> = {
  image: "Image",
  video: "Video",
  file: "File",
};

const normalizeLookup = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

const extensionFromName = (name: string): string | undefined => {
  const match = /\.([a-z0-9]{1,8})$/iu.exec(name.trim());
  return match?.[1]?.toLowerCase();
};

const buildAssetTokenText = (kind: MessageAttachmentKind, index: number): string => {
  const label = FALLBACK_RESOURCE_LABEL[kind] ?? "File";
  return `[^${label} ${index}]`;
};

const buildAssetLabel = (kind: MessageAttachmentKind, index: number): string => {
  const label = FALLBACK_RESOURCE_LABEL[kind] ?? "File";
  return `${label} ${index}`;
};

const buildCommentLabel = (index: number): string => `Comment ${index}`;
const buildCommentTokenText = (index: number): string => `[^Comment ${index}]`;

const buildReferenceAliases = (reference: {
  label: string;
  fileName?: string;
  aliases?: readonly string[];
}): string[] => {
  const values = [
    reference.label,
    normalizeLookup(reference.label),
    reference.fileName,
    reference.fileName ? normalizeLookup(reference.fileName) : undefined,
    ...(reference.aliases ?? []),
  ];
  return values.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
};

export const attachmentToResourceReference = (
  attachment: MessageAttachment,
  index: number,
): WebChatResourceReference => {
  const label = buildAssetLabel(attachment.kind, index + 1);
  return {
    id: attachment.assetId,
    assetId: attachment.assetId,
    label,
    tokenText: buildAssetTokenText(attachment.kind, index + 1),
    kind: attachment.kind,
    detailText: `${attachment.kind} resource`,
    fileName: attachment.name,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    url: attachment.url,
    previewUrl: attachment.kind === "image" ? attachment.url : undefined,
    extension: extensionFromName(attachment.name),
    aliases: buildReferenceAliases({
      label,
      fileName: attachment.name,
      aliases: [attachment.assetId],
    }),
  };
};

export const pendingAssetToResourceReference = (
  asset: PendingAsset,
  index: number,
): WebChatResourceReference => {
  const label = buildAssetLabel(asset.kind, index + 1);
  return {
    id: asset.id,
    label,
    tokenText: buildAssetTokenText(asset.kind, index + 1),
    kind: asset.kind,
    detailText: `${asset.kind} resource`,
    fileName: asset.file.name,
    mimeType: asset.file.type,
    sizeBytes: asset.file.size,
    url: asset.previewUrl,
    previewUrl: asset.kind === "image" ? asset.previewUrl : undefined,
    extension: extensionFromName(asset.file.name),
    aliases: buildReferenceAliases({
      label,
      fileName: asset.file.name,
    }),
  };
};

export const commentResourceToReference = (
  input: WebChatCommentResourcePayload,
): WebChatResourceReference => ({
  id: input.id,
  label: input.label,
  tokenText: input.tokenText,
  kind: "comment",
  detailText: input.commentText,
  extension: "cmt",
  commentText: input.commentText,
  commentAnchor: {
    sourceMessageId: input.sourceMessageId,
    sourceViewKey: input.sourceViewKey,
    sourceLineNumber: input.sourceLineNumber,
    selectedText: input.selectedText,
    sourceActorId: input.sourceActorId,
    sourceActorLabel: input.sourceActorLabel,
    sourceUri: input.sourceUri,
  },
  aliases: buildReferenceAliases({
    label: input.label,
    aliases: [input.selectedText, input.sourceActorLabel, input.sourceViewKey].filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    ),
  }),
});

const readRawCommentResources = (value: unknown): readonly unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value || typeof value !== "object") {
    return [];
  }
  const candidate = value as { webChatCommentResources?: unknown };
  return Array.isArray(candidate.webChatCommentResources) ? candidate.webChatCommentResources : [];
};

export const normalizeCommentResourcePayload = (
  value: unknown,
  fallback: Partial<
    Pick<
      WebChatCommentResourcePayload,
      "sourceMessageId" | "sourceViewKey" | "sourceActorId" | "sourceActorLabel" | "sourceUri"
    >
  > = {},
): WebChatCommentResourcePayload | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<WebChatCommentResourcePayload>;
  const sourceViewKey =
    typeof candidate.sourceViewKey === "string" && candidate.sourceViewKey.trim().length > 0
      ? candidate.sourceViewKey
      : typeof fallback.sourceViewKey === "string" && fallback.sourceViewKey.trim().length > 0
        ? fallback.sourceViewKey
        : null;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.label !== "string" ||
    typeof candidate.tokenText !== "string" ||
    typeof candidate.commentText !== "string" ||
    typeof candidate.sourceLineNumber !== "number" ||
    typeof candidate.selectedText !== "string" ||
    !sourceViewKey
  ) {
    return null;
  }
  return {
    id: candidate.id,
    label: candidate.label,
    tokenText: candidate.tokenText,
    commentText: candidate.commentText,
    sourceMessageId:
      typeof candidate.sourceMessageId === "number" ? candidate.sourceMessageId : fallback.sourceMessageId,
    sourceViewKey,
    sourceLineNumber: candidate.sourceLineNumber,
    selectedText: candidate.selectedText,
    sourceActorId:
      typeof candidate.sourceActorId === "string" || candidate.sourceActorId === null
        ? candidate.sourceActorId
        : fallback.sourceActorId,
    sourceActorLabel:
      typeof candidate.sourceActorLabel === "string" ? candidate.sourceActorLabel : fallback.sourceActorLabel,
    sourceUri: typeof candidate.sourceUri === "string" ? candidate.sourceUri : fallback.sourceUri,
  };
};

export const extractCommentResourcePayloads = (
  value: unknown,
  fallback: Partial<
    Pick<
      WebChatCommentResourcePayload,
      "sourceMessageId" | "sourceViewKey" | "sourceActorId" | "sourceActorLabel" | "sourceUri"
    >
  > = {},
): WebChatCommentResourcePayload[] =>
  readRawCommentResources(value).flatMap((resource) => {
    const normalized = normalizeCommentResourcePayload(resource, fallback);
    return normalized ? [normalized] : [];
  });

export const createCommentResourcePayload = (
  input: Omit<WebChatCommentResourcePayload, "id" | "label" | "tokenText"> & {
    index: number;
    id?: string;
  },
): WebChatCommentResourcePayload => {
  const label = buildCommentLabel(input.index);
  return {
    id: input.id ?? `comment-${input.index}`,
    label,
    tokenText: buildCommentTokenText(input.index),
    commentText: input.commentText,
    sourceMessageId: input.sourceMessageId,
    sourceViewKey: input.sourceViewKey,
    sourceLineNumber: input.sourceLineNumber,
    selectedText: input.selectedText,
    sourceActorId: input.sourceActorId,
    sourceActorLabel: input.sourceActorLabel,
    sourceUri: input.sourceUri,
  };
};

type ParsedCommentFootnote = {
  label: string;
  commentText: string;
  sourceUri: string;
};

type ParsedAssetFootnote = {
  label: string;
  fileName: string;
  url: string;
};

const COMMENT_FOOTNOTE_PATTERN =
  /^\[\^(Comment\s+\d+)\]:\s*\[(.+?)\]\((msg:\/\/[^\s)]+)\)\s*$/u;
const ASSET_FOOTNOTE_PATTERN =
  /^\[\^((?:Image|Video|File)\s+\d+)\]:\s*\[!(.+?)\]\(([^)\s]+)\)\s*$/u;

export const parseCommentFootnoteDefinition = (
  line: string,
): ParsedCommentFootnote | null => {
  const match = COMMENT_FOOTNOTE_PATTERN.exec(line.trim());
  if (!match) {
    return null;
  }
  const [, label, commentText, sourceUri] = match;
  if (!label || !commentText || !sourceUri) {
    return null;
  }
  return {
    label,
    commentText,
    sourceUri,
  };
};

export const parseAssetResourceDefinition = (
  line: string,
): ParsedAssetFootnote | null => {
  const match = ASSET_FOOTNOTE_PATTERN.exec(line.trim());
  if (!match) {
    return null;
  }
  const [, label, fileName, url] = match;
  if (!label || !fileName || !url) {
    return null;
  }
  return {
    label,
    fileName,
    url,
  };
};

export const formatAssetResourceDefinition = (
  input: Pick<WebChatResourceReference, "label"> & {
    fileName: string;
    url: string;
  },
): string => `[^${input.label}]: [!${input.fileName}](${input.url})`;

export const formatCommentResourceDefinition = (
  input: Pick<WebChatCommentResourcePayload, "label" | "commentText"> & {
    sourceUri: string;
  },
): string => `[^${input.label}]: [${input.commentText}](${input.sourceUri})`;

export const buildCommentResourceSourceUri = (
  input: Pick<
    WebChatCommentResourceAnchor,
    "sourceViewKey" | "sourceLineNumber" | "sourceMessageId"
  > & { roomId: string },
): string => {
  const suffix = `#L${input.sourceLineNumber}`;
  const base = input.sourceMessageId
    ? `msg://${input.roomId}/${input.sourceMessageId}`
    : `msg://${input.roomId}/${encodeURIComponent(input.sourceViewKey)}`;
  return `${base}${suffix}`;
};

export const mergeResourceReferences = (
  references: readonly WebChatResourceReference[],
  additions: readonly WebChatResourceReference[],
): WebChatResourceReference[] => {
  const merged = new Map<string, WebChatResourceReference>();
  for (const reference of references) {
    merged.set(reference.id, reference);
  }
  for (const reference of additions) {
    merged.set(reference.id, reference);
  }
  return [...merged.values()];
};

export const resolveMessageResourceReferences = (input: {
  attachments?: readonly MessageAttachment[];
  metadata?: unknown;
  content?: string;
  messageId?: number;
  viewKey?: string;
  senderActorId?: string | null;
  from?: string;
}): WebChatResourceReference[] => {
  const commentDefinitionsByLabel = new Map<string, ParsedCommentFootnote>();
  for (const line of (input.content ?? "").split(/\r?\n/u)) {
    const parsed = parseCommentFootnoteDefinition(line);
    if (parsed) {
      commentDefinitionsByLabel.set(parsed.label, parsed);
    }
  }
  const attachmentReferences = (input.attachments ?? []).map((attachment, index) =>
    attachmentToResourceReference(attachment, index),
  );
  const commentReferences = extractCommentResourcePayloads(input.metadata, {
    sourceMessageId: input.messageId,
    sourceViewKey: input.viewKey,
    sourceActorId: input.senderActorId,
    sourceActorLabel: input.from,
  }).map((resource) => {
    const parsed = commentDefinitionsByLabel.get(resource.label);
    return commentResourceToReference({
      ...resource,
      commentText: resource.commentText || parsed?.commentText || "",
      sourceUri: resource.sourceUri ?? parsed?.sourceUri,
    });
  });
  return mergeResourceReferences(attachmentReferences, commentReferences);
};

const collectExistingDefinitionLabels = (content: string): Set<string> => {
  const labels = new Set<string>();
  for (const line of content.split(/\r?\n/u)) {
    const comment = parseCommentFootnoteDefinition(line);
    if (comment) {
      labels.add(comment.label);
      continue;
    }
    const asset = parseAssetResourceDefinition(line);
    if (asset) {
      labels.add(asset.label);
    }
  }
  return labels;
};

const resolveCommentResourceSourceUri = (
  resource: WebChatResourceReference,
  roomId: string,
): string | null => {
  const anchor = resource.commentAnchor;
  if (typeof anchor?.sourceUri === "string" && anchor.sourceUri.trim().length > 0) {
    return anchor.sourceUri;
  }
  if (!anchor) {
    return null;
  }
  return buildCommentResourceSourceUri({
    roomId,
    sourceMessageId: anchor.sourceMessageId,
    sourceViewKey: anchor.sourceViewKey,
    sourceLineNumber: anchor.sourceLineNumber,
  });
};

const buildResourceDefinitionLine = (
  resource: WebChatResourceReference,
  roomId: string,
): string | null => {
  if (resource.kind === "comment") {
    if (!resource.commentText) {
      return null;
    }
    const sourceUri = resolveCommentResourceSourceUri(resource, roomId);
    if (!sourceUri) {
      return null;
    }
    return formatCommentResourceDefinition({
      label: resource.label,
      commentText: resource.commentText,
      sourceUri,
    });
  }
  if (!resource.fileName || !resource.url) {
    return null;
  }
  return formatAssetResourceDefinition({
    label: resource.label,
    fileName: resource.fileName,
    url: resource.url,
  });
};

export const serializeMessageSourceMarkdown = (input: {
  chatId: string;
  content: string;
  attachments?: readonly MessageAttachment[];
  metadata?: unknown;
  resourceReferences?: readonly WebChatResourceReference[];
  messageId?: number;
  viewKey?: string;
  senderActorId?: string | null;
  from?: string;
}): string => {
  const existingDefinitionLabels = collectExistingDefinitionLabels(input.content);
  const references = mergeResourceReferences(
    resolveMessageResourceReferences({
      attachments: input.attachments,
      metadata: input.metadata,
      content: input.content,
      messageId: input.messageId,
      viewKey: input.viewKey,
      senderActorId: input.senderActorId,
      from: input.from,
    }),
    input.resourceReferences ?? [],
  );
  const definitionLines = references.flatMap((resource) => {
    if (existingDefinitionLabels.has(resource.label)) {
      return [];
    }
    const line = buildResourceDefinitionLine(resource, input.chatId);
    return line ? [line] : [];
  });
  if (definitionLines.length === 0) {
    return input.content;
  }
  if (input.content.length === 0) {
    return definitionLines.join("\n");
  }
  if (input.content.endsWith("\n\n")) {
    return `${input.content}${definitionLines.join("\n")}`;
  }
  if (input.content.endsWith("\n")) {
    return `${input.content}\n${definitionLines.join("\n")}`;
  }
  return `${input.content}\n\n${definitionLines.join("\n")}`;
};

export const normalizeResourceReferenceQuery = (query: string): string => normalizeLookup(query);

export const resourceReferenceMatchesQuery = (
  reference: WebChatResourceReference,
  query: string,
): boolean => {
  const normalizedQuery = normalizeResourceReferenceQuery(query);
  if (normalizedQuery.length === 0) {
    return true;
  }
  const haystacks = buildReferenceAliases(reference);
  return haystacks.some((value) => normalizeLookup(value).includes(normalizedQuery));
};
