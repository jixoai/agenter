import type { ChatSessionAsset } from "./types";

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
  source: "chat" | "terminal" | "tool" | "task" | "attention-system";
  text: string;
  meta?: LoopBusMeta;
  attachments?: ChatSessionAsset[];
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
  | "waiting_commits"
  | "collecting_inputs"
  | "persisting_cycle"
  | "calling_model"
  | "applying_outputs"
  | "stopped";

export interface LoopBusState {
  phase: LoopBusPhase;
  timestamp: number;
  cycle: number;
  currentCycleId: number | null;
  paused: boolean;
  running: boolean;
  lastWakeSource: LoopBusWakeSource | null;
  lastError: string | null;
}

export type LoopBusWakeSource = "user" | "terminal" | "task" | "attention" | "unknown";

export interface LoopBusTraceEntry {
  cycleId: number;
  step: string;
  status: "ok" | "error";
  startedAt: number;
  endedAt: number;
  detail: Record<string, unknown>;
}

interface LoopBusDeps<TChatMessage extends LoopChatMessage = LoopChatMessage, TStage extends string = string> {
  processor: {
    send: (messages: LoopBusMessage[]) => Promise<LoopBusResponse<TChatMessage, TStage> | void>;
  };
  waitForCommit: () => Promise<LoopBusWakeSource | void>;
  collectInputs: () => Promise<LoopBusInput[] | LoopBusInput | void>;
  persistCycle: (input: { wakeSource: LoopBusWakeSource; inputs: LoopBusMessage[] }) => Promise<{ cycleId: number }>;
  onUserMessage?: (message: TChatMessage, context: { cycleId: number }) => Promise<void> | void;
  onTerminalDispatch?: (command: LoopTerminalCommand, context: { cycleId: number }) => Promise<void> | void;
  onToolCall?: (calls: LoopToolCall[], context: { cycleId: number }) => Promise<void> | void;
  onStateChange?: (state: LoopBusState) => Promise<void> | void;
  onTrace?: (entry: LoopBusTraceEntry) => Promise<void> | void;
  logger: LoopBusLogger;
  sleep?: (ms: number) => Promise<void>;
}

const LOOP_COLLECT_DEBOUNCE_MS = 300;
const LOOP_COLLECT_THROTTLE_MS = 1_000;

const normalizeInputs = (input: LoopBusInput[] | LoopBusInput | void): LoopBusMessage[] => {
  if (!input) {
    return [];
  }
  const items = Array.isArray(input) ? input : [input];
  return items.map((item) => ({
    id: item.id ?? createId(),
    timestamp: item.timestamp ?? Date.now(),
    name: item.name,
    role: item.role,
    type: item.type,
    source: item.source,
    text: item.text,
    meta: item.meta,
    attachments: item.attachments?.map((attachment) => ({ ...attachment })),
  }));
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

const defaultSleep = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
};

