import type {
  LoopBusInput,
  LoopBusLogger,
  LoopBusMessage,
  LoopBusResponse,
  LoopBusState,
  LoopBusTraceEntry,
  LoopBusWakeSource,
  LoopChatMessage,
  LoopTerminalCommand,
  LoopToolCall,
} from "./loop-bus";
import { LoopBus } from "./loop-bus";

export interface AgentRuntimeProcessor<
  TChatMessage extends LoopChatMessage = LoopChatMessage,
  TStage extends string = string,
> {
  send: (messages: LoopBusMessage[]) => Promise<LoopBusResponse<TChatMessage, TStage> | void>;
}

export interface AgentRuntimeConfig<
  TChatMessage extends LoopChatMessage = LoopChatMessage,
  TStage extends string = string,
> {
  processor: AgentRuntimeProcessor<TChatMessage, TStage>;
  logger: LoopBusLogger;
  waitForCommit: () => Promise<LoopBusWakeSource | void>;
  collectInputs: () => Promise<LoopBusInput[] | LoopBusInput | void>;
  persistCycle: (input: { wakeSource: LoopBusWakeSource; inputs: LoopBusInput[] }) => Promise<{ cycleId: number }>;
  onUserMessage?: (message: TChatMessage, context: { cycleId: number }) => Promise<void> | void;
  onTerminalDispatch?: (command: LoopTerminalCommand, context: { cycleId: number }) => Promise<void> | void;
  onToolCall?: (calls: LoopToolCall[], context: { cycleId: number }) => Promise<void> | void;
  onLoopStateChange?: (state: LoopBusState) => Promise<void> | void;
  onLoopTrace?: (entry: LoopBusTraceEntry) => Promise<void> | void;
}

export class AgentRuntime<TChatMessage extends LoopChatMessage = LoopChatMessage, TStage extends string = string> {
  private readonly bus: LoopBus<TChatMessage, TStage>;

  constructor(config: AgentRuntimeConfig<TChatMessage, TStage>) {
    this.bus = new LoopBus<TChatMessage, TStage>({
      processor: config.processor,
      logger: config.logger,
      waitForCommit: config.waitForCommit,
      collectInputs: config.collectInputs,
      persistCycle: config.persistCycle,
      onUserMessage: config.onUserMessage,
      onTerminalDispatch: config.onTerminalDispatch,
      onToolCall: config.onToolCall,
      onStateChange: config.onLoopStateChange,
      onTrace: config.onLoopTrace,
    });
  }

  start(): void {
    this.bus.start();
  }

  stop(): void {
    this.bus.stop();
  }

  pause(): void {
    this.bus.pause();
  }

  resume(): void {
    this.bus.resume();
  }

  getLoopState(): LoopBusState {
    return this.bus.getState();
  }
}
