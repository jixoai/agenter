import { LitElement, css, html } from "lit";
import { stringify as stringifyYaml } from "yaml";

import { defineElement } from "./custom-element";
import {
  DEFAULT_JSON_VIEWER_MODE,
  JSON_VIEWER_MODE_OPTIONS,
  type JsonViewerMode,
  getGlobalJsonViewerModeSnapshot,
  resolveJsonViewerMode,
  setGlobalJsonViewerMode,
  subscribeGlobalJsonViewerMode,
} from "./json-viewer-store";

export const JSON_VIEWER_TAG = "agenter-json-viewer";
export const JSON_VIEWER_PARTS = {
  root: "root",
  toolbar: "toolbar",
  menuTrigger: "menu-trigger",
  menu: "menu",
  menuLabel: "menu-label",
  menuOption: "menu-option",
  content: "content",
  rawContent: "raw-content",
  line: "line",
} as const;

const JSON_PUNCTUATION_CLASS_NAME = "punctuation";
const JSON_KEY_CLASS_NAME = "key";
const JSON_STRING_CLASS_NAME = "string";
const JSON_NUMBER_CLASS_NAME = "number";
const JSON_BOOLEAN_CLASS_NAME = "boolean";
const JSON_NULL_CLASS_NAME = "nullish";

interface ParsedYamlMappingLine {
  indent: string;
  dash: string;
  key: string;
  separator: string;
  value: string;
}

const splitTrailingComma = (value: string): { value: string; comma: string } => {
  return value.endsWith(",") ? { value: value.slice(0, -1), comma: "," } : { value, comma: "" };
};

const renderScalarFragment = (value: string, yaml = false) => {
  if (value.length === 0) {
    return null;
  }
  if ((value.startsWith('"') && value.endsWith('"')) || (yaml && /^'.*'$/.test(value))) {
    return html`<span class=${JSON_STRING_CLASS_NAME}>${value}</span>`;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return html`<span class=${JSON_NUMBER_CLASS_NAME}>${value}</span>`;
  }
  if (value === "true" || value === "false") {
    return html`<span class=${JSON_BOOLEAN_CLASS_NAME}>${value}</span>`;
  }
  if (value === "null" || value === "~") {
    return html`<span class=${JSON_NULL_CLASS_NAME}>${value}</span>`;
  }
  if (value === "{" || value === "}" || value === "[" || value === "]") {
    return html`<span class=${JSON_PUNCTUATION_CLASS_NAME}>${value}</span>`;
  }
  return html`<span class=${yaml ? JSON_STRING_CLASS_NAME : "text"}>${value}</span>`;
};

const renderJsonLine = (line: string, index: number) => {
  const keyMatch = line.match(/^(\s*)"([^"]+)"(:\s*)(.*)$/);
  if (keyMatch) {
    const [, indent, key, separator, remainder] = keyMatch;
    const { value, comma } = splitTrailingComma(remainder);
    return html`
      <div class="line" part=${JSON_VIEWER_PARTS.line} data-line=${index}>
        <span>${indent}</span>
        <span class=${JSON_KEY_CLASS_NAME}>"${key}"</span>
        <span class=${JSON_PUNCTUATION_CLASS_NAME}>${separator}</span>
        ${renderScalarFragment(value)}
        ${comma ? html`<span class=${JSON_PUNCTUATION_CLASS_NAME}>${comma}</span>` : null}
      </div>
    `;
  }
  const [, indent, remainder] = line.match(/^(\s*)(.*)$/) ?? ["", "", line];
  const { value, comma } = splitTrailingComma(remainder);
  return html`
    <div class="line" part=${JSON_VIEWER_PARTS.line} data-line=${index}>
      <span>${indent}</span>
      ${renderScalarFragment(value)}
      ${comma ? html`<span class=${JSON_PUNCTUATION_CLASS_NAME}>${comma}</span>` : null}
    </div>
  `;
};

