import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  decodeTerminalTransportClientMessage,
  encodeTerminalTransportServerMessage,
  type TerminalTransportClientMessage,
  type TerminalTransportServerMessage,
  type TerminalTransportSnapshot,
} from "@agenter/terminal-transport-protocol";

vi.mock("@xterm/xterm/css/xterm.css?inline", () => ({ default: ".xterm { display: block; }" }));
vi.mock("ghostty-web", () => {
  class MockGhosttyTerminal {
    cols = 80;
    rows = 24;
    writes: Array<string | Uint8Array> = [];
    resetCount = 0;
    focusCount = 0;
    openedWith: Element | null = null;
    element: HTMLElement | undefined;
    textarea: HTMLTextAreaElement | undefined;
    options: Record<string, unknown> = {};
    renderer = {
      getCanvas: (): HTMLCanvasElement | null => this.canvas,
      getMetrics: () => ({
        width: 9,
        height: 19,
        baseline: 15,
      }),
      setTheme: vi.fn(),
      setCursorStyle: vi.fn(),
      setFontFamily: vi.fn(),
      setFontSize: vi.fn(),
      remeasureFont: vi.fn(),
      render: vi.fn(),
    };
    private dataListeners: Array<(data: string) => void> = [];
    private canvas: HTMLCanvasElement | null = null;

    constructor(options?: Record<string, unknown>) {
      this.options = { ...(options ?? {}) };
      this.cols = typeof options?.cols === "number" ? options.cols : this.cols;
      this.rows = typeof options?.rows === "number" ? options.rows : this.rows;
    }

    onData(listener: (data: string) => void): { dispose(): void } {
      this.dataListeners.push(listener);
      return {
        dispose: () => {
          this.dataListeners = this.dataListeners.filter((item) => item !== listener);
        },
      };
    }

    emitData(data: string): void {
      for (const listener of this.dataListeners) {
        listener(data);
      }
    }

    open(node: Element): void {
      this.openedWith = node;
      this.element = node as HTMLElement;
      const textarea = document.createElement("textarea");
      textarea.setAttribute("data-terminal-input-surface", "true");
      this.textarea = textarea;
      const canvas = document.createElement("canvas");
      canvas.setAttribute("data-terminal-renderer-screen", "true");
      canvas.width = this.cols * 9;
      canvas.height = this.rows * 19;
      Object.defineProperty(canvas, "getBoundingClientRect", {
        value: () => ({
          width: this.cols * 9,
          height: this.rows * 19,
          top: 0,
          left: 0,
          right: this.cols * 9,
          bottom: this.rows * 19,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });
      this.canvas = canvas;
      node.appendChild(textarea);
      node.appendChild(canvas);
    }

    write(data: string | Uint8Array): void {
      this.writes.push(data);
    }

    resize(cols: number, rows: number): void {
      this.cols = cols;
      this.rows = rows;
      if (this.canvas) {
        this.canvas.width = cols * 9;
        this.canvas.height = rows * 19;
      }
    }

    reset(): void {
      this.resetCount += 1;
    }

    focus(): void {
      this.focusCount += 1;
      this.textarea?.focus();
    }

    dispose(): void {}
  }

  return {
    init: vi.fn(async () => undefined),
    Terminal: class GhosttyTerminalMock extends MockGhosttyTerminal {
      constructor(options?: Record<string, unknown>) {
        super(options);
        mockGhosttyTerminals.push(this);
      }
    },
  };
});

type ResizeEntry = Pick<ResizeObserverEntry, "target" | "contentRect">;

class MockTerminal {
  cols = 80;
  rows = 24;
  writes: Array<string | Uint8Array> = [];
  resetCount = 0;
  focusCount = 0;
  refreshCount = 0;
  clearTextureAtlasCount = 0;
  characterJoiners: Array<(text: string) => [number, number][]> = [];
  deregisteredJoinerIds: number[] = [];
  openedWith: Element | null = null;
  element: HTMLElement | undefined;
  textarea: HTMLTextAreaElement | undefined;
  options: Record<string, unknown> = {};
  private dataListeners: Array<(data: string) => void> = [];
  private binaryListeners: Array<(data: string) => void> = [];
  _core = {
    _renderService: {
      dimensions: {
        css: {
          canvas: {
            width: 0,
            height: 0,
          },
        },
      },
    },
  };

  constructor(options?: Record<string, unknown>) {
    this.options = { ...(options ?? {}) };
    this.cols = typeof options?.cols === "number" ? options.cols : this.cols;
    this.rows = typeof options?.rows === "number" ? options.rows : this.rows;
    this.updateDimensions();
  }

  loadAddon(_: unknown): void {}

  registerCharacterJoiner(handler: (text: string) => [number, number][]): number {
    this.characterJoiners.push(handler);
    return this.characterJoiners.length - 1;
  }

  onData(listener: (data: string) => void): { dispose(): void } {
    this.dataListeners.push(listener);
    return {
      dispose: () => {
        this.dataListeners = this.dataListeners.filter((item) => item !== listener);
      },
    };
  }

  onBinary(listener: (data: string) => void): { dispose(): void } {
    this.binaryListeners.push(listener);
    return {
      dispose: () => {
        this.binaryListeners = this.binaryListeners.filter((item) => item !== listener);
      },
    };
  }

  emitData(data: string): void {
    for (const listener of this.dataListeners) {
      listener(data);
    }
  }

  emitBinary(data: string): void {
    for (const listener of this.binaryListeners) {
      listener(data);
    }
  }

  deregisterCharacterJoiner(joinerId: number): void {
    this.deregisteredJoinerIds.push(joinerId);
  }

  open(node: Element): void {
    this.openedWith = node;
    this.element = node as HTMLElement;
    const textarea = document.createElement("textarea");
    textarea.className = "xterm-helper-textarea";
    this.textarea = textarea;
    const viewport = document.createElement("div");
    viewport.className = "xterm-viewport";
    const screen = document.createElement("div");
    screen.className = "xterm-screen";
    screen.style.width = `${this._core._renderService.dimensions.css.canvas.width}px`;
    screen.style.height = `${this._core._renderService.dimensions.css.canvas.height}px`;
    node.appendChild(textarea);
    node.appendChild(screen);
    node.appendChild(viewport);
  }

  write(data: string | Uint8Array): void {
    this.writes.push(data);
  }

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.updateDimensions();
    const screen = this.element?.querySelector(".xterm-screen");
    if (screen instanceof HTMLDivElement) {
      screen.style.width = `${this._core._renderService.dimensions.css.canvas.width}px`;
      screen.style.height = `${this._core._renderService.dimensions.css.canvas.height}px`;
    }
  }

  reset(): void {
    this.resetCount += 1;
  }

  refresh(): void {
    this.refreshCount += 1;
  }

  clearTextureAtlas(): void {
    this.clearTextureAtlasCount += 1;
  }

  focus(): void {
    this.focusCount += 1;
    this.textarea?.focus();
  }

  dispose(): void {}

  private updateDimensions(): void {
    this._core._renderService.dimensions.css.canvas.width = this.cols * 9;
    this._core._renderService.dimensions.css.canvas.height = this.rows * 19;
  }
}

const mockTerminals: MockTerminal[] = [];
const mockGhosttyTerminals: Array<{
  cols: number;
  rows: number;
  writes: Array<string | Uint8Array>;
  resetCount: number;
  focusCount: number;
  textarea?: HTMLTextAreaElement;
  options: Record<string, unknown>;
  emitData(data: string): void;
  renderer: {
    setTheme: ReturnType<typeof vi.fn>;
    setCursorStyle: ReturnType<typeof vi.fn>;
  };
}> = [];

const withSnapshotScrollback = (
  snapshot: Omit<TerminalTransportSnapshot, "scrollback"> & {
    scrollback?: TerminalTransportSnapshot["scrollback"];
  },
): TerminalTransportSnapshot => ({
  ...snapshot,
  scrollback: snapshot.scrollback ?? {
    viewportOffset: Math.max(0, snapshot.lines.length - snapshot.rows),
    totalLines: snapshot.lines.length,
    screenLines: snapshot.rows,
  },
});
vi.mock("@xterm/xterm", () => ({
  Terminal: class TerminalMock extends MockTerminal {
    constructor(options?: Record<string, unknown>) {
      super(options);
      mockTerminals.push(this);
    }
  },
}));

class ResizeObserverMock {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element): void {
    const contentRect =
      target instanceof HTMLElement && target.classList.contains("xterm-screen")
        ? {
            width: 2400,
            height: 1800,
            top: 0,
            left: 0,
            right: 2400,
            bottom: 1800,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          }
        : {
            width: 960,
            height: 420,
            top: 0,
            left: 0,
            right: 960,
            bottom: 420,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          };
    const entry = {
      target,
      contentRect,
    } satisfies ResizeEntry;
    this.callback([entry as ResizeObserverEntry], this as unknown as ResizeObserver);
  }

  disconnect(): void {}
  unobserve(): void {}
}

