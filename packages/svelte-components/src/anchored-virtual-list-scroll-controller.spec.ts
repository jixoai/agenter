// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createAnchoredVirtualListScrollController } from "./anchored-virtual-list-scroll-controller";
import { AnchoredVirtualListAbortError } from "./anchored-virtual-list-scroll-error";
import type {
  AnchoredVirtualListHostAdapter,
  AnchoredVirtualListResolvedRequest,
  AnchoredVirtualListResolvedTarget,
  AnchoredVirtualListScrollStateSnapshot,
} from "./anchored-virtual-list-scroll.types";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
};

const createViewport = () => {
  const viewport = document.createElement("div");
  viewport.tabIndex = 0;
  let scrollTop = 0;
  let scrollLeft = 0;
  Object.defineProperty(viewport, "scrollTop", {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value;
    },
  });
  Object.defineProperty(viewport, "scrollLeft", {
    configurable: true,
    get: () => scrollLeft,
    set: (value: number) => {
      scrollLeft = value;
    },
  });
  Object.defineProperty(viewport, "scrollHeight", {
    configurable: true,
    get: () => 720,
  });
  Object.defineProperty(viewport, "clientHeight", {
    configurable: true,
    get: () => 240,
  });
  Object.defineProperty(viewport, "scrollTo", {
    configurable: true,
    value: (options: ScrollToOptions) => {
      scrollTop = options.top ?? scrollTop;
      scrollLeft = options.left ?? scrollLeft;
      viewport.dispatchEvent(new Event("scroll"));
      window.setTimeout(() => {
        viewport.dispatchEvent(new Event("scrollend"));
      }, 0);
    },
  });
  Object.defineProperty(viewport, "onscrollend", {
    configurable: true,
    writable: true,
    value: null,
  });
  viewport.getBoundingClientRect = () =>
    ({
      top: 0,
      left: 0,
      bottom: 240,
      right: 320,
      width: 320,
      height: 240,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    }) as DOMRect;
  document.body.append(viewport);
  return viewport;
};

const createMeasuredElement = (
  parent: HTMLElement,
  selectorAttribute: string,
  selectorValue: string,
  height: number,
) => {
  const element = document.createElement("div");
  element.setAttribute(selectorAttribute, selectorValue);
  Object.defineProperty(element, "offsetHeight", {
    configurable: true,
    get: () => height,
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    get: () => height,
  });
  element.getBoundingClientRect = () =>
    ({
      top: 0,
      left: 0,
      bottom: height,
      right: 320,
      width: 320,
      height,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    }) as DOMRect;
  parent.append(element);
  return element;
};

const createHostAdapter = (options: {
  resolveTarget?: (
    request: AnchoredVirtualListResolvedRequest,
    snapshot: AnchoredVirtualListScrollStateSnapshot,
  ) => AnchoredVirtualListResolvedTarget | Promise<AnchoredVirtualListResolvedTarget | null> | null;
  awaitDomSettle?: (signal: AbortSignal) => Promise<void>;
  edgeState?: { atLatest: boolean; atStart: boolean };
} = {}) => {
  const viewport = createViewport();
  let edgeState = options.edgeState ?? { atLatest: true, atStart: false };
  const adapter: AnchoredVirtualListHostAdapter = {
    getViewport: () => viewport,
    getContentRoot: () => viewport,
    getEdgeState: () => edgeState,
    readPosition: () => ({
      top: viewport.scrollTop,
      left: viewport.scrollLeft,
    }),
    resolveEdgePosition: (edge) => ({
      top: edge === "latest" ? 0 : -480,
      left: 0,
    }),
    resolveTarget: async (request, snapshot) =>
      (await options.resolveTarget?.(request, snapshot)) ??
      (request.target.kind === "edge"
        ? request.target
        : request.target.kind === "position"
          ? {
              kind: "position",
              top: request.target.top ?? 0,
              left: request.target.left ?? 0,
              reason: "requested",
            }
          : null),
    scrollToEdge: (edge) => {
      viewport.scrollTop = edge === "latest" ? 0 : -480;
      edgeState = {
        atLatest: edge === "latest",
        atStart: edge === "start",
      };
      viewport.dispatchEvent(new Event("scroll"));
      window.setTimeout(() => {
        viewport.dispatchEvent(new Event("scrollend"));
      }, 0);
    },
    scrollToPosition: (position) => {
      viewport.scrollTo({
        top: position.top,
        left: position.left,
      });
      edgeState = {
        atLatest: position.top === 0,
        atStart: position.top <= -480,
      };
    },
    awaitDomSettle:
      options.awaitDomSettle ??
      (async () => {
        await Promise.resolve();
      }),
  };
  return { adapter, viewport, setEdgeState: (next: typeof edgeState) => (edgeState = next) };
};