const parseYamlMappingLine = (line: string): ParsedYamlMappingLine | null => {
  const indent = line.match(/^\s*/)?.[0] ?? "";
  let remainder = line.slice(indent.length);
  let dash = "";
  if (remainder.startsWith("- ")) {
    dash = "- ";
    remainder = remainder.slice(2);
  }
  if (remainder.length === 0) {
    return null;
  }
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  for (let index = 0; index < remainder.length; index += 1) {
    const char = remainder[index]!;
    if (inDouble) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inDouble = false;
      }
      continue;
    }
    if (inSingle) {
      if (char === "'") {
        inSingle = false;
      }
      continue;
    }
    if (char === '"') {
      inDouble = true;
      continue;
    }
    if (char === "'") {
      inSingle = true;
      continue;
    }
    if (char !== ":") {
      continue;
    }
    const after = remainder.slice(index + 1);
    if (after.length > 0 && !/^\s/.test(after)) {
      continue;
    }
    const key = remainder.slice(0, index).trimEnd();
    if (key.length === 0) {
      return null;
    }
    const whitespace = after.match(/^\s*/)?.[0] ?? "";
    return {
      indent,
      dash,
      key,
      separator: `:${whitespace}`,
      value: after.slice(whitespace.length),
    };
  }
  return null;
};

const renderYamlLine = (line: string, index: number) => {
  const keyMatch = parseYamlMappingLine(line);
  if (keyMatch) {
    return html`
      <div class="line" part=${JSON_VIEWER_PARTS.line} data-line=${index}>
        <span>${keyMatch.indent}</span>
        ${keyMatch.dash ? html`<span class=${JSON_PUNCTUATION_CLASS_NAME}>${keyMatch.dash}</span>` : null}
        <span class=${JSON_KEY_CLASS_NAME}>${keyMatch.key}</span>
        <span class=${JSON_PUNCTUATION_CLASS_NAME}>${keyMatch.separator}</span>
        ${renderScalarFragment(keyMatch.value, true)}
      </div>
    `;
  }
  const listScalarMatch = line.match(/^(\s*)(-\s+)(.*)$/);
  if (listScalarMatch) {
    const [, indent, dash, remainder] = listScalarMatch;
    return html`
      <div class="line" part=${JSON_VIEWER_PARTS.line} data-line=${index}>
        <span>${indent}</span>
        <span class=${JSON_PUNCTUATION_CLASS_NAME}>${dash}</span>
        ${renderScalarFragment(remainder, true)}
      </div>
    `;
  }
  return html`<div class="line text" part=${JSON_VIEWER_PARTS.line} data-line=${index}>${line}</div>`;
};

const renderHighlightedText = (mode: JsonViewerMode, text: string) => {
  const lines = text.split("\n");
  return mode === "highlight-yaml" ? lines.map(renderYamlLine) : lines.map(renderJsonLine);
};

const serializeJson = (value: unknown): string => {
  return JSON.stringify(value, null, 2) ?? "null";
};

const serializeYaml = (value: unknown): string => {
  return stringifyYaml(value, {
    indent: 2,
    lineWidth: 0,
  }).trimEnd();
};

const modeLabel = (mode: JsonViewerMode): string => {
  return JSON_VIEWER_MODE_OPTIONS.find((option) => option.mode === mode)?.label ?? mode;
};

export class JsonViewerElement extends LitElement {
  static properties = {
    value: { attribute: false },
    rawText: { type: String, attribute: "raw-text" },
    menuLabel: { type: String, attribute: "menu-label" },
    localMode: { attribute: false, state: true },
    globalMode: { attribute: false, state: true },
    menuOpen: { state: true },
  };

