import type { TerminalColorMode } from "./types";

const createEnv = (color: TerminalColorMode): Record<string, string> => {
  const env: Record<string, string | undefined> = { ...process.env };
  switch (color) {
    case "none":
      env.TERM = "dumb";
      env.NO_COLOR = "1";
      env.FORCE_COLOR = "0";
      delete env.COLORTERM;
      break;
    case "16":
      env.TERM = "xterm";
      env.FORCE_COLOR = "1";
      delete env.NO_COLOR;
      delete env.COLORTERM;
      break;
    case "256":
      env.TERM = "xterm-256color";
      env.FORCE_COLOR = "2";
      delete env.NO_COLOR;
      delete env.COLORTERM;
      break;
    case "truecolor":
      env.TERM = "xterm-256color";
      env.COLORTERM = "truecolor";
      env.FORCE_COLOR = "3";
      delete env.NO_COLOR;
      break;
  }

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") {
      normalized[key] = value;
    }
  }
  return normalized;
};

export class Pty {
  private proc: Bun.Subprocess | null = null;
  private onData: ((chunk: Uint8Array) => void) | null = null;
  private onExit: ((code: number | null) => void) | null = null;

  constructor(
    private readonly command: string,
    private readonly args: string[],
    private cols: number,
    private rows: number,
    private readonly color: TerminalColorMode,
    private readonly cwd?: string,
  ) {}

  setOnData(cb: (chunk: Uint8Array) => void): void {
    this.onData = cb;
  }

  setOnExit(cb: (code: number | null) => void): void {
    this.onExit = cb;
  }

  start(): void {
    if (this.proc) return;

    this.proc = Bun.spawn([this.command, ...this.args], {
      cwd: this.cwd,
      env: createEnv(this.color),
      terminal: {
        cols: this.cols,
        rows: this.rows,
        name: process.env.TERM ?? "xterm-256color",
        data: (_term, data) => {
          this.onData?.(data);
        },
        exit: (_term, _code, _signal) => {
          // stream closed
        },
      },
      onExit: (_subprocess, code, _signal, _error) => {
        this.proc = null;
        this.onExit?.(code);
      },
    });
  }

  write(input: string): void {
    const terminal = this.proc?.terminal;
    if (!terminal) throw new Error("PTY not running");
    terminal.write(input);
  }

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.proc?.terminal?.resize(cols, rows);
  }

  kill(): void {
    if (!this.proc) return;
    this.proc.kill("SIGTERM");
    this.proc.terminal?.close();
    this.proc = null;
  }

  get running(): boolean {
    return this.proc !== null;
  }
}
