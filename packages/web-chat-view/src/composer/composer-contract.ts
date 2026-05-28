import type {
  WebChatComposerCapabilities,
  WebChatComposerCommandSuggestion,
  WebChatComposerCompletionContext,
  WebChatComposerCompletionDetection,
  WebChatComposerCompletionItem,
  WebChatComposerCompletionProvider,
  WebChatComposerCompletionTrigger,
  WebChatComposerHelpItem,
  WebChatComposerMentionSuggestion,
  WebChatResourceReference,
} from "../types";
import { normalizeResourceReferenceQuery, resourceReferenceMatchesQuery } from "../resource-contract";

export interface ComposerToken {
  from: number;
  to: number;
  query: string;
  raw: string;
  trigger: WebChatComposerCompletionTrigger;
}

export interface ResolvedWebChatComposerCapabilities {
  placeholder: string;
  submitLabel: string;
  submitTitle?: string;
  attachmentEnabled: boolean;
  imageEnabled: boolean;
  screenshotEnabled: boolean;
  helpItems: readonly WebChatComposerHelpItem[];
  commandSuggestions: readonly WebChatComposerCommandSuggestion[];
  mentionSuggestions: readonly WebChatComposerMentionSuggestion[];
  resourceReferences: readonly WebChatResourceReference[];
  completionProviders: readonly WebChatComposerCompletionProvider[];
  resolveMentionSuggestions?: (
    query: string,
  ) =>
    | readonly WebChatComposerMentionSuggestion[]
    | Promise<readonly WebChatComposerMentionSuggestion[]>;
}

export interface ResolvedWebChatComposerProvider extends WebChatComposerCompletionProvider {
  detection: WebChatComposerCompletionDetection;
}

export const COMPLETION_LIMIT = 8;