  static styles = css`
    :host {
      display: block;
      min-width: 0;
    }

    .root {
      position: relative;
      border: 1px solid hsl(var(--border, 214 32% 91%));
      border-radius: 1rem;
      background: color-mix(in srgb, hsl(var(--muted, 210 40% 96%)) 85%, transparent);
      overflow: hidden;
    }

    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid color-mix(in srgb, hsl(var(--border, 214 32% 91%)) 80%, transparent);
    }

    .menu-trigger {
      border: 1px solid color-mix(in srgb, hsl(var(--border, 214 32% 91%)) 80%, transparent);
      border-radius: 999px;
      background: color-mix(in srgb, hsl(var(--background, 0 0% 100%)) 88%, transparent);
      color: hsl(var(--muted-foreground, 215 16% 47%));
      cursor: pointer;
      font: inherit;
      font-size: 0.625rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      padding: 0.35rem 0.7rem;
      text-transform: uppercase;
    }

    .menu {
      position: absolute;
      top: 2.75rem;
      left: 0.75rem;
      z-index: 1;
      width: min(18rem, calc(100% - 1.5rem));
      border: 1px solid hsl(var(--border, 214 32% 91%));
      border-radius: 1rem;
      background: hsl(var(--background, 0 0% 100%));
      box-shadow: 0 1rem 2.5rem rgba(15, 23, 42, 0.14);
      padding: 0.5rem;
    }

    .menu-label {
      color: hsl(var(--muted-foreground, 215 16% 47%));
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      padding: 0.35rem 0.5rem;
      text-transform: uppercase;
    }

    .menu-option {
      display: grid;
      gap: 0.125rem;
      width: 100%;
      padding: 0.5rem;
      border: none;
      border-radius: 0.75rem;
      background: transparent;
      color: hsl(var(--foreground, 222 47% 11%));
      cursor: pointer;
      font: inherit;
      text-align: left;
    }

    .menu-option:hover,
    .menu-option[data-active="true"] {
      background: color-mix(in srgb, hsl(var(--muted, 210 40% 96%)) 70%, transparent);
    }

    .menu-option-title {
      font-size: 0.8125rem;
      font-weight: 600;
    }

    .menu-option-description {
      color: hsl(var(--muted-foreground, 215 16% 47%));
      font-size: 0.6875rem;
      line-height: 1.4;
    }

    .content {
      overflow: auto;
      max-width: 100%;
      padding: 0.75rem;
      color: hsl(var(--foreground, 222 47% 11%));
      font-family: var(--font-mono, "JetBrains Mono Variable", monospace);
      font-size: 0.6875rem;
      line-height: 1.7;
      scrollbar-width: thin;
    }

    .content-plain {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .line {
      white-space: pre-wrap;
      word-break: break-word;
    }

    .punctuation {
      color: #94a3b8;
    }

    .key {
      color: #64748b;
    }

    .string {
      color: #0369a1;
    }

    .number {
      color: #b45309;
    }

    .boolean {
      color: #047857;
    }

    .nullish {
      color: #94a3b8;
      font-style: italic;
    }

    .text {
      color: hsl(var(--foreground, 222 47% 11%));
    }
  `;

  value: unknown = null;

  rawText = "";

  menuLabel = "Structured value options";

  private localMode: JsonViewerMode | null = null;

  private globalMode: JsonViewerMode = DEFAULT_JSON_VIEWER_MODE;

  private menuOpen = false;

  private unsubscribeGlobalMode: (() => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.globalMode = getGlobalJsonViewerModeSnapshot();
    this.unsubscribeGlobalMode = subscribeGlobalJsonViewerMode(() => {
      this.globalMode = getGlobalJsonViewerModeSnapshot();
    });
    document.addEventListener("pointerdown", this.handleDocumentPointerDown, true);
    document.addEventListener("keydown", this.handleDocumentKeyDown, true);
  }

  disconnectedCallback(): void {
    this.unsubscribeGlobalMode?.();
    this.unsubscribeGlobalMode = null;
    document.removeEventListener("pointerdown", this.handleDocumentPointerDown, true);
    document.removeEventListener("keydown", this.handleDocumentKeyDown, true);
    super.disconnectedCallback();
  }

  protected updated(): void {
    const activeMode = this.resolveActiveMode();
    this.setAttribute("data-mode", activeMode);
    this.toggleAttribute("menu-open", this.menuOpen);
  }

