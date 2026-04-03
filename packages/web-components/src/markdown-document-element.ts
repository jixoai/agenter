import hljs from "highlight.js";
import { LitElement, css, html } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import MarkdownIt from "markdown-it";

import { defineElement } from "./custom-element";
import {
  normalizeMarkdownCodeLanguage,
  resolveMarkdownDocumentProfile,
  type MarkdownDocumentDensity,
  type MarkdownDocumentMode,
  type MarkdownDocumentOverflow,
  type MarkdownDocumentPadding,
  type MarkdownDocumentSurface,
  type MarkdownDocumentSyntaxTone,
  type MarkdownDocumentUsage,
} from "./markdown-config";

export const MARKDOWN_DOCUMENT_TAG = "agenter-markdown-document";
export const MARKDOWN_DOCUMENT_PARTS = {
  root: "root",
  viewport: "viewport",
  rawContent: "raw-content",
  markdownContent: "markdown-content",
} as const;

export type MarkdownDocumentChrome = "surface" | "plain";

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
  plain: "surface plain",
  panel: "surface panel",
  muted: "surface muted",
  "bubble-user": "surface bubble-user",
  "bubble-assistant": "surface bubble-assistant",
  "bubble-self-talk": "surface bubble-self-talk",
};

const legacySurface = (chrome: MarkdownDocumentChrome | undefined): MarkdownDocumentSurface | undefined => {
  if (!chrome) {
    return undefined;
  }
  return chrome === "plain" ? "plain" : "panel";
};

const markdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight(code: string, info: string): string {
    const normalized = normalizeMarkdownCodeLanguage(info);
    const escaped = markdownIt.utils.escapeHtml(code);
    const highlighted =
      normalized.length > 0 && hljs.getLanguage(normalized)
        ? hljs.highlight(code, { language: normalized, ignoreIllegals: true }).value
        : escaped;
    const label = normalized || "text";
    return `<div class="code-block"><div class="code-header">${label}</div><pre><code class="hljs language-${label}">${highlighted}</code></pre></div>`;
  },
});

markdownIt.validateLink = (url: string): boolean => {
  const value = url.trim().toLowerCase();
  return (
    value.startsWith("#") ||
    value.startsWith("/") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("mailto:") ||
    value.startsWith("tel:")
  );
};

const linkOpen = markdownIt.renderer.rules.link_open;
type LinkOpenRendererRule = NonNullable<typeof linkOpen>;
markdownIt.renderer.rules.link_open = (
  ...args: Parameters<LinkOpenRendererRule>
): string => {
  const [tokens, index, options, env, self] = args;
  const token = tokens[index];
  token?.attrSet("target", "_blank");
  token?.attrSet("rel", "noreferrer noopener");
  return linkOpen ? linkOpen(tokens, index, options, env, self) : self.renderToken(tokens, index, options);
};

export class MarkdownDocumentElement extends LitElement {
  static properties = {
    value: { type: String },
    mode: { type: String },
    minHeight: { type: Number, attribute: "min-height" },
    maxHeight: { type: Number, attribute: "max-height" },
    usage: { type: String },
    surface: { type: String },
    overflow: { type: String },
    syntaxTone: { type: String, attribute: "syntax-tone" },
    chrome: { type: String },
    density: { type: String },
    padding: { type: String },
  };

  static styles = css`
    :host {
      display: block;
      min-width: 0;
      max-width: 100%;
      color: inherit;
    }

    .surface {
      min-width: 0;
      max-width: 100%;
      color: inherit;
    }

    .surface.panel {
      border: 1px solid hsl(var(--border, 214 32% 91%));
      border-radius: 1rem;
      background: hsl(var(--background, 0 0% 100%));
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
    }

    .surface.muted {
      border-radius: 1rem;
      background: color-mix(in srgb, hsl(var(--muted, 210 40% 96%)) 70%, transparent);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, hsl(var(--border, 214 32% 91%)) 85%, transparent);
    }

    .surface.bubble-user {
      color: white;
    }

    .surface.bubble-assistant,
    .surface.bubble-self-talk,
    .surface.plain {
      background: transparent;
    }

    .viewport {
      min-width: 0;
      max-width: 100%;
      overflow: visible;
      color: inherit;
    }

    .viewport[data-overflow="scroll"] {
      overflow: auto;
      scrollbar-width: thin;
    }

    .viewport.raw {
      white-space: pre-wrap;
      word-break: break-word;
      font-family: var(--font-mono, "JetBrains Mono Variable", monospace);
    }

    .markdown :where(h1, h2, h3, h4, h5, h6) {
      margin: 0 0 0.65em;
      font-weight: 700;
      line-height: 1.3;
    }

    .markdown :where(p, ul, ol, blockquote, pre, table) {
      margin: 0 0 0.85em;
    }

    .markdown :where(ul, ol) {
      padding-left: 1.25rem;
    }

    .markdown :where(li + li) {
      margin-top: 0.2rem;
    }

    .markdown :where(a) {
      color: hsl(var(--primary, 222 47% 11%));
      text-decoration: underline;
      text-underline-offset: 0.18em;
    }

    .markdown :where(code:not(pre code)) {
      display: inline-block;
      border-radius: 0.45rem;
      padding: 0.1rem 0.35rem;
      background: color-mix(in srgb, currentColor 7%, transparent);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 12%, transparent);
      font-family: var(--font-mono, "JetBrains Mono Variable", monospace);
      font-size: 0.9em;
    }

    .markdown :where(blockquote) {
      border-left: 3px solid color-mix(in srgb, currentColor 18%, transparent);
      padding-left: 0.85rem;
      color: color-mix(in srgb, currentColor 78%, transparent);
    }

    .markdown :where(table) {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.95em;
    }

    .markdown :where(th, td) {
      border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
      padding: 0.45rem 0.55rem;
      text-align: left;
    }

    .code-block {
      border-radius: 0.9rem;
      background: color-mix(in srgb, currentColor 4%, transparent);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 12%, transparent);
      overflow: hidden;
    }

    .code-header {
      padding: 0.45rem 0.75rem;
      border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent);
      color: color-mix(in srgb, currentColor 70%, transparent);
      font-family: var(--font-mono, "JetBrains Mono Variable", monospace);
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .code-block pre {
      margin: 0;
      overflow: auto;
      padding: 0.75rem;
    }

    .code-block code {
      display: block;
      font-family: var(--font-mono, "JetBrains Mono Variable", monospace);
      font-size: 0.82em;
      line-height: 1.65;
    }

    .hljs-keyword,
    .hljs-selector-tag,
    .hljs-meta {
      color: var(--md-keyword, #0f766e);
    }

    .hljs-string,
    .hljs-template-tag,
    .hljs-template-variable {
      color: var(--md-string, #047857);
    }

    .hljs-number,
    .hljs-literal {
      color: var(--md-number, #b45309);
    }

    .hljs-comment,
    .hljs-quote {
      color: var(--md-comment, #64748b);
      font-style: italic;
    }

    .hljs-type,
    .hljs-title.class_ {
      color: var(--md-type, #1d4ed8);
    }

    .hljs-title.function_,
    .hljs-function .hljs-title {
      color: var(--md-function, #0369a1);
    }

    .hljs-property,
    .hljs-attr {
      color: var(--md-property, #0f766e);
    }

    .hljs-operator,
    .hljs-punctuation {
      color: var(--md-operator, #334155);
    }
  `;

