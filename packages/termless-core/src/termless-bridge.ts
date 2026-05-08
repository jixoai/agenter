import type { TerminalMode, TermlessBridge } from "./types.js";
import { AgenterXtermBackend } from "./agenter-xterm-backend.js";

const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 30;
const DEFAULT_SCROLLBACK = 10_000;

const textEncoder = new TextEncoder();

export class XtermReadableBridge implements TermlessBridge {
  private readonly backend: AgenterXtermBackend;
  private readonly titleListeners: Array<(title: string) => void> = [];
  private lastTitle = "";

  constructor(cols: number = DEFAULT_COLS, rows: number = DEFAULT_ROWS, scrollbackLimit: number = DEFAULT_SCROLLBACK) {
    this.backend = new AgenterXtermBackend({ cols, rows, scrollbackLimit });
  }

  write(data: string | Uint8Array): Promise<void> {
    return new Promise<void>((resolve) => {
      this.backend.writableTerminal.write(data, () => {
        this.flushTitle();
        resolve();
      });
    });
  }

  writeSync(data: string | Uint8Array): void {
    this.backend.feed(typeof data === "string" ? textEncoder.encode(data) : data);
    this.flushTitle();
  }

  resize(cols: number, rows: number): void {
    this.backend.resize(cols, rows);
  }

  reset(): void {
    this.backend.reset();
    this.flushTitle();
  }

  dispose(): void {
    this.backend.destroy();
    this.titleListeners.length = 0;
  }

  getText(): string {
    return this.backend.getText();
  }

  getTextRange(startRow: number, startCol: number, endRow: number, endCol: number): string {
    return this.backend.getTextRange(startRow, startCol, endRow, endCol);
  }

  getCell(row: number, col: number) {
    return this.backend.getCell(row, col);
  }

  getLine(row: number) {
    return this.backend.getLine(row);
  }

  getLines() {
    return this.backend.getLines();
  }

  getCursor() {
    return this.backend.getCursor();
  }

  getMode(mode: TerminalMode) {
    return this.backend.getMode(mode);
  }

  getTitle(): string {
    return this.backend.getTitle();
  }

  getScrollback() {
    return this.backend.getScrollback();
  }

  onTitleChange(listener: (title: string) => void): () => void {
    this.titleListeners.push(listener);
    return () => {
      const index = this.titleListeners.indexOf(listener);
      if (index >= 0) {
        this.titleListeners.splice(index, 1);
      }
    };
  }

  get cols(): number {
    return this.backend.cols;
  }

  get rows(): number {
    return this.backend.rows;
  }

  private flushTitle(): void {
    const nextTitle = this.backend.getTitle();
    if (nextTitle === this.lastTitle) {
      return;
    }
    this.lastTitle = nextTitle;
    for (const listener of this.titleListeners) {
      listener(nextTitle);
    }
  }
}

export { XtermReadableBridge as XtermBridge };
