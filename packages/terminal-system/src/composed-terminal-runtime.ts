import type {
  ManagedTerminalConfigPatch,
  ManagedTerminalLifecycleEvent,
  ManagedTerminalSnapshot,
  TerminalCommitWaitHandle,
  TerminalRuntime,
} from "./managed-terminal";
import type { TerminalDirtySliceOptions, TerminalDirtySliceResult, TerminalPendingInputResult, TerminalStatus } from "./types";
import type { TerminalObservedIdentity } from "./terminal-runtime-truth";

export interface ComposedTerminalRuntimeConfig {
  terminalId: string;
  resolveShellTerminal(): TerminalRuntime;
  resolveInitialSnapshot: () => ManagedTerminalSnapshot;
}

type SnapshotListener = (snapshot: ManagedTerminalSnapshot) => void;
type StatusListener = (running: boolean, status: TerminalStatus) => void;
type OutputListener = (chunk: string) => void;
type OutputBytesListener = (chunk: Uint8Array) => void;
type LifecycleListener = (event: ManagedTerminalLifecycleEvent) => void;
type IdentityListener = (identity: TerminalObservedIdentity) => void;

const normalizePlainLine = (line: string | undefined, cols: number): string => {
  const source = line ?? "";
  if (source.length >= cols) {
    return source.slice(0, cols);
  }
  return source.padEnd(cols, " ");
};

const normalizeLines = (lines: readonly string[], rows: number, cols: number): string[] =>
  Array.from({ length: Math.max(1, rows) }, (_, index) => normalizePlainLine(lines[index], Math.max(1, cols)));

const normalizeRichLines = (
  richLines: ManagedTerminalSnapshot["richLines"],
  rows: number,
  cols: number,
): ManagedTerminalSnapshot["richLines"] =>
  Array.from({ length: Math.max(1, rows) }, (_, index) => {
    const source = richLines?.[index];
    if (source) {
      return {
        spans: source.spans.map((span) => ({ ...span })),
      };
    }
    const fallbackText = "".padEnd(Math.max(1, cols), " ");
    return {
      spans: fallbackText.length > 0 ? [{ text: fallbackText }] : [],
    };
  });

export class ComposedTerminalRuntime implements TerminalRuntime {
  private readonly snapshotListeners: SnapshotListener[] = [];
  private readonly statusListeners: StatusListener[] = [];
  private readonly outputListeners: OutputListener[] = [];
  private readonly outputBytesListeners: OutputBytesListener[] = [];
  private readonly lifecycleListeners: LifecycleListener[] = [];
  private readonly identityListeners: IdentityListener[] = [];
  private shell: TerminalRuntime | null = null;
  private cleanup: Array<() => void> = [];
  private snapshot: ManagedTerminalSnapshot;
  private observedIdentity: TerminalObservedIdentity = {};
  private running = false;
  private status: TerminalStatus = "IDLE";
  private needsSourceReadRefresh = false;

  constructor(private readonly config: ComposedTerminalRuntimeConfig) {
    this.snapshot = this.config.resolveInitialSnapshot();
    this.attach();
  }

  onSnapshot(listener: SnapshotListener): () => void {
    this.snapshotListeners.push(listener);
    return () => {
      const index = this.snapshotListeners.indexOf(listener);
      if (index >= 0) {
        this.snapshotListeners.splice(index, 1);
      }
    };
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.push(listener);
    return () => {
      const index = this.statusListeners.indexOf(listener);
      if (index >= 0) {
        this.statusListeners.splice(index, 1);
      }
    };
  }

  onOutput(listener: OutputListener): () => void {
    this.outputListeners.push(listener);
    return () => {
      const index = this.outputListeners.indexOf(listener);
      if (index >= 0) {
        this.outputListeners.splice(index, 1);
      }
    };
  }

  onOutputBytes(listener: OutputBytesListener): () => void {
    this.outputBytesListeners.push(listener);
    return () => {
      const index = this.outputBytesListeners.indexOf(listener);
      if (index >= 0) {
        this.outputBytesListeners.splice(index, 1);
      }
    };
  }

  onLifecycle(listener: LifecycleListener): () => void {
    this.lifecycleListeners.push(listener);
    return () => {
      const index = this.lifecycleListeners.indexOf(listener);
      if (index >= 0) {
        this.lifecycleListeners.splice(index, 1);
      }
    };
  }

