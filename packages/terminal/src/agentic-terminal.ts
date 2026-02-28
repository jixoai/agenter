import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { Committer } from "./committer";
import { InputInbox } from "./input-inbox";
import { runMixedInput } from "./input-parser";
import { HtmlPaginationStore } from "./pagination";
import { Pty } from "./pty";
import { compactRenderForPersistence, renderSemanticBuffer, serializeRenderLinesForLog } from "./renderer";
import type { RenderResult, TerminalProfile, TerminalStatus } from "./types";
import { DEFAULTS } from "./types";
import { createWorkspace, destroyWorkspace } from "./workspace";
import { XtermBridge } from "./xterm-bridge";

const resolveMaxLinesPerFile = (profile: TerminalProfile): number => {
  if (profile.maxLinesPerFile !== undefined) {
    return profile.maxLinesPerFile;
  }
  const rows = profile.rows ?? DEFAULTS.rows;
  return Math.max(20, Math.min(rows, 100) * 2);
};

const resolveProfile = (profile: TerminalProfile | undefined) => {
  const next = profile ?? {};
  return {
    debounceMs: next.debounceMs ?? DEFAULTS.debounceMs,
    throttleMs: next.throttleMs ?? DEFAULTS.throttleMs,
    maxLinesPerFile: resolveMaxLinesPerFile(next),
    cols: next.cols ?? DEFAULTS.cols,
    rows: next.rows ?? DEFAULTS.rows,
    color: next.color ?? "256",
    logStyle: next.logStyle ?? "rich",
    outputRoot: next.outputRoot,
    workspacePath: next.workspacePath,
    resumePid: next.resumePid,
    cwd: next.cwd,
    debugCursor: next.debugCursor ?? false,
  };
};

const xmlEscape = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/**
 * AgenticTerminal orchestrates PTY + xterm/headless + semantic HTML filesystem sync.
 */
export class AgenticTerminal {
  /** Workspace path, e.g. `/tmp/agentic-terminal/1234-1700000000`. */
  public workspace = "";

  private pty: Pty | null = null;
  private xterm: XtermBridge | null = null;
  private pager: HtmlPaginationStore | null = null;
  private committer: Committer | null = null;
  private inbox: InputInbox | null = null;
  private started = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private status: TerminalStatus = "IDLE";
  private renderQueue: Promise<void> = Promise.resolve();
  private writeQueue: Promise<void> = Promise.resolve();
  private destroyed = false;
  private resizing = false;
  private resizeQueue: Promise<void> = Promise.resolve();
  private appliedSize: { cols: number; rows: number } | null = null;
  private readonly outputListeners: Array<(chunk: string) => void> = [];
  private readonly exitListeners: Array<(code: number | null) => void> = [];
  private readonly renderListeners: Array<(render: ReturnType<typeof renderSemanticBuffer>) => void> = [];
  private renderSerial = 0;
  private debugLogPath = "";
  private lastRender: RenderResult = {
    lines: [],
    plainLines: [],
    richLines: [],
    cursorAbsRow: 0,
    cursorCol: 0,
    cursorVisible: true,
  };

  private readonly profile;

  constructor(
    private readonly command: string,
    private readonly args: string[],
    profile?: TerminalProfile,
  ) {
    this.profile = resolveProfile(profile);
  }

