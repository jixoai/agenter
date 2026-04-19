import {
  createIdleAnchoredVirtualListUserInputState,
  getAnchoredVirtualListUserInputIdleDelay,
  isAnchoredVirtualListKeyboardScrollEvent,
  promoteAnchoredVirtualListUserInputToMomentum,
  resolveAnchoredVirtualListUserInputPolicy,
} from "./anchored-virtual-list-scroll-arbitration";
import {
  getBottomAnchoredDistanceToLatest,
  getBottomAnchoredDistanceToStart,
} from "./bottom-anchored-scroll";
import type {
  ScrollController,
  ScrollControllerInternals,
  ScrollControllerWithInternals,
  ScrollObservedDom,
  ScrollQueryTree,
  ScrollTrigger,
  ScrollTriggerBinding,
  ScrollTriggerName,
} from "./named-scroll-controller.types";
import { SCROLL_CONTROLLER_INTERNALS } from "./named-scroll-controller.types";
import type {
  ActionTriggerQuery,
  CollectionDeltaDirection,
  CollectionDeltaTriggerQuery,
  EdgeTriggerQuery,
  InsertBatchMotion,
  InsertBatchTriggerQuery,
  MaterializationTriggerQuery,
  OverflowTriggerQuery,
  ResizeTriggerQuery,
  ScrollMetricsTriggerQuery,
  UserInputTriggerQuery,
  VisibilityTriggerQuery,
} from "./named-scroll-trigger.types";

export const ANCHORED_VIRTUAL_LIST_INSERT_BATCH_EVENT = "agenter:anchored-insert-batch";
export const ANCHORED_VIRTUAL_LIST_COLLECTION_DELTA_EVENT = "agenter:anchored-collection-delta";

export interface AnchoredVirtualListCollectionDeltaEventDetail {
  direction: CollectionDeltaDirection;
  insertedKeys: readonly string[];
  removedKeys: readonly string[];
  anchorKey: string | null;
}

export interface AnchoredVirtualListInsertBatchEventDetail {
  motion: InsertBatchMotion;
  elements: readonly HTMLElement[];
  extentPx: number;
  nearestElement: HTMLElement | null;
}

const JS_IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const requireControllerInternals = (controller: ScrollController): ScrollControllerInternals => {
  const candidate = controller as ScrollControllerWithInternals;
  const internals = candidate[SCROLL_CONTROLLER_INTERNALS];
  if (!internals) {
    throw new Error("ScrollTriggerBinding.connect() received a controller without trigger internals.");
  }
  return internals;
};

const createTriggerBinding = <TQuery extends object>(input: {
  family: string;
  cost: ScrollTrigger<TQuery>["cost"];
  observe(dom: ScrollObservedDom, state: TQuery, notify: () => void): () => void;
  createState(): TQuery;
  consume(state: TQuery): void;
}): ScrollTrigger<TQuery> => ({
  family: input.family,
  cost: input.cost,
  observe(dom) {
    return {
      connect(controller, options) {
        const internals = requireControllerInternals(controller);
        const state = input.createState();
        const registration = internals.registerTrigger(options.name.key, {
          family: input.family,
          cost: input.cost,
          readQuery: () => ({ ...state }) as Record<string, unknown>,
          consume: () => {
            input.consume(state);
          },
        });
        const cleanup = input.observe(dom, state, () => {
          registration.notify();
        });
        registration.notify();
        return () => {
          cleanup();
          registration.disconnect();
        };
      },
    } satisfies ScrollTriggerBinding<TQuery>;
  },
});