  onObservedIdentity(listener: IdentityListener): () => void {
    this.identityListeners.push(listener);
    return () => {
      const index = this.identityListeners.indexOf(listener);
      if (index >= 0) {
        this.identityListeners.splice(index, 1);
      }
    };
  }

  start(): void {
    this.snapshot = this.config.resolveInitialSnapshot();
    this.running = this.shell?.isRunning() ?? false;
    this.status = this.shell?.getStatus() ?? "IDLE";
    this.emitSnapshot(this.snapshot);
    this.emitStatus(this.running, this.status);
  }

  async stop(): Promise<void> {
    this.detach();
    this.running = false;
    this.status = "IDLE";
    this.emitStatus(false, "IDLE");
  }

  isRunning(): boolean {
    return this.running;
  }

  getSnapshot(): ManagedTerminalSnapshot {
    return this.snapshot;
  }

  getStatus(): TerminalStatus {
    return this.status;
  }

  getObservedIdentity(): TerminalObservedIdentity {
    return { ...this.observedIdentity };
  }

  reconfigure(patch: ManagedTerminalConfigPatch): void {
    const cols = patch.cols ?? this.snapshot.cols;
    const rows = patch.rows ?? this.snapshot.rows;
    if (cols === this.snapshot.cols && rows === this.snapshot.rows) {
      return;
    }
    this.snapshot = {
      ...this.snapshot,
      cols,
      rows,
      scrollback: {
        ...this.snapshot.scrollback,
        screenLines: rows,
      },
    };
    this.emitSnapshot(this.snapshot);
  }

  getHeadHash(): string | null {
    return this.requireShell().getHeadHash();
  }

  async sealIdleCommit(): Promise<{ ok: boolean; hash: string | null; reason?: string }> {
    return await this.requireShell().sealIdleCommit();
  }

  waitCommitted(input: { fromHash?: string | null } = {}): TerminalCommitWaitHandle<{ toHash: string | null }> {
    return this.requireShell().waitCommitted(input);
  }

  getWorkspace(): string | null {
    return this.requireShell().getWorkspace();
  }

  getText(): string {
    return this.snapshot.lines.join("\n");
  }

  resize(cols: number, rows: number): void {
    this.snapshot = {
      ...this.snapshot,
      seq: this.snapshot.seq + 1,
      timestamp: Date.now(),
      cols,
      rows,
      lines: normalizeLines(this.snapshot.lines, rows, cols),
      richLines: normalizeRichLines(this.snapshot.richLines, rows, cols),
      cursor: {
        ...this.snapshot.cursor,
        x: Math.max(0, Math.min(this.snapshot.cursor.x, Math.max(0, cols - 1))),
        y: Math.max(0, Math.min(this.snapshot.cursor.y, Math.max(0, rows - 1))),
      },
      scrollback: {
        ...this.snapshot.scrollback,
        totalLines: Math.max(rows, this.snapshot.scrollback.totalLines),
        screenLines: rows,
      },
    };
    this.requireShell().resize(cols, rows);
    this.emitSnapshot(this.snapshot);
  }

  scrollViewport(deltaRows: number): void {
    this.requireShell().scrollViewport(deltaRows);
  }

  setViewportStart(viewportStart: number): void {
    this.requireShell().setViewportStart(viewportStart);
  }

  followCursor(options?: { viewportRows?: number }): void {
    this.requireShell().followCursor(options);
  }

  applyInteractionEvent(event: Parameters<TerminalRuntime["applyInteractionEvent"]>[0]): ReturnType<TerminalRuntime["applyInteractionEvent"]> {
    return this.requireShell().applyInteractionEvent(event);
  }

  copySelection(ownerId?: string): string {
    return this.requireShell().copySelection(ownerId);
  }

  getInteractionCapabilities(): ReturnType<TerminalRuntime["getInteractionCapabilities"]> {
    return this.requireShell().getInteractionCapabilities();
  }

  getInteractionFrameState(ownerId?: string): ReturnType<TerminalRuntime["getInteractionFrameState"]> {
    return this.requireShell().getInteractionFrameState(ownerId);
  }

  async write(input: string): Promise<TerminalPendingInputResult> {
    const result = await this.requireShell().write(input);
    if (result.ok) {
      this.needsSourceReadRefresh = true;
    }
    return result;
  }

  async input(mixedInput: string): Promise<TerminalPendingInputResult> {
    const result = await this.requireShell().input(mixedInput);
    if (result.ok) {
      this.needsSourceReadRefresh = true;
    }
    return result;
  }

