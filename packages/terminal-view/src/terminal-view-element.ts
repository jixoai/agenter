import { Terminal } from "@xterm/xterm";
import xtermStyles from "@xterm/xterm/css/xterm.css?inline";
import {
  binaryStringToBytes,
  decodeTerminalTransportServerMessage,
  encodeTerminalTransportClientMessage,
  type TerminalTransportClientMessage,
  type TerminalTransportServerMessage,
  type TerminalTransportSnapshot,
} from "@agenter/terminal-transport-protocol";
import { LitElement, html } from "lit";
import { property, query } from "lit/decorators.js";
import { resolveTerminalScreenMetrics } from "./terminal-geometry";

export const TERMINAL_VIEW_TAG = "terminal-view";

export type TerminalViewConnectionState = "idle" | "connecting" | "connected" | "closed" | "error";
export interface TerminalViewScreenMetrics {
  width: number;
  height: number;
}

export type TerminalViewSnapshot = TerminalTransportSnapshot;

interface XtermRenderDimensions {
  css?: {
    canvas?: {
      width?: number;
      height?: number;
    };
  };
}

interface XtermInternalShape {
  _core?: {
    _renderService?: {
      dimensions?: XtermRenderDimensions;
    };
  };
}

interface XtermScreenWithCore {
  _core?: {
    _renderService?: {
      dimensions?: XtermRenderDimensions;
    };
  };
}

const TERMINAL_FONT_SIZE = 12;
const TERMINAL_LINE_HEIGHT = 1.25;
const FALLBACK_LINE_HEIGHT = 16;
const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const DEFAULT_SCROLLBACK = 10_000;
const PROGRAMMING_LIGATURES = Object.freeze([
  "<!--",
  "!==",
  "-->",
  "...",
  "<<<",
  "<=>",
  "===",
  ">>>",
  "!!",
  "!=",
  "##",
  "&&",
  "++",
  "--",
  "->",
  "::",
  ":=",
  "<-",
  "<<",
  "<=",
  "==",
  "=>",
  ">=",
  ">>",
  "?.",
  "??",
  "||",
]);

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
    background: #020617;
    font-variant-ligatures: normal;
    font-feature-settings: "liga" 1, "calt" 1;
    text-rendering: optimizeLegibility;
  }

  .xterm,
  .xterm-screen,
  .xterm-viewport {
    height: 100%;
  }

  .xterm-viewport {
    overflow-y: auto !important;
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, currentColor 28%, transparent) transparent;
  }

  .xterm-viewport::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  .xterm-viewport::-webkit-scrollbar-track {
    background: transparent;
  }

  .xterm-viewport::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: color-mix(in srgb, #cbd5e1 24%, transparent);
  }
