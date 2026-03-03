import { AgenticTerminal, type RenderResult, type TerminalDirtySliceResult, type TerminalStatus } from "@agenter/terminal";

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const padLines = <T>(input: T[], size: number, fill: () => T): T[] => {
  if (input.length >= size) {
    return input.slice(input.length - size);
  }
  return [...Array.from({ length: size - input.length }, fill), ...input];
};

export interface ManagedTerminalConfig {
  terminalId: string;
  command: string[];
  cwd: string;
  cols: number;
  rows: number;
  outputRoot?: string;
  gitLog?: false | "normal" | "verbose";
  logStyle?: "rich" | "plain";
}

export interface ManagedTerminalSnapshot {
  seq: number;
  timestamp: number;
  cols: number;
  rows: number;
  lines: string[];
  cursor: { x: number; y: number };
}

export class ManagedTerminal {
  private terminal: AgenticTerminal | null = null;
  private running = false;
  private seq = 0;
  private cols: number;
  private rows: number;
  private snapshot: ManagedTerminalSnapshot;
  private readonly snapshotListeners: Array<(snapshot: ManagedTerminalSnapshot) => void> = [];
  private readonly statusListeners: Array<(running: boolean, status: TerminalStatus) => void> = [];

  constructor(private readonly config: ManagedTerminalConfig) {
    this.cols = config.cols;
    this.rows = config.rows;
    this.snapshot = {
      seq: 0,
      timestamp: Date.now(),
      cols: this.cols,
      rows: this.rows,
      lines: Array.from({ length: this.rows }, () => ""),
      cursor: { x: 0, y: 0 },
    };
  }

  onSnapshot(listener: (snapshot: ManagedTerminalSnapshot) => void): () => void {
    this.snapshotListeners.push(listener);
    return () => {
      const index = this.snapshotListeners.indexOf(listener);
      if (index >= 0) {
        this.snapshotListeners.splice(index, 1);
      }
    };
  }

  onStatus(listener: (running: boolean, status: TerminalStatus) => void): () => void {
    this.statusListeners.push(listener);
    return () => {
      const index = this.statusListeners.indexOf(listener);
      if (index >= 0) {
        this.statusListeners.splice(index, 1);
      }
    };
  }

  start(): void {
    if (this.running) {
      return;
    }
    if (this.config.command.length === 0) {
      throw new Error(`terminal ${this.config.terminalId} command is empty`);
    }

    const [program, ...args] = this.config.command;
    this.terminal = new AgenticTerminal(program, args, {
      cols: this.cols,
      rows: this.rows,
      cwd: this.config.cwd,
      outputRoot: this.config.outputRoot,
      gitLog: this.config.gitLog ?? false,
      logStyle: this.config.logStyle ?? "rich",
    });

    this.terminal.onRender((render) => {
      this.snapshot = this.toSnapshot(render);
      this.emitSnapshot();
    });

    this.terminal.onExit(() => {
      this.running = false;
      this.emitStatus();
    });

    this.terminal.start();
    this.running = true;
    this.snapshot = this.toSnapshot(this.terminal.getLatestRender());
    this.emitSnapshot();
    this.emitStatus();
  }

  async stop(): Promise<void> {
    if (!this.terminal) {
      this.running = false;
      this.emitStatus();
      return;
    }
    await this.terminal.destroy(true);
    this.terminal = null;
    this.running = false;
    this.emitStatus();
  }

  isRunning(): boolean {
    return this.running;
  }

  getSnapshot(): ManagedTerminalSnapshot {
    return this.snapshot;
  }

  getStatus(): TerminalStatus {
    return this.terminal?.getStatus() ?? "IDLE";
  }

  getWorkspace(): string | null {
    return this.terminal?.workspace ?? null;
  }

  resize(cols: number, rows: number): void {
    this.cols = Math.max(8, cols);
    this.rows = Math.max(4, rows);
    if (!this.terminal) {
      return;
    }
    void this.terminal.resize(this.cols, this.rows);
  }

  async write(input: string, submit = true, submitKey: "enter" | "linefeed" = "enter", submitGapMs = 80): Promise<void> {
    if (!this.terminal) {
      throw new Error(`terminal ${this.config.terminalId} is not running`);
    }
    if (!submit) {
      await this.terminal.enqueuePendingInput(input, { wait: true });
      return;
    }

    const enterKey = submitKey === "linefeed" ? "linefeed" : "enter";
    const mixed = `${input}<wait ms=\"${submitGapMs}\"/><key data=\"${enterKey}\"/>`;
    await this.terminal.enqueuePendingInput(mixed, { wait: true });
  }

  async read(): Promise<ManagedTerminalSnapshot> {
    return this.snapshot;
  }

  async markDirty(): Promise<{ ok: boolean; hash: string | null; reason?: string }> {
    if (!this.terminal) {
      return { ok: false, hash: null, reason: "terminal-not-started" };
    }
    return this.terminal.markDirty();
  }

  async sliceDirty(options: { remark?: boolean; wait?: boolean; timeoutMs?: number } = {}): Promise<TerminalDirtySliceResult> {
    if (!this.terminal) {
      return {
        ok: false,
        changed: false,
        fromHash: null,
        toHash: null,
        diff: "",
        bytes: 0,
        reason: "terminal-not-started",
      };
    }
    return this.terminal.sliceDirty(options);
  }

  private emitSnapshot(): void {
    for (const listener of this.snapshotListeners) {
      listener(this.snapshot);
    }
  }

  private emitStatus(): void {
    const status = this.getStatus();
    for (const listener of this.statusListeners) {
      listener(this.running, status);
    }
  }

  private toSnapshot(render: RenderResult): ManagedTerminalSnapshot {
    const start = Math.max(0, render.plainLines.length - this.rows);
    const rawLines = render.plainLines.slice(start, start + this.rows);
    const lines = padLines(rawLines, this.rows, () => "");

    const cursorY = clamp(render.cursorAbsRow - start, 0, Math.max(0, this.rows - 1));
    this.seq += 1;

    return {
      seq: this.seq,
      timestamp: Date.now(),
      cols: this.cols,
      rows: this.rows,
      lines,
      cursor: {
        x: render.cursorCol,
        y: cursorY,
      },
    };
  }
}
