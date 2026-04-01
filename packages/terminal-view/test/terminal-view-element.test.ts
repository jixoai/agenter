import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@xterm/xterm/css/xterm.css?inline", () => ({ default: ".xterm { display: block; }" }));

type ResizeEntry = Pick<ResizeObserverEntry, "target" | "contentRect">;

class MockTerminal {
  cols = 80;
  rows = 24;
  writes: string[] = [];
  resetCount = 0;
  characterJoiners: Array<(text: string) => [number, number][]> = [];
  deregisteredJoinerIds: number[] = [];
  openedWith: Element | null = null;
  element: HTMLElement | undefined;
  options: Record<string, unknown> = {};
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

  deregisterCharacterJoiner(joinerId: number): void {
    this.deregisteredJoinerIds.push(joinerId);
  }

  open(node: Element): void {
    this.openedWith = node;
    this.element = node as HTMLElement;
    const viewport = document.createElement("div");
    viewport.className = "xterm-viewport";
    const screen = document.createElement("div");
    screen.className = "xterm-screen";
    screen.style.width = `${this._core._renderService.dimensions.css.canvas.width}px`;
    screen.style.height = `${this._core._renderService.dimensions.css.canvas.height}px`;
    node.appendChild(screen);
    node.appendChild(viewport);
  }

  write(data: string): void {
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

  dispose(): void {}

  private updateDimensions(): void {
    this._core._renderService.dimensions.css.canvas.width = this.cols * 9;
    this._core._renderService.dimensions.css.canvas.height = this.rows * 19;
  }
}

const mockTerminals: MockTerminal[] = [];
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
    const entry = {
      target,
      contentRect: {
        width: 960,
        height: 420,
        top: 0,
        left: 0,
        right: 960,
        bottom: 420,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      },
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
  readonly sent: string[] = [];
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

  send(data: string): void {
    this.sent.push(data);
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

describe("Feature: terminal-view WebComponent", () => {
  beforeEach(() => {
    mockTerminals.length = 0;
    WebSocketMock.instances.length = 0;
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("WebSocket", WebSocketMock);
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
    element.terminalTitle = "Flow shell";
    element.cwd = "/repo/demo";
    element.status = "BUSY";
    element.viewportMode = "cover";
    element.snapshot = {
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
    };

    document.body.append(element);
    await element.updateComplete;
    await waitForLifecycleFrame();
    await element.updateComplete;

    const shadowRoot = requireShadowRoot(element);
    const terminal = mockTerminals.at(-1);
    expect(terminal).toBeDefined();
    expect(terminal?.resetCount).toBe(1);
    expect(terminal?.cols).toBe(132);
    expect(terminal?.rows).toBe(40);
    expect(terminal?.options.allowProposedApi).toBe(true);
    expect(terminal?.options.lineHeight).toBe(1.25);
    expect(terminal?.options.scrollback).toBe(10_000);
    expect(terminal?.characterJoiners).toHaveLength(1);
    expect(terminal?.characterJoiners[0]?.("!== && => ??")).toEqual([
      [0, 3],
      [4, 6],
      [7, 9],
      [10, 12],
    ]);
    expect(element.querySelector("style")).toBeNull();
    expect(shadowRoot.querySelector(".terminal-frame")?.getAttribute("style")).toContain("width:1220px");
    expect(shadowRoot.querySelector("[data-terminal-viewport]")?.getAttribute("style")).toContain("width:1188px");
    expect(shadowRoot.querySelector("style")?.textContent).toContain('font-feature-settings: "liga" 1, "calt" 1;');
    expect(terminal?.writes.at(-1)).toContain("npm ERR!");
    expect(terminal?.writes.at(-1)).toContain("38;2;241;76;76");
    expect(terminal?.writes.at(-1)).toContain("line 64");
    expect(shadowRoot.querySelector('[data-terminal-scroll-contract="terminal-stage"]')).not.toBeNull();
    expect(shadowRoot.querySelector('[data-terminal-scroll-owner="terminal-stage"]')).not.toBeNull();
    expect(shadowRoot.querySelector('[data-viewport-mode="cover"]')).not.toBeNull();
    expect(shadowRoot.textContent).toContain("Flow shell");
    expect(shadowRoot.textContent).toContain("/repo/demo");
  });

  test("Scenario: Given a transport-backed terminal When websocket events arrive Then the component keeps fixed geometry and reflects connection lifecycle without auto-resizing the PTY", async () => {
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
    await element.updateComplete;
    expect(element.connectionState).toBe("connected");
    expect(socket?.sent).toHaveLength(0);

    const terminal = mockTerminals.at(-1);
    expect(terminal?.resetCount).toBe(0);
    expect(terminal?.characterJoiners).toHaveLength(1);

    socket?.message(
      JSON.stringify({
        type: "snapshot",
        terminalId: "iflow",
        status: "BUSY",
        snapshot: {
          seq: 2,
          cols: 140,
          rows: 40,
          lines: ["initial state"],
          cursor: { x: 0, y: 0 },
        },
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

    element.snapshot = {
      seq: 3,
      cols: 60,
      rows: 12,
      lines: ["stale prop snapshot"],
      cursor: { x: 0, y: 0 },
    };
    await element.updateComplete;
    await element.updateComplete;
    expect(terminal?.resetCount).toBe(1);
    expect(terminal?.writes).not.toContain("stale prop snapshot");

    socket?.message(
      JSON.stringify({
        type: "output",
        terminalId: "iflow",
        data: "bun test\r\n",
      }),
    );
    socket?.message(
      JSON.stringify({
        type: "status",
        terminalId: "iflow",
        running: false,
        status: "IDLE",
      }),
    );
    await element.updateComplete;

    expect(terminal?.writes).toContain("bun test\r\n");
    expect(element.status).toBe("IDLE");
    expect(element.connectionState).toBe("closed");
    expect(shadowRoot.querySelector(".terminal-connection-badge")?.textContent).toContain("disconnected");

    element.remove();
    expect(terminal?.deregisteredJoinerIds).toContain(0);
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
      JSON.stringify({
        type: "snapshot",
        terminalId: "iflow",
        status: "BUSY",
        snapshot: {
          seq: 1,
          cols: 120,
          rows: 30,
          lines: ["boot output"],
          cursor: { x: 0, y: 0 },
        },
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
});