`;

const combinedStyles = `${xtermStyles}\n${templateStyles}`;
const utf8Encoder = new TextEncoder();
const toOwnedArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
};

const ANSI_RESET = "\u001b[0m";
const escapeRegex = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PROGRAMMING_LIGATURE_REGEX = new RegExp(
  [...PROGRAMMING_LIGATURES]
    .sort((left, right) => right.length - left.length || left.localeCompare(right))
    .map(escapeRegex)
    .join("|"),
  "g",
);

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

const collectProgrammingLigatureRanges = (text: string): [number, number][] => {
  if (text.length < 2) {
    return [];
  }

  const ranges: [number, number][] = [];
  PROGRAMMING_LIGATURE_REGEX.lastIndex = 0;

  for (const match of text.matchAll(PROGRAMMING_LIGATURE_REGEX)) {
    if (typeof match.index !== "number") {
      continue;
    }
    ranges.push([match.index, match.index + match[0].length]);
  }

  return ranges;
};

export class TerminalViewElement extends LitElement {
  static override shadowRootOptions = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true,
  };

  @property({ attribute: "transport-url" }) accessor transportUrl = "";
  @property({ attribute: "terminal-id" }) accessor terminalId = "";
  @property({ attribute: false }) accessor snapshot: TerminalViewSnapshot | null = null;
  @property({ attribute: false }) accessor connectionState: TerminalViewConnectionState = "idle";
  @property({ attribute: false }) accessor errorMessage = "";
  @property({ attribute: "projection-width", type: Number }) accessor projectionWidth = 0;
  @property({ attribute: "projection-height", type: Number }) accessor projectionHeight = 0;
  @property({ attribute: "projection-scale", type: Number }) accessor projectionScale = 1;
  @property({ attribute: "projection-offset-x", type: Number }) accessor projectionOffsetX = 0;
  @property({ attribute: "projection-offset-y", type: Number }) accessor projectionOffsetY = 0;
  @property({ attribute: false }) accessor screenMetrics: TerminalViewScreenMetrics | null = null;

  @query("[data-terminal-stage]") private accessor stageHost!: HTMLDivElement;
  @query("[data-terminal-viewport]") private accessor viewportHost!: HTMLDivElement;

  private terminal: Terminal | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private socket: WebSocket | null = null;
  private inputDataDisposable: { dispose(): void } | null = null;
  private inputBinaryDisposable: { dispose(): void } | null = null;
  private ligatureJoinerId: number | null = null;
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
    this.upgradeProperty("terminalId");
    this.upgradeProperty("snapshot");
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
    this.inputDataDisposable?.dispose();
    this.inputDataDisposable = null;
    this.inputBinaryDisposable?.dispose();
    this.inputBinaryDisposable = null;
    if (this.stageResizeFrame !== 0) {
      cancelAnimationFrame(this.stageResizeFrame);
      this.stageResizeFrame = 0;
    }
    if (this.terminal && this.ligatureJoinerId !== null) {
      this.terminal.deregisterCharacterJoiner(this.ligatureJoinerId);
      this.ligatureJoinerId = null;
    }
    this.terminal?.dispose();
    this.terminal = null;
    super.disconnectedCallback();
  }

  firstUpdated(): void {
    if (this.firstUpdateFramePending) {
      return;
    }
    // Terminal bootstrap measures the xterm screen and stage, and those paths
    // can request a follow-up update. Defer them out of Lit's first update
    // commit so Storybook/browser rendering stays free of change-in-update warnings.
    this.firstUpdateFramePending = true;
    this.scheduleAfterUpdate(() => {
      this.firstUpdateFramePending = false;
      this.ensureTerminal();
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
    if (changed.has("transportUrl")) {
      queueMicrotask(() => {
        if (!this.isConnected) {
          return;
        }
        this.syncSocket();
      });
    }
  }

  render() {
    const cols = this.snapshot?.cols ?? this.terminal?.cols ?? DEFAULT_COLS;
    const rows = this.snapshot?.rows ?? this.terminal?.rows ?? DEFAULT_ROWS;
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

    return html`
      <style>
        ${combinedStyles}
      </style>
      <div
        class="terminal-stage"
        data-terminal-stage
        data-terminal-scroll-contract="terminal-stage"
        data-terminal-scroll-owner="terminal-stage"
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
              style=${`width:${screenMetrics.screenWidth}px;height:${screenMetrics.screenHeight}px;margin-left:${screenMetrics.framePaddingX}px;margin-top:${screenMetrics.framePaddingY}px;`}
            ></div>
          </section>
        </div>
      </div>
    `;
  }

  private ensureTerminal(): void {
    if (this.terminal || !this.viewportHost) {
      return;
    }
    const terminal = new Terminal({
      allowTransparency: true,
      allowProposedApi: true,
      convertEol: true,
      cursorBlink: false,
      cols: this.snapshot?.cols ?? DEFAULT_COLS,
      rows: this.snapshot?.rows ?? DEFAULT_ROWS,
      fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, monospace)",
      fontSize: TERMINAL_FONT_SIZE,
      fontWeight: "400",
      fontWeightBold: "700",
      lineHeight: TERMINAL_LINE_HEIGHT,
      scrollback: DEFAULT_SCROLLBACK,
      theme: {
        background: "#020617",
        foreground: "#e2e8f0",
        cursor: "#38bdf8",
      },
    });
    terminal.open(this.viewportHost);
    this.ligatureJoinerId = terminal.registerCharacterJoiner(collectProgrammingLigatureRanges);
    this.inputDataDisposable = terminal.onData((data) => {
      this.sendClientMessage({
        type: "inputBytes",
        data: utf8Encoder.encode(data),
      });
    });
    this.inputBinaryDisposable = terminal.onBinary((data) => {
      this.sendClientMessage({
        type: "inputBytes",
        data: binaryStringToBytes(data),
      });
    });
    this.terminal = terminal;
    this.bindViewportInteractionFocus();
    this.syncMeasuredScreen();
    if (this.snapshot) {
      const source = this.connectionState === "connected" && !this.liveSnapshotHydrated ? "transport" : "prop";
      const applied = this.hydrateSnapshot(this.snapshot, source);
      if (source === "transport" && applied) {
        this.liveSnapshotHydrated = true;
      }
    }
  }

  private upgradeProperty(
    name:
      | "transportUrl"
      | "terminalId"
      | "snapshot"
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
    const textarea = this.terminal?.textarea;
    if (!this.terminal || !textarea) {
      return;
    }
    if (textarea.ownerDocument.activeElement === textarea) {
      return;
    }
    this.terminal.focus();
    queueMicrotask(() => {
      if (!this.isConnected || !this.terminal?.textarea) {
        return;
      }
      if (this.terminal.textarea.ownerDocument.activeElement === this.terminal.textarea) {
        return;
      }
      this.terminal.focus();
    });
  }

  private resizeTerminal(cols: number, rows: number): void {
    if (!this.terminal || cols < 1 || rows < 1) {
      return;
    }
    if (this.terminal.cols === cols && this.terminal.rows === rows) {
      return;
    }
    this.terminal.resize(cols, rows);
    this.syncMeasuredScreen();
    this.requestUpdate();
  }

  private hydrateSnapshot(snapshot: TerminalViewSnapshot | null, source: "prop" | "transport"): boolean {
    if (!snapshot || !this.terminal) {
      return false;
    }
    const geometryChanged = this.terminal.cols !== snapshot.cols || this.terminal.rows !== snapshot.rows;
    if (source === "prop" && this.connectionState === "connected" && this.liveSnapshotHydrated) {
      return false;
    }
    if (snapshot.seq <= this.hydratedSnapshotSeq && !geometryChanged) {
      return false;
    }
    this.hydratedSnapshotSeq = Math.max(this.hydratedSnapshotSeq, snapshot.seq);
    this.terminal.options.scrollback = Math.max(DEFAULT_SCROLLBACK, snapshot.lines.length - snapshot.rows + 256);
    this.resizeTerminal(snapshot.cols, snapshot.rows);
    this.terminal.reset();
    const rendered = serializeSnapshot(snapshot);
    if (rendered.length > 0) {
      this.terminal.write(rendered);
    }
    this.syncMeasuredScreen();
    return true;
  }

  private syncSocket(): void {
    this.disconnectSocket();
    if (!this.transportUrl) {
      this.connectionState = "idle";
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
        this.terminal === null ||
        this.terminal.cols !== message.snapshot.cols ||
        this.terminal.rows !== message.snapshot.rows;
      if (!this.liveSnapshotHydrated || geometryChanged) {
        this.snapshot = message.snapshot;
        this.liveSnapshotHydrated = this.hydrateSnapshot(message.snapshot, "transport") || this.liveSnapshotHydrated;
      } else {
        this.hydratedSnapshotSeq = Math.max(this.hydratedSnapshotSeq, message.snapshot.seq);
      }
      return;
    }
    if (message.type === "outputBytes") {
      this.terminal?.write(message.data);
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

  private getTerminalScreenElement(): HTMLDivElement | null {
    const screen = this.terminal?.element?.querySelector(".xterm-screen");
    return screen instanceof HTMLDivElement ? screen : null;
  }

  private readMeasuredScreenFromXterm(): { width: number; height: number } | null {
    const internal = this.terminal as unknown as XtermInternalShape | null;
    const width = internal?._core?._renderService?.dimensions?.css?.canvas?.width;
    const height = internal?._core?._renderService?.dimensions?.css?.canvas?.height;
    if (typeof width === "number" && width > 0 && typeof height === "number" && height > 0) {
      return { width, height };
    }
    const screenCore = this.getTerminalScreenElement() as (HTMLDivElement & XtermScreenWithCore) | null;
    const screenWidth = screenCore?._core?._renderService?.dimensions?.css?.canvas?.width;
    const screenHeight = screenCore?._core?._renderService?.dimensions?.css?.canvas?.height;
    if (typeof screenWidth === "number" && screenWidth > 0 && typeof screenHeight === "number" && screenHeight > 0) {
      return { width: screenWidth, height: screenHeight };
    }
    return null;
  }

  private syncMeasuredScreen(): void {
    const measured = this.readMeasuredScreenFromXterm();
    if (measured) {
      this.setScreenMetrics(measured.width, measured.height);
      return;
    }
    const screenRect = this.getTerminalScreenElement()?.getBoundingClientRect();
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

}

export const defineTerminalView = (): void => {
  if (!customElements.get(TERMINAL_VIEW_TAG)) {
    customElements.define(TERMINAL_VIEW_TAG, TerminalViewElement);
  }
};

export type { TerminalTransportServerMessage, TerminalTransportServerMessage as TerminalViewTransportMessage };
