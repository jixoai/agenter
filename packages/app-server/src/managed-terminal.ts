import {
  AgenticTerminal,
  type RenderResult,
  type RichLine,
  type TerminalDirtySliceResult,
  type TerminalStatus,
} from "@agenter/terminal-system";

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
  richLines?: RichLine[];
  cursor: { x: number; y: number };
  cursorVisible?: boolean;
}

interface CommitWaitHandle<T = unknown> {
  promise: Promise<T>;
  reject: (reason: unknown) => void;
}

interface TerminalCommitWaiter {
  afterSeq: number;
  active: boolean;
  resolve: (value: { toHash: string | null }) => void;
  reject: (reason: unknown) => void;
}

const normalizeSeqHash = (value?: string | null): number => {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

export class ManagedTerminal {
  private terminal: AgenticTerminal | null = null;
  private running = false;
  private seq = 0;
  private cols: number;
  private rows: number;
  private snapshot: ManagedTerminalSnapshot;
  private readonly snapshotListeners: Array<(snapshot: ManagedTerminalSnapshot) => void> = [];
  private readonly statusListeners: Array<(running: boolean, status: TerminalStatus) => void> = [];
  private readonly commitWaiters = new Set<TerminalCommitWaiter>();

  constructor(private readonly config: ManagedTerminalConfig) {
    this.cols = config.cols;
    this.rows = config.rows;
    this.snapshot = {
      seq: 0,
      timestamp: Date.now(),
      cols: this.cols,
      rows: this.rows,
      lines: Array.from({ length: this.rows }, () => ""),
      richLines: Array.from({ length: this.rows }, () => ({ spans: [] })),
      cursor: { x: 0, y: 0 },
      cursorVisible: false,
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

    try {
      this.terminal.start();
    } catch (error) {
      this.running = false;
      void this.terminal.destroy(true).catch(() => {
        // ignore teardown errors after failed start
      });
      this.terminal = null;
      this.emitStatus();
      throw error;
    }

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

  getHeadHash(): string | null {
    return String(this.snapshot.seq);
  }

  waitCommitted(input: { fromHash?: string | null } = {}): CommitWaitHandle<{ toHash: string | null }> {
    const afterSeq = normalizeSeqHash(input.fromHash);
    if (this.snapshot.seq > afterSeq) {
      return {
        promise: Promise.resolve({ toHash: String(this.snapshot.seq) }),
        reject: () => {},
      };
    }

    let resolveRef: ((value: { toHash: string | null }) => void) | null = null;
    let rejectRef: ((reason: unknown) => void) | null = null;
    const waiter: TerminalCommitWaiter = {
      afterSeq,
      active: true,
      resolve: (value) => resolveRef?.(value),
      reject: (reason) => rejectRef?.(reason),
    };
    const promise = new Promise<{ toHash: string | null }>((resolve, reject) => {
      resolveRef = resolve;
      rejectRef = reject;
    }).finally(() => {
      waiter.active = false;
      this.commitWaiters.delete(waiter);
    });
    this.commitWaiters.add(waiter);
    return {
      promise,
      reject: (reason) => {
        if (!waiter.active) {
          return;
        }
        waiter.active = false;
        this.commitWaiters.delete(waiter);
        rejectRef?.(reason);
      },
    };
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

  async write(
    input: string,
    submit = true,
    submitKey: "enter" | "linefeed" = "enter",
    submitGapMs = 80,
  ): Promise<void> {
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

  async sliceDirty(
    options: { remark?: boolean; wait?: boolean; timeoutMs?: number } = {},
  ): Promise<TerminalDirtySliceResult> {
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
    for (const waiter of [...this.commitWaiters]) {
      if (!waiter.active || this.snapshot.seq <= waiter.afterSeq) {
        continue;
      }
      waiter.active = false;
      this.commitWaiters.delete(waiter);
      waiter.resolve({ toHash: String(this.snapshot.seq) });
    }
    for (const listener of this.snapshotListeners) {
      listener(this.snapshot);
    }
  }

  private emitStatus(): void {
    const status = this.getStatus();
    if (!this.running) {
      for (const waiter of [...this.commitWaiters]) {
        waiter.reject(new Error(`terminal ${this.config.terminalId} stopped`));
      }
    }
    for (const listener of this.statusListeners) {
      listener(this.running, status);
    }
  }

  private toSnapshot(render: RenderResult): ManagedTerminalSnapshot {
    const start = Math.max(0, render.plainLines.length - this.rows);
    const rawLines = render.plainLines.slice(start, start + this.rows);
    const rawRichLines = render.richLines.slice(start, start + this.rows);
    const lines = padLines(rawLines, this.rows, () => "");
    const richLines = padLines(rawRichLines, this.rows, () => ({ spans: [] }));

    const cursorY = clamp(render.cursorAbsRow - start, 0, Math.max(0, this.rows - 1));
    this.seq += 1;

    return {
      seq: this.seq,
      timestamp: Date.now(),
      cols: this.cols,
      rows: this.rows,
      lines,
      richLines,
      cursor: {
        x: render.cursorCol,
        y: cursorY,
      },
      cursorVisible: render.cursorVisible,
    };
  }
}