const resolveBlockSize = (element: HTMLElement): number => {
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

const compareKeyArrays = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const createVisibilityState = (): VisibilityTriggerQuery => ({
  visible: false,
  entered: false,
  exited: false,
  ratio: 0,
  element: null,
});

const createResizeState = (): ResizeTriggerQuery => ({
  resized: false,
  inlineSize: 0,
  blockSize: 0,
  grew: false,
  shrunk: false,
  element: null,
});

const createActionState = (): ActionTriggerQuery => ({
  fired: false,
  count: 0,
  sourceElement: null,
  lastFiredAt: null,
});

const createUserInputState = (): UserInputTriggerQuery => ({
  ...createIdleAnchoredVirtualListUserInputState(),
  entered: false,
  exited: false,
  momentum: false,
});

const createScrollMetricsState = (): ScrollMetricsTriggerQuery => ({
  scrollTop: 0,
  scrollHeight: 0,
  clientHeight: 0,
  scrollLeft: 0,
  scrollWidth: 0,
  clientWidth: 0,
  changed: false,
});

const createEdgeState = (): EdgeTriggerQuery => ({
  atLatest: true,
  atStart: true,
  enteredLatest: false,
  leftLatest: false,
  enteredStart: false,
  leftStart: false,
  distanceToLatestPx: 0,
  distanceToStartPx: 0,
});

const createOverflowState = (): OverflowTriggerQuery => ({
  overflowing: false,
  becameOverflowing: false,
  becameContained: false,
  overflowPx: 0,
  visibleExtentPx: 0,
  contentExtentPx: 0,
});

const createCollectionDeltaState = (): CollectionDeltaTriggerQuery => ({
  changed: false,
  direction: "unknown",
  insertedKeys: [],
  removedKeys: [],
  anchorKey: null,
});

const createMaterializationState = (selector: string): MaterializationTriggerQuery => ({
  materialized: false,
  enteredMaterialized: false,
  leftMaterialized: false,
  element: null,
  selector,
});

const createInsertBatchState = (motion: InsertBatchMotion): InsertBatchTriggerQuery => ({
  changed: false,
  motion,
  elements: [],
  extentPx: 0,
  nearestElement: null,
});

export const defineScrollTriggerName = <TQuery>(key: string): ScrollTriggerName<TQuery> => {
  if (!JS_IDENTIFIER_PATTERN.test(key)) {
    throw new Error(`Invalid scroll trigger name "${key}".`);
  }
  return { key };
};

export const readScrollTriggerQuery = <TQuery>(
  query: ScrollQueryTree,
  name: ScrollTriggerName<TQuery>,
  fallback: TQuery,
): TQuery => {
  const subtree = query[name.key];
  if (subtree && typeof subtree === "object") {
    return subtree as TQuery;
  }
  return fallback;
};

export const createVisibilityTrigger = (options: {
  element?: (dom: ScrollObservedDom) => Element | null;
  root?: (dom: ScrollObservedDom) => Element | null;
  threshold?: number | number[];
  rootMargin?: string;
} = {}): ScrollTrigger<VisibilityTriggerQuery> =>
  createTriggerBinding({
    family: "VisibilityTrigger",
    cost: "observer",
    createState: createVisibilityState,
    consume(state) {
      state.entered = false;
      state.exited = false;
    },
    observe(dom, state, notify) {
      const element = options.element?.(dom) ?? dom.element ?? null;
      state.element = element;
      const root = options.root?.(dom) ?? dom.viewport ?? null;
      if (!(element instanceof Element) || typeof IntersectionObserver === "undefined") {
        return () => {};
      }
      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) {
            return;
          }
          const previousVisible = state.visible;
          state.visible = entry.isIntersecting;
          state.ratio = entry.intersectionRatio;
          state.entered = !previousVisible && state.visible;
          state.exited = previousVisible && !state.visible;
          notify();
        },
        {
          root: root instanceof Element ? root : null,
          threshold: options.threshold,
          rootMargin: options.rootMargin,
        },
      );
      observer.observe(element);
      return () => {
        observer.disconnect();
      };
    },
  });

