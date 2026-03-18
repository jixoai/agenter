import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";

export type MarkdownDocumentMode = "preview" | "raw";
export type MarkdownDocumentUsage = "document" | "chat" | "inspector" | "inline";
export type MarkdownDocumentSurface =
  | "plain"
  | "panel"
  | "muted"
  | "bubble-user"
  | "bubble-assistant"
  | "bubble-self-talk";
export type MarkdownDocumentOverflow = "grow" | "scroll";
export type MarkdownDocumentDensity = "default" | "compact";
export type MarkdownDocumentPadding = "default" | "compact" | "none";
export type MarkdownDocumentSyntaxTone = "accented" | "inherit";

export interface MarkdownDocumentProfileInput {
  usage?: MarkdownDocumentUsage;
  surface?: MarkdownDocumentSurface;
  overflow?: MarkdownDocumentOverflow;
  density?: MarkdownDocumentDensity;
  padding?: MarkdownDocumentPadding;
  syntaxTone?: MarkdownDocumentSyntaxTone;
  maxHeight?: number;
}

export interface MarkdownDocumentProfile {
  usage: MarkdownDocumentUsage;
  surface: MarkdownDocumentSurface;
  overflow: MarkdownDocumentOverflow;
  density: MarkdownDocumentDensity;
  padding: MarkdownDocumentPadding;
  syntaxTone: MarkdownDocumentSyntaxTone;
  maxHeight?: number;
}

const usageDefaults: Record<MarkdownDocumentUsage, Omit<MarkdownDocumentProfile, "usage">> = {
  document: {
    surface: "panel",
    overflow: "grow",
    density: "default",
    padding: "default",
    syntaxTone: "accented",
    maxHeight: undefined,
  },
  chat: {
    surface: "plain",
    overflow: "grow",
    density: "compact",
    padding: "none",
    syntaxTone: "inherit",
    maxHeight: undefined,
  },
  inspector: {
    surface: "muted",
    overflow: "scroll",
    density: "compact",
    padding: "compact",
    syntaxTone: "accented",
    maxHeight: 320,
  },
  inline: {
    surface: "plain",
    overflow: "grow",
    density: "compact",
    padding: "none",
    syntaxTone: "inherit",
    maxHeight: undefined,
  },
};

export const resolveMarkdownDocumentProfile = (input: MarkdownDocumentProfileInput = {}): MarkdownDocumentProfile => {
  const usage = input.usage ?? "document";
  const defaults = usageDefaults[usage];

  return {
    usage,
    surface: input.surface ?? defaults.surface,
    overflow: input.overflow ?? defaults.overflow,
    density: input.density ?? defaults.density,
    padding: input.padding ?? defaults.padding,
    syntaxTone: input.syntaxTone ?? defaults.syntaxTone,
    maxHeight: input.maxHeight ?? defaults.maxHeight,
  };
};

const infoAliases: Record<string, string> = {
  yml: "yaml",
  shell: "bash",
  sh: "bash",
  zsh: "bash",
  shellscript: "bash",
  console: "bash",
  env: "bash",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  tsx: "tsx",
  json5: "json",
  jsonc: "json",
  mdx: "markdown",
  text: "plaintext",
  txt: "plaintext",
};

export const normalizeMarkdownCodeLanguage = (input: string): string => {
  const token = input.trim().toLowerCase().split(/\s+/)[0] ?? "";
  if (token.length === 0) {
    return "";
  }
  const base = token.split("+")[0] ?? token;
  return infoAliases[base] ?? base;
};

export const resolveMarkdownCodeLanguage = (info: string): LanguageDescription | null => {
  const normalized = normalizeMarkdownCodeLanguage(info);
  if (normalized.length === 0) {
    return null;
  }
  return LanguageDescription.matchLanguageName(languages, normalized, true);
};
