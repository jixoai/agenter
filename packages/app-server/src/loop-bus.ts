import type {
  SessionTerminalOutcome,
  SessionTraceEvent,
  SessionTraceLink,
  SessionTraceRef,
  SessionTraceStatus,
} from "@agenter/session-system";

import { createSpanId, createTraceEvent, createTraceId, mapAbortReasonToOutcome, toTerminalOutcomeFromError } from "./runtime-trace";
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
  source: "chat" | "terminal" | "tool" | "task" | "attention";
  text: string;
  meta?: LoopBusMeta;
  attachments?: ChatSessionAsset[];
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
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  kind: string;
  name: string;
  status: SessionTraceStatus;
  startedAt: number;
  endedAt: number;
  refs: SessionTraceRef[];
  links: SessionTraceLink[];
  events: SessionTraceEvent[];
  attributes: Record<string, unknown>;
  outcome?: SessionTerminalOutcome;
}

interface LoopBusDeps {
  processor: {
    send: (messages: LoopBusMessage[], context?: { signal?: AbortSignal }) => Promise<unknown | void>;
  };
  waitForCommit: () => Promise<LoopBusWakeSource | void>;
  collectInputs: () => Promise<LoopBusInput[] | LoopBusInput | void>;
  persistCycle: (input: { wakeSource: LoopBusWakeSource; inputs: LoopBusMessage[] }) => Promise<{ cycleId: number }>;
  onStateChange?: (state: LoopBusState) => Promise<void> | void;
  onTrace?: (entry: LoopBusTraceEntry) => Promise<void> | void;
  logger: LoopBusLogger;
  sleep?: (ms: number) => Promise<void>;
}

const LOOP_COLLECT_DEBOUNCE_MS = 300;
const LOOP_COLLECT_THROTTLE_MS = 1_000;

const isExclusiveCycleBatch = (messages: readonly LoopBusMessage[]): boolean =>
  messages.some((message) => message.meta?.exclusiveCycle === true);

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

const defaultSleep = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
};

export class LoopBus {
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
  private cycleAbortController: AbortController | null = null;