type WebSocketListener = (event: Event | MessageEvent) => void;

class WebSocketMock {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: WebSocketMock[] = [];

  readyState = 0;
  binaryType: BinaryType = "blob";
  readonly sent: ArrayBuffer[] = [];
  private readonly listeners = new Map<string, WebSocketListener[]>();

  constructor(readonly url: string) {
    WebSocketMock.instances.push(this);
  }

  addEventListener(type: string, listener: WebSocketListener): void {
    const queue = this.listeners.get(type) ?? [];
    queue.push(listener);
    this.listeners.set(type, queue);
  }

  removeEventListener(type: string, listener: WebSocketListener): void {
    const queue = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      queue.filter((item) => item !== listener),
    );
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (typeof data === "string") {
      throw new Error("terminal transport v2 test mock only accepts binary frames");
    }
    if (ArrayBuffer.isView(data)) {
      this.sent.push(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
      return;
    }
    if (data instanceof Blob) {
      throw new Error("blob websocket test frames are not supported");
    }
    this.sent.push(data.slice(0));
  }

  close(): void {
    this.readyState = WebSocketMock.CLOSED;
    this.emit("close", new Event("close"));
  }

  open(): void {
    this.readyState = WebSocketMock.OPEN;
    this.emit("open", new Event("open"));
  }

  message(data: unknown): void {
    this.emit("message", new MessageEvent("message", { data }));
  }

  error(): void {
    this.emit("error", new Event("error"));
  }