  /** Start child process and begin terminal capture/commit pipeline. */
  public start(): void {
    if (this.started) {
      return;
    }
    this.destroyed = false;

    this.workspace = createWorkspace({
      outputRoot: this.profile.outputRoot,
      workspacePath: this.profile.workspacePath,
      resumePid: this.profile.resumePid,
    });
    const inputDir = join(this.workspace, "input");
    const debugDir = join(this.workspace, "debug");
    mkdirSync(inputDir, { recursive: true });
    mkdirSync(debugDir, { recursive: true });
    this.debugLogPath = join(debugDir, "terminal.ndjson");
    this.debug("start", {
      command: this.command,
      args: this.args,
      profile: {
        rows: this.profile.rows,
        cols: this.profile.cols,
        color: this.profile.color,
        logStyle: this.profile.logStyle,
        outputRoot: this.profile.outputRoot,
        cwd: this.profile.cwd,
      },
    });

    this.xterm = new XtermBridge(this.profile.cols, this.profile.rows);
    const initialRender = renderSemanticBuffer(this.xterm);
    this.emitRender(initialRender);
    this.pager = new HtmlPaginationStore(this.workspace, this.profile.maxLinesPerFile);
    this.committer = new Committer({
      debounceMs: this.profile.debounceMs,
      throttleMs: this.profile.throttleMs,
    });
    this.pty = new Pty(
      this.command,
      this.args,
      this.profile.cols,
      this.profile.rows,
      this.profile.color,
      this.profile.cwd,
    );
    this.appliedSize = { cols: this.profile.cols, rows: this.profile.rows };
    this.inbox = new InputInbox({
      inputDir,
      onMixedInput: async (mixed, sourceFile) => {
        await this.enqueueMixedInput(mixed, `file:${sourceFile}`);
      },
      onError: (error, sourceFile) => {
        this.appendInputLog(`ERROR ${sourceFile}: ${error.message}`, "file:error");
      },
    });

    this.pty.setOnData((chunk) => {
      this.markBusy();
      for (const listener of this.outputListeners) {
        listener(chunk);
      }
      const xterm = this.xterm;
      const pager = this.pager;
      const committer = this.committer;
      if (!xterm || !pager || !committer) {
        return;
      }

      this.renderQueue = this.renderQueue.then(async () => {
        await xterm.write(chunk);
        if (this.resizing) {
          return;
        }
        const render = renderSemanticBuffer(xterm);
        const compact = compactRenderForPersistence(render);
        this.emitRender(render);
        committer.schedule({
          plainText: compact.plainLines.join("\n"),
          commit: async () => {
            pager.write(
              this.toPersistenceRender(compact),
              this.status,
              xterm.baseY,
              xterm.rows,
              xterm.cols,
              this.profile.logStyle,
            );
          },
        });
      });
    });

    this.pty.setOnExit((code) => {
      this.markIdle();
      this.debug("pty.exit", { code });
      for (const listener of this.exitListeners) {
        listener(code);
      }
      void this.committer?.forceCommit().catch(() => {
        // ignore async commit errors after process exit
      });
    });

    this.pty.start();
    this.inbox.start();
    this.started = true;
    this.markBusy();
    this.markIdle();
  }

  /**
   * Parse XML-like mixed input and execute sequentially in PTY.
   * Example: `echo hello<key data="enter"/>`.
   */
  public async writeMixed(mixedInput: string): Promise<void> {
    this.ensureStarted();
    await this.enqueueMixedInput(mixedInput, "api");
  }

  /**
   * Write raw input directly to PTY (no XML/mixed parsing), useful for interactive forwarding.
   */
  public writeRaw(input: string): void {
    this.ensureStarted();
    this.pty?.write(input);
  }

  public onOutput(listener: (chunk: string) => void): () => void {
    this.outputListeners.push(listener);
    return () => {
      const index = this.outputListeners.indexOf(listener);
      if (index >= 0) {
        this.outputListeners.splice(index, 1);
      }
    };
  }

  public onExit(listener: (code: number | null) => void): () => void {
    this.exitListeners.push(listener);
    return () => {
      const index = this.exitListeners.indexOf(listener);
      if (index >= 0) {
        this.exitListeners.splice(index, 1);
      }
    };
  }

  public onRender(listener: (render: ReturnType<typeof renderSemanticBuffer>) => void): () => void {
    this.renderListeners.push(listener);
    return () => {
      const index = this.renderListeners.indexOf(listener);
      if (index >= 0) {
        this.renderListeners.splice(index, 1);
      }
    };
  }

  public getLatestRender(): RenderResult {
    return this.lastRender;
  }

  /** Force a filesystem commit regardless of debounce state. */
  public async forceCommit(): Promise<void> {
    this.ensureStarted();
    await this.renderQueue;
    await this.commitSnapshotNow();
  }