describe("Feature: anchored virtual list scroll controller", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      window.setTimeout(() => {
        callback(Date.now());
      }, 0),
    );
    vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
      window.clearTimeout(handle);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  test("Scenario: Given a low-priority reveal is active When wheel input starts Then the transaction is interrupted", async () => {
    const resolveTargetGate = createDeferred<AnchoredVirtualListResolvedTarget | null>();
    const controller = createAnchoredVirtualListScrollController();
    const { adapter, viewport } = createHostAdapter({
      resolveTarget: () => resolveTargetGate.promise,
    });
    controller.connect(adapter);

    const resultPromise = controller.handle.request({
      intent: "reveal",
      target: { kind: "position", top: -120 },
      priority: "background",
    });
    await Promise.resolve();

    viewport.dispatchEvent(new Event("wheel"));

    const result = await resultPromise;
    expect(result.terminalState).toBe("interrupted");
    expect(controller.handle.getState().userInput.kind).toBe("wheel");

    resolveTargetGate.resolve(null);
  });

  test("Scenario: Given a lower-priority transaction is active When a higher-priority request arrives Then the older one is superseded", async () => {
    const firstGate = createDeferred<AnchoredVirtualListResolvedTarget | null>();
    const controller = createAnchoredVirtualListScrollController();
    let callCount = 0;
    const { adapter } = createHostAdapter({
      resolveTarget: () => {
        callCount += 1;
        if (callCount === 1) {
          return firstGate.promise;
        }
        return { kind: "edge", edge: "latest" };
      },
    });
    controller.connect(adapter);

    const lowPriority = controller.handle.request({
      intent: "reveal",
      target: { kind: "position", top: -160 },
      priority: "background",
    });
    await Promise.resolve();

    const highPriority = controller.handle.request({
      intent: "seek",
      target: { kind: "edge", edge: "latest" },
      priority: "critical",
    });

    expect((await lowPriority).terminalState).toBe("superseded");
    expect((await highPriority).terminalState).toBe("completed");

    firstGate.resolve(null);
  });

  test("Scenario: Given a reconcile request is active When a newer same-priority reconcile arrives Then the older reconcile is superseded instead of queueing behind stale geometry", async () => {
    const firstGate = createDeferred<AnchoredVirtualListResolvedTarget | null>();
    const controller = createAnchoredVirtualListScrollController();
    let callCount = 0;
    const { adapter } = createHostAdapter({
      resolveTarget: () => {
        callCount += 1;
        if (callCount === 1) {
          return firstGate.promise;
        }
        return { kind: "position", top: -96, left: 0, reason: "requested" };
      },
    });
    controller.connect(adapter);

    const staleReconcile = controller.handle.request({
      intent: "stabilize",
      target: { kind: "position", top: -48 },
      source: "reconcile",
      priority: "background",
    });
    await Promise.resolve();

    const freshReconcile = controller.handle.request({
      intent: "stabilize",
      target: { kind: "position", top: -96 },
      source: "reconcile",
      priority: "background",
    });

    expect((await staleReconcile).terminalState).toBe("superseded");
    expect((await freshReconcile).terminalState).toBe("completed");

    firstGate.resolve(null);
  });

  test("Scenario: Given direct manipulation is active When a reconcile request arrives Then it is deferred until user input settles", async () => {
    vi.useFakeTimers();
    const controller = createAnchoredVirtualListScrollController({
      userInputPolicy: {
        directManipulationIdleMs: 1,
        momentumIdleMs: 1,
      },
    });
    const { adapter, viewport } = createHostAdapter();
    controller.connect(adapter);

    viewport.dispatchEvent(new Event("touchstart"));

    const pendingPromise = controller.handle.request({
      intent: "stabilize",
      target: { kind: "edge", edge: "latest" },
      source: "reconcile",
      priority: "background",
    });
    await Promise.resolve();

    expect(controller.handle.getState().phase).toBe("deferred");

    viewport.dispatchEvent(new Event("touchend"));
    await vi.advanceTimersByTimeAsync(32);
    await Promise.resolve();

    const result = await pendingPromise;
    expect(result.terminalState).toBe("completed");
    expect(controller.handle.getState().userInput.kind).toBe("idle");
  });

  test("Scenario: Given a position request is running When state is read Then current target and eventual position are exposed", async () => {
    const settleGate = createDeferred<void>();
    const controller = createAnchoredVirtualListScrollController();
    const { adapter } = createHostAdapter({
      awaitDomSettle: async () => {
        await settleGate.promise;
      },
    });
    controller.connect(adapter);

    const requestPromise = controller.handle.request({
      intent: "seek",
      target: { kind: "position", top: -88 },
    });
    await Promise.resolve();
    await Promise.resolve();

    const snapshot = controller.handle.getState();
    expect(snapshot.currentScrollTarget).toMatchObject({
      kind: "position",
      top: -88,
      left: 0,
    });
    expect(snapshot.eventualScrollPosition).toMatchObject({
      top: -88,
      left: 0,
    });

    settleGate.resolve();
    expect((await requestPromise).terminalState).toBe("completed");
  });

  test("Scenario: Given a virtualized selector resolves through host materialization When reveal runs Then the controller keeps element semantics and drives scrollIntoView", async () => {
    const controller = createAnchoredVirtualListScrollController();
    const settleGate = createDeferred<void>();
    const { adapter, viewport } = createHostAdapter({
      awaitDomSettle: async () => {
        await settleGate.promise;
      },
    });
    const materialized = document.createElement("div");
    materialized.dataset.row = "42";
    materialized.scrollIntoView = vi.fn(() => {
      viewport.dispatchEvent(new Event("scroll"));
      window.setTimeout(() => {
        viewport.dispatchEvent(new Event("scrollend"));
      }, 0);
    });
    materialized.getBoundingClientRect = () =>
      ({
        top: 320,
        left: 0,
        bottom: 400,
        right: 280,
        width: 280,
        height: 80,
        x: 0,
        y: 320,
        toJSON() {
          return {};
        },
      }) as DOMRect;
    viewport.append(materialized);
    controller.connect({
      ...adapter,
      resolveTarget: async (request, snapshot) => {
        if (request.target.kind !== "element") {
          return adapter.resolveTarget(request, snapshot);
        }
        await Promise.resolve();
        return {
          kind: "element",
          selector: request.target.selector,
          element: materialized,
          scrollMode: "if-needed",
        };
      },
    });

    const resultPromise = controller.handle.request({
      intent: "reveal",
      target: {
        kind: "element",
        selector: '[data-row="42"]',
      },
      behavior: "smooth",
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(controller.handle.getState().currentScrollTarget).toMatchObject({
      kind: "element",
      selector: '[data-row="42"]',
    });

    settleGate.resolve();
    const result = await resultPromise;

    expect(result.terminalState).toBe("completed");
    expect(materialized.scrollIntoView).toHaveBeenCalled();
  });

  test("Scenario: Given a closure transaction is suspended on a guarded await When wheel input starts Then the transaction throws an anchored abort error", async () => {
    const guardGate = createDeferred<void>();
    const controller = createAnchoredVirtualListScrollController();
    const { adapter, viewport } = createHostAdapter();
    controller.connect(adapter);

    const transaction = controller.handle.transact(async (tx) => {
      await tx.guard(guardGate.promise);
      await tx.commit();
    });

    viewport.dispatchEvent(new Event("wheel"));
    guardGate.resolve();

    await expect(transaction.finished).rejects.toBeInstanceOf(AnchoredVirtualListAbortError);
  });

  test("Scenario: Given latest insert-motion facts publish without an active script transaction When the controller reconciles Then one shared terminal writer handles the batch", async () => {
    vi.useFakeTimers();
    const controller = createAnchoredVirtualListScrollController();
    const { adapter, viewport } = createHostAdapter({
      edgeState: { atLatest: true, atStart: false },
    });
    const scrollToPositionSpy = vi.spyOn(adapter, "scrollToPosition");
    const scrollToEdgeSpy = vi.spyOn(adapter, "scrollToEdge");
    controller.connect(adapter);

    const inserted = createMeasuredElement(viewport, "data-batch-anchor", "latest-1", 56);

    controller.publishInsertMotionBatch({
      entries: [{ element: inserted, motion: "latest" }],
      snapshot: {
        scrollTop: 0,
        clientHeight: 240,
        scrollHeight: 720,
        virtualOffset: 0,
        atLatest: true,
        atStart: false,
      },
    });

    await vi.runAllTimersAsync();

    expect(scrollToPositionSpy).toHaveBeenCalledTimes(1);
    expect(scrollToPositionSpy).toHaveBeenLastCalledWith(
      {
        kind: "position",
        top: -24,
        left: 0,
        reason: "reconcile",
      },
      "auto",
    );
    expect(scrollToEdgeSpy).toHaveBeenCalledTimes(1);
    expect(scrollToEdgeSpy).toHaveBeenLastCalledWith("latest", "smooth");
    expect(viewport.scrollTop).toBe(0);
  });

  test("Scenario: Given an active preserve transaction owns the viewport When latest insert-motion facts arrive Then the transaction remains the only terminal writer", async () => {
    const controller = createAnchoredVirtualListScrollController();
    const { adapter, viewport } = createHostAdapter({
      edgeState: { atLatest: true, atStart: false },
    });
    const scrollToPositionSpy = vi.spyOn(adapter, "scrollToPosition");
    const scrollToEdgeSpy = vi.spyOn(adapter, "scrollToEdge");
    controller.connect(adapter);

    const inserted = createMeasuredElement(viewport, "data-transaction-anchor", "append-1", 48);

    const transaction = controller.handle.transact(async (tx) => {
      tx.mutation.append({
        inserted: [{ selector: '[data-transaction-anchor="append-1"]' }],
      });
      tx.anchor.preserve();
      await tx.commit();

      controller.publishInsertMotionBatch({
        entries: [{ element: inserted, motion: "latest" }],
        snapshot: {
          scrollTop: 0,
          clientHeight: 240,
          scrollHeight: 720,
          virtualOffset: 0,
          atLatest: true,
          atStart: false,
        },
      });

      await tx.scroll.pinLatest({
        behavior: "auto",
        debugLabel: "unit-append-pin-latest",
      });
    });

    await transaction.finished;

    expect(scrollToPositionSpy).toHaveBeenCalledTimes(1);
    expect(scrollToPositionSpy).toHaveBeenLastCalledWith(
      {
        kind: "position",
        top: -48,
        left: 0,
        reason: "reconcile",
      },
      "auto",
    );
    expect(scrollToEdgeSpy).toHaveBeenCalledTimes(1);
    expect(scrollToEdgeSpy).toHaveBeenLastCalledWith("latest", "auto");
  });

  test("Scenario: Given a closure append transaction preserves anchor When commit and pinLatest run Then the viewport first preserves and then returns to latest", async () => {
    const controller = createAnchoredVirtualListScrollController();
    const { adapter, viewport } = createHostAdapter();
    controller.connect(adapter);

    const transaction = controller.handle.transact(async (tx) => {
      const inserted = document.createElement("div");
      inserted.dataset.rowId = "append-1";
      inserted.getBoundingClientRect = () =>
        ({
          top: 0,
          left: 0,
          right: 0,
          bottom: 120,
          width: 0,
          height: 120,
          x: 0,
          y: 0,
          toJSON() {
            return {};
          },
        }) as DOMRect;
      viewport.append(inserted);

      tx.mutation.append({
        inserted: [{ selector: '[data-row-id="append-1"]' }],
      });
      tx.anchor.preserve();

      await tx.commit();
      expect(viewport.scrollTop).toBe(-120);

      await tx.scroll.pinLatest({ behavior: "auto" });
      expect(viewport.scrollTop).toBe(0);
    });

    await expect(transaction.finished).resolves.toBeUndefined();
  });
});
