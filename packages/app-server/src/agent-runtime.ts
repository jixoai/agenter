import type {
  LoopBusInput,
  LoopBusLogger,
  LoopBusMessage,
  LoopBusState,
  LoopBusTraceEntry,
  LoopBusWakeSource,
} from "./loop-bus";
import { LoopBus } from "./loop-bus";

export interface AgentRuntimeProcessor {
  send: (messages: LoopBusMessage[], context?: { signal?: AbortSignal }) => Promise<unknown | void>;
}

export interface AgentRuntimeConfig {
  processor: AgentRuntimeProcessor;
  logger: LoopBusLogger;
  waitForCommit: () => Promise<LoopBusWakeSource | void>;
  collectInputs: () => Promise<LoopBusInput[] | LoopBusInput | void>;
  persistCycle: (input: { wakeSource: LoopBusWakeSource; inputs: LoopBusMessage[] }) => Promise<{ cycleId: number }>;
  onLoopStateChange?: (state: LoopBusState) => Promise<void> | void;
  onLoopTrace?: (entry: LoopBusTraceEntry) => Promise<void> | void;
}

export class AgentRuntime {
  private readonly bus: LoopBus;

  constructor(config: AgentRuntimeConfig) {
    this.bus = new LoopBus({
      processor: config.processor,
      logger: config.logger,
      waitForCommit: config.waitForCommit,
      collectInputs: config.collectInputs,
      persistCycle: config.persistCycle,
      onStateChange: config.onLoopStateChange,
      onTrace: config.onLoopTrace,
    });
  }

  start(): void {
    this.bus.start();
  }

  async stop(reason?: unknown): Promise<void> {
    await this.bus.stop(reason);
  }

  pause(reason?: unknown): void {
    this.bus.pause(reason);
  }

  resume(): void {
    this.bus.resume();
  }

  getLoopState(): LoopBusState {
    return this.bus.getState();
  }
}
