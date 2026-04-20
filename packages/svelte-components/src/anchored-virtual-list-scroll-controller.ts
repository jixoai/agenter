import {
  beginAnchoredVirtualListUserInput,
  clearAnchoredVirtualListUserInput,
  compareAnchoredVirtualListScrollPriority,
  createIdleAnchoredVirtualListUserInputState,
  getAnchoredVirtualListUserInputIdleDelay,
  isAnchoredVirtualListKeyboardScrollEvent,
  isAnchoredVirtualListUserInputBlocking,
  promoteAnchoredVirtualListUserInputToMomentum,
  resolveAnchoredVirtualListInterruptionPolicy,
  resolveAnchoredVirtualListUserInputPolicy,
  shouldDeferAnchoredVirtualListRequestForUserInput,
  shouldInterruptAnchoredVirtualListRequestForPriority,
  shouldInterruptAnchoredVirtualListRequestForUserInput,
} from "./anchored-virtual-list-scroll-arbitration";
import {
  executeAnchoredVirtualListElementPlan,
  waitForAnchoredVirtualListAnimationFrame,
  waitForAnchoredVirtualListDomSettle,
  waitForAnchoredVirtualListScrollEnd,
} from "./anchored-virtual-list-scroll-browser";
import { AnchoredVirtualListAbortError } from "./anchored-virtual-list-scroll-error";
import {
  deriveAnchoredVirtualListMutationRequest,
  createAnchoredVirtualListRequestId,
  normalizeAnchoredVirtualListScrollRequest,
  planAnchoredVirtualListScroll,
  resolveAnchoredVirtualListEventualScrollPosition,
} from "./anchored-virtual-list-scroll-plan";
import {
  getBottomAnchoredDistanceToLatest,
  getBottomAnchoredDistanceToStart,
  getBottomAnchoredScrollTopFromVirtualOffset,
} from "./bottom-anchored-scroll";
import type { BottomAnchoredTimelineInsertMotionBatch } from "./bottom-anchored-timeline.types";
import type {
  AnchoredVirtualListAppendMutation,
  AnchoredVirtualListHostAdapter,
  AnchoredVirtualListMutationAnchor,
  AnchoredVirtualListPrependMutation,
  AnchoredVirtualListResolvedRequest,
  AnchoredVirtualListResolvedTarget,
  AnchoredVirtualListScrollController,
  AnchoredVirtualListScrollControllerOptions,
  AnchoredVirtualListScrollHandle,
  AnchoredVirtualListScrollPhase,
  AnchoredVirtualListScrollRequest,
  AnchoredVirtualListScrollStateListener,
  AnchoredVirtualListScrollStateSnapshot,
  AnchoredVirtualListTransactionBeforeSnapshot,
  AnchoredVirtualListTransactionContext,
  AnchoredVirtualListTransactionOptions,
  AnchoredVirtualListTransactionScrollController,
  AnchoredVirtualListTransactResult,
  AnchoredVirtualListScrollTransactionResult,
  AnchoredVirtualListScrollTransactionSnapshot,
  AnchoredVirtualListTransactionTerminalState,
} from "./anchored-virtual-list-scroll.types";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

type PendingRequestRecord = {
  request: AnchoredVirtualListResolvedRequest;
  deferred: Deferred<AnchoredVirtualListScrollTransactionResult>;
};

type ActiveTransactionRecord = PendingRequestRecord & {
  snapshot: AnchoredVirtualListScrollTransactionSnapshot;
  abortController: AbortController;
  scrollEndDeferred: Deferred<void>;
  settleDeferred: Deferred<void>;
  resolvedTarget: AnchoredVirtualListResolvedTarget | null;
  finished: boolean;
};

type ScriptMutationRecord =
  | { kind: "append"; inserted: readonly AnchoredVirtualListMutationAnchor[] }
  | { kind: "prepend"; inserted: readonly AnchoredVirtualListMutationAnchor[] }
  | { kind: "resize" | "collapse" | "expand" };

type ScriptVisibleAnchorSnapshot = {
  key: string | null;
  top: number | null;
};

type ScriptTransactionStage = "commit" | "insert-motion";

type ScriptTerminalCommand =
  | {
      kind: "position";
      top: number;
      left: number;
      behavior: ScrollBehavior;
      reason: "reconcile" | "requested";
    }
  | {
      kind: "request";
      request: AnchoredVirtualListScrollRequest;
    };

type ScriptTransactionRecord = {
  id: string;
  abortController: AbortController;
  before: AnchoredVirtualListTransactionBeforeSnapshot;
  priority: NonNullable<AnchoredVirtualListTransactionOptions["priority"]>;
  interruptionPolicy: NonNullable<AnchoredVirtualListTransactionOptions["interruptionPolicy"]>;
  debugLabel?: string;
  startedAt: number;
  commitPromise: Promise<void> | null;
  settlePromise: Promise<void> | null;
  mutationRecord: ScriptMutationRecord | null;
  preserveAnchor: boolean;
  insertMotionBatch: BottomAnchoredTimelineInsertMotionBatch | null;
  visibleAnchor: ScriptVisibleAnchorSnapshot;
};

type ScriptTransactionProgramContext = {
  stage: ScriptTransactionStage;
  transaction: ScriptTransactionRecord;
  adapter: AnchoredVirtualListHostAdapter | null;
  write(command: ScriptTerminalCommand): Promise<void>;
  throwIfAborted(): void;
};

type ScriptTransactionProgram = (
  context: ScriptTransactionProgramContext,
  next: () => Promise<void>,
) => Promise<void>;

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
};

const resolveTerminalRequestResult = (
  request: AnchoredVirtualListResolvedRequest,
  terminalState: AnchoredVirtualListTransactionTerminalState,
  resolvedTarget: AnchoredVirtualListResolvedTarget | null = null,
  errorMessage: string | null = null,
): AnchoredVirtualListScrollTransactionResult => ({
  transactionId: request.id,
  request,
  resolvedTarget,
  terminalState,
  errorMessage,
});

const resolveNow = (options: AnchoredVirtualListScrollControllerOptions): number =>
  options.now?.() ?? Date.now();

