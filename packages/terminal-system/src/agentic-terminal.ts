import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  DEFAULT_TERMINAL_BACKEND,
  TERMINAL_INTERACTION_DEFAULT_OWNER_ID,
  applyTerminalInteractionEvent,
  cloneTerminalInteractionFrameState,
  type TerminalInteractionCapabilities,
  type TerminalInteractionController,
  type TerminalInteractionEvent,
  type TerminalInteractionFrameState,
  type TerminalInteractionOwnerId,
} from "@agenter/termless-core";

import { Committer } from "./committer";
import { TerminalGitLogger } from "./git-log";
import { InputInbox } from "./input-inbox";
import { runMixedInput } from "./input-parser";
import { HtmlPaginationStore } from "./pagination";
import { Pty } from "./pty";
import {
  compactRenderForPersistence,
  renderFullStructuredBuffer,
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
  TerminalPendingInputMode,
  TerminalPendingInputOptions,
  TerminalPendingInputResult,
  TerminalProfile,
  TerminalStatus,
  TerminalStructuredSnapshot,
} from "./types";
import { DEFAULTS } from "./types";
import { createWorkspace, destroyWorkspace } from "./workspace";
import { XtermBridge } from "./xterm-bridge";
import { TerminalObservedIdentityTracker } from "./terminal-observed-identity";
import type { TerminalObservedIdentity } from "./terminal-runtime-truth";

export interface AgenticTerminalExitInfo {
  code: number | null;
  signal: number | string | null;
}

const DEFAULT_STARTUP_SETTLE_TIMEOUT_MS = 3_200;

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
    env: next.env,
    backend: next.backend ?? DEFAULT_TERMINAL_BACKEND,
    debugCursor: next.debugCursor ?? false,
    gitLog: next.gitLog ?? "none",
  };
};

