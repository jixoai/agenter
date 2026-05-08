import { Terminal } from "./xterm-headless-module";

const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 30;
const DEFAULT_SCROLLBACK = 10_000;

type HeadlessTerminalCtor = typeof Terminal;

export class XtermBridge {
  private readonly terminal: InstanceType<HeadlessTerminalCtor>;
  private readonly titleListeners: Array<(title: string) => void> = [];

  constructor(cols: number = DEFAULT_COLS, rows: number = DEFAULT_ROWS) {
    this.terminal = new Terminal({
      cols,
      rows,
      allowProposedApi: true,
      scrollback: DEFAULT_SCROLLBACK,
    });
    this.terminal.onTitleChange((title) => {
      for (const listener of this.titleListeners) {
        listener(title);
      }
    });
  }

  write(data: string | Uint8Array): Promise<void> {
    return new Promise<void>((resolve) => {
      this.terminal.write(data, () => resolve());
    });
  }

  resize(cols: number, rows: number): void {
    this.terminal.resize(cols, rows);
  }

  reset(): void {
    this.terminal.reset();
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

  get totalLines(): number {
    return this.buffer.length;
  }

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
