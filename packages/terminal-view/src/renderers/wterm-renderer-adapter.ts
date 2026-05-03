import { GhosttyCore, type GhosttyOptions } from "@wterm/ghostty";
import { WTerm } from "@wterm/dom";
import wtermStyles from "@wterm/dom/css?inline";

import {
  TERMINAL_PUBLIC_INPUT_ATTRIBUTE,
  TERMINAL_PUBLIC_SCREEN_ATTRIBUTE,
  TERMINAL_PUBLIC_SCROLL_ATTRIBUTE,
  markPublicTerminalSurface,
  type TerminalRendererAdapter,
  type TerminalRendererSession,
  type TerminalRendererSessionInput,
} from "../terminal-renderer-adapter";
import type { ResolvedTerminalAppearance } from "../terminal-renderer-profile";
import type { TerminalViewScreenMetrics } from "../terminal-view-types";

const primeGhosttyCoreRuntime = async (): Promise<void> => {
  await GhosttyCore.load({ scrollbackLimit: 10_000 } satisfies GhosttyOptions);
};

const applyWTermAppearance = (host: HTMLElement, appearance: ResolvedTerminalAppearance): void => {
  host.classList.add("wterm-host-reset");
  host.style.setProperty("--term-font-family", appearance.font.family);
  host.style.setProperty("--term-font-size", `${appearance.font.sizePx}px`);
  host.style.setProperty("--term-line-height", String(appearance.font.lineHeight));
  host.style.setProperty("--term-row-height", `${Math.ceil(appearance.font.sizePx * appearance.font.lineHeight)}px`);
  host.style.setProperty("--term-fg", appearance.theme.foreground);
  host.style.setProperty("--term-bg", appearance.theme.background);
  host.style.setProperty("--term-cursor", appearance.theme.cursor);
  host.style.setProperty("--term-color-0", appearance.theme.black);
  host.style.setProperty("--term-color-1", appearance.theme.red);
  host.style.setProperty("--term-color-2", appearance.theme.green);
  host.style.setProperty("--term-color-3", appearance.theme.yellow);
  host.style.setProperty("--term-color-4", appearance.theme.blue);
  host.style.setProperty("--term-color-5", appearance.theme.magenta);
  host.style.setProperty("--term-color-6", appearance.theme.cyan);
  host.style.setProperty("--term-color-7", appearance.theme.white);
  host.style.setProperty("--term-color-8", appearance.theme.brightBlack);
  host.style.setProperty("--term-color-9", appearance.theme.brightRed);
  host.style.setProperty("--term-color-10", appearance.theme.brightGreen);
  host.style.setProperty("--term-color-11", appearance.theme.brightYellow);
  host.style.setProperty("--term-color-12", appearance.theme.brightBlue);
  host.style.setProperty("--term-color-13", appearance.theme.brightMagenta);
  host.style.setProperty("--term-color-14", appearance.theme.brightCyan);
  host.style.setProperty("--term-color-15", appearance.theme.brightWhite);
  host.style.fontWeight = appearance.font.weight;
  host.style.letterSpacing = `${appearance.font.letterSpacing}px`;
  host.style.fontVariantLigatures = appearance.font.ligatures ? "normal" : "none";
  host.style.fontFeatureSettings = appearance.font.ligatures ? '"liga" 1, "calt" 1' : '"liga" 0, "calt" 0';
};

const readElementRectMetrics = (element: Element | null): TerminalViewScreenMetrics | null => {
  if (!(element instanceof HTMLElement)) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  const width = rect.width || element.clientWidth || element.offsetWidth;
  const height = rect.height || element.clientHeight || element.offsetHeight;
  if (width <= 0 || height <= 0) {
    return null;
  }
  return {
    width: Math.round(width),
    height: Math.round(height),
  };
};

