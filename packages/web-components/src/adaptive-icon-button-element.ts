import { LitElement, css, html, type PropertyValues } from "lit";

import { defineElement } from "./custom-element";

export const ADAPTIVE_ICON_BUTTON_TAG = "agenter-adaptive-icon-button";
export const ADAPTIVE_ICON_BUTTON_PARTS = {
  root: "root",
  button: "button",
  icon: "icon",
  label: "label",
} as const;

export type AdaptiveIconButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost";
export type AdaptiveIconButtonSize = "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";
export type AdaptiveIconButtonLabelPriority = "auto" | "always" | "icon-only";

const ICON_ONLY_ALLOWANCE_PX = 42;

const variantClassName = (variant: AdaptiveIconButtonVariant): string => {
  switch (variant) {
    case "default":
      return "button variant-default";
    case "destructive":
      return "button variant-destructive";
    case "secondary":
      return "button variant-secondary";
    case "ghost":
      return "button variant-ghost";
    default:
      return "button variant-outline";
  }
};

const sizeClassName = (size: AdaptiveIconButtonSize, iconOnly: boolean): string => {
  if (iconOnly) {
    return size === "icon-lg" || size === "lg" ? "size-icon-lg" : size === "icon" ? "size-icon" : "size-icon-sm";
  }
  switch (size) {
    case "lg":
      return "size-lg";
    case "icon":
      return "size-icon";
    case "icon-lg":
      return "size-icon-lg";
    case "icon-sm":
      return "size-icon-sm";
    case "default":
      return "size-default";
    default:
      return "size-sm";
  }
};

export class AdaptiveIconButtonElement extends LitElement {
  static properties = {
    label: { type: String },
    tooltip: { type: String },
    titleText: { type: String },
    variant: { type: String, reflect: true },
    size: { type: String, reflect: true },
    labelPriority: { type: String, attribute: "label-priority", reflect: true },
    disabled: { type: Boolean, reflect: true },
    buttonType: { type: String, attribute: "button-type" },
  };

  static styles = css`
    :host {
      display: inline-flex;
      min-width: 0;
      max-width: 100%;
    }

    .root {
      position: relative;
      display: inline-flex;
      width: 100%;
      min-width: 0;
      max-width: 100%;
    }

    .measure {
      position: absolute;
      visibility: hidden;
      white-space: nowrap;
      pointer-events: none;
    }

    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      min-width: 0;
      border-radius: 0.625rem;
      border: 1px solid transparent;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 600;
      line-height: 1;
      cursor: pointer;
      transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease;
      background: transparent;
      color: inherit;
    }

    .button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .button.variant-default {
      background: hsl(var(--primary, 222 47% 11%));
      color: hsl(var(--primary-foreground, 210 40% 98%));
    }

    .button.variant-outline {
      border-color: hsl(var(--border, 214 32% 91%));
      background: hsl(var(--background, 0 0% 100%));
      color: hsl(var(--foreground, 222 47% 11%));
    }

    .button.variant-secondary {
      background: hsl(var(--secondary, 210 40% 96%));
      color: hsl(var(--secondary-foreground, 222 47% 11%));
    }

    .button.variant-ghost {
      color: hsl(var(--foreground, 222 47% 11%));
    }

    .button.variant-destructive {
      background: hsl(var(--destructive, 0 84% 60%));
      color: white;
    }

    .button.size-default {
      min-height: 2.25rem;
      padding: 0.5rem 1rem;
    }

    .button.size-sm {
      min-height: 2rem;
      padding: 0.4rem 0.75rem;
    }

    .button.size-lg {
      min-height: 2.5rem;
      padding: 0.625rem 1.25rem;
    }

    .button.size-icon-sm {
      width: 2rem;
      height: 2rem;
      padding: 0.35rem;
    }

    .button.size-icon {
      width: 2.25rem;
      height: 2.25rem;
      padding: 0.5rem;
    }

    .button.size-icon-lg {
      width: 2.5rem;
      height: 2.5rem;
      padding: 0.625rem;
    }

    .icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
    }

    .icon ::slotted(*) {
      width: 0.95rem;
      height: 0.95rem;
    }

    .label {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `;

  label = "";

  tooltip = "";

  titleText = "";

  variant: AdaptiveIconButtonVariant = "outline";

  size: AdaptiveIconButtonSize = "sm";

  labelPriority: AdaptiveIconButtonLabelPriority = "auto";

  disabled = false;