const resolveScriptTransactionOptions = (
  input: AnchoredVirtualListTransactionOptions | undefined,
): Required<Pick<AnchoredVirtualListTransactionOptions, "id" | "priority" | "interruptionPolicy">> &
  Pick<AnchoredVirtualListTransactionOptions, "debugLabel"> => ({
  id: input?.id ?? createAnchoredVirtualListRequestId(),
  priority: input?.priority ?? "default",
  interruptionPolicy: input?.interruptionPolicy ?? "cancel-on-user-input",
  debugLabel: input?.debugLabel,
});

const createTransactionBeforeSnapshot = (
  adapter: AnchoredVirtualListHostAdapter | null,
): AnchoredVirtualListTransactionBeforeSnapshot => {
  const viewport = adapter?.getViewport() ?? null;
  const edge = adapter?.getEdgeState() ?? {
    atLatest: true,
    atStart: true,
  };
  const distanceToLatestPx = viewport ? getBottomAnchoredDistanceToLatest(viewport) : 0;
  const distanceToStartPx = viewport ? getBottomAnchoredDistanceToStart(viewport) : 0;
  return {
    atLatest: edge.atLatest,
    atStart: edge.atStart,
    distanceToLatestPx,
    distanceToStartPx,
    isNearEdge(targetEdge, maxDistancePx) {
      const threshold = Math.max(0, maxDistancePx);
      return targetEdge === "latest" ? distanceToLatestPx <= threshold : distanceToStartPx <= threshold;
    },
  };
};

const resolveMutationAnchorElements = (
  adapter: AnchoredVirtualListHostAdapter | null,
  anchors: readonly AnchoredVirtualListMutationAnchor[],
): HTMLElement[] => {
  const contentRoot = adapter?.getContentRoot() ?? null;
  const resolved: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  for (const anchor of anchors) {
    const elementCandidate =
      anchor.element instanceof HTMLElement
        ? anchor.element
        : anchor.selector
          ? contentRoot?.querySelector(anchor.selector) ?? null
          : null;
    if (!(elementCandidate instanceof HTMLElement) || seen.has(elementCandidate)) {
      continue;
    }
    seen.add(elementCandidate);
    resolved.push(elementCandidate);
  }
  return resolved;
};

const resolveMutationBlockSize = (element: HTMLElement): number => {
  const rectHeight = Math.round(element.getBoundingClientRect().height);
  if (rectHeight > 0) {
    return rectHeight;
  }
  if (element.offsetHeight > 0) {
    return element.offsetHeight;
  }
  if (element.scrollHeight > 0) {
    return element.scrollHeight;
  }
  return 0;
};

