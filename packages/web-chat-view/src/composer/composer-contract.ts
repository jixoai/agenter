import type {
  WebChatComposerCapabilities,
  WebChatComposerCommandSuggestion,
  WebChatComposerHelpItem,
  WebChatComposerMentionSuggestion,
} from "../types";

export interface ComposerToken {
  from: number;
  to: number;
  query: string;
  raw: string;
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
  resolveMentionSuggestions?: (
    query: string,
  ) =>
    | readonly WebChatComposerMentionSuggestion[]
    | Promise<readonly WebChatComposerMentionSuggestion[]>;
}

export const COMPLETION_LIMIT = 8;

const isTokenBoundary = (char: string): boolean => /\s|[(){}\[\],;:"'`]/u.test(char);

const defaultHelpItems = (input: {
  attachmentEnabled: boolean;
  imageEnabled: boolean;
  screenshotEnabled: boolean;
}): readonly WebChatComposerHelpItem[] => {
  const items: WebChatComposerHelpItem[] = [
    { label: "@", value: "mention" },
    { label: "/", value: "command" },
    { label: "Enter", value: "send" },
    { label: "Shift+Enter", value: "newline" },
  ];
  if (input.attachmentEnabled) {
    items.push({ label: "Drop", value: "files" });
  }
  if (input.imageEnabled) {
    items.push({ label: "Paste", value: "image" });
  }
  if (input.screenshotEnabled) {
    items.push({ label: "/screenshot", value: "capture" });
  }
  return items;
};

const defaultCommandSuggestions = (screenshotEnabled: boolean): readonly WebChatComposerCommandSuggestion[] => {
  if (!screenshotEnabled) {
    return [];
  }
  return [{ label: "/screenshot", detail: "capture screen" }];
};

export const resolveComposerCapabilities = (
  input: WebChatComposerCapabilities | undefined,
  fallbackPlaceholder: string,
): ResolvedWebChatComposerCapabilities => {
  const attachmentEnabled = input?.attachmentEnabled ?? true;
  const imageEnabled = input?.imageEnabled ?? attachmentEnabled;
  const screenshotEnabled = input?.screenshotEnabled ?? attachmentEnabled;
  return {
    placeholder: input?.placeholder ?? fallbackPlaceholder,
    submitLabel: input?.submitLabel ?? "Send",
    submitTitle: input?.submitTitle,
    attachmentEnabled,
    imageEnabled,
    screenshotEnabled,
    helpItems: input?.helpItems ?? defaultHelpItems({ attachmentEnabled, imageEnabled, screenshotEnabled }),
    commandSuggestions: input?.commandSuggestions ?? defaultCommandSuggestions(screenshotEnabled),
    mentionSuggestions: input?.mentionSuggestions ?? [],
    resolveMentionSuggestions: input?.resolveMentionSuggestions,
  };
};

export const findMentionToken = (value: string, cursor: number): ComposerToken | null => {
  const safeCursor = Math.max(0, Math.min(cursor, value.length));
  let start = safeCursor;
  while (start > 0) {
    const previous = value[start - 1];
    if (!previous || isTokenBoundary(previous)) {
      break;
    }
    start -= 1;
  }

  const token = value.slice(start, safeCursor);
  if (!token.startsWith("@")) {
    return null;
  }

  return {
    from: start,
    to: safeCursor,
    query: token.slice(1),
    raw: token,
  };
};

export const findSlashCommandToken = (value: string, cursor: number): ComposerToken | null => {
  const safeCursor = Math.max(0, Math.min(cursor, value.length));
  let start = safeCursor;
  while (start > 0) {
    const previous = value[start - 1];
    if (!previous || isTokenBoundary(previous)) {
      break;
    }
    start -= 1;
  }

  const token = value.slice(start, safeCursor);
  if (!token.startsWith("/")) {
    return null;
  }

  return {
    from: start,
    to: safeCursor,
    query: token.slice(1),
    raw: token,
  };
};
