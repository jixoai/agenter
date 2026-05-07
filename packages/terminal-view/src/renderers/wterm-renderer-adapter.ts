import { WTerm, type TerminalCore } from "@wterm/dom";
import { GhosttyCore, type GhosttyOptions } from "@wterm/ghostty";
import wtermStyles from "./wterm-dom.css?inline";

import {
  TERMINAL_PUBLIC_INPUT_ATTRIBUTE,
  TERMINAL_PUBLIC_SCREEN_ATTRIBUTE,
  TERMINAL_PUBLIC_SCROLL_ATTRIBUTE,
  markPublicTerminalSurface,
  type TerminalRendererAdapter,
  type TerminalRendererSession,
} from "../terminal-renderer-adapter";
import type { ResolvedTerminalAppearance } from "../terminal-renderer-profile";
import type { TerminalViewScreenMetrics } from "../terminal-view-types";

const primeGhosttyCoreRuntime = async (): Promise<void> => {
  await GhosttyCore.load({ scrollbackLimit: 10_000 } satisfies GhosttyOptions);
};

const ANSI_SEQUENCE_PATTERN = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\)|[@-Z\\-_])/g;
const MAX_PROJECTED_TERMINAL_LINES = 20_000;

const parsePositiveCssNumber = (value: string): number | null => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const resolveWTermRowHeight = (host: HTMLElement): number => {
  const computed = getComputedStyle(host);
  return (
    parsePositiveCssNumber(host.style.getPropertyValue("--term-row-height")) ??
    parsePositiveCssNumber(computed.getPropertyValue("--term-row-height")) ??
    parsePositiveCssNumber(computed.lineHeight) ??
    17
  );
};

const resolveWTermHostBlockExtra = (host: HTMLElement): number => {
  const computed = getComputedStyle(host);
  let extra =
    (parsePositiveCssNumber(computed.paddingTop) ?? 0) + (parsePositiveCssNumber(computed.paddingBottom) ?? 0);
  if (computed.boxSizing === "border-box") {
    extra +=
      (parsePositiveCssNumber(computed.borderTopWidth) ?? 0) +
      (parsePositiveCssNumber(computed.borderBottomWidth) ?? 0);
  }
  return extra;
};

const lockWTermHostRowsHeight = (host: HTMLElement, rows: number): void => {
  const rowHeight = resolveWTermRowHeight(host);
  const blockExtra = resolveWTermHostBlockExtra(host);
  host.style.height = `${Math.ceil(Math.max(1, rows) * rowHeight + blockExtra)}px`;
};

const cellCodePointToText = (codePoint: number): string => {
  if (!Number.isInteger(codePoint) || codePoint < 32 || codePoint > 0x10ffff) {
    return " ";
  }
  return String.fromCodePoint(codePoint);
};

const readWTermScrollbackLineText = (core: TerminalCore, offset: number): string => {
  const lineLength = core.getScrollbackLineLen(offset);
  const cols = Math.max(core.getCols(), lineLength);
  let text = "";
  for (let col = 0; col < cols; col += 1) {
    const cell = col < lineLength ? core.getScrollbackCell(offset, col) : null;
    text += cellCodePointToText(cell?.char ?? 32);
  }
  return text.trimEnd();
};

const hasVisibleRowText = (row: HTMLElement): boolean => {
  for (const node of Array.from(row.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim().length > 0) {
      return true;
    }
    if (node instanceof HTMLElement) {
      const text = (node.textContent ?? "").trim();
      if (text.length > 0 && getComputedStyle(node).visibility !== "hidden") {
        return true;
      }
    }
  }
  return false;
};

const refreshBlankWTermScrollbackRows = (
  host: HTMLElement,
  core: TerminalCore | null,
  projectedScrollbackLines: readonly string[],
): void => {
  const scrollbackCount = core?.getScrollbackCount() ?? projectedScrollbackLines.length;
  const rows = Array.from(host.querySelectorAll(".term-scrollback-row")).filter(
    (row): row is HTMLElement => row instanceof HTMLElement,
  );
  if (rows.length === 0) {
    return;
  }
  rows.forEach((row, index) => {
    if (hasVisibleRowText(row)) {
      return;
    }
    const offset = rows.length - 1 - index;
    if (offset < 0 || offset >= scrollbackCount) {
      return;
    }
    const projectedLineOffset = projectedScrollbackLines.length - rows.length + index;
    const projectedText =
      projectedLineOffset >= 0 && projectedLineOffset < projectedScrollbackLines.length
        ? projectedScrollbackLines[projectedLineOffset]
        : "";
    const text = core ? readWTermScrollbackLineText(core, offset) || projectedText : projectedText;
    if (text.trim().length > 0) {
      row.textContent = text;
    }
  });
};

