import { Terminal } from "@xterm/headless";
import { DEFAULTS } from "./types";

export class XtermBridge {
  private readonly terminal: Terminal;

  constructor(cols: number = DEFAULTS.cols, rows: number = DEFAULTS.rows) {
    this.terminal = new Terminal({
      cols,
      rows,
      allowProposedApi: true,
      scrollback: DEFAULTS.scrollback,
    });
  }

  /** Write data to xterm and wait for it to be parsed. */
  write(data: string): Promise<void> {
    return new Promise<void>((resolve) => {
      this.terminal.write(data, () => resolve());
    });
  }

  resize(cols: number, rows: number): void {
    this.terminal.resize(cols, rows);
  }

  get buffer() {
    return this.terminal.buffer.active;
  }

  get cols(): number {
    return this.terminal.cols;
  }

  get rows(): number {
    return this.terminal.rows;
  }

  get cursorX(): number {
    return this.buffer.cursorX;
  }

  get cursorY(): number {
    return this.buffer.cursorY;
  }

  get cursorVisible(): boolean {
    return this.terminal.modes.showCursor;
  }

  /** Total number of lines in the scrollback buffer. */
  get totalLines(): number {
    return this.buffer.length;
  }

  /** The base line (first line in viewport = baseY). */
  get baseY(): number {
    return this.buffer.baseY;
  }

  dispose(): void {
    this.terminal.dispose();
  }
}