  constructor(private readonly deps: LoopBusDeps) {
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

  async stop(reason: unknown = "loopbus.stop"): Promise<void> {
    this.running = false;
    this.paused = false;
    this.cycleAbortController?.abort(reason);
    this.cycleAbortController = null;
    this.waitResume?.();
    this.waitResume = null;
    await this.emitState("stopped");
    await this.loopTask;
  }

  pause(reason: unknown = "loopbus.pause"): void {
    if (!this.running || this.paused) {
      return;
    }
    this.paused = true;
    this.cycleAbortController?.abort(reason);
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
    const traceId = createTraceId();
    const traces: Array<Omit<LoopBusTraceEntry, "cycleId">> = [];
    let wakeSource: LoopBusWakeSource = "unknown";

    try {
      await this.trace(
        traces,
        {
          traceId,
          kind: "scheduler.wait",
          name: "wait_commits",
          attributes: { phase: this.phase },
        },
        async () => {
          await this.emitState("waiting_commits");
          wakeSource = (await this.deps.waitForCommit()) ?? "unknown";
          this.lastWakeSource = wakeSource;
        },
      );

      if (!this.running) {
        return;
      }

      const collected = await this.trace(
        traces,
        {
          traceId,
          kind: "source.collect",
          name: "collect_inputs",
          attributes: { wakeSource },
        },
        async () => await this.collectInputsWithinWindow(),
      );

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
        {
          traceId,
          kind: "cycle.persist",
          name: "persist_cycle",
          attributes: { wakeSource, inputs: collected.length },
        },
        async () => {
          await this.emitState("persisting_cycle");
          return await this.deps.persistCycle({ wakeSource, inputs: collected });
        },
      );
      this.currentCycleId = cycleId;
      await this.flushTraceBuffer(traces, cycleId);

      const cycleAbortController = new AbortController();
      this.cycleAbortController = cycleAbortController;
      const result = await this.traceWithCycle(
        cycleId,
        {
          traceId,
          kind: "model.call",
          name: "call_model",
          attributes: { inputs: collected.length },
        },
        async () => {
          await this.emitState("calling_model");
          return await this.deps.processor.send(collected, {
            signal: cycleAbortController.signal,
          });
        },
        cycleAbortController.signal,
      );
      if (this.cycleAbortController === cycleAbortController) {
        this.cycleAbortController = null;
      }

      if (!this.running || cycleAbortController.signal.aborted) {
        return;
      }

      if (result === undefined) {
        this.deps.logger.log({
          channel: "agent",
          level: "debug",
          message: "loopbus.processor.completed",
          meta: { cycleId, inputs: collected.length },
        });
        return;
      }

      this.deps.logger.log({
        channel: "agent",
        level: "debug",
        message: "loopbus.processor.result",
        meta: {
          cycleId,
          inputs: collected.length,
        },
      });
    } catch (error) {
      if (this.isAbortError(error)) {
        this.deps.logger.log({
          channel: "agent",
          level: "debug",
          message: "loopbus.cycle.aborted",
          meta: this.currentCycleId === null ? undefined : { cycleId: this.currentCycleId },
        });
        return;
      }
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
          traceId,
          spanId: createSpanId(),
          kind: "scheduler.error",
          name: "cycle_error",
          status: "error",
          startedAt: Date.now(),
          endedAt: Date.now(),
          refs: [],
          links: [],
          events: [createTraceEvent("cycle.error", { status: "error", attributes: { message } })],
          attributes: { message },
          outcome: {
            code: "error",
            message,
            error: { message },
          },
        });
      }
    } finally {
      this.cycleAbortController = null;
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
    if (isExclusiveCycleBatch(firstBatch)) {
      return firstBatch;
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
      if (isExclusiveCycleBatch(nextBatch)) {
        break;
      }
      quietMs = 0;
    }

    return collected;
  }

  private async trace<T>(
    bucket: Array<Omit<LoopBusTraceEntry, "cycleId">>,
    input: {
      traceId: string;
      kind: string;
      name: string;
      parentSpanId?: string | null;
      refs?: SessionTraceRef[];
      links?: SessionTraceLink[];
      attributes?: Record<string, unknown>;
    },
    run: () => Promise<T>,
  ): Promise<T> {
    const startedAt = Date.now();
    const spanId = createSpanId();
    const baseEntry = {
      traceId: input.traceId,
      spanId,
      parentSpanId: input.parentSpanId,
      kind: input.kind,
      name: input.name,
      refs: [...(input.refs ?? [])],
      links: [...(input.links ?? [])],
      attributes: { ...(input.attributes ?? {}) },
    } satisfies Omit<LoopBusTraceEntry, "cycleId" | "status" | "startedAt" | "endedAt" | "events" | "outcome">;
    try {
      const value = await run();
      bucket.push({
        ...baseEntry,
        status: "done",
        startedAt,
        endedAt: Date.now(),
        events: [createTraceEvent("span.finished", { status: "ok" })],
        outcome: {
          code: "done",
        },
      });
      return value;
    } catch (error) {
      const outcome = this.isAbortError(error) ? mapAbortReasonToOutcome(error) : toTerminalOutcomeFromError(error);
      bucket.push({
        ...baseEntry,
        status: this.isAbortError(error) ? "cancelled" : "error",
        startedAt,
        endedAt: Date.now(),
        events: [
          createTraceEvent("span.failed", {
            status: "error",
            attributes: { message: error instanceof Error ? error.message : String(error) },
          }),
        ],
        attributes: {
          ...baseEntry.attributes,
          message: error instanceof Error ? error.message : String(error),
        },
        outcome,
      });
      throw error;
    }
  }

  private async traceWithCycle<T>(
    cycleId: number,
    input: {
      traceId: string;
      kind: string;
      name: string;
      parentSpanId?: string | null;
      refs?: SessionTraceRef[];
      links?: SessionTraceLink[];
      attributes?: Record<string, unknown>;
    },
    run: () => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    const startedAt = Date.now();
    const spanId = createSpanId();
    const baseEntry = {
      cycleId,
      traceId: input.traceId,
      spanId,
      parentSpanId: input.parentSpanId,
      kind: input.kind,
      name: input.name,
      refs: [...(input.refs ?? [])],
      links: [...(input.links ?? [])],
      attributes: { ...(input.attributes ?? {}) },
    } satisfies Omit<LoopBusTraceEntry, "status" | "startedAt" | "endedAt" | "events" | "outcome">;
    await this.deps.onTrace?.({
      ...baseEntry,
      status: "running",
      startedAt,
      endedAt: startedAt,
      events: [createTraceEvent("span.started", { status: "info" })],
    });
    try {
      const value = await run();
      await this.deps.onTrace?.({
        ...baseEntry,
        status: "done",
        startedAt,
        endedAt: Date.now(),
        events: [
          createTraceEvent("span.started", { timestamp: startedAt, status: "info" }),
          createTraceEvent("span.finished", { status: "ok" }),
        ],
        outcome: {
          code: "done",
        },
      });
      return value;
    } catch (error) {
      const aborted = this.isAbortError(error);
      const outcome = aborted ? mapAbortReasonToOutcome(signal?.reason ?? error) : toTerminalOutcomeFromError(error);
      await this.deps.onTrace?.({
        ...baseEntry,
        status: aborted ? "cancelled" : "error",
        startedAt,
        endedAt: Date.now(),
        events: [
          createTraceEvent("span.started", { timestamp: startedAt, status: "info" }),
          createTraceEvent("span.failed", {
            status: "error",
            attributes: { message: error instanceof Error ? error.message : String(error) },
          }),
        ],
        attributes: {
          ...baseEntry.attributes,
          message: error instanceof Error ? error.message : String(error),
        },
        outcome,
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

  private isAbortError(error: unknown): boolean {
    return error instanceof DOMException
      ? error.name === "AbortError"
      : error instanceof Error
        ? error.name === "AbortError" || error.message === "This operation was aborted"
        : false;
  }
}
