import {
  decodeTerminalTransportServerMessage,
  encodeTerminalTransportClientMessage,
  type TerminalTransportClientMessage,
  type TerminalTransportServerMessage,
} from "@agenter/terminal-transport-protocol";
import { LitElement, html } from "lit";
import { property, query } from "lit/decorators.js";

import {
  DEFAULT_TERMINAL_CURSOR,
  DEFAULT_TERMINAL_RENDERER_PREFERENCE,
  DEFAULT_TERMINAL_THEME,
  resolveTerminalAppearance,
  resolveTerminalRenderer,
  type ResolvedTerminalAppearance,
  type TerminalCursorStyle,
  type TerminalRendererPreference,
  type TerminalResolvedRenderer,
  type TerminalThemeName,
} from "./terminal-renderer-profile";
import { resolveTerminalRendererAdapter, resolveTerminalRendererStyles } from "./terminal-renderer-registry";
import type { TerminalRendererSession } from "./terminal-renderer-adapter";
import { TERMINAL_PUBLIC_SCREEN_ATTRIBUTE } from "./terminal-renderer-adapter";
import { resolveTerminalScreenMetrics } from "./terminal-geometry";
import type { TerminalViewConnectionState, TerminalViewScreenMetrics, TerminalViewSnapshot } from "./terminal-view-types";

export const TERMINAL_VIEW_TAG = "terminal-view";

const FALLBACK_LINE_HEIGHT = 16;
const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const DEFAULT_SCROLLBACK = 10_000;
const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();
const MAX_TEXT_EVIDENCE_LENGTH = 200_000;

const templateStyles = `
  :host {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
  }

  .terminal-stage {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
  }

  .terminal-frame-shell {
    position: relative;
    overflow: hidden;
  }

  .terminal-frame {
    position: relative;
    overflow: hidden;
  }

  .terminal-screen {
    overflow: hidden;
    font-variant-ligatures: normal;
    font-feature-settings: "liga" 1, "calt" 1;
    text-rendering: optimizeLegibility;
  }
`;

const toOwnedArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
};

const ANSI_RESET = "\u001b[0m";

const hexToRgb = (input: string): [number, number, number] | null => {
  const normalized = input.trim();
  const match = /^#(?<hex>[0-9a-f]{6})$/i.exec(normalized);
  if (!match?.groups?.hex) {
    return null;
  }
  const value = match.groups.hex;
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)) as [number, number, number];
};

const toAnsiColor = (prefix: "38" | "48", color: string | undefined): string | null => {
  if (!color) {
    return null;
  }
  const rgb = hexToRgb(color);
  if (!rgb) {
    return null;
  }
  return `${prefix};2;${rgb[0]};${rgb[1]};${rgb[2]}`;
};

const serializeRichSpan = (span: NonNullable<TerminalViewSnapshot["richLines"]>[number]["spans"][number]): string => {
  const codes = [
    span.bold ? "1" : null,
    span.underline ? "4" : null,
    span.inverse ? "7" : null,
    toAnsiColor("38", span.fg),
    toAnsiColor("48", span.bg),
  ].filter((value): value is string => value !== null);

  if (codes.length === 0) {
    return span.text;
  }
  return `\u001b[${codes.join(";")}m${span.text}${ANSI_RESET}`;
};

const serializeSnapshot = (snapshot: TerminalViewSnapshot): string => {
  if (snapshot.richLines && snapshot.richLines.length > 0) {
    return snapshot.richLines
      .map((line: NonNullable<TerminalViewSnapshot["richLines"]>[number]) =>
        line.spans.map((span: NonNullable<TerminalViewSnapshot["richLines"]>[number]["spans"][number]) => serializeRichSpan(span)).join(""),
      )
      .join("\r\n");
  }
  return snapshot.lines.join("\r\n");
};

const stripTerminalControlText = (value: string): string =>
  value
    .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/gu, "")
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, "")
    .replace(/\u001b[@-_]/gu, "")
    .replace(/[^\P{Cc}\n\t]/gu, "");