export class LoopBus<TChatMessage extends LoopChatMessage = LoopChatMessage, TStage extends string = string> {
  private running = false;
  private paused = false;
  private waitResume: (() => void) | null = null;
  private loopTask: Promise<void> | null = null;
  private cycle = 0;
  private currentCycleId: number | null = null;
  private lastWakeSource: LoopBusWakeSource | null = null;
  private lastError: string | null = null;
  private phase: LoopBusPhase = "stopped";
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly deps: LoopBusDeps<TChatMessage, TStage>) {
    this.sleep = deps.sleep ?? defaultSleep;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.paused = false;
    void this.emitState("waiting_commits");
    this.loopTask = this.run();
  }

  stop(): void {
    this.running = false;
    this.paused = false;
    this.waitResume?.();
    this.waitResume = null;
    void this.emitState("stopped");
  }

  pause(): void {
    if (!this.running || this.paused) {
      return;
    }
    this.paused = true;
    void this.emitState(this.phase);
  }

  resume(): void {
    if (!this.running || !this.paused) {
      return;
    }
    this.paused = false;
    this.waitResume?.();
    this.waitResume = null;
    void this.emitState(this.phase);
  }

  getState(): LoopBusState {
    return {
      phase: this.phase,
      timestamp: Date.now(),
      cycle: this.cycle,
      currentCycleId: this.currentCycleId,
      paused: this.paused,
      running: this.running,
      lastWakeSource: this.lastWakeSource,
      lastError: this.lastError,
    };
  }

  private async run(): Promise<void> {
    try {
      while (this.running) {
        await this.waitWhilePaused();
        if (!this.running) {
          break;
        }
        await this.runCycle();
      }
    } finally {
      this.loopTask = null;
    }
  }

  private async runCycle(): Promise<void> {
    const traces: Array<Omit<LoopBusTraceEntry, "cycleId">> = [];
    let wakeSource: LoopBusWakeSource = "unknown";

    try {
      await this.trace(traces, "wait_commits", { phase: this.phase }, async () => {
        await this.emitState("waiting_commits");
        wakeSource = (await this.deps.waitForCommit()) ?? "unknown";
        this.lastWakeSource = wakeSource;
      });

      if (!this.running) {
        return;
      }

      const collected = await this.trace(traces, "collect_inputs", { wakeSource }, async () => {
        return await this.collectInputsWithinWindow();
      });

      if (collected.length === 0) {
        this.deps.logger.log({
          channel: "agent",
          level: "debug",
          message: "loopbus.collect.empty",
          meta: { wakeSource },
        });
        return;
      }

      if (!this.running) {
        return;
      }

      this.cycle += 1;
      const { cycleId } = await this.trace(
        traces,
        "persist_cycle",
        { wakeSource, inputs: collected.length },
        async () => {
          await this.emitState("persisting_cycle");
          return await this.deps.persistCycle({ wakeSource, inputs: collected });
        },
      );
      this.currentCycleId = cycleId;
      await this.flushTraceBuffer(traces, cycleId);

      const response = await this.traceWithCycle(cycleId, "call_model", { inputs: collected.length }, async () => {
        await this.emitState("calling_model");
        return await this.deps.processor.send(collected);
      });

      if (!response) {
        this.deps.logger.log({
          channel: "agent",
          level: "debug",
          message: "loopbus.response.empty",
          meta: { cycleId, inputs: collected.length },
        });
        return;
      }

      const outputs = normalizeOutputs(response);
      await this.traceWithCycle(
        cycleId,
        "apply_outputs",
        {
          toUser: outputs.toUser.length,
          toTerminal: outputs.toTerminal.length,
          toTools: outputs.toTools.length,
        },
        async () => {
          await this.emitState("applying_outputs");
          if (outputs.toTools.length > 0) {
            await this.deps.onToolCall?.(outputs.toTools, { cycleId });
          }
          for (const message of outputs.toUser) {
            await this.deps.onUserMessage?.(message, { cycleId });
          }
          for (const command of outputs.toTerminal) {
            await this.deps.onTerminalDispatch?.(command, { cycleId });
          }
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = message;
      this.deps.logger.log({
        channel: "error",
        level: "error",
        message: `loopbus.cycle.failed: ${message}`,
      });
      if (this.currentCycleId !== null) {
        await this.deps.onTrace?.({
          cycleId: this.currentCycleId,
          step: "cycle_error",
          status: "error",
          startedAt: Date.now(),
          endedAt: Date.now(),
          detail: { message },
        });
      }
    } finally {
      if (this.running) {
        await this.emitState("waiting_commits");
      }
    }
  }

  private async collectInputsWithinWindow(): Promise<LoopBusMessage[]> {
    const firstBatch = normalizeInputs(await this.deps.collectInputs());
    if (firstBatch.length === 0) {
      return [];
    }

    await this.emitState("collecting_inputs");

    const collected = [...firstBatch];
    let elapsedMs = 0;
    let quietMs = 0;

    while (this.running) {
      const remainingThrottleMs = LOOP_COLLECT_THROTTLE_MS - elapsedMs;
      if (remainingThrottleMs <= 0) {
        break;
      }

      const waitMs = Math.min(LOOP_COLLECT_DEBOUNCE_MS, remainingThrottleMs);
      await this.sleep(waitMs);
      elapsedMs += waitMs;
      const nextBatch = normalizeInputs(await this.deps.collectInputs());
      if (nextBatch.length === 0) {
        quietMs += waitMs;
        if (quietMs >= LOOP_COLLECT_DEBOUNCE_MS) {
          break;
        }
        continue;
      }

      collected.push(...nextBatch);
      quietMs = 0;
    }

    return collected;
  }

  private async trace<T>(
    bucket: Array<Omit<LoopBusTraceEntry, "cycleId">>,
    step: string,
    detail: Record<string, unknown>,
    run: () => Promise<T>,
  ): Promise<T> {
    const startedAt = Date.now();
    try {
      const value = await run();
      bucket.push({
        step,
        status: "ok",
        startedAt,
        endedAt: Date.now(),
        detail,
      });
      return value;
    } catch (error) {
      bucket.push({
        step,
        status: "error",
        startedAt,
        endedAt: Date.now(),
        detail: {
          ...detail,
          message: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  private async traceWithCycle<T>(
    cycleId: number,
    step: string,
    detail: Record<string, unknown>,
    run: () => Promise<T>,
  ): Promise<T> {
    const startedAt = Date.now();
    try {
      const value = await run();
      await this.deps.onTrace?.({
        cycleId,
        step,
        status: "ok",
        startedAt,
        endedAt: Date.now(),
        detail,
      });
      return value;
    } catch (error) {
      await this.deps.onTrace?.({
        cycleId,
        step,
        status: "error",
        startedAt,
        endedAt: Date.now(),
        detail: {
          ...detail,
          message: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  private async flushTraceBuffer(traces: Array<Omit<LoopBusTraceEntry, "cycleId">>, cycleId: number): Promise<void> {
    for (const trace of traces) {
      await this.deps.onTrace?.({ cycleId, ...trace });
    }
    traces.length = 0;
  }

  private async emitState(phase: LoopBusPhase): Promise<void> {
    this.phase = phase;
    await this.deps.onStateChange?.(this.getState());
  }

  private async waitWhilePaused(): Promise<void> {
    if (!this.paused) {
      return;
    }
    await new Promise<void>((resolve) => {
      this.waitResume = resolve;
    });
  }
}
