import type {
  LoopBusInput,
  LoopBusLogger,
  LoopBusMessage,
  LoopBusResponse,
  LoopChatMessage,
  LoopBusState,
  LoopTerminalCommand,
  LoopToolCall,
} from "./loop-bus";
import { LoopBus } from "./loop-bus";

export interface AgentRuntimeProcessor<TChatMessage extends LoopChatMessage = LoopChatMessage, TStage extends string = string> {
  send: (messages: LoopBusMessage[]) => Promise<LoopBusResponse<TChatMessage, TStage> | void>;
}

export interface AgentRuntimeConfig<TChatMessage extends LoopChatMessage = LoopChatMessage, TStage extends string = string> {
  processor: AgentRuntimeProcessor<TChatMessage, TStage>;
  logger: LoopBusLogger;
  collectInputs?: () => Promise<LoopBusInput[] | LoopBusInput | void>;
  onUserMessage?: (message: TChatMessage) => Promise<void> | void;
  onTerminalDispatch?: (command: LoopTerminalCommand) => Promise<void> | void;
  onToolCall?: (calls: LoopToolCall[]) => Promise<LoopBusInput[] | LoopBusInput | void>;
  onLoopStateChange?: (state: LoopBusState) => Promise<void> | void;
}

/**
 * AgentRuntime is the app-server composition root for continuous loop processing.
 * It wraps LoopBus to provide a single server-side runtime entry.
 */
export class AgentRuntime<TChatMessage extends LoopChatMessage = LoopChatMessage, TStage extends string = string> {
  private readonly bus: LoopBus<TChatMessage, TStage>;

  constructor(private readonly config: AgentRuntimeConfig<TChatMessage, TStage>) {
    this.bus = new LoopBus<TChatMessage, TStage>({
      processor: config.processor,
      logger: config.logger,
      collectInputs: config.collectInputs,
      onUserMessage: config.onUserMessage,
      onTerminalDispatch: config.onTerminalDispatch,
      onToolCall: config.onToolCall,
      onStateChange: config.onLoopStateChange,
    });
  }

  start(): void {
    this.bus.start();
  }

  stop(): void {
    this.bus.stop();
  }

  pushMessage(message: LoopBusInput): LoopBusMessage {
    return this.bus.pushMessage(message);
  }
}