const xmlEscape = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

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
  private readonly outputBytesListeners: Array<(chunk: Uint8Array) => void> = [];
  private readonly exitListeners: Array<(info: AgenticTerminalExitInfo) => void> = [];
  private readonly statusListeners: Array<(status: TerminalStatus) => void> = [];
  private readonly observedIdentityListeners: Array<(identity: TerminalObservedIdentity) => void> = [];
  private readonly renderListeners: Array<(render: ReturnType<typeof renderSemanticBuffer>) => void> = [];
  private readonly structuredListeners: Array<(snapshot: TerminalStructuredSnapshot) => void> = [];
  private readonly outputDecoder = new TextDecoder();
  private readonly gitDecoder = new TextDecoder();
  private readonly observedIdentityTracker = new TerminalObservedIdentityTracker();
  private renderSerial = 0;
  private structuredSerial = 0;
  private debugLogPath = "";
  private gitLogger: TerminalGitLogger | null = null;
  private observedIdentity: TerminalObservedIdentity = {};
  private runtimeGeneration = 0;
  private startupSettled = false;
  private startupSettlePromise: Promise<void> | null = null;
  private startupSettleResolve: (() => void) | null = null;
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
    scrollback: {
      viewportOffset: 0,
      totalLines: 0,
      screenLines: 0,
    },
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
    this.resetObservedIdentity();
    this.runtimeGeneration += 1;
    const runtimeGeneration = this.runtimeGeneration;
    this.startupSettled = false;
    this.startupSettlePromise = new Promise<void>((resolve) => {
      this.startupSettleResolve = resolve;
    });

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
        env: this.profile.env,
      },
    });
    if (this.profile.gitLog !== "none" && this.profile.gitLog !== false) {
      this.gitLogger = new TerminalGitLogger(this.workspace, this.profile.gitLog);
      this.gitLogger.init();
      this.debug("git-log.enabled", { mode: this.profile.gitLog });
    } else {
      this.gitLogger = null;
    }

    this.xterm = new XtermBridge(
      this.profile.cols,
      this.profile.rows,
      undefined,
      this.profile.backend ?? DEFAULT_TERMINAL_BACKEND,
    );
    this.xterm.onTitleChange((title) => {
      this.applyObservedIdentity(this.observedIdentityTracker.applyTitle(title));
    });
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
      this.profile.env,
    );
    this.appliedSize = { cols: this.profile.cols, rows: this.profile.rows };
    this.inbox = new InputInbox({
      inputDir,
      onInput: async (input, sourceFile, mode) => {
        if (mode === "raw") {
          await this.enqueueRawInput(input, `file:${sourceFile}`);
          return;
        }
        await this.enqueueMixedInput(input, `file:${sourceFile}`);
      },
      onError: (error, sourceFile) => {
        this.appendInputLog(`ERROR ${sourceFile}: ${error.message}`, "file:error");
      },
    });

    this.pty.setOnData((chunk) => {
      if (!this.isRuntimeGenerationActive(runtimeGeneration)) {
        return;
      }
      this.settleStartup();
      this.markBusy();
      const outputBytes = chunk.slice();
      const textChunk = this.outputDecoder.decode(chunk, { stream: true });
      this.applyObservedIdentity(this.observedIdentityTracker.consume(textChunk));
      for (const listener of this.outputListeners) {
        listener(textChunk);
      }
      for (const listener of this.outputBytesListeners) {
        listener(outputBytes);
      }
      const xterm = this.xterm;
      const committer = this.committer;
      if (!xterm || !this.pager || !committer) {
        return;
      }

      this.renderQueue = this.renderQueue.then(async () => {
        if (!this.isRuntimeGenerationActive(runtimeGeneration)) {
          return;
        }
        await xterm.write(chunk);
        if (!this.isRuntimeGenerationActive(runtimeGeneration)) {
          return;
        }
        if (this.resizing) {
          return;
        }
        const render = this.buildRenderFromXterm(xterm);
        const compact = compactRenderForPersistence(render);
        this.emitRender(render);
        const scrollback = xterm.getScrollback();
        committer.schedule({
          plainText: compact.plainLines.join("\n"),
          commit: async () => {
            if (!this.isRuntimeGenerationActive(runtimeGeneration)) {
              return;
            }
            this.persistRenderToPager(compact, scrollback.viewportOffset, xterm.rows, xterm.cols, "write");
          },
        });
      });
    });

    this.pty.setOnExit((code, signal) => {
      if (!this.isRuntimeGenerationActive(runtimeGeneration)) {
        return;
      }
      this.markIdle();
      this.debug("pty.exit", { code, signal });
      for (const listener of this.exitListeners) {
        listener({ code, signal });
      }
      void this.committer?.forceCommit().catch(() => {
        // ignore async commit errors after process exit
      });
    });

    try {
      this.pty.start();
      this.inbox.start();
      this.started = true;
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
   * Enqueue raw automation input through the pending inbox.
   * Raw mode is literal PTY input, so callers must include any `\r`, `\n`, or control bytes explicitly.
   */
  public async write(rawInput: string): Promise<TerminalPendingInputResult> {
    this.ensureStarted();
    return await this.enqueuePendingInput(rawInput, { mode: "raw", wait: true });
  }

  /**
   * Enqueue mixed automation input through the pending inbox.
   * Mixed mode supports `<key .../>`, `<wait .../>`, and `<raw>...</raw>`.
   */
  public async input(mixedInput: string): Promise<TerminalPendingInputResult> {
    this.ensureStarted();
    return await this.enqueuePendingInput(mixedInput, { mode: "mixed", wait: true });
  }

  /**
   * Enqueue automation input through `input/pending`, then optionally wait for `done/failed`.
   * `wait` only controls pending completion for the caller; it does not affect mixed DSL
   * actions such as `<wait ms="300"/>` inside the file content itself.
   */
  public async enqueuePendingInput(
    input: string,
    options: TerminalPendingInputOptions,
  ): Promise<TerminalPendingInputResult> {
    this.ensureStarted();
    const mode: TerminalPendingInputMode = options.mode;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const file = `${id}.${mode}.txt`;
    const pendingPath = join(this.workspace, "input", "pending", file);
    const doneFile = `${file}.done`;
    const failedFile = `${file}.failed`;
    const donePath = join(this.workspace, "input", "done", doneFile);
    const failedPath = join(this.workspace, "input", "failed", failedFile);

    writeFileSync(pendingPath, input, "utf8");
    this.appendInputLog(input, `queue:${file}`);
    this.debug("input.enqueue", { id, file, mode });
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
   * Write raw input directly to PTY with no pending-file durability.
   * This is reserved for interactive forwarding such as ATI-CLI / ATI-TUI stdin bridges.
   */
  public writeRaw(input: string): void {
    this.ensureStarted();
    this.pty?.write(input);
  }

  public writeRawBytes(input: Uint8Array): void {
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

  public onOutputBytes(listener: (chunk: Uint8Array) => void): () => void {
    this.outputBytesListeners.push(listener);
    return () => {
      const index = this.outputBytesListeners.indexOf(listener);
      if (index >= 0) {
        this.outputBytesListeners.splice(index, 1);
      }
    };
  }

  public onExit(listener: (info: AgenticTerminalExitInfo) => void): () => void {
    this.exitListeners.push(listener);
    return () => {
      const index = this.exitListeners.indexOf(listener);
      if (index >= 0) {
        this.exitListeners.splice(index, 1);
      }
    };
  }

  public onStatus(listener: (status: TerminalStatus) => void): () => void {
    this.statusListeners.push(listener);
    return () => {
      const index = this.statusListeners.indexOf(listener);
      if (index >= 0) {
        this.statusListeners.splice(index, 1);
      }
    };
  }

  public onObservedIdentity(listener: (identity: TerminalObservedIdentity) => void): () => void {
    this.observedIdentityListeners.push(listener);
    return () => {
      const index = this.observedIdentityListeners.indexOf(listener);
      if (index >= 0) {
        this.observedIdentityListeners.splice(index, 1);
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

  public getFullStructured(): TerminalStructuredSnapshot {
    const xterm = this.xterm;
    if (!xterm) {
      return this.lastStructured;
    }
    const structured = renderFullStructuredBuffer(xterm);
    return {
      ...structured,
      seq: this.structuredSerial,
      timestamp: Date.now(),
      status: this.status,
    };
  }

  public getText(): string {
    return this.xterm?.getText() ?? this.lastRender.plainLines.join("\n");
  }

  public getObservedIdentity(): TerminalObservedIdentity {
    return { ...this.observedIdentity };
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
    const runtimeGeneration = this.runtimeGeneration;
    this.resizeQueue = this.resizeQueue.then(async () => {
      if (!this.isRuntimeGenerationActive(runtimeGeneration)) {
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
        if (!this.isRuntimeGenerationActive(runtimeGeneration)) {
          return;
        }
        const beforeResize = this.buildRenderFromXterm(xterm);
        const beforeScrollback = xterm.getScrollback();
        this.debug("resize.before-seal", {
          lines: beforeResize.lines.length,
          cursor: { row: beforeResize.cursorAbsRow, col: beforeResize.cursorCol },
          viewportOffset: beforeScrollback.viewportOffset,
          rows: xterm.rows,
          cols: xterm.cols,
        });
        const sealedFile = pager.sealForResize(beforeResize.lines.length, {
          cursorRow: beforeResize.cursorAbsRow + 1,
          cursorCol: beforeResize.cursorCol + 1,
          viewportBase: beforeScrollback.viewportOffset,
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
        if (!this.isRuntimeGenerationActive(runtimeGeneration)) {
          return;
        }

        const snapshot = this.buildRenderFromXterm(xterm);
        const compact = compactRenderForPersistence(snapshot);
        const afterScrollback = xterm.getScrollback();
        this.debug("resize.snapshot", {
          lines: snapshot.lines.length,
          cursor: { row: snapshot.cursorAbsRow, col: snapshot.cursorCol },
          viewportOffset: afterScrollback.viewportOffset,
          rows,
          cols,
        });
        this.emitRender(snapshot);
        pager.writeResizeSnapshot(
          this.toPersistenceRender(compact),
          this.status,
          afterScrollback.viewportOffset,
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

  public scrollViewport(deltaRows: number): void {
    this.ensureStarted();
    const delta = Math.trunc(deltaRows);
    if (!Number.isFinite(delta) || delta === 0) {
      return;
    }
    const xterm = this.xterm;
    if (!xterm) {
      return;
    }
    xterm.scrollViewport(delta);
    const render = this.buildRenderFromXterm(xterm);
    this.emitRender(render);
  }

  public setViewportStart(viewportStart: number): void {
    this.ensureStarted();
    const xterm = this.xterm;
    if (!xterm) {
      return;
    }
    xterm.setViewportStart(viewportStart);
    const render = this.buildRenderFromXterm(xterm);
    this.emitRender(render);
  }

  public followCursor(options: { viewportRows?: number } = {}): void {
    this.ensureStarted();
    const xterm = this.xterm;
    if (!xterm) {
      return;
    }
    xterm.followCursor(options);
    const render = this.buildRenderFromXterm(xterm);
    this.emitRender(render);
  }

  public applyInteractionEvent(event: TerminalInteractionEvent): { ok: boolean; selectedText?: string } {
    this.ensureStarted();
    const xterm = this.xterm;
    if (!xterm) {
      return { ok: false };
    }
    const result = applyTerminalInteractionEvent(xterm, event);
    if (result.ok || event.type === "clearSelection") {
      const render = this.buildRenderFromXterm(xterm);
      this.emitRender(render);
    }
    return result;
  }

  public copySelection(ownerId?: string): string {
    this.ensureStarted();
    return this.xterm?.copySelection(ownerId) ?? "";
  }

  public getInteractionCapabilities(): TerminalInteractionCapabilities {
    this.ensureStarted();
    const xterm = this.xterm;
    if (!xterm) {
      return {
        ownership: "unavailable",
        selection: false,
        copy: false,
        semanticSelection: false,
        cursorFollow: false,
        overlay: false,
        reason: "terminal is not started",
      };
    }
    return { ...xterm.interactionCapabilities };
  }

  public getInteractionFrameState(
    ownerId: TerminalInteractionOwnerId = TERMINAL_INTERACTION_DEFAULT_OWNER_ID,
  ): TerminalInteractionFrameState {
    this.ensureStarted();
    return this.buildInteractionFrameState(this.xterm, ownerId);
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
    const scrollback = xterm.getScrollback();
    committer.schedule({
      plainText: compact.plainLines.join("\n"),
      commit: async () => {
        this.persistRenderToPager(compact, scrollback.viewportOffset, xterm.rows, xterm.cols, reason);
      },
    });
    await committer.forceCommit();
  }

  /** Gracefully stop process and optionally keep workspace logs. */
  public async destroy(keepLogs = false): Promise<void> {
    this.destroyed = true;
    this.settleStartup();
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
    this.outputBytesListeners.length = 0;
    this.exitListeners.length = 0;
    this.statusListeners.length = 0;
    this.observedIdentityListeners.length = 0;
    this.renderListeners.length = 0;
    this.structuredListeners.length = 0;
    this.appliedSize = null;
    this.started = false;
    this.status = "IDLE";
    this.resetObservedIdentity();

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
    this.settleStartup();
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
    this.resetObservedIdentity();
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
    const changed = this.status !== "BUSY";
    if (this.status !== "BUSY") {
      this.debug("status", { from: this.status, to: "BUSY" });
    }
    this.status = "BUSY";
    if (changed) {
      this.emitStatus();
    }
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      this.markIdle();
    }, DEFAULTS.idleTimeoutMs);
  }

  private async sliceDirtyOnce(options: TerminalDirtySliceOptions): Promise<TerminalDirtySliceResult> {
    const requestedFromHash = options.fromHash ?? null;
    if (!this.isGitLogEnabled()) {
      return {
        ok: false,
        changed: false,
        fromHash: requestedFromHash,
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
        fromHash: requestedFromHash,
        toHash: null,
        diff: "",
        bytes: 0,
        reason: baseHead.error,
      };
    }

    if (!requestedFromHash) {
      return {
        ok: true,
        changed: false,
        fromHash: null,
        toHash: baseHead.hash,
        diff: "",
        bytes: 0,
      };
    }

    const fromHash = requestedFromHash;
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
      return {
        ok: true,
        changed: false,
        fromHash,
        toHash,
        diff: "",
        bytes: 0,
      };
    }

    const diffResult = this.runGitCommand([
      "diff",
      "--no-color",
      "--patience",
      `${fromHash}..${toHash}`,
      "--",
      "output",
    ]);
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
    const diff = diffResult.stdout;
    const changed = diff.length > 0;
    this.debug("dirty.slice", { fromHash, toHash, bytes: diff.length, changed });
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
    const changed = this.status !== "IDLE";
    if (this.status !== "IDLE") {
      this.debug("status", { from: this.status, to: "IDLE" });
    }
    this.status = "IDLE";
    if (changed) {
      this.emitStatus();
    }
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.started && !this.destroyed) {
      const runtimeGeneration = this.runtimeGeneration;
      this.renderQueue = this.renderQueue.then(async () => {
        if (!this.isRuntimeGenerationActive(runtimeGeneration)) {
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
      await this.awaitStartupSettle();
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

  private enqueueRawInput(rawInput: string, source: string): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      await this.awaitStartupSettle();
      this.appendInputLog(rawInput, source);
      this.pty?.write(rawInput);
    });
    return this.writeQueue;
  }

  private appendInputLog(mixedInput: string, source: string): void {
    const logPath = join(this.workspace, "input", "ai-input.log");
    const stamp = new Date().toISOString();
    appendFileSync(
      logPath,
      `<ai-input timestamp="${stamp}" source="${xmlEscape(source)}">${xmlEscape(mixedInput)}</ai-input>\n`,
      "utf8",
    );
  }

  private toPersistenceRender(compact: RenderResult): RenderResult {
    return {
      ...compact,
      lines: serializeRenderLinesForLog(compact, this.profile.logStyle),
    };
  }

  private emitStatus(): void {
    for (const listener of this.statusListeners) {
      listener(this.status);
    }
  }

  private applyObservedIdentity(next: TerminalObservedIdentity | null): void {
    if (!next) {
      return;
    }
    const currentPath = next.currentPath;
    const currentTitle = next.currentTitle;
    if (this.observedIdentity.currentPath === currentPath && this.observedIdentity.currentTitle === currentTitle) {
      return;
    }
    this.observedIdentity = {
      currentPath,
      currentTitle,
    };
    for (const listener of this.observedIdentityListeners) {
      listener({ ...this.observedIdentity });
    }
  }

  private resetObservedIdentity(): void {
    this.observedIdentityTracker.clear();
    this.observedIdentity = {};
  }

  private buildRenderFromXterm(xterm: XtermBridge): RenderResult {
    const structured = renderStructuredBuffer(xterm);
    const interaction = this.buildInteractionFrameState(xterm);
    this.lastStructured = {
      ...structured,
      interaction,
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
      interaction,
      cursorAbsRow: structured.cursorAbsRow,
      cursorCol: structured.cursorCol,
      cursorVisible: structured.cursorVisible,
    };
  }

  private buildInteractionFrameState(
    controller: TerminalInteractionController | null,
    ownerId: TerminalInteractionOwnerId = TERMINAL_INTERACTION_DEFAULT_OWNER_ID,
  ): TerminalInteractionFrameState {
    if (!controller) {
      return {
        capabilities: {
          [ownerId]: {
            ownership: "unavailable",
            selection: false,
            copy: false,
            semanticSelection: false,
            cursorFollow: false,
            overlay: false,
            reason: "terminal is not started",
          },
        },
      };
    }
    const overlay = controller.getSelectionOverlay(ownerId);
    return (
      cloneTerminalInteractionFrameState({
        activeOwnerId: overlay ? ownerId : undefined,
        selectionOverlays: overlay ? [overlay] : undefined,
        capabilities: {
          [ownerId]: controller.interactionCapabilities,
        },
      }) ?? {}
    );
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
        event:
          beforeArchive !== afterArchive && afterArchive
            ? "archive"
            : reason === "status-idle"
              ? "status-idle"
              : "write",
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

  private isRuntimeGenerationActive(runtimeGeneration: number): boolean {
    return this.started && !this.destroyed && this.runtimeGeneration === runtimeGeneration;
  }

  private settleStartup(): void {
    if (this.startupSettled) {
      return;
    }
    this.startupSettled = true;
    this.startupSettleResolve?.();
    this.startupSettleResolve = null;
  }

  private async awaitStartupSettle(): Promise<void> {
    if (this.startupSettled) {
      return;
    }
    const pending = this.startupSettlePromise;
    if (!pending) {
      return;
    }
    await Promise.race([pending, Bun.sleep(this.getStartupSettleTimeoutMs())]);
    this.settleStartup();
  }

  private getStartupSettleTimeoutMs(): number {
    return this.args.length === 0 ? DEFAULT_STARTUP_SETTLE_TIMEOUT_MS : 250;
  }
}
