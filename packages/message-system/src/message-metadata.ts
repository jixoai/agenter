const WEB_CHAT_RESOURCE_METADATA_KEY_PATTERN = /^webChat[A-Za-z0-9]*Resources$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isForbiddenWebChatResourceMetadataKey = (key: string): boolean =>
  WEB_CHAT_RESOURCE_METADATA_KEY_PATTERN.test(key);

export const sanitizeRoomMessageMetadata = (metadata: Record<string, unknown> | undefined): Record<string, unknown> => {
  if (!metadata) {
    return {};
  }
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!isForbiddenWebChatResourceMetadataKey(key)) {
      next[key] = value;
    }
  }
  return next;
};

type LegacyCommentResource = {
  label: string;
  commentText: string;
  sourceUri?: string;
  sourceMessageId?: number;
  sourceViewKey?: string;
  sourceLineNumber?: number;
  selectedText?: string;
};

const normalizeLegacyCommentResource = (value: unknown): LegacyCommentResource | null => {
  if (!isRecord(value)) {
    return null;
  }
  const label = typeof value.label === "string" ? value.label.trim() : "";
  const commentText = typeof value.commentText === "string" ? value.commentText.trim() : "";
  const sourceLineNumber = typeof value.sourceLineNumber === "number" ? value.sourceLineNumber : undefined;
  if (!label || !commentText) {
    return null;
  }
  return {
    label,
    commentText,
    sourceUri: typeof value.sourceUri === "string" && value.sourceUri.trim() ? value.sourceUri.trim() : undefined,
    sourceMessageId: typeof value.sourceMessageId === "number" ? value.sourceMessageId : undefined,
    sourceViewKey:
      typeof value.sourceViewKey === "string" && value.sourceViewKey.trim() ? value.sourceViewKey : undefined,
    sourceLineNumber,
    selectedText: typeof value.selectedText === "string" && value.selectedText.trim() ? value.selectedText : undefined,
  };
};

const readLegacyCommentResources = (metadata: Record<string, unknown>): LegacyCommentResource[] => {
  const raw = metadata.webChatCommentResources;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.flatMap((value) => {
    const normalized = normalizeLegacyCommentResource(value);
    return normalized ? [normalized] : [];
  });
};

const collectDefinitionLabels = (content: string): Set<string> => {
  const labels = new Set<string>();
  for (const line of content.split(/\r?\n/u)) {
    const match = /^\[\^([^\]]+)\]:/u.exec(line.trim());
    if (match?.[1]) {
      labels.add(match[1]);
    }
  }
  return labels;
};

const escapeMarkdownLinkText = (value: string): string => value.replace(/\\/gu, "\\\\").replace(/\]/gu, "\\]");

const escapeMarkdownTitle = (value: string): string => value.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"');

const buildLegacyCommentSourceUri = (resource: LegacyCommentResource, chatId: string): string | null => {
  if (resource.sourceUri) {
    return resource.sourceUri;
  }
  if (!resource.sourceViewKey && resource.sourceMessageId === undefined) {
    return null;
  }
  const target =
    resource.sourceMessageId !== undefined
      ? String(resource.sourceMessageId)
      : encodeURIComponent(resource.sourceViewKey ?? "");
  const line = resource.sourceLineNumber ?? 1;
  return `msg://${chatId}/${target}#L${line}`;
};

const formatLegacyCommentDefinition = (resource: LegacyCommentResource, chatId: string): string | null => {
  const sourceUri = buildLegacyCommentSourceUri(resource, chatId);
  if (!sourceUri) {
    return null;
  }
  const title = resource.selectedText ? ` "${escapeMarkdownTitle(resource.selectedText)}"` : "";
  return `[^${resource.label}]: [${escapeMarkdownLinkText(resource.commentText)}](${sourceUri}${title})`;
};

const appendFootnoteDefinitions = (content: string, definitions: readonly string[]): string => {
  if (definitions.length === 0) {
    return content;
  }
  if (content.length === 0) {
    return definitions.join("\n");
  }
  if (content.endsWith("\n\n")) {
    return `${content}${definitions.join("\n")}`;
  }
  if (content.endsWith("\n")) {
    return `${content}\n${definitions.join("\n")}`;
  }
  return `${content}\n\n${definitions.join("\n")}`;
};

export const repairLegacyWebChatResourceMetadata = (input: {
  chatId: string;
  content: string;
  metadata: Record<string, unknown> | undefined;
}): { content: string; metadata: Record<string, unknown>; changed: boolean } => {
  const metadata = input.metadata ?? {};
  const sanitized = sanitizeRoomMessageMetadata(metadata);
  const existingLabels = collectDefinitionLabels(input.content);
  const definitions = readLegacyCommentResources(metadata).flatMap((resource) => {
    if (existingLabels.has(resource.label)) {
      return [];
    }
    const definition = formatLegacyCommentDefinition(resource, input.chatId);
    return definition ? [definition] : [];
  });
  const content = appendFootnoteDefinitions(input.content, definitions);
  const changed = content !== input.content || JSON.stringify(sanitized) !== JSON.stringify(metadata);
  return {
    content,
    metadata: sanitized,
    changed,
  };
};