export const createResizeTrigger = (options: {
  element?: (dom: ScrollObservedDom) => Element | null;
} = {}): ScrollTrigger<ResizeTriggerQuery> =>
  createTriggerBinding({
    family: "ResizeTrigger",
    cost: "observer",
    createState: createResizeState,
    consume(state) {
      state.resized = false;
      state.grew = false;
      state.shrunk = false;
    },
    observe(dom, state, notify) {
      const element = options.element?.(dom) ?? dom.element ?? null;
      state.element = element;
      if (!(element instanceof Element) || typeof ResizeObserver === "undefined") {
        return () => {};
      }
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) {
          return;
        }
        const box = Array.isArray(entry.borderBoxSize) ? entry.borderBoxSize[0] : entry.borderBoxSize;
        const nextInlineSize = Math.round(box?.inlineSize ?? entry.contentRect.width);
        const nextBlockSize = Math.round(box?.blockSize ?? entry.contentRect.height);
        state.resized = true;
        state.grew = nextBlockSize > state.blockSize;
        state.shrunk = nextBlockSize < state.blockSize;
        state.inlineSize = nextInlineSize;
        state.blockSize = nextBlockSize;
        notify();
      });
      observer.observe(element);
      return () => {
        observer.disconnect();
      };
    },
  });

export const createActionTrigger = (options: {
  event?: keyof HTMLElementEventMap;
  element?: (dom: ScrollObservedDom) => Element | null;
} = {}): ScrollTrigger<ActionTriggerQuery> =>
  createTriggerBinding({
    family: "ActionTrigger",
    cost: "event",
    createState: createActionState,
    consume(state) {
      state.fired = false;
    },
    observe(dom, state, notify) {
      const element = options.element?.(dom) ?? dom.element ?? null;
      if (!(element instanceof Element)) {
        return () => {};
      }
      const eventName = options.event ?? "click";
      const handleEvent = (): void => {
        state.fired = true;
        state.count += 1;
        state.sourceElement = element;
        state.lastFiredAt = Date.now();
        notify();
      };
      element.addEventListener(eventName, handleEvent);
      return () => {
        element.removeEventListener(eventName, handleEvent);
      };
    },
  });

export const createUserInputTrigger = (options: {
  viewport?: (dom: ScrollObservedDom) => HTMLElement | null;
  policy?: Parameters<typeof resolveAnchoredVirtualListUserInputPolicy>[0];
} = {}): ScrollTrigger<UserInputTriggerQuery> =>
  createTriggerBinding({
    family: "UserInputTrigger",
    cost: "event",
    createState: createUserInputState,
    consume(state) {
      state.entered = false;
      state.exited = false;
    },
    observe(dom, state, notify) {
      const viewport = options.viewport?.(dom) ?? dom.viewport ?? null;
      if (!(viewport instanceof HTMLElement)) {
        return () => {};
      }
      const policy = resolveAnchoredVirtualListUserInputPolicy(options.policy);
      let idleHandle = 0;
      const clearIdleHandle = (): void => {
        if (idleHandle !== 0) {
          window.clearTimeout(idleHandle);
          idleHandle = 0;
        }
      };
      const scheduleIdle = (kind: "wheel" | "keyboard" | "direct-manipulation" | "momentum"): void => {
        clearIdleHandle();
        idleHandle = window.setTimeout(() => {
          if (kind === "wheel" || kind === "direct-manipulation") {
            const momentumState = promoteAnchoredVirtualListUserInputToMomentum(state, Date.now());
            state.active = momentumState.active;
            state.kind = momentumState.kind;
            state.pointerType = momentumState.pointerType;
            state.startedAt = momentumState.startedAt;
            state.lastEventAt = momentumState.lastEventAt;
            state.momentum = true;
            notify();
            scheduleIdle("momentum");
            return;
          }
          const wasActive = state.active;
          Object.assign(state, createUserInputState());
          state.exited = wasActive;
          notify();
        }, getAnchoredVirtualListUserInputIdleDelay(kind, policy));
      };
      const beginInput = (
        kind: UserInputTriggerQuery["kind"],
        pointerType: UserInputTriggerQuery["pointerType"] = state.pointerType,
      ): void => {
        const previousActive = state.active;
        state.active = true;
        state.entered = !previousActive;
        state.exited = false;
        state.kind = kind;
        state.pointerType = pointerType;
        state.momentum = kind === "momentum";
        state.startedAt = previousActive ? state.startedAt : Date.now();
        state.lastEventAt = Date.now();
        notify();
      };
      const handleWheel = (): void => {
        beginInput("wheel", "mouse");
        scheduleIdle("wheel");
      };
      const handleKeyDown = (event: KeyboardEvent): void => {
        if (!isAnchoredVirtualListKeyboardScrollEvent(event)) {
          return;
        }
        beginInput("keyboard", "unknown");
        scheduleIdle("keyboard");
      };
      const handleTouchStart = (): void => {
        beginInput("direct-manipulation", "touch");
        scheduleIdle("direct-manipulation");
      };
      const handlePointerDown = (event: PointerEvent): void => {
        if (event.pointerType !== "touch" && event.pointerType !== "pen") {
          return;
        }
        beginInput("direct-manipulation", event.pointerType);
        scheduleIdle("direct-manipulation");
      };
      viewport.addEventListener("wheel", handleWheel, { passive: true });
      viewport.addEventListener("keydown", handleKeyDown);
      viewport.addEventListener("touchstart", handleTouchStart, { passive: true });
      if (typeof PointerEvent !== "undefined") {
        viewport.addEventListener("pointerdown", handlePointerDown, { passive: true });
      }
      return () => {
        clearIdleHandle();
        viewport.removeEventListener("wheel", handleWheel);
        viewport.removeEventListener("keydown", handleKeyDown);
        viewport.removeEventListener("touchstart", handleTouchStart);
        if (typeof PointerEvent !== "undefined") {
          viewport.removeEventListener("pointerdown", handlePointerDown);
        }
      };
    },
  });