const escapeAttributeSelectorValue = (value: string): string =>
  typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(value)
    : value.replace(/["\\]/gu, "\\$&");

const INSERT_MOTION_KEY_ATTRIBUTE = "data-insert-motion-key";
const ANCHORED_ROW_KEY_ATTRIBUTE = "data-anchored-row-key";

const readScriptVisibleAnchorSnapshot = (
  adapter: AnchoredVirtualListHostAdapter | null,
): ScriptVisibleAnchorSnapshot => {
  const viewport = adapter?.getViewport() ?? null;
  if (viewport instanceof HTMLElement) {
    const key = viewport.dataset.anchoredVisibleKey?.trim() ?? "";
    const topText = viewport.dataset.anchoredVisibleTop?.trim() ?? "";
    const top = Number(topText);
    if (key.length > 0 && Number.isFinite(top)) {
      return {
        key,
        top,
      };
    }
  }

  const root = adapter?.getContentRoot() ?? viewport ?? null;
  if (viewport instanceof HTMLElement && root instanceof HTMLElement) {
    const viewportRect = viewport.getBoundingClientRect();
    const viewportCenter = viewportRect.top + viewportRect.height / 2;
    const motionRows = Array.from(root.querySelectorAll<HTMLElement>(`[${INSERT_MOTION_KEY_ATTRIBUTE}]`));
    const fallbackRows = Array.from(root.querySelectorAll<HTMLElement>(`[${ANCHORED_ROW_KEY_ATTRIBUTE}]`));
    const rows = (motionRows.length > 0 ? motionRows : fallbackRows).filter((row) => {
      const rect = row.getBoundingClientRect();
      return rect.bottom > viewportRect.top + 1 && rect.top < viewportRect.bottom - 1;
    });
    let bestKey: string | null = null;
    let bestTop: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const row of rows) {
      const rowKey =
        row.getAttribute(INSERT_MOTION_KEY_ATTRIBUTE)?.trim() ??
        row.getAttribute(ANCHORED_ROW_KEY_ATTRIBUTE)?.trim() ??
        "";
      if (rowKey.length === 0) {
        continue;
      }
      const rect = row.getBoundingClientRect();
      const visibleTop = Math.max(rect.top, viewportRect.top);
      const visibleBottom = Math.min(rect.bottom, viewportRect.bottom);
      const visibleCenter = (visibleTop + visibleBottom) / 2;
      const distance = Math.abs(visibleCenter - viewportCenter);
      if (distance >= bestDistance) {
        continue;
      }
      bestDistance = distance;
      bestKey = rowKey;
      bestTop = rect.top;
    }
    if (bestKey !== null && bestTop !== null) {
      return {
        key: bestKey,
        top: bestTop,
      };
    }
  }

  return { key: null, top: null };
};

const resolveVisibleAnchorElement = (
  adapter: AnchoredVirtualListHostAdapter | null,
  visibleAnchor: ScriptVisibleAnchorSnapshot,
): HTMLElement | null => {
  if (!visibleAnchor.key) {
    return null;
  }
  const root = adapter?.getContentRoot() ?? adapter?.getViewport() ?? null;
  if (!(root instanceof HTMLElement)) {
    return null;
  }
  const escapedKey = escapeAttributeSelectorValue(visibleAnchor.key);
  return (
    root.querySelector<HTMLElement>(`[data-insert-motion-key="${escapedKey}"]`) ??
    root.querySelector<HTMLElement>(`[data-anchored-row-key="${escapedKey}"]`) ??
    null
  );
};

const mutationPreserveProgram: ScriptTransactionProgram = async (context, next) => {
  if (context.stage !== "commit") {
    await next();
    return;
  }

  const { adapter, transaction } = context;
  if (!transaction.preserveAnchor || !transaction.mutationRecord) {
    await next();
    return;
  }

  const viewport = adapter?.getViewport() ?? null;
  if (!viewport) {
    return;
  }

  if (transaction.mutationRecord.kind === "append") {
    if (transaction.visibleAnchor.key && transaction.visibleAnchor.top !== null) {
      viewport.dataset.anchoredAppendAnchorStatus = "script-captured";
      viewport.dataset.anchoredAppendAnchorKey = transaction.visibleAnchor.key;
      viewport.dataset.anchoredAppendAnchorTop = String(Math.round(transaction.visibleAnchor.top));
      let foundVisibleAnchor = false;
      for (let frameIndex = 0; frameIndex < 5; frameIndex += 1) {
        context.throwIfAborted();
        const visibleAnchorElement = resolveVisibleAnchorElement(adapter, transaction.visibleAnchor);
        if (visibleAnchorElement instanceof HTMLElement) {
          foundVisibleAnchor = true;
          const drift = visibleAnchorElement.getBoundingClientRect().top - transaction.visibleAnchor.top;
          viewport.dataset.anchoredAppendAnchorStatus = "script-found";
          viewport.dataset.anchoredAppendAnchorDrift = String(Math.round(drift));
          if (Math.abs(drift) <= 0.5) {
            viewport.dataset.anchoredAppendAnchorStatus = "script-stable";
            return;
          }
          await context.write({
            kind: "position",
            top: viewport.scrollTop + drift,
            left: viewport.scrollLeft,
            behavior: "auto",
            reason: "reconcile",
          });
        }
        if (frameIndex < 4) {
          await waitForAnchoredVirtualListAnimationFrame(transaction.abortController.signal);
        }
      }
      if (foundVisibleAnchor) {
        viewport.dataset.anchoredAppendAnchorStatus = "script-settled";
        return;
      }
      viewport.dataset.anchoredAppendAnchorStatus = "script-missing";
    }

    const insertedHeight = resolveMutationAnchorElements(adapter, transaction.mutationRecord.inserted).reduce(
      (total, element) => total + resolveMutationBlockSize(element),
      0,
    );
    if (insertedHeight <= 0) {
      return;
    }
    await context.write({
      kind: "position",
      top: getBottomAnchoredScrollTopFromVirtualOffset(transaction.before.distanceToLatestPx + insertedHeight),
      left: viewport.scrollLeft,
      behavior: "auto",
      reason: "reconcile",
    });
    return;
  }

  if (transaction.mutationRecord.kind === "prepend") {
    await context.write({
      kind: "position",
      top: getBottomAnchoredScrollTopFromVirtualOffset(transaction.before.distanceToLatestPx),
      left: viewport.scrollLeft,
      behavior: "auto",
      reason: "reconcile",
    });
    return;
  }

  await next();
};

const resolveInsertMotionBatchHeight = (
  batch: BottomAnchoredTimelineInsertMotionBatch,
  motion: "latest" | "older",
): number =>
  batch.entries.reduce((total, entry) => {
    if (entry.motion !== motion) {
      return total;
    }
    return total + resolveMutationBlockSize(entry.element);
  }, 0);

const resolveObservedInsertMotionHeight = (
  adapter: AnchoredVirtualListHostAdapter | null,
  batch: BottomAnchoredTimelineInsertMotionBatch,
  motion: "latest" | "older",
): number => {
  const measuredHeight = resolveInsertMotionBatchHeight(batch, motion);
  const viewport = adapter?.getViewport() ?? null;
  if (!viewport) {
    return measuredHeight;
  }
  const scrollHeightDelta = Math.max(0, viewport.scrollHeight - batch.snapshot.scrollHeight);
  if (scrollHeightDelta > 0) {
    return scrollHeightDelta;
  }
  return measuredHeight;
};

const resolveInsertMotionRevealPx = (
  batch: BottomAnchoredTimelineInsertMotionBatch,
  insertedHeight: number,
): number => Math.min(insertedHeight, Math.min(96, batch.snapshot.clientHeight * 0.2));

const waitForAbortablePromise = async <T>(signal: AbortSignal, promise: Promise<T>): Promise<T> => {
  if (signal.aborted) {
    throw signal.reason;
  }
  return await new Promise<T>((resolve, reject) => {
    const handleAbort = (): void => {
      cleanup();
      reject(signal.reason);
    };
    const cleanup = (): void => {
      signal.removeEventListener("abort", handleAbort);
    };
    signal.addEventListener("abort", handleAbort, { once: true });
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
};

const isWithinScrollEpsilon = (current: number | null | undefined, target: number | null | undefined): boolean => {
  if (current == null || target == null) {
    return false;
  }
  return Math.abs(current - target) <= 1;
};

const createInitialState = (): AnchoredVirtualListScrollStateSnapshot => ({
  phase: "idle",
  edge: {
    atLatest: true,
    atStart: true,
  },
  currentScrollTarget: {
    kind: "edge",
    edge: "latest",
  },
  eventualScrollPosition: {
    target: {
      kind: "edge",
      edge: "latest",
    },
    top: 0,
    left: 0,
    behavior: "auto",
  },
  userInput: createIdleAnchoredVirtualListUserInputState(),
  activeTransaction: null,
  pendingTransaction: null,
  lastTerminalState: null,
});

/**
 * 创建语义化 anchored virtual list scroll controller。
 */
export const createAnchoredVirtualListScrollController = (
  options: AnchoredVirtualListScrollControllerOptions = {},
): AnchoredVirtualListScrollController => {
  const listeners = new Set<AnchoredVirtualListScrollStateListener>();
  const inputPolicy = resolveAnchoredVirtualListUserInputPolicy(options.userInputPolicy);
  let adapter: AnchoredVirtualListHostAdapter | null = null;
  let state = createInitialState();
  let pendingRequest: PendingRequestRecord | null = null;
  let activeTransaction: ActiveTransactionRecord | null = null;
  let activeScriptTransaction: ScriptTransactionRecord | null = null;
  let cleanupViewportListeners: (() => void) | null = null;
  let wheelIdleHandle = 0;
  let keyboardIdleHandle = 0;
  let directManipulationIdleHandle = 0;
  let momentumIdleHandle = 0;
  let latestScrollEndPromise: Promise<void> = Promise.resolve();
  let latestSettlePromise: Promise<void> = Promise.resolve();

  const emit = (): void => {
    for (const listener of listeners) {
      listener(state);
    }
  };

  const updateState = (patch: Partial<AnchoredVirtualListScrollStateSnapshot>): void => {
    state = {
      ...state,
      ...patch,
    };
    emit();
  };

  const syncEdgeState = (): void => {
    if (!adapter) {
      return;
    }
    const edge = adapter.getEdgeState();
    const fallbackTarget =
      edge.atLatest
        ? ({ kind: "edge", edge: "latest" } as const)
        : edge.atStart
          ? ({ kind: "edge", edge: "start" } as const)
          : state.currentScrollTarget;
    updateState({
      edge,
      currentScrollTarget: state.activeTransaction ? state.currentScrollTarget : fallbackTarget,
    });
  };

  const clearTimer = (handle: number): void => {
    if (handle !== 0) {
      clearTimeout(handle);
    }
  };

  const clearInputTimers = (): void => {
    clearTimer(wheelIdleHandle);
    clearTimer(keyboardIdleHandle);
    clearTimer(directManipulationIdleHandle);
    clearTimer(momentumIdleHandle);
    wheelIdleHandle = 0;
    keyboardIdleHandle = 0;
    directManipulationIdleHandle = 0;
    momentumIdleHandle = 0;
  };

  const abortScriptTransaction = (
    reason: Exclude<AnchoredVirtualListTransactionTerminalState, "completed" | "failed">,
    ownerId?: string,
  ): void => {
    const activeScript = activeScriptTransaction;
    if (!activeScript) {
      return;
    }
    if (ownerId && activeScript.id === ownerId) {
      return;
    }
    if (!activeScript.abortController.signal.aborted) {
      activeScript.abortController.abort(new AnchoredVirtualListAbortError(reason));
    }
    if (activeScriptTransaction?.id === activeScript.id) {
      activeScriptTransaction = null;
    }
  };

  const shouldSupersedeActiveScriptTransaction = (
    activeScript: ScriptTransactionRecord,
    incoming: Required<Pick<AnchoredVirtualListTransactionOptions, "priority" | "interruptionPolicy">>,
  ): boolean => {
    if (activeScript.interruptionPolicy === "protected") {
      return false;
    }
    return compareAnchoredVirtualListScrollPriority(incoming.priority, activeScript.priority) >= 0;
  };

  const createAbortedScriptTransaction = <T>(
    reason: Exclude<AnchoredVirtualListTransactionTerminalState, "completed" | "failed">,
  ): AnchoredVirtualListTransactResult<T> => {
    const abortController = new AbortController();
    const error = new AnchoredVirtualListAbortError(reason);
    abortController.abort(error);
    const finished = Promise.reject<T>(error);
    void finished.catch(() => undefined);
    return {
      signal: abortController.signal,
      finished,
    };
  };

  const flushPendingRequestIfPossible = (): void => {
    if (activeTransaction || !pendingRequest) {
      return;
    }
    if (isAnchoredVirtualListUserInputBlocking(state.userInput)) {
      if (state.phase !== "deferred") {
        updateState({ phase: "deferred" });
      }
      return;
    }
    const next = pendingRequest;
    pendingRequest = null;
    updateState({
      phase: "idle",
      pendingTransaction: null,
    });
    void runRequest(next);
  };

  const setUserInputState = (next: AnchoredVirtualListScrollStateSnapshot["userInput"]): void => {
    updateState({
      userInput: next,
      phase:
        !activeTransaction && pendingRequest && isAnchoredVirtualListUserInputBlocking(next)
          ? "deferred"
          : state.phase === "deferred" && !isAnchoredVirtualListUserInputBlocking(next)
            ? "idle"
            : state.phase,
    });
    if (!isAnchoredVirtualListUserInputBlocking(next)) {
      flushPendingRequestIfPossible();
    }
  };

  const scheduleIdleTransition = (
    kind: "wheel" | "keyboard" | "direct-manipulation" | "momentum",
  ): void => {
    const delay = getAnchoredVirtualListUserInputIdleDelay(kind, inputPolicy);
    const timerFactory = (callback: () => void): number => window.setTimeout(callback, delay);
    switch (kind) {
      case "wheel":
        clearTimer(wheelIdleHandle);
        wheelIdleHandle = timerFactory(() => {
          if (state.userInput.kind !== "wheel") {
            return;
          }
          setUserInputState(
            promoteAnchoredVirtualListUserInputToMomentum(state.userInput, resolveNow(options)),
          );
          scheduleIdleTransition("momentum");
        });
        return;
      case "keyboard":
        clearTimer(keyboardIdleHandle);
        keyboardIdleHandle = timerFactory(() => {
          if (state.userInput.kind !== "keyboard") {
            return;
          }
          setUserInputState(clearAnchoredVirtualListUserInput());
        });
        return;
      case "direct-manipulation":
        clearTimer(directManipulationIdleHandle);
        directManipulationIdleHandle = timerFactory(() => {
          if (state.userInput.kind !== "direct-manipulation") {
            return;
          }
          setUserInputState(
            promoteAnchoredVirtualListUserInputToMomentum(state.userInput, resolveNow(options)),
          );
          scheduleIdleTransition("momentum");
        });
        return;
      case "momentum":
        clearTimer(momentumIdleHandle);
        momentumIdleHandle = timerFactory(() => {
          if (state.userInput.kind !== "momentum") {
            return;
          }
          setUserInputState(clearAnchoredVirtualListUserInput());
        });
        return;
    }
  };

  const finalizeActiveTransaction = (
    record: ActiveTransactionRecord,
    terminalState: AnchoredVirtualListTransactionTerminalState,
    errorMessage: string | null = null,
  ): void => {
    if (record.finished) {
      return;
    }
    record.finished = true;
    record.snapshot = {
      ...record.snapshot,
      terminalState,
      errorMessage,
    };
    record.scrollEndDeferred.resolve();
    record.settleDeferred.resolve();
    record.deferred.resolve({
      transactionId: record.snapshot.id,
      request: record.request,
      resolvedTarget: record.resolvedTarget,
      terminalState,
      errorMessage,
    });
    if (activeTransaction === record) {
      activeTransaction = null;
    }
    updateState({
      phase: pendingRequest ? "deferred" : "idle",
      activeTransaction: null,
      currentScrollTarget:
        state.edge.atLatest
          ? { kind: "edge", edge: "latest" }
          : state.edge.atStart
            ? { kind: "edge", edge: "start" }
            : record.resolvedTarget,
      eventualScrollPosition:
        state.edge.atLatest
          ? {
              target: { kind: "edge", edge: "latest" },
              top: 0,
              left: adapter?.readPosition().left ?? 0,
              behavior: "auto",
            }
          : state.eventualScrollPosition,
      lastTerminalState: terminalState,
    });
    flushPendingRequestIfPossible();
  };

  const cancelPendingRequest = (
    record: PendingRequestRecord,
    terminalState: AnchoredVirtualListTransactionTerminalState,
  ): void => {
    record.deferred.resolve({
      transactionId: record.request.id,
      request: record.request,
      resolvedTarget: null,
      terminalState,
      errorMessage: null,
    });
  };

  const queuePendingRequest = (request: PendingRequestRecord): void => {
    if (pendingRequest) {
      cancelPendingRequest(pendingRequest, "superseded");
    }
    pendingRequest = request;
    updateState({
      phase: activeTransaction ? state.phase : "deferred",
      pendingTransaction: request.request,
    });
  };

  const interruptActiveTransaction = (
    terminalState: AnchoredVirtualListTransactionTerminalState,
  ): void => {
    if (!activeTransaction) {
      return;
    }
    activeTransaction.abortController.abort(terminalState);
    finalizeActiveTransaction(activeTransaction, terminalState);
  };

  const handleUserInputStart = (
    kind: "wheel" | "keyboard" | "direct-manipulation",
    pointerType: AnchoredVirtualListScrollStateSnapshot["userInput"]["pointerType"] = null,
  ): void => {
    clearTimer(momentumIdleHandle);
    if (activeScriptTransaction?.interruptionPolicy !== "protected") {
      abortScriptTransaction("interrupted");
    }
    setUserInputState(beginAnchoredVirtualListUserInput(state.userInput, kind, resolveNow(options), pointerType));
    if (activeTransaction && shouldInterruptAnchoredVirtualListRequestForUserInput(activeTransaction.request)) {
      interruptActiveTransaction("interrupted");
    }
    scheduleIdleTransition(kind);
  };

  const executePlan = (record: ActiveTransactionRecord): boolean => {
    if (!adapter) {
      return false;
    }
    const viewport = adapter.getViewport();
    const plan = planAnchoredVirtualListScroll(record.request, record.resolvedTarget);
    if (plan.kind === "none") {
      updateState({
        currentScrollTarget: record.resolvedTarget,
        eventualScrollPosition: state.eventualScrollPosition,
      });
      return false;
    }
    const edgePosition = plan.kind === "edge" ? adapter.resolveEdgePosition?.(plan.edge) : undefined;
    const currentPosition = adapter.readPosition();
    updateState({
      currentScrollTarget: record.resolvedTarget,
      eventualScrollPosition: resolveAnchoredVirtualListEventualScrollPosition(
        plan,
        record.request,
        state,
        edgePosition,
      ),
    });
    switch (plan.kind) {
      case "edge":
        if (
          isWithinScrollEpsilon(currentPosition.top, edgePosition?.top) &&
          (edgePosition?.left == null || isWithinScrollEpsilon(currentPosition.left, edgePosition.left))
        ) {
          return false;
        }
        adapter.scrollToEdge(plan.edge, plan.behavior);
        return true;
      case "position":
        if (
          isWithinScrollEpsilon(currentPosition.top, plan.top) &&
          isWithinScrollEpsilon(currentPosition.left, plan.left)
        ) {
          return false;
        }
        adapter.scrollToPosition(
          {
            kind: "position",
            top: plan.top,
            left: plan.left,
            reason: plan.reason,
          },
          plan.behavior,
        );
        return true;
      case "element":
        return viewport ? executeAnchoredVirtualListElementPlan(viewport, plan) : false;
      default:
        return false;
    }
  };

  const runRequest = async (pending: PendingRequestRecord): Promise<void> => {
    if (!adapter) {
      pending.deferred.resolve({
        transactionId: pending.request.id,
        request: pending.request,
        resolvedTarget: null,
        terminalState: "cancelled",
        errorMessage: "No host adapter connected.",
      });
      return;
    }
    const snapshot: AnchoredVirtualListScrollTransactionSnapshot = {
      id: pending.request.id,
      request: pending.request,
      phase: "planning",
      startedAt: resolveNow(options),
      resolvedTarget: null,
      terminalState: null,
      errorMessage: null,
    };
    const record: ActiveTransactionRecord = {
      ...pending,
      snapshot,
      abortController: new AbortController(),
      scrollEndDeferred: createDeferred<void>(),
      settleDeferred: createDeferred<void>(),
      resolvedTarget: null,
      finished: false,
    };
    activeTransaction = record;
    latestScrollEndPromise = record.scrollEndDeferred.promise;
    latestSettlePromise = record.settleDeferred.promise;
    updateState({
      phase: "planning",
      activeTransaction: record.snapshot,
      pendingTransaction: pendingRequest?.request ?? null,
    });
    try {
      const resolvedTarget = await adapter.resolveTarget(pending.request, state);
      if (record.abortController.signal.aborted) {
        return;
      }
      record.resolvedTarget = resolvedTarget;
      record.snapshot = {
        ...record.snapshot,
        phase: resolvedTarget?.kind === "element" ? "materializing" : "planning",
        resolvedTarget,
      };
      updateState({
        phase: resolvedTarget?.kind === "element" ? "materializing" : "planning",
        activeTransaction: record.snapshot,
      });
      const didScroll = executePlan(record);
      if (record.abortController.signal.aborted) {
        return;
      }
      if (!didScroll) {
        record.scrollEndDeferred.resolve();
        record.settleDeferred.resolve();
        finalizeActiveTransaction(record, "completed");
        return;
      }
      record.snapshot = {
        ...record.snapshot,
        phase: "scrolling",
      };
      updateState({
        phase: "scrolling",
        activeTransaction: record.snapshot,
      });
      await waitForAnchoredVirtualListScrollEnd(adapter.getViewport(), record.abortController.signal);
      record.scrollEndDeferred.resolve();
      if (record.abortController.signal.aborted) {
        return;
      }
      record.snapshot = {
        ...record.snapshot,
        phase: "settling",
      };
      updateState({
        phase: "settling",
        activeTransaction: record.snapshot,
      });
      if (adapter.awaitDomSettle) {
        await adapter.awaitDomSettle(record.abortController.signal);
      } else {
        await waitForAnchoredVirtualListDomSettle(adapter.getViewport(), record.abortController.signal);
      }
      record.settleDeferred.resolve();
      if (record.abortController.signal.aborted) {
        return;
      }
      syncEdgeState();
      finalizeActiveTransaction(record, "completed");
    } catch (error) {
      if (record.abortController.signal.aborted) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      finalizeActiveTransaction(record, "failed", errorMessage);
    }
  };

  const dispatchRequest = (
    request: AnchoredVirtualListScrollRequest,
    ownerScriptId?: string,
  ): Promise<AnchoredVirtualListScrollTransactionResult> => {
    const normalized = normalizeAnchoredVirtualListScrollRequest(request);
    const resolvedPolicy = resolveAnchoredVirtualListInterruptionPolicy(normalized);
    const normalizedRequest: AnchoredVirtualListResolvedRequest = {
      ...normalized,
      interruptionPolicy: resolvedPolicy,
    };
    const hasForeignActiveScript =
      activeScriptTransaction !== null &&
      activeScriptTransaction.id !== ownerScriptId &&
      ownerScriptId === undefined;
    if (hasForeignActiveScript && normalizedRequest.source === "reconcile") {
      return Promise.resolve(resolveTerminalRequestResult(normalizedRequest, "superseded"));
    }
    abortScriptTransaction("superseded", ownerScriptId);
    const deferred = createDeferred<AnchoredVirtualListScrollTransactionResult>();
    const nextRequest: PendingRequestRecord = {
      request: normalizedRequest,
      deferred,
    };
    if (activeTransaction) {
      if (shouldInterruptAnchoredVirtualListRequestForPriority(activeTransaction.request, normalizedRequest)) {
        interruptActiveTransaction("superseded");
        void runRequest(nextRequest);
        return deferred.promise;
      }
      queuePendingRequest(nextRequest);
      return deferred.promise;
    }
    if (shouldDeferAnchoredVirtualListRequestForUserInput(normalizedRequest, state.userInput)) {
      queuePendingRequest(nextRequest);
      return deferred.promise;
    }
    void runRequest(nextRequest);
    return deferred.promise;
  };

  const scriptPrograms: readonly ScriptTransactionProgram[] = [mutationPreserveProgram];

  const writeScriptTerminalCommand = async (
    record: ScriptTransactionRecord,
    command: ScriptTerminalCommand,
  ): Promise<void> => {
    if (record.abortController.signal.aborted) {
      throw record.abortController.signal.reason;
    }
    if (command.kind === "request") {
      const result = await waitForAbortablePromise(
        record.abortController.signal,
        dispatchRequest(command.request, record.id),
      );
      if (result.terminalState === "completed") {
        return;
      }
      if (result.terminalState === "failed") {
        throw new Error(result.errorMessage ?? "Anchored virtual list request failed.");
      }
      throw new AnchoredVirtualListAbortError(result.terminalState);
    }

    adapter?.scrollToPosition(
      {
        kind: "position",
        top: command.top,
        left: command.left,
        reason: command.reason,
      },
      command.behavior,
    );
  };

  const runScriptPrograms = async (
    record: ScriptTransactionRecord,
    stage: ScriptTransactionStage,
  ): Promise<void> => {
    let programIndex = -1;
    const context: ScriptTransactionProgramContext = {
      stage,
      transaction: record,
      adapter,
      write: (command) => writeScriptTerminalCommand(record, command),
      throwIfAborted: () => {
        if (record.abortController.signal.aborted) {
          throw record.abortController.signal.reason;
        }
      },
    };
    const dispatch = async (nextIndex: number): Promise<void> => {
      if (nextIndex <= programIndex) {
        throw new Error("Anchored virtual list transaction middleware delegated twice.");
      }
      programIndex = nextIndex;
      const program = scriptPrograms[nextIndex];
      if (!program) {
        return;
      }
      await program(context, async () => {
        await dispatch(nextIndex + 1);
      });
    };
    await dispatch(0);
  };

  const applyReconcilePosition = (top: number): void => {
    if (!adapter) {
      return;
    }
    adapter.scrollToPosition(
      {
        kind: "position",
        top,
        left: adapter.readPosition().left,
        reason: "reconcile",
      },
      "auto",
    );
    syncEdgeState();
  };

  const attachViewportListeners = (viewport: HTMLDivElement): (() => void) => {
    const ownerDocument = viewport.ownerDocument;
    const handleScroll = (): void => {
      syncEdgeState();
    };
    const handleWheel = (): void => {
      handleUserInputStart("wheel", "mouse");
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!isAnchoredVirtualListKeyboardScrollEvent(event)) {
        return;
      }
      handleUserInputStart("keyboard", "unknown");
    };
    const handlePointerDown = (event: PointerEvent): void => {
      if (event.pointerType !== "touch" && event.pointerType !== "pen") {
        return;
      }
      handleUserInputStart("direct-manipulation", event.pointerType);
    };
    const handlePointerUp = (): void => {
      if (state.userInput.kind === "direct-manipulation") {
        scheduleIdleTransition("direct-manipulation");
      }
    };
    const handleTouchStart = (): void => {
      handleUserInputStart("direct-manipulation", "touch");
    };
    const handleTouchEnd = (): void => {
      if (state.userInput.kind === "direct-manipulation") {
        scheduleIdleTransition("direct-manipulation");
      }
    };
    const handleScrollEnd = (): void => {
      syncEdgeState();
      if (state.userInput.kind === "momentum") {
        setUserInputState(clearAnchoredVirtualListUserInput());
      }
    };

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    viewport.addEventListener("wheel", handleWheel, { passive: true });
    viewport.addEventListener("keydown", handleKeyDown);
    viewport.addEventListener("touchstart", handleTouchStart, { passive: true });
    viewport.addEventListener("touchend", handleTouchEnd, { passive: true });
    viewport.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    if (typeof PointerEvent !== "undefined") {
      viewport.addEventListener("pointerdown", handlePointerDown, { passive: true });
      ownerDocument.addEventListener("pointerup", handlePointerUp, { passive: true });
      ownerDocument.addEventListener("pointercancel", handlePointerUp, { passive: true });
    }
    if ("onscrollend" in viewport) {
      viewport.addEventListener("scrollend", handleScrollEnd);
    }
    return () => {
      viewport.removeEventListener("scroll", handleScroll);
      viewport.removeEventListener("wheel", handleWheel);
      viewport.removeEventListener("keydown", handleKeyDown);
      viewport.removeEventListener("touchstart", handleTouchStart);
      viewport.removeEventListener("touchend", handleTouchEnd);
      viewport.removeEventListener("touchcancel", handleTouchEnd);
      if (typeof PointerEvent !== "undefined") {
        viewport.removeEventListener("pointerdown", handlePointerDown);
        ownerDocument.removeEventListener("pointerup", handlePointerUp);
        ownerDocument.removeEventListener("pointercancel", handlePointerUp);
      }
      if ("onscrollend" in viewport) {
        viewport.removeEventListener("scrollend", handleScrollEnd);
      }
    };
  };

  const handle: AnchoredVirtualListScrollHandle = {
    request(request) {
      return dispatchRequest(request);
    },
    async notifyMutation(mutation) {
      const derivedRequest = deriveAnchoredVirtualListMutationRequest(mutation, state.edge);
      if (!derivedRequest) {
        return null;
      }
      return dispatchRequest(derivedRequest);
    },
    transact<T>(
      update: (transaction: AnchoredVirtualListTransactionContext) => T | Promise<T>,
      transactionOptions?: AnchoredVirtualListTransactionOptions,
    ): AnchoredVirtualListTransactResult<T> {
      if (!adapter) {
        const abortController = new AbortController();
        const error = new Error("No host adapter connected.");
        abortController.abort(error);
        const finished = Promise.reject<T>(error);
        void finished.catch(() => undefined);
        return {
          signal: abortController.signal,
          finished,
        };
      }
      const normalizedOptions = resolveScriptTransactionOptions(transactionOptions);
      if (activeScriptTransaction) {
        if (
          !shouldSupersedeActiveScriptTransaction(activeScriptTransaction, {
            priority: normalizedOptions.priority,
            interruptionPolicy: normalizedOptions.interruptionPolicy,
          })
        ) {
          return createAbortedScriptTransaction("superseded");
        }
        abortScriptTransaction("superseded");
      }

      const scriptRecord: ScriptTransactionRecord = {
        id: normalizedOptions.id,
        abortController: new AbortController(),
        before: createTransactionBeforeSnapshot(adapter),
        priority: normalizedOptions.priority,
        interruptionPolicy: normalizedOptions.interruptionPolicy,
        debugLabel: normalizedOptions.debugLabel,
      startedAt: resolveNow(options),
      commitPromise: null,
      settlePromise: null,
      mutationRecord: null,
      preserveAnchor: false,
      insertMotionBatch: null,
      visibleAnchor: readScriptVisibleAnchorSnapshot(adapter),
    };
      activeScriptTransaction = scriptRecord;

      const throwIfAborted = (): void => {
        if (scriptRecord.abortController.signal.aborted) {
          throw scriptRecord.abortController.signal.reason;
        }
      };

      const guard = async <TGuard>(promise: Promise<TGuard>): Promise<TGuard> =>
        await waitForAbortablePromise(scriptRecord.abortController.signal, promise);

      const commit = async (): Promise<void> => {
        if (!scriptRecord.commitPromise) {
          scriptRecord.commitPromise = (async () => {
            const shouldDelayCommitUntilNextFrame = !scriptRecord.preserveAnchor || scriptRecord.mutationRecord === null;
            if (shouldDelayCommitUntilNextFrame) {
              await waitForAnchoredVirtualListAnimationFrame(scriptRecord.abortController.signal);
            }
            throwIfAborted();
            await runScriptPrograms(scriptRecord, "commit");
          })();
          void scriptRecord.commitPromise.catch(() => undefined);
        }
        await guard(scriptRecord.commitPromise);
      };

      const settled = async (): Promise<void> => {
        if (!scriptRecord.settlePromise) {
          scriptRecord.settlePromise = (async () => {
            await commit();
            if (adapter?.awaitDomSettle) {
              await adapter.awaitDomSettle(scriptRecord.abortController.signal);
              return;
            }
            await waitForAnchoredVirtualListDomSettle(adapter?.getViewport() ?? null, scriptRecord.abortController.signal);
          })();
          void scriptRecord.settlePromise.catch(() => undefined);
        }
        await guard(scriptRecord.settlePromise);
      };

      const executeTransactionScroll = async (request: AnchoredVirtualListScrollRequest): Promise<void> => {
        throwIfAborted();
        const result = await guard(dispatchRequest(request, scriptRecord.id));
        if (result.terminalState === "completed") {
          return;
        }
        if (result.terminalState === "failed") {
          throw new Error(result.errorMessage ?? "Anchored virtual list request failed.");
        }
        throw new AnchoredVirtualListAbortError(result.terminalState);
      };

      const scroll: AnchoredVirtualListTransactionScrollController = {
        pinLatest: async (options = {}) => {
          await executeTransactionScroll({
            intent: "pin",
            target: { kind: "edge", edge: "latest" },
            source: "mutation",
            priority: scriptRecord.priority,
            behavior: options.behavior ?? "auto",
            settle: "scroll-end",
            interruptionPolicy: scriptRecord.interruptionPolicy,
            debugLabel: options.debugLabel ?? `transact:${scriptRecord.id}:pin-latest`,
          });
        },
        seekStart: async (options = {}) => {
          await executeTransactionScroll({
            intent: "seek",
            target: { kind: "edge", edge: "start" },
            source: "mutation",
            priority: scriptRecord.priority,
            behavior: options.behavior ?? "auto",
            settle: "scroll-end",
            interruptionPolicy: scriptRecord.interruptionPolicy,
            debugLabel: options.debugLabel ?? `transact:${scriptRecord.id}:seek-start`,
          });
        },
        revealElement: async (target, options = {}) => {
          await executeTransactionScroll({
            intent: "reveal",
            target: {
              kind: "element",
              selector: target.selector,
              element: target.element ?? null,
              block: target.block ?? "nearest",
              inline: target.inline ?? "nearest",
              scrollMode: options.ifNeeded === false ? "always" : "if-needed",
            },
            source: "mutation",
            priority: scriptRecord.priority,
            behavior: options.behavior ?? "auto",
            settle: "scroll-end",
            interruptionPolicy: scriptRecord.interruptionPolicy,
            debugLabel: options.debugLabel ?? `transact:${scriptRecord.id}:reveal-element`,
          });
        },
      };

      const context: AnchoredVirtualListTransactionContext = {
        before: scriptRecord.before,
        signal: scriptRecord.abortController.signal,
        scroll,
        mutation: {
          append: (input: AnchoredVirtualListAppendMutation = {}) => {
            scriptRecord.mutationRecord = {
              kind: "append",
              inserted: input.inserted ?? [],
            };
          },
          prepend: (input: AnchoredVirtualListPrependMutation = {}) => {
            scriptRecord.mutationRecord = {
              kind: "prepend",
              inserted: input.inserted ?? [],
            };
          },
          resize: () => {
            scriptRecord.mutationRecord = { kind: "resize" };
          },
          collapse: () => {
            scriptRecord.mutationRecord = { kind: "collapse" };
          },
          expand: () => {
            scriptRecord.mutationRecord = { kind: "expand" };
          },
        },
        anchor: {
          preserve: () => {
            scriptRecord.preserveAnchor = true;
          },
        },
        commit,
        settled,
        guard,
        throwIfAborted,
      };

      const finished = (async () => {
        try {
          const value = await update(context);
          if (scriptRecord.preserveAnchor && scriptRecord.commitPromise === null) {
            await commit();
          }
          if (activeScriptTransaction?.id === scriptRecord.id) {
            activeScriptTransaction = null;
          }
          return value;
        } catch (error) {
          if (activeScriptTransaction?.id === scriptRecord.id) {
            activeScriptTransaction = null;
          }
          throw error;
        }
      })();
      void finished.catch(() => undefined);

      return {
        signal: scriptRecord.abortController.signal,
        finished,
      };
    },
    interrupt(reason = "cancelled") {
      if (reason !== "completed" && reason !== "failed") {
        abortScriptTransaction(reason);
      }
      interruptActiveTransaction(reason);
      if (pendingRequest) {
        cancelPendingRequest(pendingRequest, reason);
        pendingRequest = null;
        updateState({
          phase: "idle",
          pendingTransaction: null,
        });
      }
    },
    getState() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => {
        listeners.delete(listener);
      };
    },
    awaitScrollEnd() {
      return latestScrollEndPromise;
    },
    awaitSettle() {
      return latestSettlePromise;
    },
  };

  return {
    handle,
    connect(nextAdapter) {
      abortScriptTransaction("superseded");
      cleanupViewportListeners?.();
      adapter = nextAdapter;
      syncEdgeState();
      const viewport = adapter.getViewport();
      cleanupViewportListeners = viewport ? attachViewportListeners(viewport) : null;
      flushPendingRequestIfPossible();
    },
    publishInsertMotionBatch(batch) {
      const activeScript = activeScriptTransaction;
      if (activeScript && !activeScript.abortController.signal.aborted) {
        activeScript.insertMotionBatch = batch;
        if (activeScript.preserveAnchor) {
          return;
        }
        void runScriptPrograms(activeScript, "insert-motion").catch(() => {
          /* insert-motion facts are best-effort until a program consumes them */
        });
        return;
      }

      const latestHeight = resolveObservedInsertMotionHeight(adapter, batch, "latest");
      if (latestHeight > 0 && batch.snapshot.atLatest) {
        syncEdgeState();
        return;
      }

      const olderHeight = resolveObservedInsertMotionHeight(adapter, batch, "older");
      if (olderHeight <= 0 || !batch.snapshot.atStart) {
        return;
      }
      const preserveTop = getBottomAnchoredScrollTopFromVirtualOffset(batch.snapshot.virtualOffset);
      const revealTop = getBottomAnchoredScrollTopFromVirtualOffset(
        batch.snapshot.virtualOffset + resolveInsertMotionRevealPx(batch, olderHeight),
      );
      applyReconcilePosition(preserveTop);
      void (async () => {
        if (revealTop === preserveTop) {
          return;
        }
        await waitForAnchoredVirtualListDomSettle(adapter?.getViewport() ?? null, new AbortController().signal);
        await dispatchRequest({
          intent: "stabilize",
          target: {
            kind: "position",
            top: revealTop,
            left: adapter?.readPosition().left ?? 0,
          },
          source: "reconcile",
          priority: "background",
          behavior: "smooth",
          settle: "settle",
          debugLabel: "insert-motion-older-reveal",
        });
      })().catch(() => {
        /* insert-motion reconciliation should not surface as an uncaught promise */
      });
    },
    disconnect() {
      abortScriptTransaction("cancelled");
      cleanupViewportListeners?.();
      cleanupViewportListeners = null;
      clearInputTimers();
      adapter = null;
      handle.interrupt("cancelled");
      state = createInitialState();
      emit();
    },
  };
};