  private emit(type: string, event: Event | MessageEvent): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

const decodeSentClientFrames = (socket: WebSocketMock | undefined): TerminalTransportClientMessage[] =>
  socket?.sent
    .map((frame) => decodeTerminalTransportClientMessage(frame))
    .filter((frame): frame is TerminalTransportClientMessage => frame !== null) ?? [];

const encodeServerFrame = (frame: TerminalTransportServerMessage): ArrayBuffer =>
  encodeTerminalTransportServerMessage(frame).buffer.slice(0);
const containsWrittenText = (terminal: MockTerminal | undefined, value: string): boolean =>
  (terminal?.writes ?? []).some((entry) => {
    if (typeof entry === "string") {
      return entry === value;
    }
    return new TextDecoder().decode(entry) === value;
  });

const waitForLifecycleFrame = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
};

const requireShadowRoot = (element: HTMLElement): ShadowRoot => {
  const shadowRoot = element.shadowRoot;
  if (!shadowRoot) {
    throw new Error("terminal-view shadow root not found");
  }
  return shadowRoot;
};

const readTerminalScale = (shadowRoot: ShadowRoot): number => {
  const transform = shadowRoot.querySelector(".terminal-frame")?.style.transform ?? "";
  const match = /scale\(([^)]+)\)/.exec(transform);
  if (!match) {
    throw new Error(`terminal scale transform not found: ${transform}`);
  }
  return Number(match[1]);
};

