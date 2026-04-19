import { createAnchoredVirtualListRequestId } from "./anchored-virtual-list-scroll-plan";
import type {
  AnchoredVirtualListScrollController as AnchoredVirtualListScrollKernel,
  AnchoredVirtualListTransactionContext,
} from "./anchored-virtual-list-scroll.types";
import type {
  ScrollController,
  ScrollControllerInternals,
  ScrollControllerWithInternals,
  ScrollProgram,
  ScrollProgramController,
  ScrollQueryListener,
  ScrollQueryTree,
  ScrollTriggerRegistrationInput,
  ScrollTxOptions,
  ScrollTxResult,
  ScrollTxSnapshot,
} from "./named-scroll-controller.types";
import { SCROLL_CONTROLLER_INTERNALS } from "./named-scroll-controller.types";

type RegisteredTriggerRecord = {
  readonly cost: ScrollTriggerRegistrationInput["cost"];
  readonly family: string;
  readonly readQuery: ScrollTriggerRegistrationInput["readQuery"];
  readonly consume: ScrollTriggerRegistrationInput["consume"];
};

type CreateNamedScrollControllerOptions = {
  kernel: AnchoredVirtualListScrollKernel;
};

const cloneQueryTree = (bindings: ReadonlyMap<string, RegisteredTriggerRecord>): ScrollQueryTree =>
  Object.fromEntries(
    Array.from(bindings.entries(), ([name, binding]) => [name, { ...binding.readQuery() }]),
  );

/**
 * 用命名 trigger / query / program 包装旧 tx kernel。
 */
export const createNamedScrollController = (
  options: CreateNamedScrollControllerOptions,
): ScrollController => {
  const bindings = new Map<string, RegisteredTriggerRecord>();
  const listeners = new Set<ScrollQueryListener>();
  const kernel = options.kernel;
  let installedProgram: ScrollProgram | null = null;
  let stableQuery: ScrollQueryTree = {};
  let flushQueued = false;
  let flushViaFrame = false;
  let flushRunning = false;
  let flushFrameHandle = 0;
  let flushMicrotaskToken = 0;
  let activeProgramQuery: ScrollQueryTree = {};
  let activeTx: ScrollTxSnapshot | null = null;

  const notifyListeners = (query: ScrollQueryTree): void => {
    for (const listener of listeners) {
      listener(query);
    }
  };

  const clearScheduledFlush = (): void => {
    if (flushFrameHandle === 0) {
      return;
    }
    cancelAnimationFrame(flushFrameHandle);
    flushFrameHandle = 0;
  };

  const finishFlushCycle = (): void => {
    flushQueued = false;
    flushViaFrame = false;
    clearScheduledFlush();
  };

  const flush = async (): Promise<void> => {
    if (flushRunning) {
      return;
    }
    flushRunning = true;
    finishFlushCycle();
    try {
      const nextQuery = cloneQueryTree(bindings);
      activeProgramQuery = nextQuery;
      notifyListeners(nextQuery);
      if (installedProgram) {
        await installedProgram(programController);
      }
      for (const binding of bindings.values()) {
        binding.consume();
      }
      stableQuery = cloneQueryTree(bindings);
    } finally {
      const shouldReschedule = flushQueued;
      const rescheduleCost: RegisteredTriggerRecord["cost"] = flushViaFrame ? "frame" : "event";
      activeProgramQuery = {};
      flushRunning = false;
      if (shouldReschedule) {
        flushQueued = false;
        flushViaFrame = false;
        scheduleFlush(rescheduleCost);
      }
    }
  };

  const scheduleFlush = (cost: RegisteredTriggerRecord["cost"]): void => {
    if (flushQueued) {
      if (cost === "frame" && !flushViaFrame) {
        flushViaFrame = true;
        flushMicrotaskToken += 1;
        if (!flushRunning && flushFrameHandle === 0) {
          flushFrameHandle = requestAnimationFrame(() => {
            flushFrameHandle = 0;
            if (!flushQueued || !flushViaFrame || flushRunning) {
              return;
            }
            void flush();
          });
        }
      }
      return;
    }
    flushQueued = true;
    flushViaFrame = cost === "frame";
    if (flushRunning) {
      return;
    }
    if (flushViaFrame) {
      flushFrameHandle = requestAnimationFrame(() => {
        flushFrameHandle = 0;
        void flush();
      });
      return;
    }
    const microtaskToken = ++flushMicrotaskToken;
    queueMicrotask(() => {
      if (!flushQueued || flushRunning || flushViaFrame || microtaskToken !== flushMicrotaskToken) {
        return;
      }
      void flush();
    });
  };

  const programController: ScrollProgramController = {
    get query() {
      return activeProgramQuery;
    },
    async tx<T>(
      effect: (tx: AnchoredVirtualListTransactionContext) => T | Promise<T>,
      txOptions?: ScrollTxOptions,
    ): Promise<ScrollTxResult<T>> {
      const transactionId = createAnchoredVirtualListRequestId();
      const result = kernel.handle.transact(effect, {
        priority: txOptions?.priority,
        interruptionPolicy: txOptions?.interruptionPolicy,
        debugLabel: txOptions?.debugLabel,
        id: transactionId,
      });
      void result.finished.catch(() => undefined);
      activeTx = {
        id: transactionId,
        priority: txOptions?.priority ?? "default",
        interruptionPolicy: txOptions?.interruptionPolicy ?? "cancel-on-user-input",
        startedAt: Date.now(),
        debugLabel: txOptions?.debugLabel,
      };
      void result.finished
        .then(
          () => {
            if (activeTx?.id === transactionId) {
              activeTx = null;
            }
          },
          () => {
            if (activeTx?.id === transactionId) {
              activeTx = null;
            }
          },
        )
        .catch(() => undefined);
      return result;
    },
  };

  const internals: ScrollControllerInternals = {
    registerTrigger(name, input) {
      if (bindings.has(name)) {
        throw new Error(`Scroll trigger name "${name}" is already registered.`);
      }
      bindings.set(name, {
        cost: input.cost,
        family: input.family,
        readQuery: input.readQuery,
        consume: input.consume,
      });
      stableQuery = cloneQueryTree(bindings);
      scheduleFlush(input.cost);
      return {
        notify() {
          const binding = bindings.get(name);
          if (!binding) {
            return;
          }
          scheduleFlush(binding.cost);
        },
        disconnect() {
          bindings.delete(name);
          stableQuery = cloneQueryTree(bindings);
        },
      };
    },
  };

  const controller: ScrollControllerWithInternals = {
    connect(adapter) {
      kernel.connect(adapter);
    },
    disconnect() {
      installedProgram = null;
      activeTx = null;
      clearScheduledFlush();
      finishFlushCycle();
      stableQuery = {};
      bindings.clear();
      kernel.disconnect();
    },
    install(program) {
      installedProgram = program;
      scheduleFlush("event");
      return () => {
        if (installedProgram === program) {
          installedProgram = null;
        }
      };
    },
    getQuery() {
      return stableQuery;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(stableQuery);
      return () => {
        listeners.delete(listener);
      };
    },
    getActiveTx() {
      return activeTx;
    },
    [SCROLL_CONTROLLER_INTERNALS]: internals,
  };

  return controller;
};
