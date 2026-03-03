import type { RuntimeEvent, RuntimeClientState, SessionInstance } from "./types";
import type { AgenterClient } from "./trpc-client";

const createInitialState = (): RuntimeClientState => ({
  connected: false,
  lastEventId: 0,
  instances: [],
  runtimes: {},
  chatsByInstance: {},
});

type Listener = (state: RuntimeClientState) => void;
type SubscriptionHandle = { unsubscribe: () => void };

const sortInstances = (instances: SessionInstance[]): SessionInstance[] => {
  return [...instances].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

export class RuntimeStore {
  private state: RuntimeClientState = createInitialState();
  private readonly listeners = new Set<Listener>();
  private eventSub: SubscriptionHandle | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private connecting = false;
  private shouldReconnect = false;

  constructor(private readonly client: AgenterClient) {}

  getState(): RuntimeClientState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async connect(): Promise<void> {
    this.shouldReconnect = true;
    await this.connectOnce();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.reconnectAttempt = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.eventSub?.unsubscribe();
    this.eventSub = null;
    this.state = {
      ...this.state,
      connected: false,
    };
    this.emit();
    this.client.close();
  }

  private async connectOnce(): Promise<void> {
    if (this.connecting) {
      return;
    }
    this.connecting = true;

    try {
      const snapshot = await this.client.trpc.runtime.snapshot.query();
      this.state = {
        ...this.state,
        connected: true,
        instances: sortInstances(snapshot.instances),
        runtimes: snapshot.runtimes,
        lastEventId: snapshot.lastEventId,
      };
      this.emit();

      this.reconnectAttempt = 0;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      this.eventSub?.unsubscribe();
      this.eventSub = this.client.trpc.runtime.events.subscribe(
        { afterEventId: snapshot.lastEventId },
        {
          onData: (event) => {
            this.applyEvent(event);
            this.state = { ...this.state, connected: true };
            this.emit();
          },
          onError: () => {
            this.handleConnectionLoss();
          },
        },
      );
    } catch {
      this.handleConnectionLoss();
    } finally {
      this.connecting = false;
    }
  }

  private handleConnectionLoss(): void {
    this.state = { ...this.state, connected: false };
    this.emit();

    if (!this.shouldReconnect || this.reconnectTimer) {
      return;
    }

    const delayMs = Math.min(250 * 2 ** this.reconnectAttempt, 4_000);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connectOnce();
    }, delayMs);
  }

  async createInstance(input: { cwd: string; name?: string; autoStart?: boolean }): Promise<void> {
    await this.client.trpc.session.create.mutate(input);
  }

  async startInstance(instanceId: string): Promise<void> {
    await this.client.trpc.session.start.mutate({ instanceId });
  }

  async stopInstance(instanceId: string): Promise<void> {
    await this.client.trpc.session.stop.mutate({ instanceId });
  }

  async deleteInstance(instanceId: string): Promise<void> {
    await this.client.trpc.session.delete.mutate({ instanceId });
  }

  async sendChat(instanceId: string, text: string): Promise<void> {
    await this.client.trpc.chat.send.mutate({ instanceId, text });
  }

  async readSettings(instanceId: string, kind: "settings" | "agenter" | "system" | "template" | "contract") {
    return await this.client.trpc.settings.read.query({ instanceId, kind });
  }

  async saveSettings(input: {
    instanceId: string;
    kind: "settings" | "agenter" | "system" | "template" | "contract";
    content: string;
    baseMtimeMs: number;
  }) {
    return await this.client.trpc.settings.save.mutate(input);
  }

  private applyEvent(event: RuntimeEvent): void {
    if (event.eventId <= this.state.lastEventId) {
      return;
    }
    this.state.lastEventId = event.eventId;

    if (event.type === "instance.updated") {
      const payload = event.payload as { instance: SessionInstance };
      const next = this.state.instances.filter((item) => item.id !== payload.instance.id);
      next.push(payload.instance);
      this.state.instances = sortInstances(next);
      return;
    }

    if (event.type === "instance.deleted") {
      const payload = event.payload as { instanceId: string };
      this.state.instances = this.state.instances.filter((item) => item.id !== payload.instanceId);
      delete this.state.runtimes[payload.instanceId];
      delete this.state.chatsByInstance[payload.instanceId];
      return;
    }

    if (event.type === "chat.message") {
      const payload = event.payload as {
        message: {
          id: string;
          role: "user" | "assistant";
          content: string;
          timestamp: number;
        };
      };
      const instanceId = event.instanceId;
      if (!instanceId) {
        return;
      }
      const current = this.state.chatsByInstance[instanceId] ?? [];
      this.state.chatsByInstance[instanceId] = [...current, payload.message].slice(-200);
      return;
    }

    if (event.type === "runtime.phase" || event.type === "runtime.stage" || event.type === "runtime.stats" || event.type === "runtime.focusedTerminal" || event.type === "terminal.snapshot" || event.type === "terminal.status" || event.type === "runtime.error") {
      const instanceId = event.instanceId;
      if (!instanceId) {
        return;
      }
      const runtime = this.state.runtimes[instanceId];
      if (!runtime) {
        return;
      }
      if (event.type === "runtime.phase") {
        runtime.loopPhase = (event.payload as { phase: typeof runtime.loopPhase }).phase;
      } else if (event.type === "runtime.stage") {
        runtime.stage = (event.payload as { stage: typeof runtime.stage }).stage;
      } else if (event.type === "runtime.focusedTerminal") {
        runtime.focusedTerminalId = (event.payload as { terminalId: string }).terminalId;
      } else if (event.type === "terminal.status") {
        const payload = event.payload as { terminalId: string; running: boolean; status: "IDLE" | "BUSY" };
        runtime.terminals = runtime.terminals.map((item) =>
          item.terminalId === payload.terminalId
            ? {
                ...item,
                running: payload.running,
                status: payload.status,
              }
            : item,
        );
      } else if (event.type === "terminal.snapshot") {
        const payload = event.payload as { terminalId: string; snapshot: { seq: number } };
        runtime.terminals = runtime.terminals.map((item) =>
          item.terminalId === payload.terminalId
            ? {
                ...item,
                seq: payload.snapshot.seq,
              }
            : item,
        );
      }
    }
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

export const createRuntimeStore = (client: AgenterClient): RuntimeStore => new RuntimeStore(client);
