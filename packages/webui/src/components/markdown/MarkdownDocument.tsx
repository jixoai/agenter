import { markdown } from "@codemirror/lang-markdown";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { memo, useMemo } from "react";

import { cn } from "../../lib/utils";
import { markdownPreview } from "./codemirror-markdown-preview";
import {
  resolveMarkdownCodeLanguage,
  resolveMarkdownDocumentProfile,
  type MarkdownDocumentDensity,
  type MarkdownDocumentMode,
  type MarkdownDocumentOverflow,
  type MarkdownDocumentPadding,
  type MarkdownDocumentSurface,
  type MarkdownDocumentSyntaxTone,
  type MarkdownDocumentUsage,
} from "./markdown-config";

export type {
  MarkdownDocumentDensity,
  MarkdownDocumentMode,
  MarkdownDocumentOverflow,
  MarkdownDocumentPadding,
  MarkdownDocumentSurface,
  MarkdownDocumentSyntaxTone,
  MarkdownDocumentUsage,
};

export type MarkdownDocumentChrome = "surface" | "plain";

export interface MarkdownDocumentProps {
  value: string;
  mode?: MarkdownDocumentMode;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
  usage?: MarkdownDocumentUsage;
  surface?: MarkdownDocumentSurface;
  overflow?: MarkdownDocumentOverflow;
  syntaxTone?: MarkdownDocumentSyntaxTone;
  chrome?: MarkdownDocumentChrome;
  density?: MarkdownDocumentDensity;
  padding?: MarkdownDocumentPadding | "default" | "none";
}

const MARKDOWN_BASIC_SETUP = {
  lineNumbers: false,
  foldGutter: false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  autocompletion: false,
  bracketMatching: false,
  closeBrackets: false,
  searchKeymap: false,
} as const;

const MARKDOWN_LANGUAGE_EXTENSION = markdown({
  codeLanguages: (info) => resolveMarkdownCodeLanguage(info),
});

const READ_ONLY_MARKDOWN_EXTENSIONS: readonly Extension[] = [
  EditorState.readOnly.of(true),
  EditorView.editable.of(false),
  EditorView.lineWrapping,
];

const MARKDOWN_PREVIEW_EXTENSION = markdownPreview();

const densityTokens = {
  default: {
    fontSize: "13px",
    lineHeight: "1.6",
    padding: "14px 16px",
  },
  compact: {
    fontSize: "12px",
    lineHeight: "1.5",
    padding: "10px 12px",
  },
} as const;

const paddingTokens: Record<MarkdownDocumentPadding, string> = {
  default: "14px 16px",
  compact: "10px 12px",
  none: "0",
};

const surfaceClassNames: Record<MarkdownDocumentSurface, string> = {
  plain: "bg-transparent",
  panel: "rounded-xl border border-slate-200 bg-white shadow-xs",
  muted: "rounded-xl bg-slate-50 ring-1 ring-slate-200/80",
  "bubble-user": "bg-transparent",
  "bubble-assistant": "bg-transparent",
  "bubble-self-talk": "bg-transparent",
};

const legacySurface = (chrome: MarkdownDocumentChrome | undefined): MarkdownDocumentSurface | undefined => {
  if (!chrome) {
    return undefined;
  }
  return chrome === "plain" ? "plain" : "panel";
};

interface MarkdownThemePalette {
  heading: string;
  link: string;
  inlineCode: string;
  inlineCodeBg: string;
  inlineCodeBorder: string;
  quote: string;
  keyword: string;
  string: string;
  number: string;
  comment: string;
  type: string;
  function: string;
  property: string;
  operator: string;
  codeBg: string;
  codeBorder: string;
  codeLabel: string;
  codeText: string;
}

