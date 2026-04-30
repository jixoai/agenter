import type { RuntimeSystemIngressEnvelope, RuntimeSystemKernelAdapter, RuntimeSystemKernelHost } from "./types";

export interface RuntimeTerminalLifecycleIngressInput {
  terminalId: string;
  contextId: string;
  event: string;
  summary: string;
  payload?: Record<string, unknown>;
  score?: number;
  ingressType?: "commit" | "push";
}

export interface RuntimeTerminalFocusTransitionInput {
  before: readonly string[];
  after: readonly string[];
  op: string;
}

interface RuntimeTerminalKernelAdapterOptions {
  isLoopPaused: () => boolean;
  listFocusedTerminalIds: () => readonly string[];
  isTerminalRunning: (terminalId: string) => boolean;
  getTerminalStatus: (terminalId: string) => "IDLE" | "BUSY" | null;
  getTerminalContextId: (terminalId: string) => string;
  readTerminalIngress: (terminalId: string) => Promise<RuntimeSystemIngressEnvelope | null>;
  buildLifecycleIngressEnvelope: (input: RuntimeTerminalLifecycleIngressInput) => RuntimeSystemIngressEnvelope;
  onTerminalActivitySignal: () => void;
}

export class RuntimeTerminalKernelAdapter implements RuntimeSystemKernelAdapter {
  readonly name = "terminal";

  private host: RuntimeSystemKernelHost | null = null;
  private readonly dirtyTerminalIds = new Set<string>();
  private readonly queuedTerminalIds = new Set<string>();
  private readonly pendingLifecycleIngress: RuntimeSystemIngressEnvelope[] = [];

  constructor(private readonly options: RuntimeTerminalKernelAdapterOptions) {}

  mount(host: RuntimeSystemKernelHost): void {
    this.host = host;
  }

  async bootstrap(): Promise<void> {
    await this.flushPendingLifecycleIngress();
  }

  reset(): void {
    this.dirtyTerminalIds.clear();
    this.queuedTerminalIds.clear();
    this.pendingLifecycleIngress.length = 0;
  }

  hasFocusedDirtyWork(): boolean {
    return this.getFocusedTerminalIds().some(
      (terminalId) => this.dirtyTerminalIds.has(terminalId) && this.options.isTerminalRunning(terminalId),
    );
  }

  markTerminalDirty(terminalId: string): void {
    this.dirtyTerminalIds.add(terminalId);
    if (this.queueFocusedTerminal(terminalId)) {
      this.options.onTerminalActivitySignal();
    }
  }

  markTerminalConsumed(terminalId: string): void {
    this.dirtyTerminalIds.delete(terminalId);
    this.queuedTerminalIds.delete(terminalId);
  }

  syncFocusedDirtyTerminals(): void {
    let signaled = false;
    for (const terminalId of this.getFocusedTerminalIds()) {
      if (this.queueFocusedTerminal(terminalId)) {
        signaled = true;
      }
    }
    if (signaled) {
      this.options.onTerminalActivitySignal();
    }
  }

  recordFocusTransitions(input: RuntimeTerminalFocusTransitionInput): void {
    void input;
  }

  handleStatusChange(input: {
    terminalId: string;
    previousStatus: "IDLE" | "BUSY" | null;
    running: boolean;
    status: "IDLE" | "BUSY";
  }): void {
    if (
      input.previousStatus === "BUSY" &&
      input.status === "IDLE" &&
      input.running &&
      !this.getFocusedTerminalIds().includes(input.terminalId)
    ) {
      this.options.onTerminalActivitySignal();
    }
  }

  commitLifecycleIngress(input: RuntimeTerminalLifecycleIngressInput): void {
    if (
      input.event === "terminal_focus" ||
      input.event === "terminal_unfocus" ||
      input.event === "terminal_idle_ready"
    ) {
      return;
    }
    this.pendingLifecycleIngress.push(this.options.buildLifecycleIngressEnvelope(input));
    void this.flushPendingLifecycleIngress();
  }

  async drainIngress(): Promise<RuntimeSystemIngressEnvelope[] | undefined> {
    if (this.options.isLoopPaused() || this.queuedTerminalIds.size === 0) {
      return undefined;
    }
    const pendingTerminalIds = [...this.queuedTerminalIds];
    this.queuedTerminalIds.clear();

    const envelopes: RuntimeSystemIngressEnvelope[] = [];
    for (const terminalId of pendingTerminalIds) {
      if (!this.dirtyTerminalIds.has(terminalId)) {
        continue;
      }
      if (!this.getFocusedTerminalIds().includes(terminalId)) {
        continue;
      }
      if (this.options.getTerminalStatus(terminalId) === "BUSY") {
        this.queuedTerminalIds.add(terminalId);
        continue;
      }
      const envelope = await this.options.readTerminalIngress(terminalId);
      this.markTerminalConsumed(terminalId);
      if (envelope) {
        envelopes.push(envelope);
      }
    }
    return envelopes.length > 0 ? envelopes : undefined;
  }

  private getFocusedTerminalIds(): readonly string[] {
    return this.options.listFocusedTerminalIds();
  }

  private queueFocusedTerminal(terminalId: string): boolean {
    if (
      !this.dirtyTerminalIds.has(terminalId) ||
      !this.getFocusedTerminalIds().includes(terminalId) ||
      !this.options.isTerminalRunning(terminalId)
    ) {
      return false;
    }
    const sizeBefore = this.queuedTerminalIds.size;
    this.queuedTerminalIds.add(terminalId);
    return this.queuedTerminalIds.size > sizeBefore;
  }

  private async flushPendingLifecycleIngress(): Promise<void> {
    if (!this.host || this.pendingLifecycleIngress.length === 0) {
      return;
    }
    const pending = this.pendingLifecycleIngress.splice(0, this.pendingLifecycleIngress.length);
    for (const envelope of pending) {
      await this.host.commitIngress(envelope, { notifyLoop: true });
    }
  }
}
