import { join } from "node:path";

import { AgenticTerminal, type RenderResult, type TerminalGitLogMode, type TerminalStatus } from "@agenter/terminal-system";

import type { DebugLogger } from "../infra/logger";
import { createEmptySnapshot, type TerminalRichLine, type TerminalSnapshot } from "./protocol";

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const padLines = <T>(input: T[], size: number, fill: () => T): T[] => {
  if (input.length >= size) {
    return input.slice(input.length - size);
  }
  return [...Array.from({ length: size - input.length }, fill), ...input];
};

export interface TerminalAdapterConfig {
  terminalId: string;
  command: string[];
  commandLabel: string;
  cwd: string;
  cols: number;
  rows: number;
  outputRoot?: string;
  gitLog?: false | TerminalGitLogMode;
  logStyle?: "rich" | "plain";
}

export interface TerminalDirtySlice {
  ok: boolean;
  changed: boolean;
  fromHash: string | null;
  toHash: string | null;
  diff: string;
  bytes: number;
  reason?: string;
}

export interface SliceDirtyOptions {
  remark?: boolean;
  wait?: boolean;
  timeoutMs?: number;
  pollMs?: number;
}

export interface PendingInputOptions {
  extension?: "xml" | "txt";
  wait?: boolean;
  timeoutMs?: number;
  pollMs?: number;
}

export class TerminalAdapter {
  private terminal: AgenticTerminal | null = null;
  private snapshot = createEmptySnapshot();
  private seq = 0;
  private running = false;
  private cols: number;
  private rows: number;
  private workspace: string | null = null;
  private readonly snapshotListeners: Array<(snapshot: TerminalSnapshot) => void> = [];
  private readonly statusListeners: Array<(running: boolean, status: TerminalStatus) => void> = [];

  constructor(
    private readonly logger: DebugLogger,
    private readonly config: TerminalAdapterConfig,
  ) {
    this.cols = config.cols;
    this.rows = config.rows;
    this.snapshot = {
      ...createEmptySnapshot(),
      cols: config.cols,
      rows: config.rows,
      lines: Array.from({ length: config.rows }, () => ""),
      richLines: Array.from({ length: config.rows }, () => ({ plain: "", spans: [] })),
    };
  }

  onSnapshot(listener: (snapshot: TerminalSnapshot) => void): () => void {
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
      throw new Error("terminal command is empty");
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
    this.terminal.onExit((code) => {
      this.running = false;
      this.logger.log({
        channel: "pty.out",
        level: code === 0 ? "info" : "warn",
        message: "terminal exited",
        meta: { code: code ?? -1, terminalId: this.config.terminalId },
      });
      this.emitStatus();
    });
    this.terminal.start();
    this.workspace = this.terminal.workspace;
    this.running = true;
    this.snapshot = this.toSnapshot(this.terminal.getLatestRender());
    this.emitSnapshot();
    this.emitStatus();
    this.logger.log({
      channel: "pty.in",
      level: "info",
      message: "terminal adapter started",
      meta: {
        terminalId: this.config.terminalId,
        command: this.config.commandLabel,
        cwd: this.config.cwd,
        cols: this.cols,
        rows: this.rows,
        workspace: this.workspace ?? "none",
      },
    });
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

  getSnapshot(): TerminalSnapshot {
    return this.snapshot;
  }

  getWorkspace(): string | null {
    return this.workspace;
  }

  getOutputDir(): string | null {
    if (!this.workspace) {
      return null;
    }
    return join(this.workspace, "output");
  }

  getStatus(): TerminalStatus {
    return this.terminal?.getStatus() ?? "IDLE";
  }

  resize(cols: number, rows: number): void {
    this.cols = Math.max(8, cols);
    this.rows = Math.max(4, rows);
    if (!this.terminal) {
      return;
    }
    void this.terminal.resize(this.cols, this.rows);
  }

  write(input: string): void {
    if (!this.terminal) {
      throw new Error("terminal is not running");
    }
    this.terminal.writeRaw(input);
  }

  async writeMixed(input: string, options: PendingInputOptions = {}): Promise<{ ok: boolean; reason?: string }> {
    if (!this.terminal) {
      return { ok: false, reason: "terminal-not-started" };
    }
    const result = await this.terminal.enqueuePendingInput(input, options);
    if (!result.ok) {
      this.logger.log({
        channel: "error",
        level: "error",
        message: "terminal.writeMixed failed",
        meta: {
          reason: result.reason ?? "unknown",
          file: result.file,
        },
      });
      return { ok: false, reason: result.reason ?? "unknown" };
    }
    this.logger.log({
      channel: "agent",
      level: "debug",
      message: "terminal.writeMixed",
      meta: {
        file: result.file,
        doneFile: result.doneFile ?? "none",
      },
    });
    return { ok: true };
  }

  async forceCommit(): Promise<void> {
    if (!this.terminal) {
      return;
    }
    await this.terminal.forceCommit();
  }

  async markDirty(): Promise<{ ok: boolean; hash: string | null; reason?: string }> {
    if (!this.terminal) {
      return { ok: false, hash: null, reason: "terminal-not-started" };
    }
    const result = await this.terminal.markDirty();
    if (!result.ok) {
      this.logger.log({
        channel: "error",
        level: "error",
        message: "terminal.markDirty failed",
        meta: { reason: result.reason ?? "unknown" },
      });
      return result;
    }
    this.logger.log({
      channel: "agent",
      level: "debug",
      message: "terminal.markDirty",
      meta: { hash: result.hash ?? "none" },
    });
    return result;
  }

  async sliceDirty(options: SliceDirtyOptions = {}): Promise<TerminalDirtySlice> {
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
    const result = await this.terminal.sliceDirty(options);
    this.logger.log({
      channel: "agent",
      level: "debug",
      message: "terminal.sliceDirty",
      meta: {
        fromHash: result.fromHash ?? "none",
        toHash: result.toHash ?? "none",
        bytes: result.bytes,
        changed: result.changed,
        remark: options.remark ?? true,
      },
    });
    return result;
  }

  interrupt(): void {
    if (!this.terminal) {
      return;
    }
    this.terminal.writeRaw("\u0003");
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

  private toSnapshot(render: RenderResult): TerminalSnapshot {
    const start = Math.max(0, render.richLines.length - this.rows);
    const rawLines = render.plainLines.slice(start, start + this.rows);
    const lines = padLines(rawLines, this.rows, () => "");
    const richTail = render.richLines.slice(start, start + this.rows).map<TerminalRichLine>((line) => ({
      plain: line.spans.map((span) => span.text).join(""),
      spans: line.spans.map((span) => {
        if (!span.inverse) {
          return {
            text: span.text,
            fg: span.fg,
            bg: span.bg,
            bold: span.bold,
            underline: span.underline,
          };
        }
        return {
          text: span.text,
          fg: span.bg ?? "#0d1117",
          bg: span.fg ?? "#e6edf3",
          bold: span.bold,
          underline: span.underline,
        };
      }),
    }));
    const richLines = padLines(richTail, this.rows, () => ({ plain: "", spans: [] }));
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
    };
  }
}