  buttonType: "button" | "submit" | "reset" = "button";

  private resizeObserver: ResizeObserver | null = null;
  private iconOnly = false;
  private autoSyncQueued = false;

  private get rootElement(): HTMLSpanElement | null {
    return this.renderRoot?.querySelector<HTMLSpanElement>(".root") ?? null;
  }

  private get measureElement(): HTMLSpanElement | null {
    return this.renderRoot?.querySelector<HTMLSpanElement>(".measure") ?? null;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.setupResizeObserver();
  }

  disconnectedCallback(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    super.disconnectedCallback();
  }

  protected firstUpdated(): void {
    this.setupResizeObserver();
    if (this.labelPriority === "auto") {
      this.scheduleAutoIconOnlySync();
    }
  }

  protected willUpdate(): void {
    if (this.labelPriority === "icon-only") {
      this.iconOnly = true;
      return;
    }
    if (this.labelPriority === "always") {
      this.iconOnly = false;
    }
  }

  protected updated(changedProperties: PropertyValues<this>): void {
    if (
      this.labelPriority === "auto" &&
      (changedProperties.has("label") ||
        changedProperties.has("size") ||
        changedProperties.has("labelPriority"))
    ) {
      this.scheduleAutoIconOnlySync();
    }
    this.setAttribute("data-icon-only", this.iconOnly ? "true" : "false");
  }

  private setupResizeObserver(): void {
    if (this.resizeObserver || typeof ResizeObserver === "undefined") {
      return;
    }
    this.resizeObserver = new ResizeObserver(() => {
      if (this.labelPriority === "auto") {
        this.scheduleAutoIconOnlySync();
      }
    });
    if (this.rootElement) {
      this.resizeObserver.observe(this.rootElement);
    }
    if (this.measureElement) {
      this.resizeObserver.observe(this.measureElement);
    }
  }

  private computeAutoIconOnly(): boolean {
    const width = this.rootElement?.clientWidth ?? 0;
    const labelWidth = this.measureElement?.scrollWidth ?? 0;
    return width > 0 && width < labelWidth + ICON_ONLY_ALLOWANCE_PX;
  }

  private scheduleAutoIconOnlySync(): void {
    if (this.autoSyncQueued) {
      return;
    }
    this.autoSyncQueued = true;
    queueMicrotask(() => {
      this.autoSyncQueued = false;
      if (!this.isConnected || this.labelPriority !== "auto") {
        return;
      }
      const nextIconOnly = this.computeAutoIconOnly();
      if (this.iconOnly === nextIconOnly) {
        return;
      }
      this.iconOnly = nextIconOnly;
      this.requestUpdate();
    });
  }

  private syncAutoIconOnly(): void {
    const nextIconOnly = this.computeAutoIconOnly();
    if (this.iconOnly !== nextIconOnly) {
      this.iconOnly = nextIconOnly;
      this.requestUpdate();
    }
  }

  render() {
    const title = this.tooltip || this.titleText || this.label;
    return html`
      <span
        class="root"
        part=${ADAPTIVE_ICON_BUTTON_PARTS.root}
        data-adaptive-icon-only=${this.iconOnly ? "true" : "false"}
      >
        <span class="measure" aria-hidden="true">${this.label}</span>
        <button
          class=${`${variantClassName(this.variant)} ${sizeClassName(this.size, this.iconOnly)}`}
          part=${ADAPTIVE_ICON_BUTTON_PARTS.button}
          type=${this.buttonType}
          ?disabled=${this.disabled}
          aria-label=${this.label}
          title=${title}
        >
          <span class="icon" part=${ADAPTIVE_ICON_BUTTON_PARTS.icon}><slot name="icon"></slot></span>
          ${this.iconOnly
            ? null
            : html`<span class="label" part=${ADAPTIVE_ICON_BUTTON_PARTS.label}>${this.label}</span>`}
        </button>
      </span>
    `;
  }
}

export const defineAdaptiveIconButton = (): void => {
  defineElement(ADAPTIVE_ICON_BUTTON_TAG, AdaptiveIconButtonElement);
};

export type AdaptiveIconButtonElementType = HTMLElement & {
  label: string;
  tooltip: string;
  titleText: string;
  variant: AdaptiveIconButtonVariant;
  size: AdaptiveIconButtonSize;
  labelPriority: AdaptiveIconButtonLabelPriority;
  disabled: boolean;
  buttonType: "button" | "submit" | "reset";
};
