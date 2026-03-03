import {
  settingsKindSchema,
  type RuntimeSnapshotPayload,
  type AnyRuntimeEvent,
  type RuntimeEventEnvelope,
  type RuntimeEventType,
} from "./realtime-types";
import { InstanceRegistry, type InstanceMeta } from "./instance-registry";
import { InstanceRuntime, type RuntimeEvent } from "./instance-runtime";
import type { ChatMessage } from "./types";

const now = (): number => Date.now();

type KernelListener = (event: AnyRuntimeEvent) => void;

export interface AppKernelOptions {
  registryPath?: string;
  logger?: {
    log: (line: {
      channel: "agent" | "error";
      level: "debug" | "info" | "warn" | "error";
      message: string;
      meta?: Record<string, string | number | boolean | null>;
    }) => void;
  };
}

export class AppKernel {
  private readonly registry: InstanceRegistry;
  private readonly runtimes = new Map<string, InstanceRuntime>();
  private readonly runtimeStopListeners = new Map<string, () => void>();
  private readonly listeners = new Set<KernelListener>();
  private eventSeq = 0;

  constructor(private readonly options: AppKernelOptions = {}) {
    this.registry = new InstanceRegistry({ filePath: options.registryPath });
  }

  async start(): Promise<void> {
    for (const meta of this.registry.list()) {
      if (!meta.autoStart) {
        continue;
      }
      await this.startInstance(meta.id);
    }
  }

  async stop(): Promise<void> {
    for (const runtime of this.runtimes.values()) {
      await runtime.stop();
    }
    this.runtimes.clear();
    this.runtimeStopListeners.clear();
  }

  getSnapshot(): RuntimeSnapshotPayload {
    const runtimes = Object.fromEntries(
      [...this.runtimes.entries()].map(([instanceId, runtime]) => [instanceId, runtime.snapshot()]),
    );

    return {
      version: 1,
      timestamp: now(),
      lastEventId: this.eventSeq,
      instances: this.registry.list(),
      runtimes,
    };
  }