const palettes: Record<MarkdownDocumentSurface, MarkdownThemePalette> = {
  plain: {
    heading: "currentColor",
    link: "#0f766e",
    inlineCode: "#0f172a",
    inlineCodeBg: "color-mix(in srgb, #0f172a 8%, transparent)",
    inlineCodeBorder: "color-mix(in srgb, #0f172a 14%, transparent)",
    quote: "color-mix(in srgb, #334155 78%, transparent)",
    keyword: "#0f766e",
    string: "#047857",
    number: "#b45309",
    comment: "#64748b",
    type: "#1d4ed8",
    function: "#0369a1",
    property: "#0f766e",
    operator: "color-mix(in srgb, #0f172a 60%, transparent)",
    codeBg: "color-mix(in srgb, #e2e8f0 76%, white)",
    codeBorder: "color-mix(in srgb, #94a3b8 35%, transparent)",
    codeLabel: "color-mix(in srgb, #334155 82%, transparent)",
    codeText: "#0f172a",
  },
  panel: {
    heading: "#0f172a",
    link: "#0f766e",
    inlineCode: "#0f172a",
    inlineCodeBg: "color-mix(in srgb, #0f172a 7%, transparent)",
    inlineCodeBorder: "color-mix(in srgb, #0f172a 12%, transparent)",
    quote: "#475569",
    keyword: "#0f766e",
    string: "#047857",
    number: "#b45309",
    comment: "#64748b",
    type: "#1d4ed8",
    function: "#0369a1",
    property: "#0f766e",
    operator: "#334155",
    codeBg: "#f8fafc",
    codeBorder: "#cbd5e1",
    codeLabel: "#475569",
    codeText: "#0f172a",
  },
  muted: {
    heading: "#0f172a",
    link: "#0f766e",
    inlineCode: "#0f172a",
    inlineCodeBg: "color-mix(in srgb, #0f172a 6%, white)",
    inlineCodeBorder: "color-mix(in srgb, #0f172a 10%, transparent)",
    quote: "#475569",
    keyword: "#0f766e",
    string: "#047857",
    number: "#b45309",
    comment: "#64748b",
    type: "#1d4ed8",
    function: "#0369a1",
    property: "#0f766e",
    operator: "#334155",
    codeBg: "#f1f5f9",
    codeBorder: "#cbd5e1",
    codeLabel: "#475569",
    codeText: "#0f172a",
  },
  "bubble-user": {
    heading: "#f8fafc",
    link: "#ccfbf1",
    inlineCode: "#f8fafc",
    inlineCodeBg: "color-mix(in srgb, #0f172a 22%, transparent)",
    inlineCodeBorder: "color-mix(in srgb, white 28%, transparent)",
    quote: "color-mix(in srgb, white 82%, transparent)",
    keyword: "#ccfbf1",
    string: "#fef3c7",
    number: "#dbeafe",
    comment: "color-mix(in srgb, white 68%, transparent)",
    type: "#e0f2fe",
    function: "#bae6fd",
    property: "#99f6e4",
    operator: "color-mix(in srgb, white 76%, transparent)",
    codeBg: "color-mix(in srgb, #0f172a 18%, transparent)",
    codeBorder: "color-mix(in srgb, white 22%, transparent)",
    codeLabel: "color-mix(in srgb, white 84%, transparent)",
    codeText: "#f8fafc",
  },
  "bubble-assistant": {
    heading: "#0f172a",
    link: "#0f766e",
    inlineCode: "#0f172a",
    inlineCodeBg: "color-mix(in srgb, #0f172a 6%, white)",
    inlineCodeBorder: "color-mix(in srgb, #0f172a 12%, transparent)",
    quote: "#475569",
    keyword: "#0f766e",
    string: "#047857",
    number: "#b45309",
    comment: "#64748b",
    type: "#1d4ed8",
    function: "#0369a1",
    property: "#0f766e",
    operator: "#334155",
    codeBg: "#f8fafc",
    codeBorder: "#cbd5e1",
    codeLabel: "#475569",
    codeText: "#0f172a",
  },
  "bubble-self-talk": {
    heading: "#0f172a",
    link: "#0f766e",
    inlineCode: "#0f172a",
    inlineCodeBg: "color-mix(in srgb, #0f172a 6%, white)",
    inlineCodeBorder: "color-mix(in srgb, #0f172a 10%, transparent)",
    quote: "#475569",
    keyword: "#334155",
    string: "#0369a1",
    number: "#b45309",
    comment: "#64748b",
    type: "#1d4ed8",
    function: "#475569",
    property: "#0f766e",
    operator: "#475569",
    codeBg: "#f8fafc",
    codeBorder: "#cbd5e1",
    codeLabel: "#64748b",
    codeText: "#0f172a",
  },
};

const buildTonePalette = (input: {
  surface: MarkdownDocumentSurface;
  syntaxTone: MarkdownDocumentSyntaxTone;
}): MarkdownThemePalette => {
  const palette = palettes[input.surface];
  if (input.syntaxTone === "accented") {
    return palette;
  }
  return {
    ...palette,
    heading: "currentColor",
    link: "currentColor",
    inlineCode: "currentColor",
    inlineCodeBg: "color-mix(in srgb, currentColor 10%, transparent)",
    inlineCodeBorder: "color-mix(in srgb, currentColor 16%, transparent)",
    quote: "color-mix(in srgb, currentColor 72%, transparent)",
    keyword: "currentColor",
    string: "currentColor",
    number: "currentColor",
    comment: "color-mix(in srgb, currentColor 62%, transparent)",
    type: "currentColor",
    function: "currentColor",
    property: "currentColor",
    operator: "color-mix(in srgb, currentColor 72%, transparent)",
    codeBg: "color-mix(in srgb, currentColor 6%, transparent)",
    codeBorder: "color-mix(in srgb, currentColor 16%, transparent)",
    codeLabel: "color-mix(in srgb, currentColor 72%, transparent)",
    codeText: "currentColor",
  };
};