  writeRaw(input: string): void {
    this.requireShell().writeRaw(input);
  }

  writeRawBytes(input: Uint8Array): void {
    this.requireShell().writeRawBytes(input);
  }

  async read(): Promise<ManagedTerminalSnapshot> {
    if (this.needsSourceReadRefresh) {
      this.needsSourceReadRefresh = false;
      return await this.refreshFromShellRead();
    }
    return this.snapshot;
  }

  async markDirty(): Promise<{ ok: boolean; hash: string | null; reason?: string }> {
    return await this.requireShell().markDirty();
  }

  async sliceDirty(options: TerminalDirtySliceOptions = {}): Promise<TerminalDirtySliceResult> {
    return await this.requireShell().sliceDirty(options);
  }

  publishSnapshot(snapshot: ManagedTerminalSnapshot): void {
    this.snapshot = {
      ...snapshot,
      lines: normalizeLines(snapshot.lines, snapshot.rows, snapshot.cols),
      richLines: normalizeRichLines(snapshot.richLines, snapshot.rows, snapshot.cols),
    };
    this.emitSnapshot(this.snapshot);
  }

  publishComposedSurface(input: {
    snapshot: ManagedTerminalSnapshot;
    running?: boolean;
    status?: TerminalStatus;
    observedIdentity?: TerminalObservedIdentity;
  }): void {
    this.snapshot = {
      ...input.snapshot,
      lines: normalizeLines(input.snapshot.lines, input.snapshot.rows, input.snapshot.cols),
      richLines: normalizeRichLines(input.snapshot.richLines, input.snapshot.rows, input.snapshot.cols),
    };
    if (input.observedIdentity) {
      this.observedIdentity = { ...input.observedIdentity };
      for (const listener of this.identityListeners) {
        listener({ ...this.observedIdentity });
      }
    }
    if (typeof input.running === "boolean") {
      this.running = input.running;
    }
    if (input.status) {
      this.status = input.status;
    }
    this.emitSnapshot(this.snapshot);
    this.emitStatus(this.running, this.status);
  }

  private requireShell(): TerminalRuntime {
    if (!this.shell) {
      this.attach();
    }
    if (!this.shell) {
      throw new Error(`composed terminal missing shell source: ${this.config.terminalId}`);
    }
    return this.shell;
  }

  private async refreshFromShellRead(): Promise<ManagedTerminalSnapshot> {
    const shellSnapshot = await this.requireShell().read();
    return this.replaceWithShellSnapshot(shellSnapshot);
  }

  private replaceWithShellSnapshot(shellSnapshot: ManagedTerminalSnapshot): ManagedTerminalSnapshot {
    this.snapshot = {
      ...shellSnapshot,
      lines: normalizeLines(shellSnapshot.lines, shellSnapshot.rows, shellSnapshot.cols),
      richLines: normalizeRichLines(shellSnapshot.richLines, shellSnapshot.rows, shellSnapshot.cols),
    };
    this.emitSnapshot(this.snapshot);
    return this.snapshot;
  }

  private attach(): void {
    if (this.shell) {
      return;
    }
    const shell = this.config.resolveShellTerminal();
    this.shell = shell;
    this.observedIdentity = shell.getObservedIdentity();
    this.running = shell.isRunning();
    this.status = shell.getStatus();
    this.cleanup = [
      shell.onSnapshot(() => undefined),
      shell.onStatus((running, status) => {
        this.running = running;
        this.status = status;
        this.emitStatus(running, status);
      }),
      shell.onOutput(() => undefined),
      shell.onOutputBytes(() => undefined),
      shell.onLifecycle((event) => {
        this.emitLifecycle(event);
      }),
      shell.onObservedIdentity((identity) => {
        this.observedIdentity = { ...identity };
        for (const listener of this.identityListeners) {
          listener({ ...identity });
        }
      }),
    ];
  }

  private detach(): void {
    for (const release of this.cleanup) {
      release();
    }
    this.cleanup = [];
    this.shell = null;
  }

  private emitSnapshot(snapshot: ManagedTerminalSnapshot): void {
    for (const listener of this.snapshotListeners) {
      listener(snapshot);
    }
  }

  private emitStatus(running: boolean, status: TerminalStatus): void {
    for (const listener of this.statusListeners) {
      listener(running, status);
    }
  }

  private emitLifecycle(event: ManagedTerminalLifecycleEvent): void {
    for (const listener of this.lifecycleListeners) {
      listener(event);
    }
  }
}
