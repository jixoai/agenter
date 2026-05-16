import type {
  ManagedTerminalConfigPatch,
  ManagedTerminalLifecycleEvent,
  ManagedTerminalSnapshot,
  TerminalCommitWaitHandle,
  TerminalRuntime,
} from "./managed-terminal";
import type { TerminalDirtySliceOptions, TerminalDirtySliceResult, TerminalPendingInputResult, TerminalStatus } from "./types";
import type { TerminalObservedIdentity } from "./terminal-runtime-truth";

export interface ProjectionTerminalRuntimeConfig {
  terminalId: string;
  sourceTerminalId: string;
  resolveSourceTerminal(): TerminalRuntime;
}

type SnapshotListener = (snapshot: ManagedTerminalSnapshot) => void;
type StatusListener = (running: boolean, status: TerminalStatus) => void;
type OutputListener = (chunk: string) => void;
type OutputBytesListener = (chunk: Uint8Array) => void;
type LifecycleListener = (event: ManagedTerminalLifecycleEvent) => void;
type IdentityListener = (identity: TerminalObservedIdentity) => void;

export class ProjectionTerminalRuntime implements TerminalRuntime {
  private readonly snapshotListeners: SnapshotListener[] = [];
  private readonly statusListeners: StatusListener[] = [];
  private readonly outputListeners: OutputListener[] = [];
  private readonly outputBytesListeners: OutputBytesListener[] = [];
  private readonly lifecycleListeners: LifecycleListener[] = [];
  private readonly identityListeners: IdentityListener[] = [];
  private source: TerminalRuntime | null = null;
  private cleanup: Array<() => void> = [];
  private stopped = false;
  private snapshot: ManagedTerminalSnapshot;
  private observedIdentity: TerminalObservedIdentity = {};

  constructor(private readonly config: ProjectionTerminalRuntimeConfig) {
    this.attach();
    const source = this.requireSource();
    this.snapshot = source.getSnapshot();
    this.observedIdentity = source.getObservedIdentity();
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
    if (!this.stopped) {
      return;
    }
    this.stopped = false;
    this.attach();
    const source = this.requireSource();
    this.snapshot = source.getSnapshot();
    this.observedIdentity = source.getObservedIdentity();
    this.emitSnapshot(this.snapshot);
    for (const listener of this.identityListeners) {
      listener({ ...this.observedIdentity });
    }
    this.emitLifecycle({
      processPhase: this.isRunning() ? "running" : "stopped",
      lastStopReason: null,
      lastExitCode: null,
      lastExitSignal: null,
      lastStoppedAt: this.isRunning() ? null : Date.now(),
    });
    this.emitStatus(this.isRunning(), this.getStatus());
  }

  async stop(): Promise<void> {
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    this.detach();
    this.emitLifecycle({
      processPhase: "stopped",
      lastStopReason: "killed",
      lastExitCode: null,
      lastExitSignal: null,
      lastStoppedAt: Date.now(),
    });
    this.emitStatus(false, "IDLE");
  }

  isRunning(): boolean {
    return !this.stopped && this.requireSource().isRunning();
  }

  getSnapshot(): ManagedTerminalSnapshot {
    return this.snapshot;
  }

  getStatus(): TerminalStatus {
    return this.stopped ? "IDLE" : this.requireSource().getStatus();
  }

  getObservedIdentity(): TerminalObservedIdentity {
    return { ...this.observedIdentity };
  }

  reconfigure(patch: ManagedTerminalConfigPatch): void {
    if (this.stopped) {
      return;
    }
    const sourcePatch: ManagedTerminalConfigPatch = {};
    if (patch.cols !== undefined) {
      sourcePatch.cols = patch.cols;
    }
    if (patch.rows !== undefined) {
      sourcePatch.rows = patch.rows;
    }
    if (Object.keys(sourcePatch).length > 0) {
      this.requireSource().reconfigure(sourcePatch);
    }
  }

  getHeadHash(): string | null {
    return this.requireSource().getHeadHash();
  }

  waitCommitted(input: { fromHash?: string | null } = {}): TerminalCommitWaitHandle<{ toHash: string | null }> {
    return this.requireSource().waitCommitted(input);
  }

  getWorkspace(): string | null {
    return this.requireSource().getWorkspace();
  }

  getText(): string {
    return this.requireSource().getText();
  }

  resize(cols: number, rows: number): void {
    this.requireSource().resize(cols, rows);
  }

  scrollViewport(deltaRows: number): void {
    this.requireSource().scrollViewport(deltaRows);
  }

  setViewportStart(viewportStart: number): void {
    this.requireSource().setViewportStart(viewportStart);
  }

  followCursor(options?: { viewportRows?: number }): void {
    this.requireSource().followCursor(options);
  }

  applyInteractionEvent(event: Parameters<TerminalRuntime["applyInteractionEvent"]>[0]): ReturnType<TerminalRuntime["applyInteractionEvent"]> {
    return this.requireSource().applyInteractionEvent(event);
  }

  copySelection(ownerId?: string): string {
    return this.requireSource().copySelection(ownerId);
  }

  getInteractionCapabilities(): ReturnType<TerminalRuntime["getInteractionCapabilities"]> {
    return this.requireSource().getInteractionCapabilities();
  }

  getInteractionFrameState(ownerId?: string): ReturnType<TerminalRuntime["getInteractionFrameState"]> {
    return this.requireSource().getInteractionFrameState(ownerId);
  }

  async write(input: string): Promise<TerminalPendingInputResult> {
    return await this.requireSource().write(input);
  }

  async input(mixedInput: string): Promise<TerminalPendingInputResult> {
    return await this.requireSource().input(mixedInput);
  }

  writeRaw(input: string): void {
    this.requireSource().writeRaw(input);
  }

  writeRawBytes(input: Uint8Array): void {
    this.requireSource().writeRawBytes(input);
  }

  async read(): Promise<ManagedTerminalSnapshot> {
    if (!this.isRunning()) {
      throw new Error(`projection terminal ${this.config.terminalId} is not running`);
    }
    return await this.requireSource().read();
  }

  async markDirty(): Promise<{ ok: boolean; hash: string | null; reason?: string }> {
    return await this.requireSource().markDirty();
  }

  async sliceDirty(options: TerminalDirtySliceOptions = {}): Promise<TerminalDirtySliceResult> {
    return await this.requireSource().sliceDirty(options);
  }

  private requireSource(): TerminalRuntime {
    if (!this.source) {
      this.attach();
    }
    if (!this.source) {
      throw new Error(`projection terminal missing source: ${this.config.sourceTerminalId}`);
    }
    return this.source;
  }

  private attach(): void {
    if (this.source) {
      return;
    }
    const source = this.config.resolveSourceTerminal();
    this.source = source;
    this.cleanup = [
      source.onSnapshot((snapshot) => {
        this.snapshot = snapshot;
        this.emitSnapshot(snapshot);
      }),
      source.onStatus((running, status) => {
        this.emitStatus(this.stopped ? false : running, this.stopped ? "IDLE" : status);
      }),
      source.onOutput((chunk) => {
        for (const listener of this.outputListeners) {
          listener(chunk);
        }
      }),
      source.onOutputBytes((chunk) => {
        for (const listener of this.outputBytesListeners) {
          listener(chunk);
        }
      }),
      source.onLifecycle((event) => {
        this.emitLifecycle(event);
      }),
      source.onObservedIdentity((identity) => {
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
    this.source = null;
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