const TOKEN_BOUNDARY_PATTERN = /\s|[(){}\[\],;:"'`]/u;

const isTokenBoundary = (char: string): boolean => TOKEN_BOUNDARY_PATTERN.test(char);

const defaultHelpItems = (input: {
  attachmentEnabled: boolean;
  imageEnabled: boolean;
  screenshotEnabled: boolean;
}): readonly WebChatComposerHelpItem[] => {
  const items: WebChatComposerHelpItem[] = [
    {
      label: "@",
      value: "people and resources",
      insertText: "@",
      aliases: ["mention", "people", "participant", "resource"],
    },
    {
      label: "^",
      value: "resources only",
      insertText: "^",
      aliases: ["resource", "footnote", "image", "file", "comment"],
    },
    {
      label: "/",
      value: "commands",
      insertText: "/",
      aliases: ["command", "slash"],
    },
    {
      label: "Enter",
      value: "send message",
      aliases: ["send", "submit"],
    },
    {
      label: "Shift+Enter",
      value: "new line",
      aliases: ["newline", "line break"],
    },
  ];
  if (input.attachmentEnabled) {
    items.push({
      label: "Drop",
      value: "attach files",
      aliases: ["upload", "files", "drag"],
    });
  }
  if (input.imageEnabled) {
    items.push({
      label: "Paste",
      value: "paste image",
      aliases: ["image", "clipboard", "paste"],
    });
  }
  if (input.screenshotEnabled) {
    items.push({
      label: "/screenshot",
      value: "capture current screen",
      insertText: "/screenshot",
      aliases: ["capture", "screen", "screenshot"],
    });
  }
  return items;
};

const defaultCommandSuggestions = (screenshotEnabled: boolean): readonly WebChatComposerCommandSuggestion[] => {
  if (!screenshotEnabled) {
    return [];
  }
  return [{ label: "/screenshot", detail: "capture screen" }];
};

const mentionSuggestionToCompletionItem = (
  item: WebChatComposerMentionSuggestion,
): WebChatComposerCompletionItem => ({
  id: item.id,
  label: item.label,
  insertText: item.apply ?? `@${item.label}`,
  detail: item.detail,
  iconUrl: item.iconUrl,
});

const resourceReferenceToCompletionItem = (reference: WebChatResourceReference): WebChatComposerCompletionItem => ({
  id: reference.id,
  label: reference.label,
  insertText: reference.tokenText,
  detail: reference.detailText ?? reference.fileName,
  aliases: reference.aliases,
  fileName: reference.fileName,
  iconUrl: reference.iconUrl,
  resource: reference,
});

const commandSuggestionToCompletionItem = (
  item: WebChatComposerCommandSuggestion,
): WebChatComposerCompletionItem => ({
  id: item.label,
  label: item.label,
  insertText: item.label,
  detail: item.detail,
});

const helpItemToCompletionItem = (item: WebChatComposerHelpItem): WebChatComposerCompletionItem => ({
  id: `help:${item.label}:${item.value}`,
  label: item.label,
  insertText: item.insertText ?? "",
  detail: item.value,
  aliases: item.aliases,
});

const createMentionProvider = (
  input: Pick<
    ResolvedWebChatComposerCapabilities,
    "mentionSuggestions" | "resolveMentionSuggestions" | "resourceReferences"
  >,
): WebChatComposerCompletionProvider => ({
  id: "people-and-resources",
  trigger: "@",
  detection: "embedded",
  suggestions: [
    ...input.mentionSuggestions.map(mentionSuggestionToCompletionItem),
    ...input.resourceReferences.map(resourceReferenceToCompletionItem),
  ],
  resolveSuggestions: async (query: string, context: WebChatComposerCompletionContext) => {
    const items: WebChatComposerCompletionItem[] = [];
    const seen = new Set<string>();
    const normalizedQuery = normalizeResourceReferenceQuery(query);
    const pushItem = (item: WebChatComposerCompletionItem): void => {
      if (seen.has(item.id)) {
        return;
      }
      seen.add(item.id);
      items.push(item);
    };

    for (const mention of input.mentionSuggestions) {
      if (
        normalizedQuery.length === 0 ||
        mention.label.toLowerCase().includes(query.toLowerCase()) ||
        mention.id.toLowerCase().includes(query.toLowerCase())
      ) {
        pushItem(mentionSuggestionToCompletionItem(mention));
      }
    }

    if (input.resolveMentionSuggestions) {
      const dynamic = await input.resolveMentionSuggestions(query);
      for (const mention of dynamic) {
        pushItem(mentionSuggestionToCompletionItem(mention));
      }
    }

    if (context.trigger === "@") {
      for (const reference of input.resourceReferences) {
        if (resourceReferenceMatchesQuery(reference, query)) {
          pushItem(resourceReferenceToCompletionItem(reference));
        }
      }
    }

    return items.slice(0, COMPLETION_LIMIT);
  },
});

const createResourceProvider = (
  references: readonly WebChatResourceReference[],
): WebChatComposerCompletionProvider => ({
  id: "resources",
  trigger: "^",
  detection: "embedded",
  suggestions: references.map(resourceReferenceToCompletionItem),
  resolveSuggestions: (query: string) =>
    references.filter((reference) => resourceReferenceMatchesQuery(reference, query)).map(resourceReferenceToCompletionItem),
});

const createCommandProvider = (
  commands: readonly WebChatComposerCommandSuggestion[],
): WebChatComposerCompletionProvider => ({
  id: "commands",
  trigger: "/",
  detection: "boundary",
  suggestions: commands.map(commandSuggestionToCompletionItem),
  resolveSuggestions: (query: string) =>
    commands
      .filter((item) => item.label.toLowerCase().startsWith(`/${query.toLowerCase()}`))
      .map(commandSuggestionToCompletionItem),
});

const helpItemMatchesQuery = (item: WebChatComposerHelpItem, query: string): boolean => {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return true;
  }
  return [item.label, item.value, item.insertText ?? "", ...(item.aliases ?? [])].some((candidate) =>
    candidate.toLowerCase().includes(normalizedQuery),
  );
};