  value = "";

  mode: MarkdownDocumentMode = "preview";

  minHeight = 0;

  maxHeight = 0;

  usage: MarkdownDocumentUsage = "document";

  surface: MarkdownDocumentSurface | "" = "";

  overflow: MarkdownDocumentOverflow | "" = "";

  syntaxTone: MarkdownDocumentSyntaxTone | "" = "";

  chrome: MarkdownDocumentChrome | "" = "";

  density: MarkdownDocumentDensity | "" = "";

  padding: MarkdownDocumentPadding | "default" | "none" = "default";

  protected updated(): void {
    const profile = this.resolveProfile();
    this.setAttribute("data-mode", this.mode);
    this.setAttribute("data-usage", profile.usage);
    this.setAttribute("data-surface", profile.surface);
    this.setAttribute("data-overflow", profile.overflow);
    this.setAttribute("data-density", profile.density);
  }

  private resolveProfile() {
    return resolveMarkdownDocumentProfile({
      usage: this.usage,
      surface: (this.surface || legacySurface(this.chrome || undefined)) || undefined,
      overflow: this.overflow || undefined,
      density: this.density || undefined,
      padding:
        this.padding === "default" || this.padding === "none" ? (this.padding as MarkdownDocumentPadding) : this.padding,
      syntaxTone: this.syntaxTone || undefined,
      maxHeight: this.maxHeight > 0 ? this.maxHeight : undefined,
    });
  }

  render() {
    const profile = this.resolveProfile();
    const density = densityTokens[profile.density];
    const resolvedPadding = profile.padding === "default" ? density.padding : paddingTokens[profile.padding];
    const palette =
      profile.syntaxTone === "inherit"
        ? {
            "--md-keyword": "currentColor",
            "--md-string": "currentColor",
            "--md-number": "currentColor",
            "--md-comment": "color-mix(in srgb, currentColor 62%, transparent)",
            "--md-type": "currentColor",
            "--md-function": "currentColor",
            "--md-property": "currentColor",
            "--md-operator": "color-mix(in srgb, currentColor 72%, transparent)",
          }
        : {};
    const style = {
      minHeight: `${Math.max(this.minHeight, 0)}px`,
      maxHeight: profile.maxHeight ? `${profile.maxHeight}px` : "none",
      padding: resolvedPadding,
      fontSize: density.fontSize,
      lineHeight: density.lineHeight,
      ...palette,
    };
    const previewHtml = markdownIt.render(this.value);
    return html`
      <div class=${surfaceClassNames[profile.surface]} part=${MARKDOWN_DOCUMENT_PARTS.root}>
        <div
          class=${`viewport ${this.mode === "raw" ? "raw" : "markdown"}`}
          part=${this.mode === "raw"
            ? `${MARKDOWN_DOCUMENT_PARTS.viewport} ${MARKDOWN_DOCUMENT_PARTS.rawContent}`
            : `${MARKDOWN_DOCUMENT_PARTS.viewport} ${MARKDOWN_DOCUMENT_PARTS.markdownContent}`}
          data-overflow=${profile.overflow}
          style=${styleMap(style)}
        >
          ${this.mode === "raw" ? html`<pre>${this.value}</pre>` : html`${unsafeHTML(previewHtml)}`}
        </div>
      </div>
    `;
  }
}

export const defineMarkdownDocument = (): void => {
  defineElement(MARKDOWN_DOCUMENT_TAG, MarkdownDocumentElement);
};

export type MarkdownDocumentElementType = HTMLElement & {
  value: string;
  mode: MarkdownDocumentMode;
  minHeight: number;
  maxHeight: number;
  usage: MarkdownDocumentUsage;
  surface: MarkdownDocumentSurface | "";
  overflow: MarkdownDocumentOverflow | "";
  syntaxTone: MarkdownDocumentSyntaxTone | "";
  chrome: MarkdownDocumentChrome | "";
  density: MarkdownDocumentDensity | "";
  padding: MarkdownDocumentPadding | "default" | "none";
};
