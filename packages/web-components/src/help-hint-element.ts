import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { styleMap } from "lit/directives/style-map.js";

import { defineElement } from "./custom-element";
import { registerHelpHintRuntimeHandle } from "./help-hint-runtime";
import { dismissHelpHint, readHelpHintDismissed } from "./help-hint-store";

export const HELP_HINT_TAG = "agenter-help-hint";

export type HelpHintSide = "top" | "right" | "bottom" | "left";
export type HelpHintAlign = "start" | "center" | "end";
export type HelpHintPresentationMode = "closed" | "passive-auto" | "active-open";
type HelpHintPassiveReason = "onboarding" | "global-shortcut";
type HelpHintDisplayState =
  | { kind: "closed" }
  | { kind: "passive"; reason: HelpHintPassiveReason }
  | { kind: "active"; reason: "manual-click" | "transient" };

export const HELP_HINT_PARTS = {
  trigger: "trigger",
  triggerLabel: "trigger-label",
  popup: "popup",
  content: "content",
} as const;

const VIEWPORT_PADDING = 8;
const HIDDEN_POSITION = -10_000;
const TRANSIENT_CLOSE_DELAY_MS = 100;
const HIDDEN_POPUP_STYLE = {
  "--help-hint-popover-left": `${HIDDEN_POSITION}px`,
  "--help-hint-popover-top": `${HIDDEN_POSITION}px`,
} as const;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
const createClosedState = (): HelpHintDisplayState => ({ kind: "closed" });
const createPassiveState = (reason: HelpHintPassiveReason): HelpHintDisplayState => ({ kind: "passive", reason });
const createActiveState = (reason: "manual-click" | "transient"): HelpHintDisplayState => ({ kind: "active", reason });

const resolveAlignedOffset = (input: {
  align: HelpHintAlign;
  anchorStart: number;
  anchorSize: number;
  popupSize: number;
}): number => {
  if (input.align === "start") {
    return input.anchorStart;
  }
  if (input.align === "end") {
    return input.anchorStart + input.anchorSize - input.popupSize;
  }
  return input.anchorStart + (input.anchorSize - input.popupSize) / 2;
};

export class HelpHintElement extends LitElement {
  static properties = {
    textContext: { type: String },
    helpId: { type: String },
    ariaLabel: { type: String, attribute: "aria-label" },
    side: { type: String },
    align: { type: String },
    sideOffset: { type: Number },
    passiveOnFirstVisit: { type: Boolean, attribute: "passive-on-first-visit" },
    disabled: { type: Boolean, reflect: true },
    displayState: { attribute: false, state: true },
    popupStyle: { attribute: false, state: true },
  };

