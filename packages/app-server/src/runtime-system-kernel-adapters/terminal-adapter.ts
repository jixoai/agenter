import type { RuntimeSystemIngressEnvelope, RuntimeSystemKernelAdapter, RuntimeSystemKernelHost } from "./types";

const TERMINAL_IDLE_UNREAD_ATTENTION_SCORE = 100;

export interface RuntimeTerminalLifecycleIngressInput {
  terminalId: string;
  contextId: string;
  event: string;
  summary: string;
  payload?: Record<string, unknown>;
  score?: number;
  ingressType?: "commit" | "push";
  boundaryChannel?: RuntimeSystemIngressEnvelope["boundaryChannel"];
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
  getTerminalHeadHash: (terminalId: string) => Promise<string | null>;
  getTerminalReadCursorHash: (terminalId: string) => string | null;
  getTerminalContextId: (terminalId: string) => string;
  isTerminalActionable: (terminalId: string) => boolean;
  readTerminalIngress: (terminalId: string) => Promise<RuntimeSystemIngressEnvelope | null>;
  buildLifecycleIngressEnvelope: (input: RuntimeTerminalLifecycleIngressInput) => RuntimeSystemIngressEnvelope;
  onTerminalActionableSignal: (input: { terminalId: string; reason: string }) => void;
}

export class RuntimeTerminalKernelAdapter implements RuntimeSystemKernelAdapter {
  readonly name = "terminal";

  private host: RuntimeSystemKernelHost | null = null;
  private readonly dirtyTerminalIds = new Set<string>();
  private readonly queuedTerminalIds = new Set<string>();
  private readonly pendingIdleReadTerminalIds = new Set<string>();
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
      (terminalId) =>
        this.dirtyTerminalIds.has(terminalId) &&
        this.options.isTerminalRunning(terminalId) &&
        this.options.isTerminalActionable(terminalId),
    );
  }

  markTerminalDirty(terminalId: string): void {
    this.dirtyTerminalIds.add(terminalId);
    if (this.queueFocusedTerminal(terminalId)) {
      this.options.onTerminalActionableSignal({
        terminalId,
        reason: "terminal.actionable",
      });
    }
  }

  markTerminalConsumed(terminalId: string): void {
    this.dirtyTerminalIds.delete(terminalId);
    this.queuedTerminalIds.delete(terminalId);
  }

  syncFocusedDirtyTerminals(): void {
    const actionableTerminalIds: string[] = [];
    for (const terminalId of this.getFocusedTerminalIds()) {
      if (this.queueFocusedTerminal(terminalId)) {
        actionableTerminalIds.push(terminalId);
      }
    }
    for (const terminalId of actionableTerminalIds) {
      this.options.onTerminalActionableSignal({
        terminalId,
        reason: "terminal.focused-actionable",
      });
    }
  }

  recordFocusTransitions(input: RuntimeTerminalFocusTransitionInput): void {
    void input;
  }

  async handleStatusChange(input: {
    terminalId: string;
    previousStatus: "IDLE" | "BUSY" | null;
    running: boolean;
    status: "IDLE" | "BUSY";
  }): Promise<void> {
    if (input.previousStatus === "BUSY" && input.status === "IDLE" && input.running) {
      await this.commitIdleUnreadTerminal(input.terminalId);
    }
    if (
      input.previousStatus === "BUSY" &&
      input.status === "IDLE" &&
      input.running &&
      !this.getFocusedTerminalIds().includes(input.terminalId) &&
      this.options.isTerminalActionable(input.terminalId)
    ) {
      this.options.onTerminalActionableSignal({
        terminalId: input.terminalId,
        reason: "terminal.idle-actionable",
      });
    }
  }

  async commitLifecycleIngress(input: RuntimeTerminalLifecycleIngressInput): Promise<void> {
    if (
      input.event === "terminal_focus" ||
      input.event === "terminal_unfocus" ||
      input.event === "terminal_idle_ready"
    ) {
      return;
    }
    this.pendingLifecycleIngress.push(this.options.buildLifecycleIngressEnvelope(input));
    await this.flushPendingLifecycleIngress();
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
      if (!this.options.isTerminalActionable(terminalId)) {
        this.markTerminalConsumed(terminalId);
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
      !this.options.isTerminalRunning(terminalId) ||
      !this.options.isTerminalActionable(terminalId)
    ) {
      return false;
    }
    const sizeBefore = this.queuedTerminalIds.size;
    this.queuedTerminalIds.add(terminalId);
    return this.queuedTerminalIds.size > sizeBefore;
  }

  private async commitIdleUnreadTerminal(terminalId: string): Promise<void> {
    if (
      !this.host ||
      this.pendingIdleReadTerminalIds.has(terminalId) ||
      !this.getFocusedTerminalIds().includes(terminalId) ||
      !this.options.isTerminalRunning(terminalId) ||
      !this.options.isTerminalActionable(terminalId)
    ) {
      return;
    }
    const headHash = await this.options.getTerminalHeadHash(terminalId);
    if (!this.isUnreadHead(headHash, this.options.getTerminalReadCursorHash(terminalId))) {
      return;
    }
    this.pendingIdleReadTerminalIds.add(terminalId);
    try {
      // Raw/live PTY traffic does not create terminal_write activity. The IDLE
      // bridge therefore keys off terminal git truth and the actor read cursor.
      const envelope = await this.options.readTerminalIngress(terminalId);
      this.markTerminalConsumed(terminalId);
      if (!envelope) {
        return;
      }
      await this.host.commitIngress(this.promoteIdleUnreadEnvelope(envelope), {
        notifyLoop: true,
      });
    } finally {
      this.pendingIdleReadTerminalIds.delete(terminalId);
    }
  }

  private isUnreadHead(headHash: string | null, readCursorHash: string | null): boolean {
    return headHash !== null && headHash !== readCursorHash;
  }

  private promoteIdleUnreadEnvelope(envelope: RuntimeSystemIngressEnvelope): RuntimeSystemIngressEnvelope {
    return {
      ...envelope,
      score: Math.max(envelope.score ?? 0, TERMINAL_IDLE_UNREAD_ATTENTION_SCORE),
      ingressType: envelope.ingressType ?? "commit",
      tags: [...(envelope.tags ?? []), "idle-unread"],
    };
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
