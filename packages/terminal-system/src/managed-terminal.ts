import { AgenticTerminal } from "./agentic-terminal";
import type { TerminalBackendKind } from "@agenter/termless-core";
import type {
  RichLine,
  StructuredRenderResult,
  TerminalDirtySliceOptions,
  TerminalDirtySliceResult,
  TerminalPendingInputResult,
  TerminalStatus,
} from "./types";
import type { TerminalLifecycleState, TerminalObservedIdentity } from "./terminal-runtime-truth";

export interface ManagedTerminalConfig {
  terminalId: string;
  backend: TerminalBackendKind;
  command: string[];
  cwd: string;
  env?: Record<string, string>;
  cols: number;
  rows: number;
  outputRoot?: string;
  gitLog?: false | "normal" | "verbose";
  logStyle?: "rich" | "plain";
}

export interface ManagedTerminalConfigPatch {
  backend?: TerminalBackendKind;
  command?: string[];
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
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
  cursor: { x: number; y: number; visible?: boolean };
  scrollback: {
    viewportOffset: number;
    totalLines: number;
    screenLines: number;
  };
}

export interface ManagedTerminalLifecycleEvent extends TerminalLifecycleState {}

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
  private stopping = false;
  private seq = 0;
  private cols: number;
  private rows: number;
  private observedIdentity: TerminalObservedIdentity = {};
  private snapshot: ManagedTerminalSnapshot;
  private readonly snapshotListeners: Array<(snapshot: ManagedTerminalSnapshot) => void> = [];
  private readonly statusListeners: Array<(running: boolean, status: TerminalStatus) => void> = [];
  private readonly outputListeners: Array<(chunk: string) => void> = [];
  private readonly outputBytesListeners: Array<(chunk: Uint8Array) => void> = [];
  private readonly lifecycleListeners: Array<(event: ManagedTerminalLifecycleEvent) => void> = [];
  private readonly identityListeners: Array<(identity: TerminalObservedIdentity) => void> = [];
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
      cursor: { x: 0, y: 0, visible: false },
      scrollback: {
        viewportOffset: 0,
        totalLines: this.rows,
        screenLines: this.rows,
      },
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

  onOutput(listener: (chunk: string) => void): () => void {
    this.outputListeners.push(listener);
    return () => {
      const index = this.outputListeners.indexOf(listener);
      if (index >= 0) {
        this.outputListeners.splice(index, 1);
      }
    };
  }

  onOutputBytes(listener: (chunk: Uint8Array) => void): () => void {
    this.outputBytesListeners.push(listener);
    return () => {
      const index = this.outputBytesListeners.indexOf(listener);
      if (index >= 0) {
        this.outputBytesListeners.splice(index, 1);
      }
    };
  }

  onLifecycle(listener: (event: ManagedTerminalLifecycleEvent) => void): () => void {
    this.lifecycleListeners.push(listener);
    return () => {
      const index = this.lifecycleListeners.indexOf(listener);
      if (index >= 0) {
        this.lifecycleListeners.splice(index, 1);
      }
    };
  }

  onObservedIdentity(listener: (identity: TerminalObservedIdentity) => void): () => void {
    this.identityListeners.push(listener);
    return () => {
      const index = this.identityListeners.indexOf(listener);
      if (index >= 0) {
        this.identityListeners.splice(index, 1);
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
    if (this.terminal) {
      void this.terminal.destroy(true).catch(() => undefined);
      this.terminal = null;
    }
    this.clearObservedIdentity();

    const [program, ...args] = this.config.command;
    this.terminal = new AgenticTerminal(program, args, {
      cols: this.cols,
      rows: this.rows,
      cwd: this.config.cwd,
      env: this.config.env,
      backend: this.config.backend,
      outputRoot: this.config.outputRoot,
      gitLog: this.config.gitLog ?? false,
      logStyle: this.config.logStyle ?? "rich",
    });

    this.terminal.onStructured((structured) => {
      this.snapshot = this.toSnapshot(structured);
      this.emitSnapshot();
    });

    this.terminal.onOutput((chunk) => {
      this.emitOutput(chunk);
    });
    this.terminal.onOutputBytes((chunk) => {
      this.emitOutputBytes(chunk);
    });

    this.terminal.onStatus(() => {
      if (this.running) {
        this.emitStatus();
      }
    });

    this.terminal.onObservedIdentity((identity) => {
      this.setObservedIdentity(identity);
    });

    this.terminal.onExit((info) => {
      if (this.stopping) {
        return;
      }
      const previousTerminal = this.terminal;
      this.running = false;
      this.terminal = null;
      this.clearObservedIdentity();
      this.emitLifecycle({
        processPhase: "stopped",
        lastStopReason: info.signal ? "killed" : "exited",
        lastExitCode: info.code,
        lastExitSignal: info.signal === null ? null : String(info.signal),
        lastStoppedAt: Date.now(),
      });
      this.emitStatus();
      void previousTerminal?.destroy(true).catch(() => undefined);
    });

    try {
      this.terminal.start();
    } catch (error) {
      this.running = false;
      void this.terminal.destroy(true).catch(() => {});
      this.terminal = null;
      this.emitLifecycle({
        processPhase: "stopped",
        lastStopReason: "startup_failed",
        lastExitCode: null,
        lastExitSignal: null,
        lastStoppedAt: Date.now(),
      });
      this.emitStatus();
      throw error;
    }

    this.running = true;
    this.snapshot = this.toSnapshot(this.terminal.getLatestStructured());
    this.emitSnapshot();
    this.emitLifecycle({
      processPhase: "running",
      lastStopReason: null,
      lastExitCode: null,
      lastExitSignal: null,
      lastStoppedAt: null,
    });
    this.emitStatus();
  }

  async stop(): Promise<void> {
    if (!this.terminal) {
      this.running = false;
      this.emitStatus();
      return;
    }
    const current = this.terminal;
    this.stopping = true;
    try {
      await current.destroy(true);
    } finally {
      this.stopping = false;
    }
    this.terminal = null;
    this.running = false;
    this.clearObservedIdentity();
    this.emitLifecycle({
      processPhase: "stopped",
      lastStopReason: "killed",
      lastExitCode: null,
      lastExitSignal: "SIGTERM",
      lastStoppedAt: Date.now(),
    });
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

  getObservedIdentity(): TerminalObservedIdentity {
    return { ...this.observedIdentity };
  }

  reconfigure(patch: ManagedTerminalConfigPatch): void {
    if (patch.backend !== undefined) {
      this.config.backend = patch.backend;
    }
    if (patch.command) {
      this.config.command = [...patch.command];
    }
    if (patch.cwd !== undefined) {
      this.config.cwd = patch.cwd;
    }
    if (patch.env !== undefined) {
      this.config.env = { ...patch.env };
    }
    if (patch.outputRoot !== undefined) {
      this.config.outputRoot = patch.outputRoot;
    }
    if (patch.gitLog !== undefined) {
      this.config.gitLog = patch.gitLog;
    }
    if (patch.logStyle !== undefined) {
      this.config.logStyle = patch.logStyle;
    }
    const colsChanged = typeof patch.cols === "number" && Number.isFinite(patch.cols) && patch.cols > 0;
    const rowsChanged = typeof patch.rows === "number" && Number.isFinite(patch.rows) && patch.rows > 0;
    if (colsChanged) {
      this.config.cols = Math.floor(patch.cols!);
    }
    if (rowsChanged) {
      this.config.rows = Math.floor(patch.rows!);
    }
    if (colsChanged || rowsChanged) {
      this.resize(this.config.cols, this.config.rows);
    }
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
    const nextCols = Math.max(8, cols);
    const nextRows = Math.max(4, rows);
    const geometryChanged = nextCols !== this.cols || nextRows !== this.rows;
    this.cols = nextCols;
    this.rows = nextRows;
    if (geometryChanged) {
      this.publishGeometrySnapshot();
    }
    if (!this.terminal) {
      return;
    }
    void this.terminal.resize(this.cols, this.rows);
  }

  async write(input: string): Promise<TerminalPendingInputResult> {
    if (!this.terminal) {
      throw new Error(`terminal ${this.config.terminalId} is not running`);
    }
    return await this.terminal.write(input);
  }

  async input(mixedInput: string): Promise<TerminalPendingInputResult> {
    if (!this.terminal) {
      throw new Error(`terminal ${this.config.terminalId} is not running`);
    }
    return await this.terminal.input(mixedInput);
  }

  writeRaw(input: string): void {
    if (!this.terminal) {
      throw new Error(`terminal ${this.config.terminalId} is not running`);
    }
    this.terminal.writeRaw(input);
  }

  writeRawBytes(input: Uint8Array): void {
    if (!this.terminal) {
      throw new Error(`terminal ${this.config.terminalId} is not running`);
    }
    this.terminal.writeRawBytes(input);
  }

  async read(): Promise<ManagedTerminalSnapshot> {
    if (!this.terminal || !this.running) {
      throw new Error("terminal is not running");
    }
    return this.snapshot;
  }

  async markDirty(): Promise<{ ok: boolean; hash: string | null; reason?: string }> {
    if (!this.terminal) {
      return { ok: false, hash: null, reason: "terminal-not-started" };
    }
    return this.terminal.markDirty();
  }

  async sliceDirty(options: TerminalDirtySliceOptions = {}): Promise<TerminalDirtySliceResult> {
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

  private emitOutput(chunk: string): void {
    for (const listener of this.outputListeners) {
      listener(chunk);
    }
  }

  private emitOutputBytes(chunk: Uint8Array): void {
    for (const listener of this.outputBytesListeners) {
      listener(chunk);
    }
  }

  private emitLifecycle(event: ManagedTerminalLifecycleEvent): void {
    for (const listener of this.lifecycleListeners) {
      listener(event);
    }
  }

  private setObservedIdentity(identity: TerminalObservedIdentity): void {
    const nextPath = identity.currentPath;
    const nextTitle = identity.currentTitle;
    if (this.observedIdentity.currentPath === nextPath && this.observedIdentity.currentTitle === nextTitle) {
      return;
    }
    this.observedIdentity = {
      currentPath: nextPath,
      currentTitle: nextTitle,
    };
    for (const listener of this.identityListeners) {
      listener({ ...this.observedIdentity });
    }
  }

  private clearObservedIdentity(): void {
    if (!this.observedIdentity.currentPath && !this.observedIdentity.currentTitle) {
      return;
    }
    this.observedIdentity = {};
    for (const listener of this.identityListeners) {
      listener({});
    }
  }

  private publishGeometrySnapshot(): void {
    this.seq += 1;
    this.snapshot = {
      ...this.snapshot,
      seq: this.seq,
      timestamp: Date.now(),
      cols: this.cols,
      rows: this.rows,
      cursor: {
        x: Math.max(0, Math.min(this.snapshot.cursor.x, Math.max(0, this.cols - 1))),
        y: Math.max(0, this.snapshot.cursor.y),
        visible: this.snapshot.cursor.visible,
      },
      scrollback: {
        viewportOffset: Math.max(0, this.snapshot.scrollback.viewportOffset),
        totalLines: Math.max(this.rows, this.snapshot.scrollback.totalLines),
        screenLines: this.rows,
      },
    };
    this.emitSnapshot();
  }

  private toSnapshot(render: StructuredRenderResult): ManagedTerminalSnapshot {
    this.seq += 1;
    const lines = render.richLines.map((line) => line.spans.map((span) => span.text).join(""));

    return {
      seq: this.seq,
      timestamp: Date.now(),
      cols: this.cols,
      rows: this.rows,
      // Preserve the whole xterm scrollback so the frontend terminal can restore
      // a stable buffer and expose real scrolling, while rows/cols keep the PTY geometry.
      lines,
      richLines: render.richLines.map((line) => ({
        spans: line.spans.map((span) => ({ ...span })),
      })),
      cursor: {
        x: render.cursorCol,
        y: render.cursorAbsRow,
        visible: render.cursorVisible,
      },
      scrollback: { ...render.scrollback },
    };
  }
}
