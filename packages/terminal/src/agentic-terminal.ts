import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Committer } from "./committer";
import { TerminalGitLogger } from "./git-log";
import { InputInbox } from "./input-inbox";
import { runMixedInput } from "./input-parser";
import { HtmlPaginationStore } from "./pagination";
import { Pty } from "./pty";
import {
  compactRenderForPersistence,
  renderSemanticBuffer,
  renderStructuredBuffer,
  serializeRenderLinesForLog,
  serializeStructuredLinesForLog,
} from "./renderer";
import type {
  RenderResult,
  TerminalDirtyMarkResult,
  TerminalDirtySliceOptions,
  TerminalDirtySliceResult,
  TerminalPendingInputOptions,
  TerminalPendingInputResult,
  TerminalProfile,
  TerminalStatus,
  TerminalStructuredSnapshot,
} from "./types";
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
    gitLog: next.gitLog ?? "none",
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
  private readonly structuredListeners: Array<(snapshot: TerminalStructuredSnapshot) => void> = [];
  private readonly outputDecoder = new TextDecoder();
  private readonly gitDecoder = new TextDecoder();
  private renderSerial = 0;
  private structuredSerial = 0;
  private debugLogPath = "";
  private gitLogger: TerminalGitLogger | null = null;
  private dirtyMarkHash: string | null = null;
  private lastRender: RenderResult = {
    lines: [],
    plainLines: [],
    richLines: [],
    cursorAbsRow: 0,
    cursorCol: 0,
    cursorVisible: true,
  };
  private lastStructured: TerminalStructuredSnapshot = {
    seq: 0,
    timestamp: Date.now(),
    status: "IDLE",
    rows: 0,
    cols: 0,
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
        gitLog: this.profile.gitLog,
        outputRoot: this.profile.outputRoot,
        cwd: this.profile.cwd,
      },
    });
    if (this.profile.gitLog !== "none" && this.profile.gitLog !== false) {
      this.gitLogger = new TerminalGitLogger(this.workspace, this.profile.gitLog);
      this.gitLogger.init();
      this.debug("git-log.enabled", { mode: this.profile.gitLog });
    } else {
      this.gitLogger = null;
    }

    this.xterm = new XtermBridge(this.profile.cols, this.profile.rows);
    const initialRender = this.buildRenderFromXterm(this.xterm);
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
      const textChunk = this.outputDecoder.decode(chunk, { stream: true });
      for (const listener of this.outputListeners) {
        listener(textChunk);
      }
      const xterm = this.xterm;
      const committer = this.committer;
      if (!xterm || !this.pager || !committer) {
        return;
      }

      this.renderQueue = this.renderQueue.then(async () => {
        await xterm.write(chunk);
        if (this.resizing) {
          return;
        }
        const render = this.buildRenderFromXterm(xterm);
        const compact = compactRenderForPersistence(render);
        this.emitRender(render);
        committer.schedule({
          plainText: compact.plainLines.join("\n"),
          commit: async () => {
            this.persistRenderToPager(compact, xterm.baseY, xterm.rows, xterm.cols, "write");
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

    try {
      this.pty.start();
      this.inbox.start();
      this.started = true;
      this.dirtyMarkHash = null;
      this.markBusy();
      this.markIdle();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.debug("start.failed", { message });
      this.rollbackStartState();
      throw new Error(`failed to start terminal "${this.command}": ${message}`);
    }
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
   * Enqueue mixed input through `input/pending`, then wait for `done/failed`.
   * This keeps one consistent input path for automation and manual workflows.
   */
  public async enqueuePendingInput(
    mixedInput: string,
    options: TerminalPendingInputOptions = {},
  ): Promise<TerminalPendingInputResult> {
    this.ensureStarted();
    const extension = options.extension ?? "txt";
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const file = `${id}.${extension}`;
    const pendingPath = join(this.workspace, "input", "pending", file);
    const doneFile = `${file}.done`;
    const failedFile = `${file}.failed`;
    const donePath = join(this.workspace, "input", "done", doneFile);
    const failedPath = join(this.workspace, "input", "failed", failedFile);

    writeFileSync(pendingPath, mixedInput, "utf8");
    this.appendInputLog(mixedInput, `queue:${file}`);
    this.debug("input.enqueue", { id, file, extension });
    this.inbox?.poke();

    const wait = options.wait ?? true;
    if (!wait) {
      return { ok: true, id, file };
    }

    const timeoutMs = Math.max(0, options.timeoutMs ?? 30_000);
    const pollMs = Math.max(20, options.pollMs ?? 100);
    const startAt = Date.now();
    while (Date.now() - startAt <= timeoutMs) {
      if (await Bun.file(donePath).exists()) {
        this.debug("input.done", { id, file, doneFile });
        return { ok: true, id, file, doneFile };
      }
      if (await Bun.file(failedPath).exists()) {
        this.debug("input.failed", { id, file, failedFile });
        return { ok: false, id, file, failedFile, reason: "input-processing-failed" };
      }
      await Bun.sleep(pollMs);
    }

    this.debug("input.timeout", { id, file, timeoutMs });
    return { ok: false, id, file, reason: "input-timeout" };
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

  public onStructured(listener: (snapshot: TerminalStructuredSnapshot) => void): () => void {
    this.structuredListeners.push(listener);
    return () => {
      const index = this.structuredListeners.indexOf(listener);
      if (index >= 0) {
        this.structuredListeners.splice(index, 1);
      }
    };
  }

  public getLatestRender(): RenderResult {
    return this.lastRender;
  }

  public getLatestStructured(): TerminalStructuredSnapshot {
    return this.lastStructured;
  }

  /** Force a filesystem commit regardless of debounce state. */
  public async forceCommit(): Promise<void> {
    this.ensureStarted();
    await this.renderQueue;
    await this.commitSnapshotNow("force");
  }

  public async markDirty(): Promise<TerminalDirtyMarkResult> {
    this.ensureStarted();
    if (!this.isGitLogEnabled()) {
      return { ok: false, hash: null, reason: "git-log-disabled" };
    }
    await this.forceCommit();
    const head = this.ensureGitHead();
    if (!head.ok) {
      return { ok: false, hash: null, reason: head.error };
    }
    this.dirtyMarkHash = head.hash;
    this.debug("dirty.mark", { hash: head.hash });
    return { ok: true, hash: head.hash };
  }

  public async releaseDirty(): Promise<TerminalDirtyMarkResult> {
    return this.markDirty();
  }

  public async sliceDirty(options: TerminalDirtySliceOptions = {}): Promise<TerminalDirtySliceResult> {
    this.ensureStarted();
    const wait = options.wait ?? false;
    const timeoutMs = Math.max(0, options.timeoutMs ?? 30_000);
    const pollMs = Math.max(50, options.pollMs ?? 250);
    const startedAt = Date.now();
    let latest = await this.sliceDirtyOnce(options);

    while (wait && latest.ok && !latest.changed && Date.now() - startedAt < timeoutMs) {
      await Bun.sleep(pollMs);
      latest = await this.sliceDirtyOnce(options);
    }

    if (wait && latest.ok && !latest.changed && Date.now() - startedAt >= timeoutMs) {
      return {
        ...latest,
        reason: latest.reason ?? "timeout",
      };
    }

    return latest;
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
        const beforeResize = this.buildRenderFromXterm(xterm);
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
        if (sealedFile) {
          this.commitGitLog({
            event: "resize-seal",
            file: sealedFile,
            status: this.status,
            rows: xterm.rows,
            cols: xterm.cols,
            cursorRow: beforeResize.cursorAbsRow + 1,
            cursorCol: beforeResize.cursorCol + 1,
            preFile: pager.getLastArchiveName(),
            nextFile: "latest.log.html",
          });
        }

        pty.resize(cols, rows);
        xterm.resize(cols, rows);
        this.appliedSize = { cols, rows };
        this.debug("resize.applied", { cols, rows });

        await Bun.sleep(500);
        await this.renderQueue;

        const snapshot = this.buildRenderFromXterm(xterm);
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
        this.commitGitLog({
          event: "resize-snapshot",
          file: "latest.log.html",
          status: this.status,
          rows,
          cols,
          cursorRow: snapshot.cursorAbsRow + 1,
          cursorCol: snapshot.cursorCol + 1,
          preFile: sealedFile ?? pager.getLastArchiveName(),
          nextFile: null,
        });
        this.debug("resize.done", { cols, rows, sealedFile });
      } finally {
        this.resizing = false;
      }
    });
    return this.resizeQueue;
  }

  private async commitSnapshotNow(reason: "force" | "status-idle"): Promise<void> {
    this.ensureStarted();
    const xterm = this.xterm;
    const pager = this.pager;
    const committer = this.committer;
    if (!xterm || !pager || !committer) {
      return;
    }

    const render = this.buildRenderFromXterm(xterm);
    const compact = compactRenderForPersistence(render);
    committer.schedule({
      plainText: compact.plainLines.join("\n"),
      commit: async () => {
        this.persistRenderToPager(compact, xterm.baseY, xterm.rows, xterm.cols, reason);
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
    if (this.gitLogger) {
      try {
        await this.gitLogger.flush();
      } catch {
        // ignore git flush errors during teardown
      }
    }
    this.gitLogger = null;

    this.xterm?.dispose();
    this.xterm = null;
    this.pager = null;
    this.outputListeners.length = 0;
    this.exitListeners.length = 0;
    this.renderListeners.length = 0;
    this.structuredListeners.length = 0;
    this.appliedSize = null;
    this.dirtyMarkHash = null;
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

  private rollbackStartState(): void {
    this.inbox?.stop();
    this.inbox = null;

    this.pty?.kill();
    this.pty = null;

    this.committer?.stop();
    this.committer = null;

    this.xterm?.dispose();
    this.xterm = null;
    this.pager = null;
    this.gitLogger = null;

    this.started = false;
    this.status = "IDLE";
    this.appliedSize = null;
    this.dirtyMarkHash = null;
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
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

  private async sliceDirtyOnce(options: TerminalDirtySliceOptions): Promise<TerminalDirtySliceResult> {
    const remark = options.remark ?? true;
    if (!this.isGitLogEnabled()) {
      return {
        ok: false,
        changed: false,
        fromHash: null,
        toHash: null,
        diff: "",
        bytes: 0,
        reason: "git-log-disabled",
      };
    }

    await this.forceCommit();
    const baseHead = this.ensureGitHead();
    if (!baseHead.ok) {
      return {
        ok: false,
        changed: false,
        fromHash: this.dirtyMarkHash,
        toHash: null,
        diff: "",
        bytes: 0,
        reason: baseHead.error,
      };
    }

    if (!this.dirtyMarkHash) {
      this.dirtyMarkHash = baseHead.hash;
      return {
        ok: true,
        changed: false,
        fromHash: null,
        toHash: baseHead.hash,
        diff: "",
        bytes: 0,
      };
    }

    const fromHash = this.dirtyMarkHash;
    let toHash = baseHead.hash;
    const dirtyStatus = this.runGitCommand(["status", "--porcelain", "--", "output"]);
    if (!dirtyStatus.ok) {
      return {
        ok: false,
        changed: false,
        fromHash,
        toHash,
        diff: "",
        bytes: 0,
        reason: dirtyStatus.stderr || dirtyStatus.stdout || `git-status-exit-${dirtyStatus.code}`,
      };
    }

    if (dirtyStatus.stdout.trim().length > 0) {
      const add = this.runGitCommand(["add", "-A", "--", "output"]);
      if (!add.ok) {
        return {
          ok: false,
          changed: false,
          fromHash,
          toHash,
          diff: "",
          bytes: 0,
          reason: add.stderr || add.stdout || `git-add-exit-${add.code}`,
        };
      }
      const commit = this.runGitCommand(["commit", "--allow-empty", "-m", "ati(slice): output update"]);
      if (!commit.ok) {
        return {
          ok: false,
          changed: false,
          fromHash,
          toHash,
          diff: "",
          bytes: 0,
          reason: commit.stderr || commit.stdout || `git-commit-exit-${commit.code}`,
        };
      }
      const nextHead = this.runGitCommand(["rev-parse", "HEAD"]);
      if (!nextHead.ok || !nextHead.stdout) {
        return {
          ok: false,
          changed: false,
          fromHash,
          toHash: null,
          diff: "",
          bytes: 0,
          reason: nextHead.stderr || nextHead.stdout || `git-rev-parse-exit-${nextHead.code}`,
        };
      }
      toHash = nextHead.stdout;
    }

    if (fromHash === toHash) {
      if (remark) {
        this.dirtyMarkHash = toHash;
      }
      return {
        ok: true,
        changed: false,
        fromHash,
        toHash,
        diff: "",
        bytes: 0,
      };
    }

    const diffResult = this.runGitCommand(["diff", "--no-color", "--patience", `${fromHash}..${toHash}`, "--", "output"]);
    if (!diffResult.ok) {
      return {
        ok: false,
        changed: false,
        fromHash,
        toHash,
        diff: "",
        bytes: 0,
        reason: diffResult.stderr || diffResult.stdout || `git-diff-exit-${diffResult.code}`,
      };
    }
    if (remark) {
      this.dirtyMarkHash = toHash;
    }
    const diff = diffResult.stdout;
    const changed = diff.length > 0;
    this.debug("dirty.slice", { fromHash, toHash, bytes: diff.length, changed, remark });
    return {
      ok: true,
      changed,
      fromHash,
      toHash,
      diff,
      bytes: diff.length,
    };
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
          await this.commitSnapshotNow("status-idle");
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

  private buildRenderFromXterm(xterm: XtermBridge): RenderResult {
    const structured = renderStructuredBuffer(xterm);
    this.lastStructured = {
      ...structured,
      seq: this.structuredSerial + 1,
      timestamp: Date.now(),
      status: this.status,
    };
    this.structuredSerial += 1;
    const plainLines = structured.richLines.map((line) => line.spans.map((span) => span.text).join(""));
    return {
      lines: serializeStructuredLinesForLog(structured, "rich"),
      plainLines,
      richLines: structured.richLines,
      cursorAbsRow: structured.cursorAbsRow,
      cursorCol: structured.cursorCol,
      cursorVisible: structured.cursorVisible,
    };
  }

  private persistRenderToPager(
    compact: RenderResult,
    viewportBase: number,
    rows: number,
    cols: number,
    reason: "write" | "force" | "status-idle",
  ): void {
    const pager = this.pager;
    if (!pager) {
      return;
    }
    const beforeArchive = pager.getLastArchiveName();
    const persisted = this.toPersistenceRender(compact);
    pager.write(persisted, this.status, viewportBase, rows, cols, this.profile.logStyle);
    const afterArchive = pager.getLastArchiveName();

    if (this.profile.gitLog === "verbose") {
      this.commitGitLog({
        event: beforeArchive !== afterArchive && afterArchive ? "archive" : reason === "status-idle" ? "status-idle" : "write",
        file: beforeArchive !== afterArchive && afterArchive ? afterArchive : "latest.log.html",
        status: this.status,
        rows,
        cols,
        cursorRow: persisted.cursorAbsRow + 1,
        cursorCol: persisted.cursorCol + 1,
        preFile: afterArchive,
        nextFile: beforeArchive !== afterArchive && afterArchive ? "latest.log.html" : null,
      });
      return;
    }
    if (this.profile.gitLog === "normal") {
      if (beforeArchive !== afterArchive && afterArchive) {
        this.commitGitLog({
          event: "archive",
          file: afterArchive,
          status: this.status,
          rows,
          cols,
          cursorRow: persisted.cursorAbsRow + 1,
          cursorCol: persisted.cursorCol + 1,
          preFile: afterArchive,
          nextFile: "latest.log.html",
        });
      }
      if (reason === "status-idle") {
        this.commitGitLog({
          event: "status-idle",
          file: "latest.log.html",
          status: this.status,
          rows,
          cols,
          cursorRow: persisted.cursorAbsRow + 1,
          cursorCol: persisted.cursorCol + 1,
          preFile: afterArchive,
          nextFile: null,
        });
      }
    }
  }

  private commitGitLog(input: {
    event: "write" | "archive" | "resize-seal" | "resize-snapshot" | "status-idle";
    file: string;
    status: TerminalStatus;
    rows: number;
    cols: number;
    cursorRow: number;
    cursorCol: number;
    preFile: string | null;
    nextFile?: string | null;
  }): void {
    if (!this.gitLogger || this.profile.gitLog === false || this.profile.gitLog === "none") {
      return;
    }
    this.gitLogger.commit(input);
  }

  private emitRender(render: ReturnType<typeof renderSemanticBuffer>): void {
    this.lastRender = render;
    for (const listener of this.structuredListeners) {
      listener(this.lastStructured);
    }
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

  private isGitLogEnabled(): boolean {
    return Boolean(this.profile.gitLog && this.profile.gitLog !== "none");
  }

  private runGitCommand(args: string[]): { ok: boolean; code: number; stdout: string; stderr: string } {
    const result = Bun.spawnSync({
      cmd: ["git", ...args],
      cwd: this.workspace,
      stdout: "pipe",
      stderr: "pipe",
    });
    return {
      ok: result.exitCode === 0,
      code: result.exitCode,
      stdout: this.gitDecoder.decode(result.stdout).trimEnd(),
      stderr: this.gitDecoder.decode(result.stderr).trimEnd(),
    };
  }

  private ensureGitHead(): { ok: true; hash: string } | { ok: false; error: string } {
    const head = this.runGitCommand(["rev-parse", "HEAD"]);
    if (head.ok && head.stdout) {
      return { ok: true, hash: head.stdout };
    }
    const add = this.runGitCommand(["add", "-A"]);
    if (!add.ok) {
      return {
        ok: false,
        error: `git add failed: ${add.stderr || add.stdout || `code=${add.code}`}`,
      };
    }
    const commit = this.runGitCommand(["commit", "--allow-empty", "-m", "ati(mark): baseline"]);
    if (!commit.ok) {
      return {
        ok: false,
        error: `git commit failed: ${commit.stderr || commit.stdout || `code=${commit.code}`}`,
      };
    }
    const nextHead = this.runGitCommand(["rev-parse", "HEAD"]);
    if (!nextHead.ok || !nextHead.stdout) {
      return {
        ok: false,
        error: `git rev-parse failed: ${nextHead.stderr || nextHead.stdout || `code=${nextHead.code}`}`,
      };
    }
    return { ok: true, hash: nextHead.stdout };
  }
}