  private readonly handleDocumentPointerDown = (event: PointerEvent): void => {
    if (!this.menuOpen) {
      return;
    }
    const path = event.composedPath();
    if (path.includes(this)) {
      return;
    }
    this.menuOpen = false;
  };

  private readonly handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && this.menuOpen) {
      this.menuOpen = false;
    }
  };

  private setViewerMode(scope: "local" | "global", mode: JsonViewerMode): void {
    if (scope === "local") {
      this.localMode = mode;
    } else {
      setGlobalJsonViewerMode(mode);
    }
    this.menuOpen = false;
  }

  private resolveActiveMode(): JsonViewerMode {
    return resolveJsonViewerMode({
      localMode: this.localMode,
      globalMode: this.globalMode,
    });
  }

  render() {
    const activeMode = this.resolveActiveMode();
    const jsonText = serializeJson(this.value);
    const yamlText = serializeYaml(this.value);
    const rawJsonText = this.rawText || jsonText;
    const renderedText =
      activeMode === "highlight-yaml" ? yamlText : activeMode === "fmt-highlight-json" ? jsonText : rawJsonText;

    return html`
      <div class="root" part=${JSON_VIEWER_PARTS.root} data-json-viewer-mode=${activeMode}>
        <div class="toolbar" part=${JSON_VIEWER_PARTS.toolbar}>
          <button
            class="menu-trigger"
            part=${JSON_VIEWER_PARTS.menuTrigger}
            type="button"
            aria-label=${this.menuLabel}
            aria-expanded=${this.menuOpen ? "true" : "false"}
            @click=${() => {
              this.menuOpen = !this.menuOpen;
            }}
          >
            ${modeLabel(activeMode)}
          </button>
        </div>

        ${this.menuOpen
          ? html`
              <div class="menu" part=${JSON_VIEWER_PARTS.menu} role="menu">
                <div class="menu-label" part=${JSON_VIEWER_PARTS.menuLabel}>This viewer</div>
                ${JSON_VIEWER_MODE_OPTIONS.map(
                  (option) => html`
                    <button
                      class="menu-option"
                      part=${activeMode === option.mode
                        ? `${JSON_VIEWER_PARTS.menuOption} active-option`
                        : JSON_VIEWER_PARTS.menuOption}
                      type="button"
                      data-active=${activeMode === option.mode ? "true" : "false"}
                      @click=${() => this.setViewerMode("local", option.mode)}
                    >
                      <span class="menu-option-title">${option.label}</span>
                      <span class="menu-option-description">${option.description}</span>
                    </button>
                  `,
                )}
                <div class="menu-label" part=${JSON_VIEWER_PARTS.menuLabel}>All JSON viewers</div>
                ${JSON_VIEWER_MODE_OPTIONS.map(
                  (option) => html`
                    <button
                      class="menu-option"
                      part=${this.globalMode === option.mode
                        ? `${JSON_VIEWER_PARTS.menuOption} global-active-option`
                        : JSON_VIEWER_PARTS.menuOption}
                      type="button"
                      data-active=${this.globalMode === option.mode ? "true" : "false"}
                      @click=${() => this.setViewerMode("global", option.mode)}
                    >
                      <span class="menu-option-title">${option.label}</span>
                      <span class="menu-option-description">${option.description}</span>
                    </button>
                  `,
                )}
              </div>
            `
          : null}

        <div class="content" part=${JSON_VIEWER_PARTS.content}>
          ${activeMode === "raw-text-json"
            ? html`<pre class="content-plain" part=${JSON_VIEWER_PARTS.rawContent}>${renderedText}</pre>`
            : html`${renderHighlightedText(activeMode, renderedText)}`}
        </div>
      </div>
    `;
  }
}

export const defineJsonViewer = (): void => {
  defineElement(JSON_VIEWER_TAG, JsonViewerElement);
};

export type JsonViewerElementType = HTMLElement & {
  value: unknown;
  rawText: string;
  menuLabel: string;
};
