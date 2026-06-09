import { LitElement, css, html, type TemplateResult } from "lit";
import { stringify as stringifyYaml } from "yaml";

import { defineElement } from "./custom-element";
import {
  DEFAULT_JSON_VIEWER_MODE,
  JSON_VIEWER_MODE_OPTIONS,
  getGlobalJsonViewerModeSnapshot,
  resolveJsonViewerMode,
  setGlobalJsonViewerMode,
  subscribeGlobalJsonViewerMode,
  type JsonViewerMode,
} from "./json-viewer-store";

export const JSON_VIEWER_TAG = "agenter-json-viewer";
export const JSON_VIEWER_PARTS = {
  root: "root",
  toolbar: "toolbar",
  menuTrigger: "menu-trigger",
  menu: "menu",
  menuLabel: "menu-label",
  menuOption: "menu-option",
  wrapToggle: "wrap-toggle",
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
type JsonViewerLineWrap = "wrap" | "nowrap";

interface PopoverToggleEvent extends Event {
  newState?: "open" | "closed";
}

interface NativePopoverElement extends HTMLElement {
  showPopover(): void;
  hidePopover(): void;
}

interface ParsedYamlMappingLine {
  indent: string;
  dash: string;
  key: string;
  separator: string;
  value: string;
}

const pushIndentFragment = (fragments: TemplateResult[], indent: string): void => {
  if (indent.length > 0) {
    fragments.push(html`<span class="indent">${indent}</span>`);
  }
};

const pushFragment = (fragments: TemplateResult[], fragment: TemplateResult | null): void => {
  if (fragment) {
    fragments.push(fragment);
  }
};

const renderLine = (index: number, fragments: TemplateResult[], className = "line") =>
  html`<div class=${className} part=${JSON_VIEWER_PARTS.line} data-line=${index}>${fragments}</div>`;

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
    const fragments: TemplateResult[] = [];
    pushIndentFragment(fragments, indent);
    fragments.push(html`<span class=${JSON_KEY_CLASS_NAME}>"${key}"</span>`);
    fragments.push(html`<span class=${JSON_PUNCTUATION_CLASS_NAME}>${separator}</span>`);
    pushFragment(fragments, renderScalarFragment(value));
    if (comma) {
      fragments.push(html`<span class=${JSON_PUNCTUATION_CLASS_NAME}>${comma}</span>`);
    }
    return renderLine(index, fragments);
  }
  const [, indent, remainder] = line.match(/^(\s*)(.*)$/) ?? ["", "", line];
  const { value, comma } = splitTrailingComma(remainder);
  const fragments: TemplateResult[] = [];
  pushIndentFragment(fragments, indent);
  pushFragment(fragments, renderScalarFragment(value));
  if (comma) {
    fragments.push(html`<span class=${JSON_PUNCTUATION_CLASS_NAME}>${comma}</span>`);
  }
  return renderLine(index, fragments);
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
    const fragments: TemplateResult[] = [];
    pushIndentFragment(fragments, keyMatch.indent);
    if (keyMatch.dash) {
      fragments.push(html`<span class=${JSON_PUNCTUATION_CLASS_NAME}>${keyMatch.dash}</span>`);
    }
    fragments.push(html`<span class=${JSON_KEY_CLASS_NAME}>${keyMatch.key}</span>`);
    fragments.push(html`<span class=${JSON_PUNCTUATION_CLASS_NAME}>${keyMatch.separator}</span>`);
    pushFragment(fragments, renderScalarFragment(keyMatch.value, true));
    return renderLine(index, fragments);
  }
  const listScalarMatch = line.match(/^(\s*)(-\s+)(.*)$/);
  if (listScalarMatch) {
    const [, indent, dash, remainder] = listScalarMatch;
    const fragments: TemplateResult[] = [];
    pushIndentFragment(fragments, indent);
    fragments.push(html`<span class=${JSON_PUNCTUATION_CLASS_NAME}>${dash}</span>`);
    pushFragment(fragments, renderScalarFragment(remainder, true));
    return renderLine(index, fragments);
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

const renderTextWrapIcon = () => html`
  <svg
    class="wrap-toggle-icon"
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="2"
  >
    <path d="m16 16-3 3 3 3"></path>
    <path d="M3 12h14.5a1 1 0 0 1 0 7H13"></path>
    <path d="M3 19h6"></path>
    <path d="M3 5h18"></path>
  </svg>
`;

export class JsonViewerElement extends LitElement {
  static properties = {
    value: { attribute: false },
    rawText: { type: String, attribute: "raw-text" },
    menuLabel: { type: String, attribute: "menu-label" },
    localMode: { attribute: false, state: true },
    globalMode: { attribute: false, state: true },
    menuOpen: { state: true },
    lineWrap: { attribute: false, state: true },
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

    .toolbar-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.375rem;
      min-width: 0;
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
      position: fixed;
      inset: var(--menu-popover-top, 0.75rem) auto auto var(--menu-popover-left, 0.75rem);
      z-index: 10;
      width: min(18rem, var(--menu-popover-max-width, calc(100vw - 1rem)));
      margin: 0;
      border: 1px solid hsl(var(--border, 214 32% 91%));
      border-radius: 1rem;
      background: hsl(var(--background, 0 0% 100%));
      color: hsl(var(--foreground, 222 47% 11%));
      box-shadow: 0 1rem 2.5rem rgba(15, 23, 42, 0.14);
      padding: 0.5rem;
    }

    .menu[data-native-popover="false"][data-open="false"] {
      display: none;
    }

    .menu:popover-open {
      display: block;
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

    .wrap-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      min-inline-size: 4.25rem;
      justify-content: center;
      border: 1px solid color-mix(in srgb, hsl(var(--border, 214 32% 91%)) 80%, transparent);
      border-radius: 0.5rem;
      background: transparent;
      color: hsl(var(--foreground, 222 47% 11%));
      cursor: pointer;
      font: inherit;
      font-size: 0.625rem;
      font-weight: 700;
      line-height: 1;
      padding: 0.4rem 0.55rem;
      text-transform: lowercase;
      transition:
        background 120ms ease,
        border-color 120ms ease,
        color 120ms ease;
    }

    .wrap-toggle:hover {
      background: color-mix(in srgb, hsl(var(--muted, 210 40% 96%)) 62%, transparent);
    }

    .wrap-toggle[data-state="on"] {
      border-color: color-mix(in srgb, hsl(var(--border, 214 32% 91%)) 92%, hsl(var(--foreground, 222 47% 11%)) 8%);
      background: color-mix(in srgb, hsl(var(--muted, 210 40% 96%)) 82%, transparent);
      color: hsl(var(--foreground, 222 47% 11%));
    }

    .wrap-toggle:disabled {
      cursor: default;
      opacity: 0.55;
    }

    .wrap-toggle:disabled:hover {
      background: transparent;
    }

    .wrap-toggle-icon {
      inline-size: 0.875rem;
      block-size: 0.875rem;
      flex: 0 0 auto;
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
    }

    .line {
      display: block;
    }

    .root[data-wrap="wrap"] .content-plain,
    .root[data-wrap="wrap"] .line {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: normal;
    }

    .root[data-wrap="nowrap"] .content-plain,
    .root[data-wrap="nowrap"] .line {
      white-space: pre;
      overflow-wrap: normal;
      word-break: normal;
    }

    .indent {
      white-space: pre;
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

  private lineWrap: JsonViewerLineWrap = "wrap";

  private unsubscribeGlobalMode: (() => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.globalMode = getGlobalJsonViewerModeSnapshot();
    this.unsubscribeGlobalMode = subscribeGlobalJsonViewerMode(() => {
      this.globalMode = getGlobalJsonViewerModeSnapshot();
    });
  }

  disconnectedCallback(): void {
    this.unsubscribeGlobalMode?.();
    this.unsubscribeGlobalMode = null;
    super.disconnectedCallback();
  }

  protected updated(): void {
    const activeMode = this.resolveActiveMode();
    const effectiveWrap = this.resolveEffectiveWrap(activeMode);
    this.setAttribute("data-mode", activeMode);
    this.setAttribute("data-wrap", effectiveWrap);
    this.toggleAttribute("menu-open", this.menuOpen);
  }

  private isNativePopover(menu: HTMLElement): menu is NativePopoverElement {
    return typeof menu.showPopover === "function" && typeof menu.hidePopover === "function";
  }

  private supportsNativePopover(): boolean {
    return (
      typeof HTMLElement !== "undefined" &&
      "showPopover" in HTMLElement.prototype &&
      "hidePopover" in HTMLElement.prototype
    );
  }

  private getMenuElement(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".menu");
  }

  private isMenuPopoverOpen(menu: HTMLElement): boolean {
    try {
      return menu.matches(":popover-open");
    } catch {
      return this.menuOpen;
    }
  }

  private positionMenuPopover(menu: HTMLElement): void {
    const trigger = this.renderRoot.querySelector<HTMLElement>(".menu-trigger");
    if (!trigger || typeof window === "undefined") {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const gap = 6;
    const viewportPadding = 8;
    const menuWidth = Math.min(288, Math.max(160, window.innerWidth - viewportPadding * 2));
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding),
    );
    const top = Math.min(rect.bottom + gap, Math.max(viewportPadding, window.innerHeight - viewportPadding));
    menu.style.setProperty("--menu-popover-left", `${left}px`);
    menu.style.setProperty("--menu-popover-top", `${top}px`);
    menu.style.setProperty("--menu-popover-max-width", `${menuWidth}px`);
  }

  private toggleMenuPopover(): void {
    const menu = this.getMenuElement();
    if (!menu || !this.isNativePopover(menu)) {
      this.menuOpen = !this.menuOpen;
      return;
    }
    this.positionMenuPopover(menu);
    if (this.isMenuPopoverOpen(menu)) {
      menu.hidePopover();
      this.menuOpen = false;
      return;
    }
    this.menuOpen = true;
    menu.showPopover();
  }

  private closeMenuPopover(): void {
    const menu = this.getMenuElement();
    if (menu && this.isNativePopover(menu) && this.isMenuPopoverOpen(menu)) {
      menu.hidePopover();
    }
    this.menuOpen = false;
  }

  private readonly handleMenuToggle = (event: Event): void => {
    const toggleEvent = event as PopoverToggleEvent;
    if (toggleEvent.newState) {
      this.menuOpen = toggleEvent.newState === "open";
      return;
    }
    const currentTarget = event.currentTarget;
    if (currentTarget instanceof HTMLElement) {
      this.menuOpen = this.isMenuPopoverOpen(currentTarget);
    }
  };

  private setViewerMode(scope: "local" | "global", mode: JsonViewerMode): void {
    if (scope === "local") {
      this.localMode = mode;
    } else {
      setGlobalJsonViewerMode(mode);
    }
    this.closeMenuPopover();
  }

  private resolveActiveMode(): JsonViewerMode {
    return resolveJsonViewerMode({
      localMode: this.localMode,
      globalMode: this.globalMode,
    });
  }

  private resolveEffectiveWrap(mode: JsonViewerMode): JsonViewerLineWrap {
    return mode === "raw-text-json" ? "nowrap" : this.lineWrap;
  }

  private toggleLineWrap(): void {
    this.lineWrap = this.lineWrap === "wrap" ? "nowrap" : "wrap";
  }

  render() {
    const activeMode = this.resolveActiveMode();
    const effectiveWrap = this.resolveEffectiveWrap(activeMode);
    const nativePopover = this.supportsNativePopover();
    const jsonText = serializeJson(this.value);
    const yamlText = serializeYaml(this.value);
    const rawJsonText = this.rawText || jsonText;
    const renderedText =
      activeMode === "highlight-yaml" ? yamlText : activeMode === "fmt-highlight-json" ? jsonText : rawJsonText;

    return html`
      <div class="root" part=${JSON_VIEWER_PARTS.root} data-json-viewer-mode=${activeMode} data-wrap=${effectiveWrap}>
        <div class="toolbar" part=${JSON_VIEWER_PARTS.toolbar}>
          <button
            class="menu-trigger"
            part=${JSON_VIEWER_PARTS.menuTrigger}
            type="button"
            aria-label=${this.menuLabel}
            aria-expanded=${this.menuOpen ? "true" : "false"}
            @click=${() => this.toggleMenuPopover()}
          >
            ${modeLabel(activeMode)}
          </button>
          <div class="toolbar-actions">
            <button
              class="wrap-toggle"
              part=${JSON_VIEWER_PARTS.wrapToggle}
              type="button"
              aria-label=${effectiveWrap === "wrap" ? "Disable line wrapping" : "Enable line wrapping"}
              aria-pressed=${effectiveWrap === "wrap" ? "true" : "false"}
              title=${activeMode === "raw-text-json"
                ? "Raw JSON is always unwrapped"
                : effectiveWrap === "wrap"
                  ? "Disable line wrapping"
                  : "Enable line wrapping"}
              data-state=${effectiveWrap === "wrap" ? "on" : "off"}
              ?disabled=${activeMode === "raw-text-json"}
              @click=${() => this.toggleLineWrap()}
            >
              ${renderTextWrapIcon()}
              <span>wrap</span>
            </button>
          </div>
        </div>

        <div
          class="menu"
          part=${JSON_VIEWER_PARTS.menu}
          role="menu"
          popover="auto"
          data-open=${this.menuOpen ? "true" : "false"}
          data-native-popover=${nativePopover ? "true" : "false"}
          @toggle=${this.handleMenuToggle}
        >
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