export const createScrollMetricsTrigger = (options: {
  viewport?: (dom: ScrollObservedDom) => HTMLElement | null;
  enabled?: boolean;
} = {}): ScrollTrigger<ScrollMetricsTriggerQuery> =>
  createTriggerBinding({
    family: "ScrollMetricsTrigger",
    cost: "frame",
    createState: createScrollMetricsState,
    consume(state) {
      state.changed = false;
    },
    observe(dom, state, notify) {
      if (options.enabled === false) {
        return () => {};
      }
      const viewport = options.viewport?.(dom) ?? dom.viewport ?? null;
      if (!(viewport instanceof HTMLElement)) {
        return () => {};
      }
      let frameHandle = 0;
      const sample = (): void => {
        frameHandle = 0;
        const nextScrollTop = viewport.scrollTop;
        const nextScrollHeight = viewport.scrollHeight;
        const nextClientHeight = viewport.clientHeight;
        const nextScrollLeft = viewport.scrollLeft;
        const nextScrollWidth = viewport.scrollWidth;
        const nextClientWidth = viewport.clientWidth;
        const changed =
          nextScrollTop !== state.scrollTop ||
          nextScrollHeight !== state.scrollHeight ||
          nextClientHeight !== state.clientHeight ||
          nextScrollLeft !== state.scrollLeft ||
          nextScrollWidth !== state.scrollWidth ||
          nextClientWidth !== state.clientWidth;
        if (!changed) {
          return;
        }
        state.scrollTop = nextScrollTop;
        state.scrollHeight = nextScrollHeight;
        state.clientHeight = nextClientHeight;
        state.scrollLeft = nextScrollLeft;
        state.scrollWidth = nextScrollWidth;
        state.clientWidth = nextClientWidth;
        state.changed = true;
        notify();
      };
      const handleScroll = (): void => {
        if (frameHandle !== 0) {
          return;
        }
        frameHandle = requestAnimationFrame(sample);
      };
      viewport.addEventListener("scroll", handleScroll, { passive: true });
      handleScroll();
      return () => {
        if (frameHandle !== 0) {
          cancelAnimationFrame(frameHandle);
        }
        viewport.removeEventListener("scroll", handleScroll);
      };
    },
  });