export class TerminalViewElement extends LitElement {
  static override shadowRootOptions = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true,
  };

  @property({ attribute: "transport-url" }) accessor transportUrl = "";
  @property({ attribute: "live-transport-enabled", type: Boolean }) accessor liveTransportEnabled = true;
  @property({ attribute: "terminal-id" }) accessor terminalId = "";
  @property({ attribute: false }) accessor snapshot: TerminalViewSnapshot | null = null;
  @property({ attribute: false }) accessor connectionState: TerminalViewConnectionState = "idle";
  @property({ attribute: false }) accessor errorMessage = "";
  @property({ attribute: "renderer-preference" }) accessor rendererPreference: TerminalRendererPreference =
    DEFAULT_TERMINAL_RENDERER_PREFERENCE;
  @property({ attribute: "theme-name" }) accessor theme: TerminalThemeName = DEFAULT_TERMINAL_THEME;
  @property({ attribute: "cursor-style" }) accessor cursor: TerminalCursorStyle = DEFAULT_TERMINAL_CURSOR;
  @property({ attribute: false }) accessor resolvedRenderer: TerminalResolvedRenderer | null = null;
  @property({ attribute: false }) accessor rendererReason = "";
  @property({ attribute: false }) accessor screenMetrics: TerminalViewScreenMetrics | null = null;
  @property({ attribute: "projection-width", type: Number }) accessor projectionWidth = 0;
  @property({ attribute: "projection-height", type: Number }) accessor projectionHeight = 0;
  @property({ attribute: "projection-scale", type: Number }) accessor projectionScale = 1;
  @property({ attribute: "projection-offset-x", type: Number }) accessor projectionOffsetX = 0;
  @property({ attribute: "projection-offset-y", type: Number }) accessor projectionOffsetY = 0;

  @query("[data-terminal-stage]") private accessor stageHost!: HTMLDivElement;
  @query("[data-terminal-viewport]") private accessor viewportHost!: HTMLDivElement;

  private terminalSession: TerminalRendererSession | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private socket: WebSocket | null = null;
  private hydratedSnapshotSeq = -1;
  private liveSnapshotHydrated = false;
  private lastSentResize: { cols: number; rows: number } | null = null;
  private stageWidth = 0;
  private stageHeight = 0;
  private screenWidth = 0;
  private screenHeight = 0;
  private firstUpdateFramePending = false;
  private stageResizeFrame = 0;
  private viewportInteractionDisposers: Array<() => void> = [];
  private activeAppearanceKey = "";
  private rendererErrorMessage = "";
  private rendererSetupToken = 0;
  private textEvidenceBuffer = "";

  // Canvas-first renderers such as ghostty-web do not surface visible terminal text
  // through DOM nodes. Keep one renderer-neutral text evidence surface for host probes
  // and end-to-end verification instead of falling back to renderer-private selectors.
  public get textEvidence(): string {
    return this.textEvidenceBuffer;
  }

  public requestViewportResize(input: { cols: number; rows: number }): boolean {
    const cols = Math.max(1, Math.floor(input.cols));
    const rows = Math.max(1, Math.floor(input.rows));
    if (!Number.isFinite(cols) || !Number.isFinite(rows)) {
      return false;
    }
    if (
      this.sendClientMessage({
        type: "resize",
        cols,
        rows,
      })
    ) {
      this.lastSentResize = { cols, rows };
      return true;
    }
    return false;
  }

  private scheduleAfterUpdate(callback: () => void): void {
    const run = () => {
      if (!this.isConnected) {
        return;
      }
      callback();
    };

    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => run());
      return;
    }

    setTimeout(run, 0);
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("tabindex")) {
      this.tabIndex = 0;
    }
    this.upgradeProperty("transportUrl");
    this.upgradeProperty("liveTransportEnabled");
    this.upgradeProperty("terminalId");
    this.upgradeProperty("snapshot");
    this.upgradeProperty("rendererPreference");
    this.upgradeProperty("theme");
    this.upgradeProperty("cursor");
    this.upgradeProperty("projectionWidth");
    this.upgradeProperty("projectionHeight");
    this.upgradeProperty("projectionScale");
    this.upgradeProperty("projectionOffsetX");
    this.upgradeProperty("projectionOffsetY");
    this.syncSocket();
  }

  disconnectedCallback(): void {
    this.disconnectSocket();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    for (const dispose of this.viewportInteractionDisposers) {
      dispose();
    }
    this.viewportInteractionDisposers = [];
    if (this.stageResizeFrame !== 0) {
      cancelAnimationFrame(this.stageResizeFrame);
      this.stageResizeFrame = 0;
    }
    this.disposeRendererSession();
    super.disconnectedCallback();
  }

  firstUpdated(): void {
    if (this.firstUpdateFramePending) {
      return;
    }
    this.firstUpdateFramePending = true;
    this.scheduleAfterUpdate(() => {
      this.firstUpdateFramePending = false;
      this.ensureRendererSession();
      this.observeStage();
    });
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has("snapshot")) {
      queueMicrotask(() => {
        if (!this.isConnected) {
          return;
        }
        this.hydrateSnapshot(this.snapshot, "prop");
      });
    }
    if (changed.has("transportUrl") || changed.has("liveTransportEnabled")) {
      queueMicrotask(() => {
        if (!this.isConnected) {
          return;
        }
        this.syncSocket();
      });
    }
    if (changed.has("rendererPreference") || changed.has("theme") || changed.has("cursor")) {
      queueMicrotask(() => {
        if (!this.isConnected) {
          return;
        }
        this.ensureRendererSession();
      });
    }
  }

  render() {
    const cols = this.snapshot?.cols ?? this.terminalSession?.cols ?? DEFAULT_COLS;
    const rows = this.snapshot?.rows ?? this.terminalSession?.rows ?? DEFAULT_ROWS;
    const screenWidth = this.screenWidth > 0 ? this.screenWidth : undefined;
    const screenHeight = this.screenHeight > 0 ? this.screenHeight : Math.round(rows * FALLBACK_LINE_HEIGHT);
    const screenMetrics = resolveTerminalScreenMetrics({
      cols,
      rows,
      screenWidth,
      screenHeight,
    });
    const frameWidth = screenMetrics.frameWidth;
    const frameHeight = screenMetrics.frameHeight;
    const projectionScale = Number.isFinite(this.projectionScale) && this.projectionScale > 0 ? this.projectionScale : 1;
    const projectionWidth =
      Number.isFinite(this.projectionWidth) && this.projectionWidth > 0 ? this.projectionWidth : Math.round(frameWidth * projectionScale);
    const projectionHeight =
      Number.isFinite(this.projectionHeight) && this.projectionHeight > 0 ? this.projectionHeight : Math.round(frameHeight * projectionScale);
    const projectionOffsetX = Number.isFinite(this.projectionOffsetX) ? this.projectionOffsetX : 0;
    const projectionOffsetY = Number.isFinite(this.projectionOffsetY) ? this.projectionOffsetY : 0;
    const appearance = this.resolveAppearance();
    const rendererStyles = resolveTerminalRendererStyles(this.resolveRendererState().resolvedRenderer);
    const combinedStyles = `${rendererStyles}\n${templateStyles}`;

    return html`
      <style>
        ${combinedStyles}
      </style>
      <div
        class="terminal-stage"
        data-terminal-stage
        data-terminal-scroll-contract="terminal-stage"
        data-terminal-scroll-owner="terminal-stage"
        data-terminal-renderer-preference=${this.rendererPreference}
        data-terminal-resolved-renderer=${this.resolvedRenderer ?? ""}
        style=${`width:${projectionWidth}px;height:${projectionHeight}px;`}
      >
        <div class="terminal-frame-shell" style=${`width:${projectionWidth}px;height:${projectionHeight}px;`}>
          <section
            class="terminal-frame"
            data-terminal-view-root="true"
            style=${`width:${frameWidth}px;height:${frameHeight}px;transform:translate(${projectionOffsetX}px, ${projectionOffsetY}px) scale(${projectionScale});transform-origin:top left;`}
          >
            <div
              class="terminal-screen"
              data-terminal-viewport
              data-terminal-theme=${appearance.themeName}
              style=${`width:${screenMetrics.screenWidth}px;height:${screenMetrics.screenHeight}px;margin-left:${screenMetrics.framePaddingX}px;margin-top:${screenMetrics.framePaddingY}px;background:${appearance.theme.background};color:${appearance.theme.foreground};`}
            ></div>
          </section>
        </div>
      </div>
    `;
  }

  private resolveRendererState() {
    return resolveTerminalRenderer(this.rendererPreference);
  }

  private resolveAppearance(): ResolvedTerminalAppearance {
    return resolveTerminalAppearance({
      theme: this.theme,
      cursor: this.cursor,
    });
  }

  private ensureRendererSession(): void {
    if (!this.viewportHost) {
      return;
    }
    void this.ensureRendererSessionAsync();
  }

  private async ensureRendererSessionAsync(): Promise<void> {
    if (!this.viewportHost) {
      return;
    }
    const resolution = this.resolveRendererState();
    const appearance = this.resolveAppearance();
    const appearanceKey = `${appearance.themeName}:${appearance.cursorStyle}`;
    const currentCols = this.snapshot?.cols ?? this.terminalSession?.cols ?? DEFAULT_COLS;
    const currentRows = this.snapshot?.rows ?? this.terminalSession?.rows ?? DEFAULT_ROWS;
    const requiresRebuild = this.terminalSession?.resolvedRenderer !== resolution.resolvedRenderer;

    if (requiresRebuild) {
      this.disposeRendererSession();
    }

    if (!this.terminalSession) {
      const adapter = resolveTerminalRendererAdapter(resolution.resolvedRenderer);
      if (!adapter) {
        this.resolvedRenderer = resolution.resolvedRenderer;
        this.rendererReason = resolution.reason;
        this.rendererErrorMessage = `renderer '${resolution.resolvedRenderer}' is not available in terminal-view`;
        this.connectionState = "error";
        this.errorMessage = this.rendererErrorMessage;
        return;
      }
      const setupToken = ++this.rendererSetupToken;
      try {
        await adapter.ensureReady?.();
      } catch (error) {
        if (setupToken !== this.rendererSetupToken) {
          return;
        }
        this.resolvedRenderer = resolution.resolvedRenderer;
        this.rendererReason = resolution.reason;
        this.rendererErrorMessage =
          error instanceof Error ? error.message : `failed to prepare renderer '${resolution.resolvedRenderer}'`;
        this.connectionState = "error";
        this.errorMessage = this.rendererErrorMessage;
        return;
      }
      if (setupToken !== this.rendererSetupToken) {
        return;
      }
      this.rendererErrorMessage = "";
      this.terminalSession = adapter.createSession({
        host: this.viewportHost,
        cols: currentCols,
        rows: currentRows,
        scrollback: DEFAULT_SCROLLBACK,
        appearance,
        onInputBytes: (data) => {
          this.sendClientMessage({
            type: "inputBytes",
            data,
          });
        },
      });
      this.activeAppearanceKey = appearanceKey;
      this.resolvedRenderer = resolution.resolvedRenderer;
      this.rendererReason = resolution.reason;
      this.bindViewportInteractionFocus();
      this.syncMeasuredScreen();
      if (this.snapshot) {
        const source = this.connectionState === "connected" ? "renderer" : "prop";
        const applied = this.hydrateSnapshot(this.snapshot, source);
        if (source === "renderer" && applied) {
          this.liveSnapshotHydrated = true;
        }
      }
      return;
    }

    this.resolvedRenderer = resolution.resolvedRenderer;
    this.rendererReason = resolution.reason;
    if (this.activeAppearanceKey !== appearanceKey) {
      this.terminalSession.applyAppearance(appearance);
      this.activeAppearanceKey = appearanceKey;
      this.syncMeasuredScreen();
    }
  }

  private disposeRendererSession(): void {
    this.rendererSetupToken += 1;
    this.terminalSession?.dispose();
    this.terminalSession = null;
    this.resolvedRenderer = null;
    this.rendererReason = "";
    this.activeAppearanceKey = "";
  }

  private upgradeProperty(
    name:
      | "transportUrl"
      | "liveTransportEnabled"
      | "terminalId"
      | "snapshot"
      | "rendererPreference"
      | "theme"
      | "cursor"
      | "projectionWidth"
      | "projectionHeight"
      | "projectionScale"
      | "projectionOffsetX"
      | "projectionOffsetY"
      | "screenMetrics",
  ): void {
    if (!Object.prototype.hasOwnProperty.call(this, name)) {
      return;
    }
    const value = (this as Record<string, unknown>)[name];
    delete (this as Record<string, unknown>)[name];
    (this as Record<string, unknown>)[name] = value;
  }

  private observeStage(): void {
    if (this.resizeObserver || !this.stageHost || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateStageSize = (width: number, height: number) => {
      if (width === this.stageWidth && height === this.stageHeight) {
        return;
      }
      this.stageWidth = width;
      this.stageHeight = height;
      this.requestUpdate();
    };

    const scheduleStageCommit = (width: number, height: number) => {
      if (this.stageResizeFrame !== 0) {
        cancelAnimationFrame(this.stageResizeFrame);
      }
      this.stageResizeFrame = requestAnimationFrame(() => {
        this.stageResizeFrame = 0;
        updateStageSize(width, height);
      });
    };

    const rect = this.stageHost.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      scheduleStageCommit(rect.width, rect.height);
    }

    this.resizeObserver = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect;
      if (!next) {
        return;
      }
      scheduleStageCommit(next.width, next.height);
    });
    this.resizeObserver.observe(this.stageHost);
  }

  private bindViewportInteractionFocus(): void {
    if (!this.viewportHost || this.viewportInteractionDisposers.length > 0) {
      return;
    }

    const focusTerminalInput = (): void => {
      this.focusTerminalInput();
    };
    const bind = (type: string, options?: AddEventListenerOptions): void => {
      this.viewportHost.addEventListener(type, focusTerminalInput, options);
      this.viewportInteractionDisposers.push(() => {
        this.viewportHost.removeEventListener(type, focusTerminalInput, options);
      });
    };

    bind("pointerdown", { passive: true });
    bind("mousedown", { passive: true });
    bind("touchstart", { passive: true });
    bind("click", { passive: true });
    bind("focusin");
  }

  private focusTerminalInput(): void {
    const inputElement = this.terminalSession?.inputElement;
    if (!this.terminalSession || !inputElement) {
      return;
    }
    if (inputElement.ownerDocument.activeElement === inputElement) {
      return;
    }
    this.terminalSession.focus();
    queueMicrotask(() => {
      const nextInputElement = this.terminalSession?.inputElement;
      if (!this.isConnected || !this.terminalSession || !nextInputElement) {
        return;
      }
      if (nextInputElement.ownerDocument.activeElement === nextInputElement) {
        return;
      }
      this.terminalSession.focus();
    });
  }

  private resizeTerminal(cols: number, rows: number): void {
    if (!this.terminalSession || cols < 1 || rows < 1) {
      return;
    }
    if (this.terminalSession.cols === cols && this.terminalSession.rows === rows) {
      return;
    }
    this.terminalSession.resize(cols, rows);
    this.syncMeasuredScreen();
    this.requestUpdate();
  }

  private hydrateSnapshot(snapshot: TerminalViewSnapshot | null, source: "prop" | "transport" | "renderer"): boolean {
    if (!snapshot || !this.terminalSession) {
      return false;
    }
    const geometryChanged = this.terminalSession.cols !== snapshot.cols || this.terminalSession.rows !== snapshot.rows;
    if (source === "prop" && this.connectionState === "connected" && this.liveSnapshotHydrated) {
      return false;
    }
    if (snapshot.seq <= this.hydratedSnapshotSeq && !geometryChanged) {
      return false;
    }
    this.hydratedSnapshotSeq = Math.max(this.hydratedSnapshotSeq, snapshot.seq);
    this.terminalSession.setScrollback(Math.max(DEFAULT_SCROLLBACK, snapshot.lines.length - snapshot.rows + 256));
    this.resizeTerminal(snapshot.cols, snapshot.rows);
    this.terminalSession.reset();
    const rendered = serializeSnapshot(snapshot);
    this.replaceTextEvidence(snapshot.lines.join("\n"));
    if (rendered.length > 0) {
      this.terminalSession.write(rendered);
    }
    this.syncMeasuredScreen();
    return true;
  }

  private syncSocket(): void {
    this.disconnectSocket();
    if (this.rendererErrorMessage) {
      this.connectionState = "error";
      this.errorMessage = this.rendererErrorMessage;
      return;
    }
    if (!this.liveTransportEnabled || !this.transportUrl) {
      this.connectionState = "idle";
      this.errorMessage = "";
      return;
    }
    this.connectionState = "connecting";
    const socket = new WebSocket(this.transportUrl);
    socket.binaryType = "arraybuffer";
    this.socket = socket;
    socket.addEventListener("open", () => {
      if (this.socket !== socket) {
        return;
      }
      this.connectionState = "connected";
      this.errorMessage = "";
      this.liveSnapshotHydrated = false;
    });
    socket.addEventListener("message", (event) => {
      this.handleSocketMessage(event.data);
    });
    socket.addEventListener("close", () => {
      if (this.socket !== socket) {
        return;
      }
      this.socket = null;
      if (this.connectionState !== "error") {
        this.connectionState = "closed";
      }
    });
    socket.addEventListener("error", () => {
      if (this.socket !== socket) {
        return;
      }
      this.connectionState = "error";
      this.errorMessage = this.errorMessage || "transport error";
    });
  }

  private disconnectSocket(): void {
    if (!this.socket) {
      return;
    }
    this.socket.close();
    this.socket = null;
    this.lastSentResize = null;
  }

  private sendClientMessage(message: TerminalTransportClientMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.connectionState !== "connected") {
      return false;
    }
    this.socket.send(toOwnedArrayBuffer(encodeTerminalTransportClientMessage(message)));
    return true;
  }

  private handleSocketMessage(raw: unknown): void {
    if (!(raw instanceof ArrayBuffer)) {
      this.connectionState = "error";
      this.errorMessage = "invalid transport payload";
      return;
    }
    const message = decodeTerminalTransportServerMessage(raw);
    if (!message) {
      this.connectionState = "error";
      this.errorMessage = "invalid transport payload";
      return;
    }
    if (message.type === "snapshot") {
      const geometryChanged =
        this.terminalSession === null ||
        this.terminalSession.cols !== message.snapshot.cols ||
        this.terminalSession.rows !== message.snapshot.rows;
      if (!this.liveSnapshotHydrated || geometryChanged) {
        this.snapshot = message.snapshot;
        this.liveSnapshotHydrated = this.hydrateSnapshot(message.snapshot, "transport") || this.liveSnapshotHydrated;
      } else {
        this.hydratedSnapshotSeq = Math.max(this.hydratedSnapshotSeq, message.snapshot.seq);
      }
      return;
    }
    if (message.type === "outputBytes") {
      this.appendTextEvidence(utf8Decoder.decode(message.data));
      this.terminalSession?.write(message.data);
      return;
    }
    if (message.type === "status") {
      if (!message.running) {
        this.connectionState = "closed";
      }
      return;
    }
    if (message.type === "error") {
      this.connectionState = "error";
      this.errorMessage = message.message;
    }
  }

  private syncMeasuredScreen(): void {
    const measured = this.terminalSession?.getScreenMetrics() ?? null;
    if (measured) {
      this.setScreenMetrics(measured.width, measured.height);
      return;
    }
    const screenRect = this.renderRoot.querySelector(`[${TERMINAL_PUBLIC_SCREEN_ATTRIBUTE}]`)?.getBoundingClientRect();
    if (screenRect && screenRect.width > 0 && screenRect.height > 0) {
      this.setScreenMetrics(screenRect.width, screenRect.height);
    }
  }

  private setScreenMetrics(width: number, height: number): void {
    const roundedWidth = Math.round(width);
    const roundedHeight = Math.round(height);
    if (roundedWidth === this.screenWidth && roundedHeight === this.screenHeight) {
      return;
    }
    this.screenWidth = roundedWidth;
    this.screenHeight = roundedHeight;
    this.screenMetrics = { width: roundedWidth, height: roundedHeight };
    this.dispatchEvent(
      new CustomEvent<TerminalViewScreenMetrics>("terminal-view-screen-metrics", {
        bubbles: true,
        composed: true,
        detail: this.screenMetrics,
      }),
    );
    this.requestUpdate();
  }

  private replaceTextEvidence(value: string): void {
    this.textEvidenceBuffer = this.clampTextEvidence(stripTerminalControlText(value));
  }

  private appendTextEvidence(value: string): void {
    const next = stripTerminalControlText(value);
    if (next.length === 0) {
      return;
    }
    this.textEvidenceBuffer = this.clampTextEvidence(`${this.textEvidenceBuffer}${next}`);
  }

  private clampTextEvidence(value: string): string {
    if (value.length <= MAX_TEXT_EVIDENCE_LENGTH) {
      return value;
    }
    return value.slice(-MAX_TEXT_EVIDENCE_LENGTH);
  }
}

export const defineTerminalView = (): void => {
  if (!customElements.get(TERMINAL_VIEW_TAG)) {
    customElements.define(TERMINAL_VIEW_TAG, TerminalViewElement);
  }
};

export type { TerminalTransportServerMessage, TerminalTransportServerMessage as TerminalViewTransportMessage };
