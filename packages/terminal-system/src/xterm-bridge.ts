import { DEFAULTS } from "./types";
import { Terminal } from "./xterm-headless-module";

type HeadlessTerminalCtor = typeof Terminal;

export class XtermBridge {
  private readonly terminal: InstanceType<HeadlessTerminalCtor>;
  private readonly titleListeners: Array<(title: string) => void> = [];

  constructor(cols: number = DEFAULTS.cols, rows: number = DEFAULTS.rows) {
    this.terminal = new Terminal({
      cols,
      rows,
      allowProposedApi: true,
      scrollback: DEFAULTS.scrollback,
    });
    this.terminal.onTitleChange((title) => {
      for (const listener of this.titleListeners) {
        listener(title);
      }
    });
  }

  /** Write data to xterm and wait for it to be parsed. */
  write(data: string | Uint8Array): Promise<void> {
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

  onTitleChange(listener: (title: string) => void): () => void {
    this.titleListeners.push(listener);
    return () => {
      const index = this.titleListeners.indexOf(listener);
      if (index >= 0) {
        this.titleListeners.splice(index, 1);
      }
    };
  }

  dispose(): void {
    this.terminal.dispose();
    this.titleListeners.length = 0;
  }
}
