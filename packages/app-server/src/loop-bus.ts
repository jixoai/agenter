const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export interface LoopBusMeta {
  [key: string]: string | number | boolean | null;
}

export interface LoopBusMessage {
  id: string;
  timestamp: number;
  name: string;
  role: "user" | "tool";
  type: "text";
  source: "chat" | "terminal" | "tool" | "task" | "chat-system";
  text: string;
  meta?: LoopBusMeta;
}

export interface LoopTerminalCommand {
  taskId: string;
  terminalId: string;
  text: string;
  submit: boolean;
  submitKey?: "enter" | "linefeed";
}

export interface LoopToolCall {
  id: string;
  name: string;
  input: string;
}

export interface LoopChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface LoopBusResponse<
  TChatMessage extends LoopChatMessage = LoopChatMessage,
  TStage extends string = string,
> {
  taskId?: string;
  stage?: TStage;
  summary?: string;
  done?: boolean;
  outputs?: Partial<LoopBusOutputs<TChatMessage>>;
  user?: TChatMessage;
  terminal?: LoopTerminalCommand[];
  tools?: LoopToolCall[];
}

export interface LoopBusOutputs<TChatMessage extends LoopChatMessage = LoopChatMessage> {
  toUser: TChatMessage[];
  toTerminal: LoopTerminalCommand[];
  toTools: LoopToolCall[];
}

export type LoopBusInput = Omit<LoopBusMessage, "id" | "timestamp"> & {
  id?: string;
  timestamp?: number;
};

export interface LoopBusLogger {
  log: (line: {
    channel: "agent" | "error";
    level: "debug" | "info" | "warn" | "error";
    message: string;
    meta?: LoopBusMeta;
  }) => void;
}

export type LoopBusPhase =
  | "waiting_messages"
  | "collecting_inputs"
  | "processing_messages"
  | "waiting_processor_response"
  | "dispatching_tools"
  | "dispatching_user"
  | "dispatching_terminal"
  | "stopped";

export interface LoopBusState {
  phase: LoopBusPhase;
  timestamp: number;
  queueSize: number;
}

interface LoopBusDeps<TChatMessage extends LoopChatMessage = LoopChatMessage, TStage extends string = string> {
  processor: {
    send: (messages: LoopBusMessage[]) => Promise<LoopBusResponse<TChatMessage, TStage> | void>;
  };
  collectInputs?: () => Promise<LoopBusInput[] | LoopBusInput | void>;
  idleCollectIntervalMs?: number;
  onUserMessage?: (message: TChatMessage) => Promise<void> | void;
  onTerminalDispatch?: (command: LoopTerminalCommand) => Promise<void> | void;
  onToolCall?: (calls: LoopToolCall[]) => Promise<LoopBusInput[] | LoopBusInput | void>;
  onStateChange?: (state: LoopBusState) => Promise<void> | void;
  logger: LoopBusLogger;
}

const LOOP_TRANSITIONS: Record<LoopBusPhase, ReadonlySet<LoopBusPhase>> = {
  waiting_messages: new Set(["collecting_inputs", "stopped"]),
  collecting_inputs: new Set(["processing_messages", "waiting_messages", "stopped"]),
  processing_messages: new Set(["waiting_processor_response", "waiting_messages", "stopped"]),
  waiting_processor_response: new Set([
    "dispatching_tools",
    "dispatching_user",
    "dispatching_terminal",
    "waiting_messages",
    "stopped",
  ]),
  dispatching_tools: new Set(["dispatching_user", "dispatching_terminal", "waiting_messages", "stopped"]),
  dispatching_user: new Set(["dispatching_terminal", "waiting_messages", "stopped"]),
  dispatching_terminal: new Set(["waiting_messages", "stopped"]),
  stopped: new Set(),
};

const DEFAULT_IDLE_COLLECT_INTERVAL_MS = 1_500;

const normalizeInputs = (input: LoopBusInput[] | LoopBusInput | void): LoopBusInput[] => {
  if (!input) {
    return [];
  }
  return Array.isArray(input) ? input : [input];
};

const normalizeOutputs = <TChatMessage extends LoopChatMessage>(
  response: LoopBusResponse<TChatMessage>,
): LoopBusOutputs<TChatMessage> => {
  const outputs = response.outputs;
  return {
    toUser: outputs?.toUser ?? (response.user ? [response.user] : []),
    toTerminal: outputs?.toTerminal ?? response.terminal ?? [],
    toTools: outputs?.toTools ?? response.tools ?? [],
  };
};