  /** Resize PTY and xterm buffer; split epoch and snapshot viewport to avoid reflow noise. */
  public resize(cols: number, rows: number): Promise<void> {
    this.ensureStarted();
    this.resizeQueue = this.resizeQueue.then(async () => {
      if (!this.started || this.destroyed) {
        return;
      }
      const xterm = this.xterm;
      const pty = this.pty;
      const pager = this.pager;
      if (!xterm || !pty || !pager) {
        return;
      }
      const currentCols = xterm.cols;
      const currentRows = xterm.rows;
      if (cols === currentCols && rows === currentRows) {
        this.debug("resize.skip.current", { cols, rows, currentCols, currentRows });
        return;
      }
      if (this.appliedSize && cols === this.appliedSize.cols && rows === this.appliedSize.rows) {
        this.debug("resize.skip.applied", { cols, rows, applied: this.appliedSize });
        return;
      }

      this.resizing = true;
      this.debug("resize.begin", {
        request: { cols, rows },
        current: { cols: currentCols, rows: currentRows },
        applied: this.appliedSize,
      });
      try {
        await this.forceCommit();
        const beforeResize = renderSemanticBuffer(xterm);
        this.debug("resize.before-seal", {
          lines: beforeResize.lines.length,
          cursor: { row: beforeResize.cursorAbsRow, col: beforeResize.cursorCol },
          baseY: xterm.baseY,
          rows: xterm.rows,
          cols: xterm.cols,
        });
        const sealedFile = pager.sealForResize(beforeResize.lines.length, {
          cursorRow: beforeResize.cursorAbsRow + 1,
          cursorCol: beforeResize.cursorCol + 1,
          viewportBase: xterm.baseY,
          logStyle: this.profile.logStyle,
          rows: xterm.rows,
          cols: xterm.cols,
        });
        this.debug("resize.sealed", { sealedFile });

        pty.resize(cols, rows);
        xterm.resize(cols, rows);
        this.appliedSize = { cols, rows };
        this.debug("resize.applied", { cols, rows });

        await Bun.sleep(500);
        await this.renderQueue;

        const snapshot = renderSemanticBuffer(xterm);
        const compact = compactRenderForPersistence(snapshot);
        this.debug("resize.snapshot", {
          lines: snapshot.lines.length,
          cursor: { row: snapshot.cursorAbsRow, col: snapshot.cursorCol },
          baseY: xterm.baseY,
          rows,
          cols,
        });
        this.emitRender(snapshot);
        pager.writeResizeSnapshot(
          this.toPersistenceRender(compact),
          this.status,
          xterm.baseY,
          cols,
          rows,
          sealedFile,
          this.profile.logStyle,
        );
        this.debug("resize.done", { cols, rows, sealedFile });
      } finally {
        this.resizing = false;
      }
    });
    return this.resizeQueue;
  }

  private async commitSnapshotNow(): Promise<void> {
    this.ensureStarted();
    const xterm = this.xterm;
    const pager = this.pager;
    const committer = this.committer;
    if (!xterm || !pager || !committer) {
      return;
    }

    const render = renderSemanticBuffer(xterm);
    const compact = compactRenderForPersistence(render);
    committer.schedule({
      plainText: compact.plainLines.join("\n"),
      commit: async () => {
        pager.write(
          this.toPersistenceRender(compact),
          this.status,
          xterm.baseY,
          xterm.rows,
          xterm.cols,
          this.profile.logStyle,
        );
      },
    });
    await committer.forceCommit();
  }