export const createEdgeTrigger = (options: {
  viewport?: (dom: ScrollObservedDom) => HTMLDivElement | null;
  latestSentinel?: (dom: ScrollObservedDom) => Element | null;
  latestThreshold?: number;
  startThreshold?: number;
} = {}): ScrollTrigger<EdgeTriggerQuery> =>
  createTriggerBinding({
    family: "EdgeTrigger",
    cost: "observer",
    createState: createEdgeState,
    consume(state) {
      state.enteredLatest = false;
      state.leftLatest = false;
      state.enteredStart = false;
      state.leftStart = false;
    },
    observe(dom, state, notify) {
      const viewport = options.viewport?.(dom) ?? dom.viewport ?? null;
      if (!(viewport instanceof HTMLDivElement)) {
        return () => {};
      }
      const latestThreshold = options.latestThreshold ?? 48;
      const startThreshold = options.startThreshold ?? 48;
      const latestSentinel =
        options.latestSentinel?.(dom) ??
        dom.content?.querySelector?.("[data-bottom-anchored-timeline-latest-sentinel='true']") ??
        null;
      let latestSentinelVisible: boolean | null = null;
      const recompute = (): void => {
        const previousAtLatest = state.atLatest;
        const previousAtStart = state.atStart;
        state.distanceToLatestPx = getBottomAnchoredDistanceToLatest(viewport);
        state.distanceToStartPx = getBottomAnchoredDistanceToStart(viewport);
        state.atLatest = latestSentinelVisible ?? state.distanceToLatestPx <= latestThreshold;
        state.atStart = state.distanceToStartPx <= startThreshold;
        state.enteredLatest = !previousAtLatest && state.atLatest;
        state.leftLatest = previousAtLatest && !state.atLatest;
        state.enteredStart = !previousAtStart && state.atStart;
        state.leftStart = previousAtStart && !state.atStart;
        notify();
      };
      const handleScroll = (): void => {
        recompute();
      };
      viewport.addEventListener("scroll", handleScroll, { passive: true });
      let visibilityObserver: IntersectionObserver | null = null;
      if (latestSentinel instanceof Element && typeof IntersectionObserver !== "undefined") {
        visibilityObserver = new IntersectionObserver(
          (entries) => {
            latestSentinelVisible = entries[0]?.isIntersecting ?? false;
            recompute();
          },
          { root: viewport, threshold: [0.2, 0.5, 0.8] },
        );
        visibilityObserver.observe(latestSentinel);
      }
      recompute();
      return () => {
        viewport.removeEventListener("scroll", handleScroll);
        visibilityObserver?.disconnect();
      };
    },
  });

export const createOverflowTrigger = (options: {
  viewport?: (dom: ScrollObservedDom) => HTMLElement | null;
} = {}): ScrollTrigger<OverflowTriggerQuery> =>
  createTriggerBinding({
    family: "OverflowTrigger",
    cost: "observer",
    createState: createOverflowState,
    consume(state) {
      state.becameOverflowing = false;
      state.becameContained = false;
    },
    observe(dom, state, notify) {
      const viewport = options.viewport?.(dom) ?? dom.viewport ?? null;
      if (!(viewport instanceof HTMLElement)) {
        return () => {};
      }
      const recompute = (): void => {
        const previousOverflowing = state.overflowing;
        state.visibleExtentPx = viewport.clientHeight;
        state.contentExtentPx = viewport.scrollHeight;
        state.overflowPx = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
        state.overflowing = state.overflowPx > 0;
        state.becameOverflowing = !previousOverflowing && state.overflowing;
        state.becameContained = previousOverflowing && !state.overflowing;
        notify();
      };
      const resizeObserver =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(() => {
              recompute();
            });
      resizeObserver?.observe(viewport);
      if (dom.content instanceof Element) {
        resizeObserver?.observe(dom.content);
      }
      const mutationObserver =
        typeof MutationObserver === "undefined"
          ? null
          : new MutationObserver(() => {
              recompute();
            });
      mutationObserver?.observe(viewport, { childList: true, subtree: true });
      recompute();
      return () => {
        resizeObserver?.disconnect();
        mutationObserver?.disconnect();
      };
    },
  });

