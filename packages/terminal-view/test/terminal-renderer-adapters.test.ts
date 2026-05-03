import { beforeEach, describe, expect, test, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  xtermTerminals: [] as Array<{
    cols: number;
    rows: number;
    options: Record<string, unknown>;
    textarea?: HTMLTextAreaElement;
    element?: HTMLElement;
    registerCharacterJoiner: ReturnType<typeof vi.fn>;
    deregisterCharacterJoiner: ReturnType<typeof vi.fn>;
    onData: ReturnType<typeof vi.fn>;
    onBinary: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
  }>,
  ghosttyTerminals: [] as Array<{
    cols: number;
    rows: number;
    options: Record<string, unknown>;
    textarea?: HTMLTextAreaElement;
    renderer: {
      getCanvas: ReturnType<typeof vi.fn>;
      getMetrics: ReturnType<typeof vi.fn>;
      setTheme: ReturnType<typeof vi.fn>;
      setCursorStyle: ReturnType<typeof vi.fn>;
    };
    reset: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
    onData: ReturnType<typeof vi.fn>;
  }>,
  wtermTerminals: [] as Array<{
    cols: number;
    rows: number;
    host: HTMLElement;
    options: Record<string, unknown>;
    textarea: HTMLTextAreaElement;
    grid: HTMLDivElement;
    rowsDom: HTMLDivElement[];
    write: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    init: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
  }>,
  ghosttyCoreLoad: vi.fn(async (options: unknown) => ({ options })),
  ghosttyInit: vi.fn(async () => undefined),
}));

vi.mock("@xterm/xterm/css/xterm.css?inline", () => ({ default: ".xterm { display:block; }" }));
vi.mock("@wterm/dom/css?inline", () => ({ default: ".term-grid { display:block; }" }));

vi.mock("@xterm/xterm", () => ({
  Terminal: class TerminalMock {
    cols: number;
    rows: number;
    options: Record<string, unknown>;
    textarea: HTMLTextAreaElement | undefined;
    element: HTMLElement | undefined;
    registerCharacterJoiner = vi.fn(() => 0);
    deregisterCharacterJoiner = vi.fn();
    onData = vi.fn(() => ({ dispose() {} }));
    onBinary = vi.fn(() => ({ dispose() {} }));
    reset = vi.fn();
    focus = vi.fn();
    dispose = vi.fn();
    resize = vi.fn((cols: number, rows: number) => {
      this.cols = cols;
      this.rows = rows;
    });
    write = vi.fn();

    constructor(options?: Record<string, unknown>) {
      this.options = { ...(options ?? {}) };
      this.cols = Number(options?.cols ?? 80);
      this.rows = Number(options?.rows ?? 24);
      mockState.xtermTerminals.push(this);
    }

    open(host: Element): void {
      this.element = host as HTMLElement;
      this.textarea = document.createElement("textarea");
      const screen = document.createElement("div");
      screen.className = "xterm-screen";
      const viewport = document.createElement("div");
      viewport.className = "xterm-viewport";
      this.element.append(this.textarea, screen, viewport);
    }
  },
}));

vi.mock("ghostty-web", () => ({
  init: mockState.ghosttyInit,
  Terminal: class TerminalMock {
    cols: number;
    rows: number;
    options: Record<string, unknown>;
    textarea: HTMLTextAreaElement | undefined;
    private canvas: HTMLCanvasElement | null = null;
    renderer = {
      getCanvas: vi.fn(() => this.canvas),
      getMetrics: vi.fn(() => ({ width: 9, height: 18 })),
      setTheme: vi.fn(),
      setCursorStyle: vi.fn(),
    };
    reset = vi.fn();
    focus = vi.fn();
    dispose = vi.fn();
    resize = vi.fn((cols: number, rows: number) => {
      this.cols = cols;
      this.rows = rows;
      if (this.canvas) {
        Object.defineProperty(this.canvas, "offsetWidth", { configurable: true, value: cols * 9 });
        Object.defineProperty(this.canvas, "offsetHeight", { configurable: true, value: rows * 18 });
      }
    });
    write = vi.fn();
    onData = vi.fn(() => ({ dispose() {} }));

    constructor(options?: Record<string, unknown>) {
      this.options = { ...(options ?? {}) };
      this.cols = Number(options?.cols ?? 80);
      this.rows = Number(options?.rows ?? 24);
      mockState.ghosttyTerminals.push(this);
    }

    open(host: Element): void {
      const root = host as HTMLElement;
      this.textarea = document.createElement("textarea");
      this.canvas = document.createElement("canvas");
      Object.defineProperty(this.canvas, "offsetWidth", { configurable: true, value: this.cols * 9 });
      Object.defineProperty(this.canvas, "offsetHeight", { configurable: true, value: this.rows * 18 });
      root.append(this.textarea, this.canvas);
    }
  },
}));

