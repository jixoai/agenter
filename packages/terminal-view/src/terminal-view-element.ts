import { Terminal } from "@xterm/xterm";
import xtermStyles from "@xterm/xterm/css/xterm.css?inline";
import { LitElement, html } from "lit";
import { property, query } from "lit/decorators.js";

export const TERMINAL_VIEW_TAG = "terminal-view";

export type TerminalViewConnectionState = "idle" | "connecting" | "connected" | "closed" | "error";

export interface TerminalViewSnapshot {
  seq: number;
  timestamp?: number;
  cols: number;
  rows: number;
  lines: string[];
  richLines?: Array<{
    spans: Array<{
      text: string;
      fg?: string;
      bg?: string;
      bold?: boolean;
      underline?: boolean;
      inverse?: boolean;
    }>;
  }>;
  cursor: { x: number; y: number };
  cursorVisible?: boolean;
}

export type TerminalViewServerMessage =
  | {
      type: "snapshot";
      terminalId: string;
      snapshot: TerminalViewSnapshot;
      status: "IDLE" | "BUSY";
    }
  | {
      type: "output";
      terminalId: string;
      data: string;
    }
  | {
      type: "status";
      terminalId: string;
      running: boolean;
      status: "IDLE" | "BUSY";
    }
  | {
      type: "error";
      terminalId: string;
      message: string;
    };

interface TerminalViewportMetrics {
  scale: number;
  width: number;
  height: number;
  scaledWidth: number;
  scaledHeight: number;
}

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

const VIEWPORT_PADDING_X = 16;
const VIEWPORT_PADDING_Y = 14;
const FALLBACK_CELL_WIDTH = 8.2;
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
    height: 100%;
    min-height: 0;
  }

  .terminal-stage {
    display: flex;
    height: 100%;
    min-height: 0;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .terminal-frame-shell {
    position: relative;
    flex: none;
    max-width: 100%;
    max-height: 100%;
  }

  .terminal-frame {
    position: relative;
    transform-origin: top left;
    transition: transform 140ms ease;
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
    return snapshot.richLines.map((line) => line.spans.map((span) => serializeRichSpan(span)).join("")).join("\r\n");
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

const buildViewportMetrics = (input: {
  availableWidth: number;
  availableHeight: number;
  screenWidth: number;
  screenHeight: number;
  mode: "fit" | "cover";
}): TerminalViewportMetrics => {
  const width = input.screenWidth + VIEWPORT_PADDING_X * 2;
  const height = input.screenHeight + VIEWPORT_PADDING_Y * 2;
  const fitScale = Math.min(input.availableWidth / width, input.availableHeight / height);
  const coverScale = Math.max(input.availableWidth / width, input.availableHeight / height);
  const rawScale = input.mode === "cover" ? coverScale : fitScale;
  const scale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;
  return {
    scale,
    width,
    height,
    scaledWidth,
    scaledHeight,
  };
};

export class TerminalViewElement extends LitElement {
  @property({ attribute: "transport-url" }) accessor transportUrl = "";
  @property({ attribute: "terminal-id" }) accessor terminalId = "";
  @property({ attribute: "viewport-mode" }) accessor viewportMode: "fit" | "cover" = "fit";
  @property({ attribute: false }) accessor snapshot: TerminalViewSnapshot | null = null;
  @property({ attribute: false }) accessor connectionState: TerminalViewConnectionState = "idle";
  @property({ attribute: false }) accessor errorMessage = "";

  @query("[data-terminal-stage]") private accessor stageHost!: HTMLDivElement;
  @query("[data-terminal-viewport]") private accessor viewportHost!: HTMLDivElement;

  private terminal: Terminal | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private socket: WebSocket | null = null;
  private ligatureJoinerId: number | null = null;
  private hydratedSnapshotSeq = -1;
  private liveSnapshotHydrated = false;
  private stageWidth = 0;
  private stageHeight = 0;
  private screenWidth = 0;
  private screenHeight = 0;
  private firstUpdateFramePending = false;
  private stageResizeFrame = 0;

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
    this.upgradeProperty("transportUrl");
    this.upgradeProperty("terminalId");
    this.upgradeProperty("viewportMode");
    this.upgradeProperty("snapshot");
    this.syncSocket();
  }

  disconnectedCallback(): void {
    this.disconnectSocket();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
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
    const screenWidth = this.screenWidth > 0 ? this.screenWidth : Math.round(cols * FALLBACK_CELL_WIDTH);
    const screenHeight = this.screenHeight > 0 ? this.screenHeight : Math.round(rows * FALLBACK_LINE_HEIGHT);
    const metrics = buildViewportMetrics({
      availableWidth: Math.max(this.stageWidth, 320),
      availableHeight: Math.max(this.stageHeight, 200),
      screenWidth,
      screenHeight,
      mode: this.viewportMode,
    });

    return html`
      <style>
        ${combinedStyles}
      </style>
      <div
        class="terminal-stage"
        data-terminal-stage
        data-terminal-scroll-contract="terminal-stage"
        data-terminal-scroll-owner="terminal-stage"
        data-viewport-mode=${this.viewportMode}
      >
        <div class="terminal-frame-shell" style=${`width:${metrics.scaledWidth}px;height:${metrics.scaledHeight}px;`}>
          <section
            class="terminal-frame"
            data-terminal-view-root="true"
            data-viewport-mode=${this.viewportMode}
            style=${`width:${metrics.width}px;height:${metrics.height}px;transform:scale(${metrics.scale});`}
          >
            <div
              class="terminal-screen"
              data-terminal-viewport
              style=${`width:${screenWidth}px;height:${screenHeight}px;`}
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
    this.terminal = terminal;
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
    name: "transportUrl" | "terminalId" | "viewportMode" | "snapshot",
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
      this.handleSocketMessage(String(event.data));
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
  }

  private handleSocketMessage(raw: string): void {
    try {
      const message = JSON.parse(raw) as TerminalViewServerMessage;
      if (message.type === "snapshot") {
        this.snapshot = message.snapshot;
        const geometryChanged =
          this.terminal === null ||
          this.terminal.cols !== message.snapshot.cols ||
          this.terminal.rows !== message.snapshot.rows;
        if (!this.liveSnapshotHydrated || geometryChanged) {
          this.liveSnapshotHydrated = this.hydrateSnapshot(message.snapshot, "transport") || this.liveSnapshotHydrated;
        }
        return;
      }
      if (message.type === "output") {
        this.terminal?.write(message.data);
        return;
      }
      if (message.type === "status") {
        if (!message.running) {
          this.connectionState = "closed";
        }
        return;
      }
      this.connectionState = "error";
      this.errorMessage = message.message;
    } catch {
      this.connectionState = "error";
      this.errorMessage = "invalid transport payload";
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
    this.requestUpdate();
  }

}

export const defineTerminalView = (): void => {
  if (!customElements.get(TERMINAL_VIEW_TAG)) {
    customElements.define(TERMINAL_VIEW_TAG, TerminalViewElement);
  }
};

export type { TerminalViewServerMessage as TerminalViewTransportMessage };