export const resolveCollectionDelta = (
  previousKeys: readonly string[],
  nextKeys: readonly string[],
): CollectionDeltaTriggerQuery => {
  const previousSet = new Set(previousKeys);
  const nextSet = new Set(nextKeys);
  const insertedKeys = nextKeys.filter((key) => !previousSet.has(key));
  const removedKeys = previousKeys.filter((key) => !nextSet.has(key));
  const overlap = nextKeys.filter((key) => previousSet.has(key));
  if (insertedKeys.length === 0 && removedKeys.length === 0) {
    return createCollectionDeltaState();
  }
  if (overlap.length === 0) {
    return {
      changed: true,
      direction: "replace",
      insertedKeys,
      removedKeys,
      anchorKey: null,
    };
  }
  const firstOverlapIndex = nextKeys.findIndex((key) => previousSet.has(key));
  let lastOverlapIndex = -1;
  for (let index = nextKeys.length - 1; index >= 0; index -= 1) {
    if (previousSet.has(nextKeys[index] ?? "")) {
      lastOverlapIndex = index;
      break;
    }
  }
  const insertedIndexes = insertedKeys.map((key) => nextKeys.indexOf(key));
  const isPrepend = insertedIndexes.length > 0 && insertedIndexes.every((index) => index < firstOverlapIndex);
  const isAppend = insertedIndexes.length > 0 && insertedIndexes.every((index) => index > lastOverlapIndex);
  const direction: CollectionDeltaDirection = isPrepend ? "prepend" : isAppend ? "append" : "replace";
  return {
    changed: true,
    direction,
    insertedKeys,
    removedKeys,
    anchorKey:
      direction === "prepend"
        ? overlap[0] ?? insertedKeys.at(-1) ?? null
        : direction === "append"
          ? overlap.at(-1) ?? insertedKeys.at(0) ?? null
          : overlap[0] ?? null,
  };
};

export const createCollectionDeltaTrigger = (options: {
  getKeys: () => readonly string[];
  directionFilter?: readonly CollectionDeltaDirection[];
  eventName?: string;
}): ScrollTrigger<CollectionDeltaTriggerQuery> =>
  createTriggerBinding({
    family: "CollectionDeltaTrigger",
    cost: "observer",
    createState: createCollectionDeltaState,
    consume(state) {
      state.changed = false;
      state.insertedKeys = [];
      state.removedKeys = [];
      state.anchorKey = null;
    },
    observe(dom, state, notify) {
      const root = dom.content ?? dom.viewport ?? null;
      let previousKeys = [...options.getKeys()];
      if (!(root instanceof Element) || typeof MutationObserver === "undefined") {
        return () => {};
      }
      const recompute = (): void => {
        const nextKeys = [...options.getKeys()];
        if (compareKeyArrays(previousKeys, nextKeys)) {
          return;
        }
        const delta = resolveCollectionDelta(previousKeys, nextKeys);
        previousKeys = nextKeys;
        if (
          options.directionFilter &&
          delta.changed &&
          !options.directionFilter.includes(delta.direction)
        ) {
          return;
        }
        state.changed = delta.changed;
        state.direction = delta.direction;
        state.insertedKeys = delta.insertedKeys;
        state.removedKeys = delta.removedKeys;
        state.anchorKey = delta.anchorKey;
        notify();
      };
      const eventTarget = root as EventTarget;
      const handleCollectionDeltaEvent = (event: Event): void => {
        const customEvent = event as CustomEvent<AnchoredVirtualListCollectionDeltaEventDetail>;
        const detail = customEvent.detail;
        if (!detail) {
          return;
        }
        previousKeys = [...options.getKeys()];
        if (options.directionFilter && !options.directionFilter.includes(detail.direction)) {
          return;
        }
        state.changed = true;
        state.direction = detail.direction;
        state.insertedKeys = [...detail.insertedKeys];
        state.removedKeys = [...detail.removedKeys];
        state.anchorKey = detail.anchorKey;
        notify();
      };
      const observer = new MutationObserver(() => {
        recompute();
      });
      observer.observe(root, { childList: true, subtree: true });
      const resizeObserver =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(() => {
              recompute();
            });
      resizeObserver?.observe(root);
      eventTarget.addEventListener(options.eventName ?? ANCHORED_VIRTUAL_LIST_COLLECTION_DELTA_EVENT, handleCollectionDeltaEvent as EventListener);
      return () => {
        observer.disconnect();
        resizeObserver?.disconnect();
        eventTarget.removeEventListener(options.eventName ?? ANCHORED_VIRTUAL_LIST_COLLECTION_DELTA_EVENT, handleCollectionDeltaEvent as EventListener);
      };
    },
  });