const buildTheme = (input: {
  minHeight: number;
  maxHeight?: number;
  density: MarkdownDocumentDensity;
  padding: MarkdownDocumentPadding;
  overflow: MarkdownDocumentOverflow;
  syntaxTone: MarkdownDocumentSyntaxTone;
  surface: MarkdownDocumentSurface;
}): Extension => {
  const density = densityTokens[input.density];
  const resolvedPadding = input.padding === "default" ? density.padding : paddingTokens[input.padding];
  const palette = buildTonePalette({
    surface: input.surface,
    syntaxTone: input.syntaxTone,
  });

  return EditorView.theme({
    "&": {
      minHeight: `${input.minHeight}px`,
      maxHeight: input.maxHeight ? `${input.maxHeight}px` : "none",
      backgroundColor: "transparent",
      color: "inherit",
      "--md-heading": palette.heading,
      "--md-link": palette.link,
      "--md-inline-code": palette.inlineCode,
      "--md-inline-code-bg": palette.inlineCodeBg,
      "--md-inline-code-border": palette.inlineCodeBorder,
      "--md-quote": palette.quote,
      "--md-keyword": palette.keyword,
      "--md-string": palette.string,
      "--md-number": palette.number,
      "--md-comment": palette.comment,
      "--md-type": palette.type,
      "--md-function": palette.function,
      "--md-property": palette.property,
      "--md-operator": palette.operator,
      "--md-code-bg": palette.codeBg,
      "--md-code-border": palette.codeBorder,
      "--md-code-label": palette.codeLabel,
      "--md-code-text": palette.codeText,
    },
    ".cm-focused": {
      outline: "none",
    },
    ".cm-scroller": {
      overflow: input.overflow === "scroll" ? "auto" : "visible",
      maxHeight: input.maxHeight ? `${input.maxHeight}px` : "none",
    },
    ".cm-content": {
      padding: resolvedPadding,
      fontFamily: "var(--font-sans)",
      fontSize: density.fontSize,
      lineHeight: density.lineHeight,
      caretColor: "transparent",
      color: "inherit",
    },
    ".cm-line": {
      paddingInline: 0,
    },
    ".cm-gutters": {
      display: "none",
    },
    ".cm-activeLine": {
      backgroundColor: "transparent",
    },
    ".cm-selectionBackground, ::selection": {
      backgroundColor: "color-mix(in srgb, var(--color-primary), transparent 82%)",
    },
    ".cm-cursor, .cm-dropCursor": {
      display: "none",
    },
    ".cm-tooltip": {
      fontFamily: "var(--font-mono)",
    },
  });
};

const MarkdownDocumentComponent = ({
  value,
  mode = "preview",
  minHeight = 0,
  maxHeight,
  className,
  usage = "document",
  surface,
  overflow,
  syntaxTone,
  chrome,
  density,
  padding,
}: MarkdownDocumentProps) => {
  const requestedSurface = surface ?? legacySurface(chrome);
  const profile = useMemo(
    () =>
      resolveMarkdownDocumentProfile({
        usage,
        surface: requestedSurface,
        overflow,
        syntaxTone,
        maxHeight,
        density,
        padding: (padding as MarkdownDocumentPadding | undefined) ?? undefined,
      }),
    [density, maxHeight, overflow, padding, requestedSurface, syntaxTone, usage],
  );

  const themeExtension = useMemo(
    () =>
      buildTheme({
        minHeight,
        maxHeight: profile.maxHeight,
        density: profile.density,
        padding: profile.padding,
        overflow: profile.overflow,
        syntaxTone: profile.syntaxTone,
        surface: profile.surface,
      }),
    [
      minHeight,
      profile.density,
      profile.maxHeight,
      profile.overflow,
      profile.padding,
      profile.surface,
      profile.syntaxTone,
    ],
  );

  const extensions = useMemo(() => {
    const result: Extension[] = [...READ_ONLY_MARKDOWN_EXTENSIONS, MARKDOWN_LANGUAGE_EXTENSION, themeExtension];
    if (mode === "preview") {
      result.push(MARKDOWN_PREVIEW_EXTENSION);
    }
    return result;
  }, [mode, themeExtension]);

  return (
    <CodeMirror
      value={value}
      theme="none"
      editable={false}
      basicSetup={MARKDOWN_BASIC_SETUP}
      className={cn("overflow-hidden text-inherit", surfaceClassNames[profile.surface], className)}
      extensions={extensions}
    />
  );
};

const markdownDocumentPropsEqual = (left: MarkdownDocumentProps, right: MarkdownDocumentProps): boolean => {
  return (
    left.value === right.value &&
    left.mode === right.mode &&
    left.minHeight === right.minHeight &&
    left.maxHeight === right.maxHeight &&
    left.className === right.className &&
    left.usage === right.usage &&
    left.surface === right.surface &&
    left.overflow === right.overflow &&
    left.syntaxTone === right.syntaxTone &&
    left.chrome === right.chrome &&
    left.density === right.density &&
    left.padding === right.padding
  );
};

export const MarkdownDocument = memo(MarkdownDocumentComponent, markdownDocumentPropsEqual);
MarkdownDocument.displayName = "MarkdownDocument";