  onEvent(listener: KernelListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  listInstances(): InstanceMeta[] {
    return this.registry.list();
  }

  getInstance(instanceId: string): InstanceMeta | undefined {
    return this.registry.get(instanceId);
  }

  createInstance(input: { name?: string; cwd: string; autoStart?: boolean }): InstanceMeta {
    const instance = this.registry.create(input);
    this.emit("instance.updated", { instance }, instance.id);
    return instance;
  }

  updateInstance(instanceId: string, patch: { name?: string; autoStart?: boolean }): InstanceMeta {
    const instance = this.registry.update(instanceId, patch);
    this.emit("instance.updated", { instance }, instance.id);
    return instance;
  }

  async deleteInstance(instanceId: string): Promise<{ removed: boolean }> {
    const runtime = this.runtimes.get(instanceId);
    if (runtime) {
      await runtime.stop();
      this.detachRuntime(instanceId);
    }
    const removed = this.registry.remove(instanceId);
    if (removed) {
      this.emit("instance.deleted", { instanceId, removed }, instanceId);
    }
    return { removed };
  }

  async startInstance(instanceId: string): Promise<InstanceMeta> {
    const meta = this.registry.get(instanceId);
    if (!meta) {
      throw new Error(`instance not found: ${instanceId}`);
    }

    const existing = this.runtimes.get(instanceId);
    if (existing?.isStarted()) {
      const running = this.registry.update(instanceId, { status: "running", lastError: undefined });
      this.emit("instance.updated", { instance: running }, instanceId);
      return running;
    }

    this.registry.update(instanceId, { status: "starting", lastError: undefined });
    const runtime = new InstanceRuntime({
      instanceId: meta.id,
      cwd: meta.cwd,
      logger: this.options.logger,
    });

    const unsubscribe = runtime.onEvent((event) => {
      this.forwardRuntimeEvent(meta.id, event);
    });

    this.runtimes.set(instanceId, runtime);
    this.runtimeStopListeners.set(instanceId, unsubscribe);

    try {
      await runtime.start();
      const updated = this.registry.update(instanceId, { status: "running", lastError: undefined });
      this.emit("instance.updated", { instance: updated }, instanceId);
      return updated;
    } catch (error) {
      this.detachRuntime(instanceId);
      const message = error instanceof Error ? error.message : String(error);
      const failed = this.registry.update(instanceId, { status: "error", lastError: message });
      this.emit("instance.updated", { instance: failed }, instanceId);
      throw error;
    }
  }

  async stopInstance(instanceId: string): Promise<InstanceMeta> {
    const runtime = this.runtimes.get(instanceId);
    if (runtime) {
      await runtime.stop();
      this.detachRuntime(instanceId);
    }
    const stopped = this.registry.update(instanceId, { status: "stopped", lastError: undefined });
    this.emit("instance.updated", { instance: stopped }, instanceId);
    return stopped;
  }

  focusTerminal(instanceId: string, terminalId: string): { ok: boolean } {
    const runtime = this.runtimes.get(instanceId);
    if (!runtime) {
      return { ok: false };
    }
    const ok = runtime.focusTerminal(terminalId);
    return { ok };
  }

  sendChat(instanceId: string, text: string): { ok: boolean } {
    const runtime = this.runtimes.get(instanceId);
    if (!runtime) {
      return { ok: false };
    }
    runtime.pushUserChat(text);
    return { ok: true };
  }

  async readSettings(input: { instanceId: string; kind: unknown }): Promise<{ path: string; content: string; mtimeMs: number }> {
    const runtime = await this.ensureRuntime(input.instanceId);
    const kind = settingsKindSchema.parse(input.kind);
    return runtime.readEditable(kind);
  }

  async saveSettings(input: {
    instanceId: string;
    kind: unknown;
    content: string;
    baseMtimeMs: number;
  }): Promise<
    | { ok: true; file: { path: string; content: string; mtimeMs: number } }
    | { ok: false; reason: "conflict"; latest: { path: string; content: string; mtimeMs: number } }
  > {
    const runtime = await this.ensureRuntime(input.instanceId);
    const kind = settingsKindSchema.parse(input.kind);
    return runtime.saveEditable(kind, input.content, input.baseMtimeMs);
  }

  private async ensureRuntime(instanceId: string): Promise<InstanceRuntime> {
    if (this.runtimes.has(instanceId)) {
      return this.runtimes.get(instanceId)!;
    }
    await this.startInstance(instanceId);
    const runtime = this.runtimes.get(instanceId);
    if (!runtime) {
      throw new Error(`runtime not found for instance ${instanceId}`);
    }
    return runtime;
  }

  private detachRuntime(instanceId: string): void {
    this.runtimes.delete(instanceId);
    const unsubscribe = this.runtimeStopListeners.get(instanceId);
    if (unsubscribe) {
      unsubscribe();
      this.runtimeStopListeners.delete(instanceId);
    }
  }

  private forwardRuntimeEvent(instanceId: string, event: RuntimeEvent): void {
    switch (event.type) {
      case "chat":
        this.emit("chat.message", { message: event.payload as ChatMessage }, instanceId, event.timestamp);
        return;
      case "phase":
        this.emit("runtime.phase", { phase: event.payload.phase }, instanceId, event.timestamp);
        return;
      case "stage":
        this.emit("runtime.stage", { stage: event.payload.stage }, instanceId, event.timestamp);
        return;
      case "stats":
        this.emit("runtime.stats", event.payload, instanceId, event.timestamp);
        return;
      case "focusedTerminal":
        this.emit("runtime.focusedTerminal", { terminalId: event.payload.terminalId }, instanceId, event.timestamp);
        return;
      case "terminalSnapshot":
        this.emit("terminal.snapshot", event.payload, instanceId, event.timestamp);
        return;
      case "terminalStatus":
        this.emit("terminal.status", event.payload, instanceId, event.timestamp);
        return;
      case "error":
        this.emit("runtime.error", event.payload, instanceId, event.timestamp);
        return;
    }
  }

  private emit<TType extends RuntimeEventType>(
    type: TType,
    payload: unknown,
    instanceId?: string,
    timestamp = now(),
  ): RuntimeEventEnvelope<TType, unknown> {
    const event: RuntimeEventEnvelope<TType, unknown> = {
      version: 1,
      eventId: ++this.eventSeq,
      timestamp,
      type,
      instanceId,
      payload,
    };
    for (const listener of this.listeners) {
      listener(event);
    }
    return event;
  }
}