export const createMaterializationTrigger = (options: {
  selector: string;
  content?: (dom: ScrollObservedDom) => Element | null;
}): ScrollTrigger<MaterializationTriggerQuery> =>
  createTriggerBinding({
    family: "MaterializationTrigger",
    cost: "observer",
    createState: () => createMaterializationState(options.selector),
    consume(state) {
      state.enteredMaterialized = false;
      state.leftMaterialized = false;
    },
    observe(dom, state, notify) {
      const root = options.content?.(dom) ?? dom.content ?? null;
      if (!(root instanceof Element)) {
        return () => {};
      }
      const recompute = (): void => {
        const nextElement = root.querySelector(options.selector);
        const nextMaterialized = nextElement !== null;
        state.enteredMaterialized = !state.materialized && nextMaterialized;
        state.leftMaterialized = state.materialized && !nextMaterialized;
        state.materialized = nextMaterialized;
        state.element = nextElement;
        notify();
      };
      const observer =
        typeof MutationObserver === "undefined"
          ? null
          : new MutationObserver(() => {
              recompute();
            });
      observer?.observe(root, { childList: true, subtree: true });
      recompute();
      return () => {
        observer?.disconnect();
      };
    },
  });

export const createInsertBatchTrigger = (options: {
  motion: InsertBatchMotion;
  element?: (dom: ScrollObservedDom) => EventTarget | null;
  eventName?: string;
}): ScrollTrigger<InsertBatchTriggerQuery> =>
  createTriggerBinding({
    family: "InsertBatchTrigger",
    cost: "observer",
    createState: () => createInsertBatchState(options.motion),
    consume(state) {
      state.changed = false;
      state.elements = [];
      state.extentPx = 0;
      state.nearestElement = null;
    },
    observe(dom, state, notify) {
      const target = options.element?.(dom) ?? dom.content ?? dom.viewport ?? null;
      if (!(target instanceof EventTarget)) {
        return () => {};
      }
      const eventName = options.eventName ?? ANCHORED_VIRTUAL_LIST_INSERT_BATCH_EVENT;
      const handleEvent = (event: Event): void => {
        const customEvent = event as CustomEvent<AnchoredVirtualListInsertBatchEventDetail>;
        const detail = customEvent.detail;
        if (!detail || detail.motion !== options.motion) {
          return;
        }
        state.changed = true;
        state.elements = detail.elements;
        state.extentPx =
          detail.extentPx > 0
            ? detail.extentPx
            : detail.elements.reduce((total, element) => total + resolveBlockSize(element), 0);
        state.nearestElement = detail.nearestElement;
        notify();
      };
      target.addEventListener(eventName, handleEvent as EventListener);
      return () => {
        target.removeEventListener(eventName, handleEvent as EventListener);
      };
    },
  });