vi.mock("@wterm/ghostty", () => ({
  GhosttyCore: {
    load: mockState.ghosttyCoreLoad,
  },
}));

vi.mock("@wterm/dom", () => ({
  WTerm: class WTermMock {
    cols: number;
    rows: number;
    readonly host: HTMLElement;
    readonly options: Record<string, unknown>;
    readonly textarea: HTMLTextAreaElement;
    readonly grid: HTMLDivElement;
    readonly rowsDom: HTMLDivElement[] = [];
    write = vi.fn();
    focus = vi.fn();
    destroy = vi.fn();
    init = vi.fn(async () => undefined);
    resize = vi.fn((cols: number, rows: number) => {
      this.cols = cols;
      this.rows = rows;
      Object.defineProperty(this.grid, "clientWidth", { configurable: true, value: cols * 9 });
      Object.defineProperty(this.grid, "clientHeight", { configurable: true, value: rows * 20 });
      Object.defineProperty(this.grid, "offsetWidth", { configurable: true, value: cols * 9 });
      Object.defineProperty(this.grid, "offsetHeight", { configurable: true, value: rows * 20 });
      Object.defineProperty(this.grid, "getBoundingClientRect", {
        configurable: true,
        value: () => ({
          width: cols * 9,
          height: rows * 20,
          top: 0,
          left: 0,
          right: cols * 9,
          bottom: rows * 20,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });
      this.rowsDom.splice(0, this.rowsDom.length);
      this.grid.replaceChildren();
      for (let index = 0; index < rows; index += 1) {
        const row = document.createElement("div");
        row.className = "term-row";
        Object.defineProperty(row, "getBoundingClientRect", {
          configurable: true,
          value: () => ({
            width: cols * 9,
            height: 20,
            top: index * 20,
            left: 0,
            right: cols * 9,
            bottom: index * 20 + 20,
            x: 0,
            y: index * 20,
            toJSON: () => ({}),
          }),
        });
        this.rowsDom.push(row);
        this.grid.append(row);
      }
    });

    constructor(host: HTMLElement, options: Record<string, unknown>) {
      this.host = host;
      this.options = options;
      this.cols = Number(options.cols ?? 80);
      this.rows = Number(options.rows ?? 24);
      this.textarea = document.createElement("textarea");
      this.grid = document.createElement("div");
      this.grid.className = "term-grid";
      this.resize(this.cols, this.rows);
      this.host.append(this.textarea, this.grid);
      mockState.wtermTerminals.push(this);
    }
  },
}));

import {
  TERMINAL_PUBLIC_INPUT_ATTRIBUTE,
  TERMINAL_PUBLIC_SCREEN_ATTRIBUTE,
  TERMINAL_PUBLIC_SCROLL_ATTRIBUTE,
} from "../src/terminal-renderer-adapter";
import { resolveTerminalAppearance } from "../src/terminal-renderer-profile";
import { ghosttyWebRendererAdapter } from "../src/renderers/ghostty-web-renderer-adapter";
import { wtermRendererAdapter } from "../src/renderers/wterm-renderer-adapter";
import { xtermRendererAdapter } from "../src/renderers/xterm-renderer-adapter";

const createAppearance = () =>
  resolveTerminalAppearance({
    theme: "monokai",
    cursor: "underline",
    font: {
      family: "'JetBrains Mono', monospace",
      sizePx: 16,
      lineHeight: 1.35,
      letterSpacing: 1,
      weight: "500",
      weightBold: "800",
      ligatures: false,
    },
  });

describe("Feature: terminal renderer adapters", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    mockState.xtermTerminals.length = 0;
    mockState.ghosttyTerminals.length = 0;
    mockState.wtermTerminals.length = 0;
    mockState.ghosttyCoreLoad.mockClear();
    mockState.ghosttyInit.mockClear();
  });

  test("Scenario: Given the shared terminal appearance law When xterm and ghostty-web sessions are created Then both adapters map the same font, theme, and cursor truth into engine-local options", async () => {
    const appearance = createAppearance();

    const xtermHost = document.createElement("div");
    const xtermSession = await xtermRendererAdapter.createSession({
      host: xtermHost,
      cols: 90,
      rows: 28,
      scrollback: 4096,
      appearance,
      onInputBytes: vi.fn(),
    });
    const xterm = mockState.xtermTerminals.at(-1);
    expect(xterm?.options.fontFamily).toBe(appearance.font.family);
    expect(xterm?.options.fontSize).toBe(appearance.font.sizePx);
    expect(xterm?.options.fontWeight).toBe(appearance.font.weight);
    expect(xterm?.options.fontWeightBold).toBe(appearance.font.weightBold);
    expect(xterm?.options.lineHeight).toBe(appearance.font.lineHeight);
    expect(xterm?.options.letterSpacing).toBe(appearance.font.letterSpacing);
    expect(xterm?.options.customGlyphs).toBe(appearance.font.ligatures);
    expect(xterm?.options.cursorStyle).toBe(appearance.cursorStyle);
    expect(xterm?.options.theme).toEqual(appearance.theme);
    expect(xtermHost.querySelector(".xterm-screen")?.getAttribute(TERMINAL_PUBLIC_SCREEN_ATTRIBUTE)).toBe("true");
    expect(xtermHost.querySelector(".xterm-viewport")?.getAttribute(TERMINAL_PUBLIC_SCROLL_ATTRIBUTE)).toBe("true");
    expect(xtermHost.querySelector("textarea")?.getAttribute(TERMINAL_PUBLIC_INPUT_ATTRIBUTE)).toBe("true");

    const ghosttyHost = document.createElement("div");
    const ghosttySession = await ghosttyWebRendererAdapter.createSession({
      host: ghosttyHost,
      cols: 90,
      rows: 28,
      scrollback: 4096,
      appearance,
      onInputBytes: vi.fn(),
    });
    const ghostty = mockState.ghosttyTerminals.at(-1);
    expect(mockState.ghosttyInit).not.toHaveBeenCalled();
    expect(ghostty?.options.fontFamily).toBe(appearance.font.family);
    expect(ghostty?.options.fontSize).toBe(appearance.font.sizePx);
    expect(ghostty?.options.fontWeight).toBe(appearance.font.weight);
    expect(ghostty?.options.fontWeightBold).toBe(appearance.font.weightBold);
    expect(ghostty?.options.lineHeight).toBe(appearance.font.lineHeight);
    expect(ghostty?.options.letterSpacing).toBe(appearance.font.letterSpacing);
    expect(ghostty?.options.cursorStyle).toBe(appearance.cursorStyle);
    expect(ghostty?.options.theme).toEqual(appearance.theme);

    const nextAppearance = resolveTerminalAppearance({
      theme: "default-light",
      cursor: "bar",
      font: {
        sizePx: 14,
        ligatures: true,
        weight: "400",
        weightBold: "700",
      },
    });
    xtermSession.applyAppearance(nextAppearance);
    ghosttySession.applyAppearance(nextAppearance);

    expect(xterm?.options.fontSize).toBe(14);
    expect(xterm?.options.customGlyphs).toBe(true);
    expect(xterm?.options.theme).toEqual(nextAppearance.theme);
    expect(ghostty?.options.fontSize).toBe(14);
    expect(ghostty?.options.fontWeight).toBe("400");
    expect(ghostty?.renderer.setTheme).toHaveBeenCalledWith(nextAppearance.theme);
    expect(ghostty?.renderer.setCursorStyle).toHaveBeenCalledWith(nextAppearance.cursorStyle);
  });

  test("Scenario: Given renderer stacks own presentation capability law When the host asks how theme, cursor, and font can settle Then adapters expose policy instead of leaking renderer-specific branches", () => {
    expect(xtermRendererAdapter.presentationMutationPolicy).toEqual({
      theme: "live-apply",
      cursor: "live-apply",
      font: "rebuild-session",
    });
    expect(ghosttyWebRendererAdapter.presentationMutationPolicy).toEqual({
      theme: "rebuild-session",
      cursor: "live-apply",
      font: "rebuild-session",
    });
    expect(wtermRendererAdapter.presentationMutationPolicy).toEqual({
      theme: "live-apply",
      cursor: "live-apply",
      font: "rebuild-session",
    });
  });

  test("Scenario: Given the explicit wterm renderer path When the adapter builds a session Then core loading, DOM hosting, and font CSS variables stay private to the adapter boundary", async () => {
    const appearance = createAppearance();
    const host = document.createElement("div");

    await wtermRendererAdapter.ensureReady?.();
    const session = await wtermRendererAdapter.createSession({
      host,
      cols: 90,
      rows: 30,
      scrollback: 2048,
      appearance,
      onInputBytes: vi.fn(),
    });
    const wterm = mockState.wtermTerminals.at(-1);

    expect(mockState.ghosttyCoreLoad).toHaveBeenNthCalledWith(1, { scrollbackLimit: 10_000 });
    expect(mockState.ghosttyCoreLoad).toHaveBeenNthCalledWith(2, { scrollbackLimit: 2048 });
    expect(wterm?.options.autoResize).toBe(false);
    expect(wterm?.options.cols).toBe(90);
    expect(wterm?.options.rows).toBe(30);
    expect(host.classList.contains("wterm-host-reset")).toBe(true);
    expect(host.style.getPropertyValue("--term-font-family")).toBe(appearance.font.family);
    expect(host.style.getPropertyValue("--term-font-size")).toBe("16px");
    expect(host.style.getPropertyValue("--term-line-height")).toBe("1.35");
    expect(host.style.getPropertyValue("--term-bg")).toBe(appearance.theme.background);
    expect(host.style.getPropertyValue("--term-fg")).toBe(appearance.theme.foreground);
    expect(host.style.fontFeatureSettings).toBe('"liga" 0, "calt" 0');
    expect(host.style.fontVariantLigatures).toBe("none");
    expect(host.getAttribute(TERMINAL_PUBLIC_SCROLL_ATTRIBUTE)).toBe("true");
    expect(host.querySelector("textarea")?.getAttribute(TERMINAL_PUBLIC_INPUT_ATTRIBUTE)).toBe("true");
    expect(host.querySelector(".term-grid")?.getAttribute(TERMINAL_PUBLIC_SCREEN_ATTRIBUTE)).toBe("true");
    expect(session.getScreenMetrics()).toEqual({ width: 810, height: 600 });

    session.applyAppearance(
      resolveTerminalAppearance({
        theme: "default-light",
        font: {
          family: "'SF Mono', monospace",
          sizePx: 14,
          ligatures: true,
        },
      }),
    );
    expect(host.style.getPropertyValue("--term-font-family")).toBe("'SF Mono', monospace");
    expect(host.style.getPropertyValue("--term-font-size")).toBe("14px");
    expect(host.style.getPropertyValue("--term-bg")).toBe("#f8fafc");
    expect(host.style.fontFeatureSettings).toBe('"liga" 1, "calt" 1');
    expect(host.style.fontVariantLigatures).toBe("normal");
  });

  test("Scenario: Given wterm host metrics and inner grid metrics disagree When screen metrics are read Then the adapter reports the active terminal content box instead of the outer scroll host", async () => {
    const appearance = createAppearance();
    const host = document.createElement("div");

    const session = await wtermRendererAdapter.createSession({
      host,
      cols: 90,
      rows: 30,
      scrollback: 2048,
      appearance,
      onInputBytes: vi.fn(),
    });

    Object.defineProperty(host, "clientWidth", { configurable: true, value: 824 });
    Object.defineProperty(host, "clientHeight", { configurable: true, value: 612 });
    Object.defineProperty(host, "offsetWidth", { configurable: true, value: 824 });
    Object.defineProperty(host, "offsetHeight", { configurable: true, value: 612 });

    expect(session.getScreenMetrics()).toEqual({ width: 810, height: 600 });
  });
});