describe("Feature: terminal-view WebComponent", () => {
  beforeEach(() => {
    mockTerminals.length = 0;
    mockGhosttyTerminals.length = 0;
    WebSocketMock.instances.length = 0;
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("WebSocket", WebSocketMock);
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        ready: Promise.resolve(),
        load: vi.fn(async () => []),
      },
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  test("Scenario: Given a snapshot-only terminal When mounting Then it owns the viewport scroll contract, preserves rich colors, and hydrates the whole scrollback buffer", async () => {
    const { TERMINAL_VIEW_TAG, defineTerminalView } = await import("../src");
    defineTerminalView();
    const element = document.createElement(TERMINAL_VIEW_TAG) as InstanceType<
      typeof import("../src").TerminalViewElement
    >;

    element.terminalId = "iflow";
    element.projectionWidth = 1198;
    element.projectionHeight = 780;
    element.projectionScale = 1;
    const screenMetricsEvents: Array<{ width: number; height: number }> = [];
    element.addEventListener("terminal-view-screen-metrics", (event) => {
      screenMetricsEvents.push((event as CustomEvent<{ width: number; height: number }>).detail);
    });
    element.snapshot = withSnapshotScrollback({
      seq: 8,
      cols: 132,
      rows: 40,
      lines: Array.from({ length: 64 }, (_, index) => (index === 0 ? "npm ERR! build failed" : `line ${index + 1}`)),
      richLines: [
        {
          spans: [{ text: "npm ERR!", fg: "#f14c4c", bold: true }, { text: " build failed" }],
        },
        ...Array.from({ length: 63 }, (_, index) => ({
          spans: [{ text: `line ${index + 2}`, fg: index === 62 ? "#fbbf24" : undefined }],
        })),
      ],
      cursor: { x: 3, y: 63 },
    });

    document.body.append(element);
    await element.updateComplete;
    await waitForLifecycleFrame();
    await waitForLifecycleFrame();
    await element.updateComplete;

    const shadowRoot = requireShadowRoot(element);
    const terminal = mockTerminals.at(-1);
    expect(terminal).toBeDefined();
    expect(terminal?.resetCount).toBe(1);
    expect(terminal?.cols).toBe(132);
    expect(terminal?.rows).toBe(40);
    expect(element.resolvedRenderer).toBe("xterm");
    expect(terminal?.options.allowTransparency).toBe(true);
    expect(terminal?.options.scrollback).toBe(10_000);
    expect(element.querySelector("style")).toBeNull();
    expect(shadowRoot.querySelector(".terminal-frame")?.getAttribute("style")).toContain("width:1198px");
    expect(shadowRoot.querySelector("[data-terminal-viewport]")?.getAttribute("style")).toContain("width:1188px");
    expect(shadowRoot.querySelector("[data-terminal-viewport]")?.getAttribute("style")).toContain("margin-left:5px");
    expect(shadowRoot.querySelector("[data-terminal-viewport]")?.getAttribute("style")).toContain("margin-top:10px");
    expect(element.screenMetrics).toEqual({ width: 1188, height: 760 });
    expect(screenMetricsEvents).toContainEqual({ width: 1188, height: 760 });
    expect(shadowRoot.querySelector("style")?.textContent).toContain('font-feature-settings: "liga" 1, "calt" 1;');
    expect(terminal?.writes.at(-1)).toContain("npm ERR!");
    expect(terminal?.writes.at(-1)).toContain("38;2;241;76;76");
    expect(terminal?.writes.at(-1)).toContain("line 64");
    expect(shadowRoot.querySelector('[data-terminal-scroll-contract="terminal-stage"]')).not.toBeNull();
    expect(shadowRoot.querySelector('[data-terminal-scroll-owner="terminal-stage"]')).not.toBeNull();
    expect(shadowRoot.querySelector(".terminal-toolbar")).toBeNull();
    expect(shadowRoot.querySelector(".terminal-footer")).toBeNull();
    expect(shadowRoot.querySelector(".terminal-connection-badge")).toBeNull();
  });

  test("Scenario: Given fit mode and deep scrollback When screen metrics sync Then the viewport fits the visible canvas instead of shrinking against scrollback DOM height", async () => {
    const { TERMINAL_VIEW_TAG, defineTerminalView } = await import("../src");
    defineTerminalView();
    const element = document.createElement(TERMINAL_VIEW_TAG) as InstanceType<
      typeof import("../src").TerminalViewElement
    >;

    element.terminalId = "fit-scrollback";
    element.projectionWidth = 730;
    element.projectionHeight = 394;
    element.projectionScale = 1;
    element.snapshot = withSnapshotScrollback({
      seq: 3,
      cols: 80,
      rows: 24,
      lines: Array.from({ length: 240 }, (_, index) => `line ${index + 1}`),
      cursor: { x: 0, y: 239 },
    });

    document.body.append(element);
    await element.updateComplete;
    await waitForLifecycleFrame();
    await element.updateComplete;

    const shadowRoot = requireShadowRoot(element);
    expect(shadowRoot.querySelector("[data-terminal-viewport]")?.getAttribute("style")).toContain("width:720px");
    expect(shadowRoot.querySelector(".terminal-frame")?.getAttribute("style")).toContain("width:730px");
  });

  test("Scenario: Given fit mode on a wide remote terminal When stage metrics settle Then the viewport keeps the full remote geometry by shrinking the projection instead of falling back to overflow", async () => {
    const { TERMINAL_VIEW_TAG, defineTerminalView } = await import("../src");
    defineTerminalView();
    const element = document.createElement(TERMINAL_VIEW_TAG) as InstanceType<
      typeof import("../src").TerminalViewElement
    >;

    element.terminalId = "fit-readable-floor";
    element.projectionWidth = 644;
    element.projectionHeight = 430;
    element.projectionScale = 0.538;
    element.snapshot = withSnapshotScrollback({
      seq: 9,
      cols: 132,
      rows: 40,
      lines: Array.from({ length: 40 }, (_, index) => `line ${index + 1}`),
      cursor: { x: 0, y: 39 },
    });

    document.body.append(element);
    await element.updateComplete;
    await waitForLifecycleFrame();
    await waitForLifecycleFrame();
    await element.updateComplete;

    const shadowRoot = requireShadowRoot(element);
    expect(readTerminalScale(shadowRoot)).toBeCloseTo(0.538, 3);
    expect(shadowRoot.querySelector('[data-terminal-stage]')?.getAttribute("style")).toContain("width:644px");
    expect(element.screenMetrics).toEqual({ width: 1188, height: 760 });
  });

  test("Scenario: Given a projected terminal viewport When explicit projection geometry is assigned Then the primitive uses that geometry without owning viewport mode semantics", async () => {
    const { TERMINAL_VIEW_TAG, defineTerminalView } = await import("../src");
    defineTerminalView();
    const element = document.createElement(TERMINAL_VIEW_TAG) as InstanceType<
      typeof import("../src").TerminalViewElement
    >;

    element.terminalId = "cover-origin-anchor";
    element.projectionWidth = 1480;
    element.projectionHeight = 980;
    element.projectionScale = 1.234;
    element.snapshot = withSnapshotScrollback({
      seq: 10,
      cols: 132,
      rows: 40,
      lines: Array.from({ length: 40 }, (_, index) => `line ${index + 1}`),
      cursor: { x: 0, y: 39 },
    });

    document.body.append(element);
    await element.updateComplete;
    await waitForLifecycleFrame();
    await waitForLifecycleFrame();
    await element.updateComplete;

    const shadowRoot = requireShadowRoot(element);
    const terminalStage = shadowRoot.querySelector<HTMLDivElement>("[data-terminal-stage]");
    expect(terminalStage).not.toBeNull();
    expect(terminalStage?.getAttribute("style")).toContain("width:1480px");
    expect(terminalStage?.getAttribute("style")).toContain("height:980px");
    expect(readTerminalScale(shadowRoot)).toBeCloseTo(1.234, 3);
  });

  test("Scenario: Given viewport gutter is reserved for edge safety When the frame renders Then the terminal screen stays symmetrically inset instead of leaving a one-sided blank strip", async () => {
    const { TERMINAL_VIEW_TAG, defineTerminalView } = await import("../src");
    defineTerminalView();
    const element = document.createElement(TERMINAL_VIEW_TAG) as InstanceType<
      typeof import("../src").TerminalViewElement
    >;

    element.terminalId = "balanced-gutter";
    element.projectionWidth = 874;
    element.projectionHeight = 552;
    element.projectionScale = 1;
    element.snapshot = withSnapshotScrollback({
      seq: 14,
      cols: 96,
      rows: 28,
      lines: Array.from({ length: 28 }, (_, index) => `line ${index + 1}`),
      cursor: { x: 0, y: 27 },
    });

    document.body.append(element);
    await element.updateComplete;
    await waitForLifecycleFrame();
    await waitForLifecycleFrame();
    await element.updateComplete;

    const shadowRoot = requireShadowRoot(element);
    const frameStyle = shadowRoot.querySelector(".terminal-frame")?.getAttribute("style") ?? "";
    const viewportStyle = shadowRoot.querySelector("[data-terminal-viewport]")?.getAttribute("style") ?? "";
    expect(frameStyle).toContain("width:874px");
    expect(viewportStyle).toContain("width:864px");
    expect(viewportStyle).toContain("margin-left:5px");
    expect(viewportStyle).toContain("margin-top:10px");
  });

  test("Scenario: Given fit mode on a small remote terminal When stage metrics settle Then the viewport can scale up the projection without mutating remote rows or cols", async () => {
    const { TERMINAL_VIEW_TAG, defineTerminalView } = await import("../src");
    defineTerminalView();
    const element = document.createElement(TERMINAL_VIEW_TAG) as InstanceType<
      typeof import("../src").TerminalViewElement
    >;

    element.terminalId = "fit-upscale";
    element.projectionWidth = 656;
    element.projectionHeight = 328;
    element.projectionScale = 2;
    element.snapshot = withSnapshotScrollback({
      seq: 12,
      cols: 40,
      rows: 10,
      lines: Array.from({ length: 10 }, (_, index) => `line ${index + 1}`),
      cursor: { x: 0, y: 9 },
    });

    document.body.append(element);
    await element.updateComplete;
    await waitForLifecycleFrame();
    await waitForLifecycleFrame();
    await element.updateComplete;

    const shadowRoot = requireShadowRoot(element);
    const terminal = mockTerminals.at(-1);
    expect(readTerminalScale(shadowRoot)).toBeCloseTo(2, 2);
    expect(terminal?.cols).toBe(40);
    expect(terminal?.rows).toBe(10);
  });

  test("Scenario: Given transport url and bootstrap snapshot are assigned together after mount When the element updates Then websocket transport still connects instead of staying idle", async () => {
    const { TERMINAL_VIEW_TAG, defineTerminalView } = await import("../src");
    defineTerminalView();
    const element = document.createElement(TERMINAL_VIEW_TAG) as InstanceType<
      typeof import("../src").TerminalViewElement
    >;

    document.body.append(element);
    await element.updateComplete;
    await waitForLifecycleFrame();
    await element.updateComplete;

    element.transportUrl = "ws://127.0.0.1:4900/pty/bootstrap";
    element.snapshot = withSnapshotScrollback({
      seq: 1,
      cols: 80,
      rows: 24,
      lines: ["bootstrap snapshot"],
      cursor: { x: 0, y: 0 },
    });

    await element.updateComplete;
    await waitForLifecycleFrame();
    await element.updateComplete;

    expect(WebSocketMock.instances.at(-1)?.url).toBe("ws://127.0.0.1:4900/pty/bootstrap");
    expect(element.connectionState).toBe("connecting");
  });

  test("Scenario: Given a transport-backed terminal When websocket events arrive Then the component stays connected and only sends resize frames through the explicit viewport resize API", async () => {
    const { TERMINAL_VIEW_TAG, defineTerminalView } = await import("../src");
    defineTerminalView();
    const element = document.createElement(TERMINAL_VIEW_TAG) as InstanceType<
      typeof import("../src").TerminalViewElement
    >;

    element.terminalId = "iflow";
    element.transportUrl = "ws://127.0.0.1:4900/pty/iflow";

    document.body.append(element);
    await element.updateComplete;
    await waitForLifecycleFrame();
    await element.updateComplete;

    const shadowRoot = requireShadowRoot(element);
    const socket = WebSocketMock.instances.at(-1);
    expect(socket?.url).toBe("ws://127.0.0.1:4900/pty/iflow");
    expect(element.connectionState).toBe("connecting");

    socket?.open();
    await element.updateComplete;
    await waitForLifecycleFrame();
    await element.updateComplete;
    expect(element.connectionState).toBe("connected");
    expect(decodeSentClientFrames(socket)).toEqual([]);

    expect(element.requestViewportResize({ cols: 103, rows: 20 })).toBe(true);
    expect(decodeSentClientFrames(socket)).toContainEqual({
      type: "resize",
      cols: 103,
      rows: 20,
    });

    const terminal = mockTerminals.at(-1);
    expect(terminal?.resetCount).toBe(0);

    socket?.message(
      encodeServerFrame({
        type: "snapshot",
        terminalId: "iflow",
        status: "BUSY",
        snapshot: withSnapshotScrollback({
          seq: 2,
          cols: 140,
          rows: 40,
          lines: ["initial state"],
          cursor: { x: 0, y: 0 },
        }),
      }),
    );
    await element.updateComplete;
    await element.updateComplete;
    expect(terminal?.resetCount).toBe(1);
    expect(terminal?.cols).toBe(140);
    expect(terminal?.rows).toBe(40);
    expect(terminal?.writes).toContain("initial state");
    expect(terminal?.options.scrollback).toBe(10_000);
    expect(shadowRoot.querySelector("[data-terminal-viewport]")?.getAttribute("style")).toContain("width:1260px");

    let redundantSnapshotUpdates = 0;
    const originalRequestUpdate = element.requestUpdate.bind(element);
    element.requestUpdate = ((...args) => {
      redundantSnapshotUpdates += 1;
      return originalRequestUpdate(...args);
    }) as typeof element.requestUpdate;

    socket?.message(
      encodeServerFrame({
        type: "snapshot",
        terminalId: "iflow",
        status: "BUSY",
        snapshot: withSnapshotScrollback({
          seq: 3,
          cols: 140,
          rows: 40,
          lines: ["redundant full snapshot"],
          cursor: { x: 0, y: 0 },
        }),
      }),
    );
    await element.updateComplete;
    await element.updateComplete;
    expect(redundantSnapshotUpdates).toBe(0);
    expect(terminal?.resetCount).toBe(1);
    expect(terminal?.writes).not.toContain("redundant full snapshot");

    element.snapshot = withSnapshotScrollback({
      seq: 4,
      cols: 60,
      rows: 12,
      lines: ["stale prop snapshot"],
      cursor: { x: 0, y: 0 },
    });
    await element.updateComplete;
    await element.updateComplete;
    expect(terminal?.resetCount).toBe(1);
    expect(terminal?.writes).not.toContain("stale prop snapshot");

    terminal?.emitData("typed text");
    terminal?.emitData("\u001b[A");
    const sentFrames = decodeSentClientFrames(socket);
    expect(sentFrames).toContainEqual({ type: "inputBytes", data: new TextEncoder().encode("typed text") });
    expect(sentFrames).toContainEqual({ type: "inputBytes", data: new TextEncoder().encode("\u001b[A") });

    socket?.message(
      encodeServerFrame({
        type: "outputBytes",
        terminalId: "iflow",
        data: new TextEncoder().encode("bun test\r\n"),
      }),
    );
    socket?.message(
      encodeServerFrame({
        type: "status",
        terminalId: "iflow",
        running: false,
        status: "IDLE",
      }),
    );
    await element.updateComplete;

    expect(containsWrittenText(terminal, "bun test\r\n")).toBe(true);
    expect(element.connectionState).toBe("closed");
    expect(shadowRoot.querySelector(".terminal-connection-badge")).toBeNull();

    const sentBeforeClosedInput = socket?.sent.length ?? 0;
    terminal?.emitData("after close");
    expect(socket?.sent).toHaveLength(sentBeforeClosedInput);

    element.remove();
  });

  test("Scenario: Given terminal stop closes the live websocket When the same transport url is enabled again Then the component reconnects instead of staying closed", async () => {
    const { TERMINAL_VIEW_TAG, defineTerminalView } = await import("../src");
    defineTerminalView();
    const element = document.createElement(TERMINAL_VIEW_TAG) as InstanceType<
      typeof import("../src").TerminalViewElement
    >;

    element.terminalId = "reconnect-after-stop";
    element.transportUrl = "ws://127.0.0.1:4900/pty/reconnect-after-stop";

    document.body.append(element);
    await element.updateComplete;
    await waitForLifecycleFrame();
    await element.updateComplete;

    const firstSocket = WebSocketMock.instances.at(-1);
    expect(firstSocket?.url).toBe("ws://127.0.0.1:4900/pty/reconnect-after-stop");
    firstSocket?.open();
    await element.updateComplete;
    expect(element.connectionState).toBe("connected");

    firstSocket?.message(
      encodeServerFrame({
        type: "status",
        terminalId: "reconnect-after-stop",
        running: false,
        status: "IDLE",
      }),
    );
    await element.updateComplete;
    expect(element.connectionState).toBe("closed");

    element.liveTransportEnabled = false;
    await element.updateComplete;
    await waitForLifecycleFrame();
    expect(element.connectionState).toBe("idle");

    element.liveTransportEnabled = true;
    await element.updateComplete;
    await waitForLifecycleFrame();
    await element.updateComplete;

    const secondSocket = WebSocketMock.instances.at(-1);
    expect(secondSocket).toBeDefined();
    expect(secondSocket).not.toBe(firstSocket);
    expect(secondSocket?.url).toBe("ws://127.0.0.1:4900/pty/reconnect-after-stop");
    expect(element.connectionState).toBe("connecting");

    secondSocket?.open();
    await element.updateComplete;
    expect(element.connectionState).toBe("connected");
  });

  test("Scenario: Given transport discovery remains while live transport is disabled When the element updates Then it stays idle and does not attempt a websocket connection", async () => {
    const { TERMINAL_VIEW_TAG, defineTerminalView } = await import("../src");
    defineTerminalView();
    const element = document.createElement(TERMINAL_VIEW_TAG) as InstanceType<
      typeof import("../src").TerminalViewElement
    >;

    element.terminalId = "stopped-discovery";
    element.transportUrl = "ws://127.0.0.1:4900/pty/stopped-discovery";
    element.liveTransportEnabled = false;
    element.snapshot = withSnapshotScrollback({
      seq: 1,
      cols: 80,
      rows: 24,
      lines: ["bootstrap snapshot"],
      cursor: { x: 0, y: 0 },
    });

    document.body.append(element);
    await element.updateComplete;
    await waitForLifecycleFrame();
    await element.updateComplete;

    expect(WebSocketMock.instances.at(-1)?.url).not.toBe("ws://127.0.0.1:4900/pty/stopped-discovery");
    expect(element.connectionState).toBe("idle");
    expect(requireShadowRoot(element).querySelector("[data-terminal-viewport]")).not.toBeNull();
  });

  test("Scenario: Given a terminal viewport inside shadow DOM When pointer and touch interactions happen Then the primitive explicitly focuses xterm input", async () => {
    const { TERMINAL_VIEW_TAG, defineTerminalView } = await import("../src");
    defineTerminalView();
    const element = document.createElement(TERMINAL_VIEW_TAG) as InstanceType<
      typeof import("../src").TerminalViewElement
    >;

    element.terminalId = "focus-bridge";
    document.body.append(element);
    await element.updateComplete;
    await waitForLifecycleFrame();
    await element.updateComplete;

    const shadowRoot = requireShadowRoot(element);
    const terminal = mockTerminals.at(-1);
    const viewport = shadowRoot.querySelector<HTMLElement>("[data-terminal-viewport]");
    expect(viewport).not.toBeNull();
    expect(terminal?.focusCount).toBe(0);

    viewport?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await waitForLifecycleFrame();
    expect(terminal?.focusCount).toBeGreaterThanOrEqual(1);

    terminal?.textarea?.blur();
    viewport?.dispatchEvent(new Event("touchstart", { bubbles: true }));
    await waitForLifecycleFrame();
    expect(terminal?.focusCount).toBeGreaterThanOrEqual(2);
  });

  test("Scenario: Given a running xterm session When cursor style changes Then terminal-view emits a live-apply presentation-ready event without rebuilding the renderer session", async () => {
    const { TERMINAL_VIEW_TAG, defineTerminalView } = await import("../src");
    defineTerminalView();
    const element = document.createElement(TERMINAL_VIEW_TAG) as InstanceType<
      typeof import("../src").TerminalViewElement
    >;
    const readyEvents: Array<{
      terminalId: string;
      resolvedRenderer: string;
      reason: string;
    }> = [];

    element.terminalId = "presentation-live-apply";
    element.rendererPreference = "xterm";
    element.addEventListener("terminal-view-presentation-ready", (event) => {
      readyEvents.push(
        (event as CustomEvent<{ terminalId: string; resolvedRenderer: string; reason: string }>).detail,
      );
    });

    document.body.append(element);
    await element.updateComplete;
    await waitForLifecycleFrame();
    await element.updateComplete;

    const firstTerminal = mockTerminals.at(-1);
    expect(firstTerminal).toBeDefined();

    element.cursor = "bar";
    await element.updateComplete;
    await waitForLifecycleFrame();
    await element.updateComplete;

    expect(mockTerminals.at(-1)).toBe(firstTerminal);
    expect(firstTerminal?.options.cursorStyle).toBe("bar");
    expect(readyEvents.some((event) => event.reason === "live-apply")).toBe(true);
  });

  test("Scenario: Given a running xterm session When font size changes Then terminal-view live-applies the font settle path without rebuilding the renderer session", async () => {
    const { TERMINAL_VIEW_TAG, defineTerminalView } = await import("../src");
    defineTerminalView();
    const element = document.createElement(TERMINAL_VIEW_TAG) as InstanceType<
      typeof import("../src").TerminalViewElement
    >;
    const readyEvents: Array<{
      terminalId: string;
      resolvedRenderer: string;
      reason: string;
    }> = [];

    element.terminalId = "presentation-font-live-apply";
    element.rendererPreference = "xterm";
    element.addEventListener("terminal-view-presentation-ready", (event) => {
      readyEvents.push(
        (event as CustomEvent<{ terminalId: string; resolvedRenderer: string; reason: string }>).detail,
      );
    });

    document.body.append(element);
    await element.updateComplete;
    await waitForLifecycleFrame();
    await element.updateComplete;

    const firstTerminal = mockTerminals.at(-1);
    expect(firstTerminal).toBeDefined();
    expect(firstTerminal?.options.fontSize).toBe(14);

    element.font = {
      ...element.font,
      sizePx: 16,
    };
    await element.updateComplete;
    await waitForLifecycleFrame();
    await waitForLifecycleFrame();
    await element.updateComplete;

    expect(mockTerminals.at(-1)).toBe(firstTerminal);
    expect(firstTerminal?.options.fontSize).toBe(16);
    expect(firstTerminal?.clearTextureAtlasCount).toBeGreaterThanOrEqual(2);
    expect(firstTerminal?.refreshCount).toBeGreaterThanOrEqual(2);
    expect(readyEvents.at(-1)?.reason).toBe("live-apply");
  });

  test("Scenario: Given a running ghostty-web session When theme changes Then terminal-view rebuilds the local renderer stack and emits a rebuild-session ready event", async () => {
    const { TERMINAL_VIEW_TAG, defineTerminalView } = await import("../src");
    defineTerminalView();
    const element = document.createElement(TERMINAL_VIEW_TAG) as InstanceType<
      typeof import("../src").TerminalViewElement
    >;
    const readyEvents: Array<{
      terminalId: string;
      resolvedRenderer: string;
      reason: string;
    }> = [];

    element.terminalId = "presentation-rebuild";
    element.rendererPreference = "ghostty-web";
    element.addEventListener("terminal-view-presentation-ready", (event) => {
      readyEvents.push(
        (event as CustomEvent<{ terminalId: string; resolvedRenderer: string; reason: string }>).detail,
      );
    });

    document.body.append(element);
    await element.updateComplete;
    await waitForLifecycleFrame();
    await element.updateComplete;

    const firstTerminal = mockGhosttyTerminals.at(-1);
    expect(firstTerminal).toBeDefined();

    element.theme = "default-light";
    await element.updateComplete;
    await waitForLifecycleFrame();
    await element.updateComplete;

    const rebuiltTerminal = mockGhosttyTerminals.at(-1);
    expect(rebuiltTerminal).toBeDefined();
    expect(rebuiltTerminal).not.toBe(firstTerminal);
    expect(readyEvents.some((event) => event.reason === "rebuild-session")).toBe(true);
  });

  test("Scenario: Given a rebuilt renderer session and an unchanged snapshot sequence When presentation rebuild settles Then the fresh renderer still rehydrates the current snapshot", async () => {
    const { TERMINAL_VIEW_TAG, defineTerminalView } = await import("../src");
    defineTerminalView();
    const element = document.createElement(TERMINAL_VIEW_TAG) as InstanceType<
      typeof import("../src").TerminalViewElement
    >;

    element.terminalId = "rebuild-hydrate";
    element.rendererPreference = "ghostty-web";
    element.snapshot = withSnapshotScrollback({
      seq: 7,
      cols: 80,
      rows: 24,
      lines: ["hello rebuild"],
      cursor: { x: 0, y: 0 },
    });

    document.body.append(element);
    await element.updateComplete;
    await waitForLifecycleFrame();
    await element.updateComplete;

    const firstTerminal = mockGhosttyTerminals.at(-1);
    expect(firstTerminal?.writes.some((entry) => typeof entry === "string" && entry.includes("hello rebuild"))).toBe(true);

    element.theme = "default-light";
    await element.updateComplete;
    await waitForLifecycleFrame();
    await element.updateComplete;

    const rebuiltTerminal = mockGhosttyTerminals.at(-1);
    expect(rebuiltTerminal).toBeDefined();
    expect(rebuiltTerminal).not.toBe(firstTerminal);
    expect(rebuiltTerminal?.writes.some((entry) => typeof entry === "string" && entry.includes("hello rebuild"))).toBe(
      true,
    );
    expect(rebuiltTerminal?.renderer.render).toHaveBeenCalled();
  });

  test("Scenario: Given an xterm session with an existing snapshot When renderer preference switches to ghostty-web Then the rebuilt ghostty-web session paints immediately", async () => {
    const { TERMINAL_VIEW_TAG, defineTerminalView } = await import("../src");
    defineTerminalView();
    const element = document.createElement(TERMINAL_VIEW_TAG) as InstanceType<
      typeof import("../src").TerminalViewElement
    >;

    element.terminalId = "xterm-to-ghostty";
    element.rendererPreference = "xterm";
    element.snapshot = withSnapshotScrollback({
      seq: 11,
      cols: 80,
      rows: 24,
      lines: ["switch renderer repaint"],
      cursor: { x: 0, y: 0 },
    });

    document.body.append(element);
    await element.updateComplete;
    await waitForLifecycleFrame();
    await element.updateComplete;

    const xtermTerminal = mockTerminals.at(-1);
    expect(xtermTerminal?.writes.some((entry) => typeof entry === "string" && entry.includes("switch renderer repaint"))).toBe(
      true,
    );

    element.rendererPreference = "ghostty-web";
    await element.updateComplete;
    await waitForLifecycleFrame();
    await waitForLifecycleFrame();
    await element.updateComplete;

    const rebuiltTerminal = mockGhosttyTerminals.at(-1);
    expect(rebuiltTerminal?.writes.some((entry) => typeof entry === "string" && entry.includes("switch renderer repaint"))).toBe(
      true,
    );
    expect(rebuiltTerminal?.renderer.render).toHaveBeenCalled();
  });

  test("Scenario: Given the live snapshot arrives before xterm boot finishes When the component mounts Then the first transport snapshot is still rendered", async () => {
    const { TERMINAL_VIEW_TAG, defineTerminalView } = await import("../src");
    defineTerminalView();
    const element = document.createElement(TERMINAL_VIEW_TAG) as InstanceType<
      typeof import("../src").TerminalViewElement
    >;

    element.terminalId = "iflow";
    element.transportUrl = "ws://127.0.0.1:4900/pty/iflow";

    document.body.append(element);
    await element.updateComplete;

    const socket = WebSocketMock.instances.at(-1);
    socket?.open();
    socket?.message(
      encodeServerFrame({
        type: "snapshot",
        terminalId: "iflow",
        status: "BUSY",
        snapshot: withSnapshotScrollback({
          seq: 1,
          cols: 120,
          rows: 30,
          lines: ["boot output"],
          cursor: { x: 0, y: 0 },
        }),
      }),
    );

    await waitForLifecycleFrame();
    await element.updateComplete;

    const terminal = mockTerminals.at(-1);
    expect(element.connectionState).toBe("connected");
    expect(terminal?.resetCount).toBe(1);
    expect(terminal?.writes).toContain("boot output");
    expect(terminal?.cols).toBe(120);
    expect(terminal?.rows).toBe(30);
  });

  test("Scenario: Given a transport-backed viewport When the socket sends an invalid payload Then the primitive enters error state without reintroducing host chrome", async () => {
    const { TERMINAL_VIEW_TAG, defineTerminalView } = await import("../src");
    defineTerminalView();
    const element = document.createElement(TERMINAL_VIEW_TAG) as InstanceType<
      typeof import("../src").TerminalViewElement
    >;

    element.terminalId = "iflow";
    element.transportUrl = "ws://127.0.0.1:4900/pty/iflow";

    document.body.append(element);
    await element.updateComplete;
    await waitForLifecycleFrame();
    await element.updateComplete;

    const shadowRoot = requireShadowRoot(element);
    const socket = WebSocketMock.instances.at(-1);
    socket?.open();
    socket?.message(new ArrayBuffer(2));
    await element.updateComplete;

    expect(element.connectionState).toBe("error");
    expect(element.errorMessage).toBe("invalid transport payload");
    expect(shadowRoot.querySelector(".terminal-toolbar")).toBeNull();
    expect(shadowRoot.querySelector(".terminal-footer")).toBeNull();
    expect(shadowRoot.querySelector(".terminal-connection-badge")).toBeNull();
  });
});