const createHelpProvider = (
  helpItems: readonly WebChatComposerHelpItem[],
  trigger: "?" | "？",
): WebChatComposerCompletionProvider => ({
  id: trigger === "?" ? "help" : "help-fullwidth",
  trigger,
  detection: "boundary",
  suggestions: helpItems.map(helpItemToCompletionItem),
  resolveSuggestions: (query: string) =>
    helpItems.filter((item) => helpItemMatchesQuery(item, query)).map(helpItemToCompletionItem),
});

export const resolveComposerCapabilities = (
  input: WebChatComposerCapabilities | undefined,
  fallbackPlaceholder: string,
): ResolvedWebChatComposerCapabilities => {
  const attachmentEnabled = input?.attachmentEnabled ?? true;
  const imageEnabled = input?.imageEnabled ?? attachmentEnabled;
  const screenshotEnabled = input?.screenshotEnabled ?? attachmentEnabled;
  const helpItems = input?.helpItems ?? defaultHelpItems({ attachmentEnabled, imageEnabled, screenshotEnabled });
  const commandSuggestions = input?.commandSuggestions ?? defaultCommandSuggestions(screenshotEnabled);
  const mentionSuggestions = input?.mentionSuggestions ?? [];
  const resourceReferences = input?.resourceReferences ?? [];

  const defaultProviders = [
    createMentionProvider({
      mentionSuggestions,
      resolveMentionSuggestions: input?.resolveMentionSuggestions,
      resourceReferences,
    }),
    createResourceProvider(resourceReferences),
    createCommandProvider(commandSuggestions),
    createHelpProvider(helpItems, "?"),
    createHelpProvider(helpItems, "？"),
  ];

  return {
    placeholder: input?.placeholder ?? fallbackPlaceholder,
    submitLabel: input?.submitLabel ?? "Send",
    submitTitle: input?.submitTitle,
    attachmentEnabled,
    imageEnabled,
    screenshotEnabled,
    helpItems,
    commandSuggestions,
    mentionSuggestions,
    resourceReferences,
    completionProviders: input?.completionProviders ?? defaultProviders,
    resolveMentionSuggestions: input?.resolveMentionSuggestions,
  };
};

export const resolveCompletionProviders = (
  capabilities: ResolvedWebChatComposerCapabilities,
): readonly ResolvedWebChatComposerProvider[] =>
  capabilities.completionProviders.map((provider) => ({
    ...provider,
    detection: provider.detection ?? "embedded",
  }));

export const findCompletionToken = (
  value: string,
  cursor: number,
  provider: Pick<ResolvedWebChatComposerProvider, "trigger" | "detection">,
): ComposerToken | null => {
  const safeCursor = Math.max(0, Math.min(cursor, value.length));
  let segmentStart = safeCursor;
  while (segmentStart > 0) {
    const previous = value[segmentStart - 1];
    if (!previous || isTokenBoundary(previous)) {
      break;
    }
    segmentStart -= 1;
  }

  const segment = value.slice(segmentStart, safeCursor);
  const relativeTriggerIndex =
    provider.detection === "embedded"
      ? segment.lastIndexOf(provider.trigger)
      : segment.startsWith(provider.trigger)
        ? 0
        : -1;

  if (relativeTriggerIndex < 0) {
    return null;
  }

  const start = segmentStart + relativeTriggerIndex;
  const token = value.slice(start, safeCursor);

  return {
    from: start,
    to: safeCursor,
    query: token.slice(provider.trigger.length),
    raw: token,
    trigger: provider.trigger,
  };
};

const needsLeadingSpace = (value: string, from: number): boolean => {
  if (from <= 0) {
    return false;
  }
  const previous = value[from - 1];
  return Boolean(previous) && !isTokenBoundary(previous);
};

const needsTrailingSpace = (value: string, to: number): boolean => {
  if (to >= value.length) {
    return false;
  }
  const next = value[to];
  return Boolean(next) && !isTokenBoundary(next);
};

export const padInsertedCompletion = (
  value: string,
  token: ComposerToken,
  insertText: string,
): string => {
  const prefix = needsLeadingSpace(value, token.from) ? " " : "";
  const suffix = needsTrailingSpace(value, token.to) ? " " : "";
  return `${prefix}${insertText}${suffix}`;
};