const stripTerminalControlSequences = (value: string): string => value.replace(ANSI_SEQUENCE_PATTERN, "");

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
  private readonly outputDecoder = new TextDecoder();
  private projectedCurrentColumns = 0;
  private projectedCurrentLine = "";
  private projectedLines: string[] = [];
  private scrollbackRefreshFrame: number | null = null;
  private scrollbackRefreshTimer: ReturnType<typeof setTimeout> | null = null;

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
    this.recordProjectedWrite(data);
    this.terminal.write(data);
    this.scheduleScrollbackRefresh();
  }

  resize(cols: number, rows: number): void {
    this.colsValue = cols;
    this.rowsValue = rows;
    this.terminal.resize(cols, rows);
    lockWTermHostRowsHeight(this.host, rows);
    this.scheduleScrollbackRefresh();
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
    lockWTermHostRowsHeight(this.host, this.rowsValue);
    this.decoratePublicSurfaces();
  }

  getScreenMetrics(): TerminalViewScreenMetrics | null {
    return measureWTermGridMetrics(this.host, this.rowsValue);
  }

  dispose(): void {
    if (this.scrollbackRefreshTimer) {
      clearTimeout(this.scrollbackRefreshTimer);
      this.scrollbackRefreshTimer = null;
    }
    if (this.scrollbackRefreshFrame !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(this.scrollbackRefreshFrame);
      this.scrollbackRefreshFrame = null;
    }
    this.terminal.destroy();
  }

  decoratePublicSurfaces(): void {
    markPublicTerminalSurface(this.host.querySelector("textarea"), TERMINAL_PUBLIC_INPUT_ATTRIBUTE);
    markPublicTerminalSurface(this.host.querySelector(".term-grid"), TERMINAL_PUBLIC_SCREEN_ATTRIBUTE);
    markPublicTerminalSurface(this.host, TERMINAL_PUBLIC_SCROLL_ATTRIBUTE);
  }

  private recordProjectedWrite(data: string | Uint8Array): void {
    const text = stripTerminalControlSequences(typeof data === "string" ? data : this.outputDecoder.decode(data));
    const characters = Array.from(text);
    for (let index = 0; index < characters.length; index += 1) {
      const character = characters[index] ?? "";
      if (character === "\r") {
        if (characters[index + 1] === "\n") {
          this.pushProjectedLine();
          index += 1;
          continue;
        }
        this.projectedCurrentLine = "";
        this.projectedCurrentColumns = 0;
        continue;
      }
      if (character === "\n") {
        this.pushProjectedLine();
        continue;
      }
      if (character >= " ") {
        this.projectedCurrentLine += character;
        this.projectedCurrentColumns += 1;
        if (this.projectedCurrentColumns >= Math.max(1, this.colsValue)) {
          this.pushProjectedLine();
        }
      }
    }
  }

  private pushProjectedLine(): void {
    this.projectedLines.push(this.projectedCurrentLine);
    this.projectedCurrentLine = "";
    this.projectedCurrentColumns = 0;
    if (this.projectedLines.length > MAX_PROJECTED_TERMINAL_LINES) {
      this.projectedLines = this.projectedLines.slice(-MAX_PROJECTED_TERMINAL_LINES);
    }
  }

  private readProjectedScrollbackLines(): readonly string[] {
    const lines =
      this.projectedCurrentLine.length > 0 ? [...this.projectedLines, this.projectedCurrentLine] : this.projectedLines;
    return lines.slice(0, Math.max(0, lines.length - this.rowsValue));
  }

  private scheduleScrollbackRefresh(): void {
    if (this.scrollbackRefreshTimer || this.scrollbackRefreshFrame !== null) {
      return;
    }
    this.scrollbackRefreshTimer = setTimeout(() => {
      this.scrollbackRefreshTimer = null;
      const refresh = () => {
        this.scrollbackRefreshFrame = null;
        // @wterm/dom 0.3.0 can materialize scrollback rows before the Ghostty
        // core exposes their line text. Refresh only blank historical rows and
        // leave the live grid renderer-owned.
        refreshBlankWTermScrollbackRows(this.host, this.terminal.bridge, this.readProjectedScrollbackLines());
      };
      if (typeof requestAnimationFrame === "function") {
        this.scrollbackRefreshFrame = requestAnimationFrame(refresh);
      } else {
        refresh();
      }
    }, 0);
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
    lockWTermHostRowsHeight(input.host, input.rows);
    session.decoratePublicSurfaces();
    return session;
  },
};