  static styles = css`
    :host {
      display: inline-flex;
      position: relative;
      z-index: 0;
    }

    :host([open]) {
      z-index: 80;
    }

    .trigger {
      anchor-name: --agenter-help-hint-trigger;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.25rem;
      height: 1.25rem;
      border-radius: 999px;
      border: 1px solid hsl(var(--border, 214 32% 91%));
      background: hsl(var(--background, 0 0% 100%));
      color: hsl(var(--muted-foreground, 215 16% 47%));
      cursor: pointer;
      font: inherit;
      font-size: 0.6875rem;
      font-weight: 700;
      line-height: 1;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
      transition:
        background-color 140ms ease,
        color 140ms ease,
        border-color 140ms ease;
    }

    .trigger[data-popup-open] {
      border-color: color-mix(in srgb, hsl(var(--primary, 222 47% 11%)) 35%, white);
      background: color-mix(in srgb, hsl(var(--primary, 222 47% 11%)) 8%, white);
      color: hsl(var(--primary, 222 47% 11%));
    }

    .popup {
      position: fixed;
      inset: var(--help-hint-popover-top, ${HIDDEN_POSITION}px) auto auto
        var(--help-hint-popover-left, ${HIDDEN_POSITION}px);
      z-index: 60;
      width: max-content;
      max-width: min(30rem, calc(100vw - 1rem));
      border-radius: 0.75rem;
      border: 1px solid hsl(var(--border, 214 32% 91%));
      background: hsl(var(--background, 0 0% 100%));
      color: hsl(var(--foreground, 222 47% 11%));
      box-shadow: 0 1rem 2.5rem rgba(15, 23, 42, 0.12);
      padding: 0.625rem 0.75rem;
      font-size: 0.75rem;
      line-height: 1.6;
      margin: 0;
      outline: none;
    }

    .popup[data-native-popover="true"]:not(:popover-open) {
      display: none;
    }

    .popup::backdrop {
      display: none;
    }

    .popup[data-help-hint-presentation="passive-auto"] {
      pointer-events: none;
      animation: help-hint-breathe 3.2s ease-in-out infinite;
    }

    .popup[data-help-hint-presentation="active-open"] {
      pointer-events: auto;
    }

    ::slotted(*) {
      margin: 0;
    }

    @supports (position-anchor: --agenter-help-hint-trigger) and (position-area: top) {
      @position-try --agenter-help-hint-top {
        position-area: top;
        justify-self: anchor-center;
        align-self: anchor-center;
      }

      @position-try --agenter-help-hint-right {
        position-area: right;
        justify-self: anchor-center;
        align-self: anchor-center;
      }

      @position-try --agenter-help-hint-bottom {
        position-area: bottom;
        justify-self: anchor-center;
        align-self: anchor-center;
      }

      @position-try --agenter-help-hint-left {
        position-area: left;
        justify-self: anchor-center;
        align-self: anchor-center;
      }

      .popup[data-native-popover="true"] {
        inset: auto;
        position-anchor: --agenter-help-hint-trigger;
        position-area: top;
        justify-self: anchor-center;
        align-self: anchor-center;
        position-try-fallbacks: --agenter-help-hint-bottom, --agenter-help-hint-right, --agenter-help-hint-left;
        position-try: --agenter-help-hint-bottom, --agenter-help-hint-right, --agenter-help-hint-left;
        margin: var(--help-hint-side-offset, 8px);
      }

      .popup[data-native-popover="true"][data-side="right"] {
        position-area: right;
        position-try-fallbacks: --agenter-help-hint-left, --agenter-help-hint-bottom, --agenter-help-hint-top;
        position-try: --agenter-help-hint-left, --agenter-help-hint-bottom, --agenter-help-hint-top;
      }

      .popup[data-native-popover="true"][data-side="bottom"] {
        position-area: bottom;
        position-try-fallbacks: --agenter-help-hint-top, --agenter-help-hint-right, --agenter-help-hint-left;
        position-try: --agenter-help-hint-top, --agenter-help-hint-right, --agenter-help-hint-left;
      }

      .popup[data-native-popover="true"][data-side="left"] {
        position-area: left;
        position-try-fallbacks: --agenter-help-hint-right, --agenter-help-hint-bottom, --agenter-help-hint-top;
        position-try: --agenter-help-hint-right, --agenter-help-hint-bottom, --agenter-help-hint-top;
      }
    }

    @keyframes help-hint-breathe {
      0%,
      100% {
        box-shadow: 0 1rem 2.5rem rgba(15, 23, 42, 0.12);
      }
      50% {
        box-shadow: 0 1rem 2.5rem rgba(20, 184, 166, 0.18);
      }
    }
  `;

  textContext = "";

  helpId = "";

  ariaLabel = "Help";

  side: HelpHintSide = "top";

  align: HelpHintAlign = "center";

  sideOffset = 8;

  passiveOnFirstVisit = false;

  disabled = false;

  private displayState: HelpHintDisplayState = createClosedState();

  private popupStyle: Record<string, string> = {
    ...HIDDEN_POPUP_STYLE,
  };

  private frameHandle: number | null = null;
  private transientCloseHandle: number | null = null;
  private popupStyleResetQueued = false;
  private unregisterRuntimeHandle: (() => void) | null = null;
  private readonly popupId = `help-hint-${crypto.randomUUID()}`;

  private get triggerElement(): HTMLButtonElement | null {
    return this.renderRoot?.querySelector<HTMLButtonElement>(".trigger") ?? null;
  }

  private get popupElement(): HTMLDivElement | null {
    return this.renderRoot?.querySelector<HTMLDivElement>(".popup") ?? null;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.unregisterRuntimeHandle = registerHelpHintRuntimeHandle({
      id: this.helpId || this.textContext || crypto.randomUUID(),
      isDisabled: () => this.disabled,
      isOpen: () => this.displayState.kind !== "closed",
      openPassiveFromShortcut: () => {
        this.displayState = createPassiveState("global-shortcut");
      },
      closeFromShortcut: () => {
        this.displayState = createClosedState();
      },
    });
    document.addEventListener("pointerdown", this.handleDocumentPointerDown, true);
    document.addEventListener("keydown", this.handleDocumentKeyDown, true);
    void this.syncPersistence();
  }