const measureWTermGridMetrics = (host: HTMLElement, rows: number): TerminalViewScreenMetrics | null => {
  const grid = host.querySelector(".term-grid");
  const gridMetrics = readElementRectMetrics(grid);
  if (!gridMetrics) {
    return null;
  }
  const rowElements = Array.from(host.querySelectorAll(".term-row"));
  const activeRowElements = rowElements.slice(-Math.max(rows, 0));
  if (activeRowElements.length === 0) {
    return gridMetrics;
  }
  const firstRow = activeRowElements[0];
  const lastRow = activeRowElements.at(-1) ?? null;
  if (!(firstRow instanceof HTMLElement) || !(lastRow instanceof HTMLElement)) {
    return gridMetrics;
  }
  const firstRect = firstRow.getBoundingClientRect();
  const lastRect = lastRow.getBoundingClientRect();
  const width = Math.max(gridMetrics.width, Math.round(firstRect.width || lastRect.width || gridMetrics.width));
  const height = Math.round(lastRect.bottom - firstRect.top);
  if (width <= 0 || height <= 0) {
    return gridMetrics;
  }
  return {
    width,
    height,
  };
};

class WTermRendererSession implements TerminalRendererSession {
  readonly resolvedRenderer = "wterm" as const;
  readonly inputDataDisposable = { dispose() {} };

  constructor(
    readonly host: HTMLElement,
    readonly terminal: WTerm,
    private colsValue: number,
    private rowsValue: number,
  ) {}

  get cols(): number {
    return this.colsValue;
  }

  get rows(): number {
    return this.rowsValue;
  }

  get inputElement(): HTMLElement | null {
    return this.host.querySelector("textarea");
  }

  write(data: string | Uint8Array): void {
    this.terminal.write(data);
  }

  resize(cols: number, rows: number): void {
    this.colsValue = cols;
    this.rowsValue = rows;
    this.terminal.resize(cols, rows);
    this.decoratePublicSurfaces();
  }

  reset(): void {
    this.terminal.write("\u001bc");
  }

  focus(): void {
    this.terminal.focus();
  }

  setScrollback(_: number): void {
    // `@wterm/ghostty` owns scrollback through the core. Keep durable profile declarative
    // and tolerate capability gaps inside adapters instead of leaking stack-specific knobs.
  }

  applyAppearance(appearance: ResolvedTerminalAppearance): void {
    applyWTermAppearance(this.host, appearance);
    this.decoratePublicSurfaces();
  }

  getScreenMetrics(): TerminalViewScreenMetrics | null {
    return measureWTermGridMetrics(this.host, this.rowsValue);
  }

  dispose(): void {
    this.terminal.destroy();
  }

  decoratePublicSurfaces(): void {
    markPublicTerminalSurface(this.host.querySelector("textarea"), TERMINAL_PUBLIC_INPUT_ATTRIBUTE);
    markPublicTerminalSurface(this.host.querySelector(".term-grid"), TERMINAL_PUBLIC_SCREEN_ATTRIBUTE);
    markPublicTerminalSurface(this.host, TERMINAL_PUBLIC_SCROLL_ATTRIBUTE);
  }
}

export const wtermRendererAdapter: TerminalRendererAdapter = {
  renderer: "wterm",
  styles: `
${wtermStyles}

.wterm-host-reset {
  padding: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  background: transparent !important;
  outline: none !important;
}

.wterm-host-reset.wterm {
  height: auto !important;
  max-height: none !important;
}
`,
  presentationMutationPolicy: {
    theme: "live-apply",
    cursor: "live-apply",
    font: "rebuild-session",
  },
  async ensureReady() {
    await primeGhosttyCoreRuntime();
  },
  async createSession(input) {
    const core = await GhosttyCore.load({ scrollbackLimit: input.scrollback } satisfies GhosttyOptions);
    input.host.replaceChildren();
    applyWTermAppearance(input.host, input.appearance);
    // WTerm can auto-measure and resize itself, but terminal-view already owns the
    // projection and resize law. Keep WTerm in manual grid mode so stack behavior stays
    // aligned with the host's durable snapshot and explicit resize workflow.
    const terminal = new WTerm(input.host, {
      core,
      cols: input.cols,
      rows: input.rows,
      autoResize: false,
      cursorBlink: false,
      onData: (data) => {
        input.onInputBytes(new TextEncoder().encode(data));
      },
    });
    await terminal.init();
    const session = new WTermRendererSession(input.host, terminal, input.cols, input.rows);
    session.decoratePublicSurfaces();
    return session;
  },
};