  /** Gracefully stop process and optionally keep workspace logs. */
  public async destroy(keepLogs = false): Promise<void> {
    this.destroyed = true;
    if (!this.started) {
      if (this.workspace) {
        destroyWorkspace(this.workspace, keepLogs);
      }
      return;
    }

    this.inbox?.stop();
    this.inbox = null;

    this.pty?.kill();
    this.pty = null;

    if (this.committer) {
      try {
        await this.forceCommit();
      } catch {
        // ignore final commit errors during teardown
      }
      this.committer.stop();
    }
    this.committer = null;

    this.xterm?.dispose();
    this.xterm = null;
    this.pager = null;
    this.outputListeners.length = 0;
    this.exitListeners.length = 0;
    this.renderListeners.length = 0;
    this.appliedSize = null;
    this.started = false;
    this.status = "IDLE";

    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    if (this.workspace.length > 0) {
      this.debug("destroy", { keepLogs });
      destroyWorkspace(this.workspace, keepLogs);
    }
  }

  public getStatus(): TerminalStatus {
    return this.status;
  }

  private ensureStarted(): void {
    if (!this.started) {
      throw new Error("AgenticTerminal is not started");
    }
  }

  private markBusy(): void {
    if (this.status !== "BUSY") {
      this.debug("status", { from: this.status, to: "BUSY" });
    }
    this.status = "BUSY";
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      this.markIdle();
    }, DEFAULTS.idleTimeoutMs);
  }

  private markIdle(): void {
    if (this.status !== "IDLE") {
      this.debug("status", { from: this.status, to: "IDLE" });
    }
    this.status = "IDLE";
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.started && !this.destroyed) {
      this.renderQueue = this.renderQueue.then(async () => {
        if (!this.started || this.destroyed) {
          return;
        }
        try {
          await this.commitSnapshotNow();
        } catch {
          // ignore status-only commit failures
        }
      });
    }
  }

  private enqueueMixedInput(mixedInput: string, source: string): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      this.appendInputLog(mixedInput, source);
      await runMixedInput(mixedInput, {
        write: (data) => {
          this.pty?.write(data);
        },
        wait: (ms) => Bun.sleep(ms),
      });
    });
    return this.writeQueue;
  }

  private appendInputLog(mixedInput: string, source: string): void {
    const logPath = join(this.workspace, "input", "ai-input.log");
    const stamp = new Date().toISOString();
    appendFileSync(logPath, `<ai-input timestamp="${stamp}" source="${xmlEscape(source)}">${xmlEscape(mixedInput)}</ai-input>\n`, "utf8");
  }

  private toPersistenceRender(compact: RenderResult): RenderResult {
    return {
      ...compact,
      lines: serializeRenderLinesForLog(compact, this.profile.logStyle),
    };
  }

  private emitRender(render: ReturnType<typeof renderSemanticBuffer>): void {
    this.lastRender = render;
    this.appendCursorDebug(render);
    for (const listener of this.renderListeners) {
      listener(render);
    }
  }

  private debug(event: string, payload: Record<string, unknown> = {}): void {
    if (!this.debugLogPath) {
      return;
    }
    try {
      const debugDir = join(this.workspace, "debug");
      mkdirSync(debugDir, { recursive: true });
      appendFileSync(
        this.debugLogPath,
        `${JSON.stringify({
          ts: new Date().toISOString(),
          source: "agentic-terminal",
          event,
          ...payload,
        })}\n`,
        "utf8",
      );
    } catch {
      // ignore debug logging errors to avoid affecting runtime behavior
    }
  }

  private appendCursorDebug(render: RenderResult): void {
    if (!this.profile.debugCursor || this.workspace.length === 0) {
      return;
    }
    const row = render.cursorAbsRow;
    const start = Math.max(0, row - 4);
    const end = Math.min(render.plainLines.length - 1, row + 4);
    const context = render.plainLines.slice(start, end + 1);
    const logPath = join(this.workspace, "output", "cursor-debug.ndjson");
    mkdirSync(join(this.workspace, "output"), { recursive: true });
    const record = {
      timestamp: new Date().toISOString(),
      seq: this.renderSerial,
      cursor: {
        row,
        col: render.cursorCol,
        visible: render.cursorVisible,
      },
      contextRange: {
        start,
        end,
      },
      context,
    };
    this.renderSerial += 1;
    appendFileSync(logPath, `${JSON.stringify(record)}\n`, "utf8");
  }
}