  disconnectedCallback(): void {
    this.unregisterRuntimeHandle?.();
    this.unregisterRuntimeHandle = null;
    document.removeEventListener("pointerdown", this.handleDocumentPointerDown, true);
    document.removeEventListener("keydown", this.handleDocumentKeyDown, true);
    if (this.frameHandle !== null) {
      window.cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
    this.clearTransientClose();
    super.disconnectedCallback();
  }

  protected updated(changedProperties: PropertyValues<this>): void {
    this.syncHostStateAttributes();
    if (
      changedProperties.has("disabled") ||
      changedProperties.has("textContext") ||
      changedProperties.has("helpId") ||
      changedProperties.has("passiveOnFirstVisit")
    ) {
      void this.syncPersistence();
    }
    if (this.displayState.kind === "closed") {
      this.clearTransientClose();
      this.scheduleHiddenPopupReset();
      this.syncNativePopover();
      return;
    }
    this.syncNativePopover();
    this.schedulePositioning();
  }

  private syncHostStateAttributes(): void {
    this.toggleAttribute("open", this.open);
    this.setAttribute("data-presentation", this.presentationMode);
  }

  private get open(): boolean {
    return this.displayState.kind !== "closed";
  }

  private get passiveReason(): HelpHintPassiveReason | null {
    return this.displayState.kind === "passive" ? this.displayState.reason : null;
  }

  private get isOnboardingPassive(): boolean {
    return this.passiveReason === "onboarding";
  }

  private get isTransientActive(): boolean {
    return this.displayState.kind === "active" && this.displayState.reason === "transient";
  }

  private get presentationMode(): HelpHintPresentationMode {
    if (this.displayState.kind === "closed") {
      return "closed";
    }
    return this.displayState.kind === "passive" ? "passive-auto" : "active-open";
  }

  private async syncPersistence(): Promise<void> {
    if (this.disabled) {
      this.displayState = createClosedState();
      return;
    }
    if (!this.passiveOnFirstVisit) {
      if (this.isOnboardingPassive) {
        this.displayState = createClosedState();
      }
      return;
    }
    const dismissed = await readHelpHintDismissed({
      helpId: this.helpId || undefined,
      textContext: this.textContext,
    });
    if (dismissed || this.displayState.kind !== "closed") {
      return;
    }
    this.displayState = createPassiveState("onboarding");
  }

  private async dismissOnboardingHint(): Promise<void> {
    this.displayState = createClosedState();
    await dismissHelpHint({
      helpId: this.helpId || undefined,
      textContext: this.textContext,
    });
  }

  private schedulePositioning(): void {
    if (this.frameHandle !== null) {
      window.cancelAnimationFrame(this.frameHandle);
    }
    this.frameHandle = window.requestAnimationFrame(() => {
      this.frameHandle = null;
      this.updatePosition();
    });
  }

  private scheduleHiddenPopupReset(): void {
    if (
      this.popupStyle["--help-hint-popover-left"] === HIDDEN_POPUP_STYLE["--help-hint-popover-left"] &&
      this.popupStyle["--help-hint-popover-top"] === HIDDEN_POPUP_STYLE["--help-hint-popover-top"]
    ) {
      return;
    }
    if (this.popupStyleResetQueued) {
      return;
    }
    this.popupStyleResetQueued = true;
    queueMicrotask(() => {
      this.popupStyleResetQueued = false;
      if (this.displayState.kind !== "closed") {
        return;
      }
      if (
        this.popupStyle["--help-hint-popover-left"] === HIDDEN_POPUP_STYLE["--help-hint-popover-left"] &&
        this.popupStyle["--help-hint-popover-top"] === HIDDEN_POPUP_STYLE["--help-hint-popover-top"]
      ) {
        return;
      }
      this.popupStyle = { ...HIDDEN_POPUP_STYLE };
    });
  }

  private updatePosition(): void {
    const trigger = this.triggerElement;
    const popup = this.popupElement;
    if (!trigger || !popup || !this.open) {
      return;
    }
    const triggerRect = trigger.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

    let top = 0;
    let left = 0;
    if (this.side === "top" || this.side === "bottom") {
      top =
        this.side === "top"
          ? triggerRect.top - popupRect.height - this.sideOffset
          : triggerRect.bottom + this.sideOffset;
      left = resolveAlignedOffset({
        align: this.align,
        anchorStart: triggerRect.left,
        anchorSize: triggerRect.width,
        popupSize: popupRect.width,
      });
    } else {
      left =
        this.side === "left"
          ? triggerRect.left - popupRect.width - this.sideOffset
          : triggerRect.right + this.sideOffset;
      top = resolveAlignedOffset({
        align: this.align,
        anchorStart: triggerRect.top,
        anchorSize: triggerRect.height,
        popupSize: popupRect.height,
      });
    }

    const maxLeft = Math.max(VIEWPORT_PADDING, viewportWidth - popupRect.width - VIEWPORT_PADDING);
    const maxTop = Math.max(VIEWPORT_PADDING, viewportHeight - popupRect.height - VIEWPORT_PADDING);

    const nextPopupStyle = {
      "--help-hint-popover-left": `${clamp(left, VIEWPORT_PADDING, maxLeft)}px`,
      "--help-hint-popover-top": `${clamp(top, VIEWPORT_PADDING, maxTop)}px`,
      "--help-hint-side-offset": `${this.sideOffset}px`,
    };
    if (
      this.popupStyle["--help-hint-popover-left"] !== nextPopupStyle["--help-hint-popover-left"] ||
      this.popupStyle["--help-hint-popover-top"] !== nextPopupStyle["--help-hint-popover-top"] ||
      this.popupStyle["--help-hint-side-offset"] !== nextPopupStyle["--help-hint-side-offset"]
    ) {
      this.popupStyle = nextPopupStyle;
    }
  }

  private get hasNativePopover(): boolean {
    return typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype;
  }

  private syncNativePopover(): void {
    const popup = this.popupElement;
    if (!popup || !this.hasNativePopover) {
      return;
    }
    const nativePopup = popup as HTMLDivElement & {
      showPopover?: () => void;
      hidePopover?: () => void;
    };
    const nativeOpen = popup.matches(":popover-open");
    if (this.open && !nativeOpen) {
      nativePopup.showPopover?.();
      return;
    }
    if (!this.open && nativeOpen) {
      nativePopup.hidePopover?.();
    }
  }

  private readonly handleDocumentPointerDown = (event: PointerEvent): void => {
    if (!this.open) {
      return;
    }
    const path = event.composedPath();
    if (path.includes(this)) {
      return;
    }
    if (this.isOnboardingPassive) {
      return;
    }
    this.displayState = createClosedState();
  };

  private readonly handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && this.open) {
      this.displayState = createClosedState();
    }
  };

  private openTransientHint(): void {
    this.clearTransientClose();
    if (this.displayState.kind !== "closed") {
      return;
    }
    this.displayState = createActiveState("transient");
  }

  private closeTransientHint(): void {
    this.clearTransientClose();
    if (this.isTransientActive) {
      this.displayState = createClosedState();
    }
  }

  private scheduleTransientClose(): void {
    if (!this.isTransientActive) {
      return;
    }
    this.clearTransientClose();
    this.transientCloseHandle = window.setTimeout(() => {
      this.transientCloseHandle = null;
      if (this.isTransientActive) {
        this.displayState = createClosedState();
      }
    }, TRANSIENT_CLOSE_DELAY_MS);
  }

  private clearTransientClose(): void {
    if (this.transientCloseHandle === null) {
      return;
    }
    window.clearTimeout(this.transientCloseHandle);
    this.transientCloseHandle = null;
  }

  private handleTriggerClick(): void {
    if (this.isOnboardingPassive) {
      void this.dismissOnboardingHint();
      return;
    }
    this.displayState =
      this.displayState.kind === "active" && this.displayState.reason === "manual-click"
        ? createClosedState()
        : createActiveState("manual-click");
  }

  render() {
    if (this.disabled) {
      return nothing;
    }

    return html`
      <button
        class="trigger"
        part=${HELP_HINT_PARTS.trigger}
        type="button"
        aria-controls=${this.popupId}
        aria-describedby=${this.open ? this.popupId : nothing}
        aria-label=${this.ariaLabel}
        title=${this.ariaLabel}
        aria-expanded=${this.open ? "true" : "false"}
        data-popup-open=${this.open ? "" : nothing}
        @click=${this.handleTriggerClick}
        @focus=${() => this.openTransientHint()}
        @blur=${() => this.closeTransientHint()}
        @mouseenter=${() => this.openTransientHint()}
        @mouseleave=${() => this.scheduleTransientClose()}
      >
        <span part=${HELP_HINT_PARTS.triggerLabel}>?</span>
      </button>
      <div
        class="popup"
        id=${this.popupId}
        part=${HELP_HINT_PARTS.popup}
        role="tooltip"
        popover=${this.hasNativePopover ? "manual" : nothing}
        aria-hidden=${this.open ? "false" : "true"}
        data-help-hint-presentation=${this.presentationMode}
        data-native-popover=${this.hasNativePopover ? "true" : "false"}
        data-side=${this.side}
        data-align=${this.align}
        ?hidden=${!this.open && !this.hasNativePopover}
        style=${styleMap(this.popupStyle)}
        @click=${() => {
          if (this.isOnboardingPassive) {
            void this.dismissOnboardingHint();
            return;
          }
          if (this.isTransientActive) {
            this.displayState = createActiveState("manual-click");
          }
        }}
        @mouseenter=${() => this.openTransientHint()}
        @mouseleave=${() => this.scheduleTransientClose()}
      >
        <div part=${HELP_HINT_PARTS.content}>
          <slot></slot>
        </div>
      </div>
    `;
  }
}

export const defineHelpHint = (): void => {
  defineElement(HELP_HINT_TAG, HelpHintElement);
};

export type HelpHintElementType = HTMLElement & {
  textContext: string;
  helpId: string;
  ariaLabel: string;
  side: HelpHintSide;
  align: HelpHintAlign;
  sideOffset: number;
  passiveOnFirstVisit: boolean;
  disabled: boolean;
  open: boolean;
  getAttribute(qualifiedName: "data-presentation"): HelpHintPresentationMode | null;
};