export class LoopBus<TChatMessage extends LoopChatMessage = LoopChatMessage, TStage extends string = string> {
  private readonly queue: LoopBusMessage[] = [];
  private waiters: Array<(messages: LoopBusMessage[]) => void> = [];
  private running = false;
  private lastPhase: LoopBusPhase | null = null;
  private readonly idleCollectIntervalMs: number;

  constructor(private readonly deps: LoopBusDeps<TChatMessage, TStage>) {
    this.idleCollectIntervalMs = Math.max(200, deps.idleCollectIntervalMs ?? DEFAULT_IDLE_COLLECT_INTERVAL_MS);
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.deps.logger.log({
      channel: "agent",
      level: "info",
      message: "loopbus.started",
    });
    void this.run();
  }

  stop(): void {
    if (!this.running) {
      return;
    }
    this.running = false;
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter?.([]);
    }
    this.deps.logger.log({
      channel: "agent",
      level: "warn",
      message: "loopbus.stopped",
    });
    void this.emitPhase("stopped");
  }

  pushMessage(input: LoopBusInput): LoopBusMessage {
    if (input.source === "terminal") {
      const merged = this.mergeTerminalDirty(input);
      this.wakeWaiter();
      return merged;
    }

    const message: LoopBusMessage = {
      id: input.id ?? createId(),
      timestamp: input.timestamp ?? Date.now(),
      name: input.name,
      role: input.role,
      type: input.type,
      source: input.source,
      text: input.text,
      meta: input.meta,
    };

    this.queue.push(message);
    this.queue.sort((a, b) => a.timestamp - b.timestamp);
    this.deps.logger.log({
      channel: "agent",
      level: "debug",
      message: "loopbus.push",
      meta: {
        source: message.source,
        role: message.role,
        queueSize: this.queue.length,
      },
    });

    this.wakeWaiter();
    return message;
  }

  private mergeTerminalDirty(input: LoopBusInput): LoopBusMessage {
    const nextTimestamp = input.timestamp ?? Date.now();
    const existedIndex = this.queue.findIndex((line) => line.source === "terminal" && line.name === input.name);

    if (existedIndex >= 0) {
      const merged: LoopBusMessage = {
        ...this.queue[existedIndex],
        timestamp: nextTimestamp,
        text: input.text,
        meta: input.meta,
      };
      this.queue[existedIndex] = merged;
      this.deps.logger.log({
        channel: "agent",
        level: "debug",
        message: "loopbus.push.merge",
        meta: {
          source: merged.source,
          role: merged.role,
          queueSize: this.queue.length,
        },
      });
      return merged;
    }

    const message: LoopBusMessage = {
      id: input.id ?? createId(),
      timestamp: nextTimestamp,
      name: input.name,
      role: input.role,
      type: input.type,
      source: input.source,
      text: input.text,
      meta: input.meta,
    };
    this.queue.push(message);
    this.queue.sort((a, b) => a.timestamp - b.timestamp);
    this.deps.logger.log({
      channel: "agent",
      level: "debug",
      message: "loopbus.push",
      meta: {
        source: message.source,
        role: message.role,
        queueSize: this.queue.length,
      },
    });
    return message;
  }

  private async run(): Promise<void> {
    while (this.running) {
      await this.emitPhase("waiting_messages");
      let messages: LoopBusMessage[] = [];
      if (this.queue.length > 0) {
        messages = this.drainQueue();
      } else if (this.deps.collectInputs) {
        messages = await this.popQueueMessages(this.idleCollectIntervalMs);
      } else {
        messages = await this.popQueueMessages();
      }
      if (!this.running) {
        continue;
      }

      await this.emitPhase("collecting_inputs");
      const collected = normalizeInputs(await this.deps.collectInputs?.());
      if (collected.length > 0) {
        for (const input of collected) {
          this.pushMessage(input);
        }
      }

      if (this.queue.length > 0) {
        messages = [...messages, ...this.drainQueue()].sort((a, b) => a.timestamp - b.timestamp);
      }
      if (messages.length === 0) {
        continue;
      }

      const visibleMessages = messages.filter(
        (message) => !(message.source === "terminal" && Boolean(message.meta?.signal)),
      );
      if (visibleMessages.length === 0) {
        this.deps.logger.log({
          channel: "agent",
          level: "debug",
          message: "loopbus.pop.skip",
          meta: { count: messages.length, reason: "signal-only" },
        });
        continue;
      }

      this.deps.logger.log({
        channel: "agent",
        level: "debug",
        message: "loopbus.pop",
        meta: { count: visibleMessages.length, rawCount: messages.length },
      });

      try {
        await this.emitPhase("processing_messages");
        await this.emitPhase("waiting_processor_response");
        const response = await this.deps.processor.send(visibleMessages);
        if (!response) {
          this.deps.logger.log({
            channel: "agent",
            level: "debug",
            message: "loopbus.response",
            meta: { hasResponse: false, count: visibleMessages.length },
          });
          continue;
        }

        const outputs = normalizeOutputs(response);

        this.deps.logger.log({
          channel: "agent",
          level: "debug",
          message: "loopbus.response",
          meta: {
            hasResponse: true,
            done: response.done ?? false,
            toUser: outputs.toUser.length,
            toTerminal: outputs.toTerminal.length,
            toTools: outputs.toTools.length,
            stage: response.stage ?? "unknown",
          },
        });

        if (outputs.toTools.length > 0 && this.deps.onToolCall) {
          await this.emitPhase("dispatching_tools");
          const toolResult = await this.deps.onToolCall(outputs.toTools);
          this.deps.logger.log({
            channel: "agent",
            level: "debug",
            message: "loopbus.tool.result",
            meta: {
              calls: outputs.toTools.length,
              returned: Array.isArray(toolResult) ? toolResult.length : toolResult ? 1 : 0,
            },
          });
          if (Array.isArray(toolResult)) {
            for (const item of toolResult) {
              this.pushMessage(item);
            }
          } else if (toolResult) {
            this.pushMessage(toolResult);
          }
        }

        if (outputs.toUser.length > 0 && this.deps.onUserMessage) {
          await this.emitPhase("dispatching_user");
          for (const message of outputs.toUser) {
            this.deps.logger.log({
              channel: "agent",
              level: "debug",
              message: "loopbus.user.dispatch",
              meta: { chars: message.content.length },
            });
            await this.deps.onUserMessage(message);
          }
        }

        if (outputs.toTerminal.length > 0 && this.deps.onTerminalDispatch) {
          await this.emitPhase("dispatching_terminal");
          for (const command of outputs.toTerminal) {
            this.deps.logger.log({
              channel: "agent",
              level: "debug",
              message: "loopbus.terminal.dispatch",
              meta: {
                terminalId: command.terminalId,
                submit: command.submit,
                chars: command.text.length,
              },
            });
            await this.deps.onTerminalDispatch(command);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.deps.logger.log({
          channel: "error",
          level: "error",
          message: `loopbus processor failed: ${message}`,
        });
      }
    }
  }

  private popQueueMessages(timeoutMs?: number): Promise<LoopBusMessage[]> {
    if (this.queue.length > 0) {
      return Promise.resolve(this.drainQueue());
    }
    if (timeoutMs === undefined) {
      return new Promise((resolve) => {
        this.waiters.push(resolve);
      });
    }
    return new Promise((resolve) => {
      let settled = false;
      const waiter = (messages: LoopBusMessage[]) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        resolve(messages);
      };
      const timeout = setTimeout(() => {
        const index = this.waiters.indexOf(waiter);
        if (index >= 0) {
          this.waiters.splice(index, 1);
        }
        waiter([]);
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  private wakeWaiter(): void {
    if (this.waiters.length === 0 || this.queue.length === 0) {
      return;
    }
    const waiter = this.waiters.shift();
    waiter?.(this.drainQueue());
  }

  private drainQueue(): LoopBusMessage[] {
    const items = [...this.queue];
    this.queue.length = 0;
    return items.sort((a, b) => a.timestamp - b.timestamp);
  }

  private async emitPhase(phase: LoopBusPhase): Promise<void> {
    if (this.lastPhase === phase) {
      return;
    }
    if (this.lastPhase !== null) {
      const allowed = LOOP_TRANSITIONS[this.lastPhase];
      if (!allowed.has(phase)) {
        this.deps.logger.log({
          channel: "agent",
          level: "warn",
          message: "loopbus.phase.transition.invalid",
          meta: {
            from: this.lastPhase,
            to: phase,
          },
        });
      }
    }
    this.lastPhase = phase;
    await this.deps.onStateChange?.({
      phase,
      timestamp: Date.now(),
      queueSize: this.queue.length,
    });
  }
}
