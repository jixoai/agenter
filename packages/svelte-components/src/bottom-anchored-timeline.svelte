<script lang="ts" generics="Item">
  import {
    createVirtualizer,
    measureElement as defaultMeasureElement,
    observeElementOffset,
    type Rect,
    type Virtualizer,
  } from "@tanstack/svelte-virtual";
  import { onDestroy, tick } from "svelte";

  import {
    BOTTOM_ANCHORED_INSERT_MOTION_DURATION_MS,
    createBottomAnchoredInsertMotionController,
    type BottomAnchoredInsertMotion,
    type BottomAnchoredInsertMotionBatchEntry,
  } from "./bottom-anchored-insert-motion";
  import {
    getBottomAnchoredDistanceToLatest,
    getBottomAnchoredDistanceToStart,
    getBottomAnchoredScrollExtent,
    getBottomAnchoredScrollTopFromVirtualOffset,
    getBottomAnchoredStartScrollTop,
    getBottomAnchoredVirtualOffset,
  } from "./bottom-anchored-scroll";
  import type {
    BottomAnchoredTimelineHandle,
    BottomAnchoredTimelineProps,
    BottomAnchoredTimelineVirtualRow,
  } from "./bottom-anchored-timeline.types";
  import type { ScrollViewVirtualizer, ScrollVirtualMeasureInput } from "./scroll-view.types";

  type ScrollVirtualCoreInstance = ScrollVirtualMeasureInput<Item>["virtualizer"];
  type ScrollVirtualMeasureCallback = (
    element: HTMLDivElement,
    entry: ResizeObserverEntry | undefined,
    instance: ScrollVirtualCoreInstance,
  ) => number;
  type StaticRow<TItem> = { value: TItem; sourceIndex: number; displayIndex: number };
  type ScrollAnimationOptions = { durationMs?: number };
  type ScrollIntentKind = "latest" | "toward-start";
  type ScrollIntent = {
    token: number;
    viewport: HTMLDivElement;
    kind: ScrollIntentKind;
    targetTop: number;
    deadline: number;
  };
  type ViewportSnapshot = {
    scrollTop: number;
    clientHeight: number;
    scrollHeight: number;
    virtualOffset: number;
    atLatest: boolean;
    atStart: boolean;
  };

  let {
    class: className = "",
    viewportClass = "",
    contentClass = "",
    viewportRef = $bindable<HTMLDivElement | null>(null),
    contentRef = $bindable<HTMLDivElement | null>(null),
    viewportTestId = undefined,
    onViewportScroll = undefined,
    items,
    virtual = undefined,
    virtualizerRef = $bindable<ScrollViewVirtualizer | null>(null),
    timelineRef = $bindable<BottomAnchoredTimelineHandle | null>(null),
    atLatest = $bindable(true),
    atStart = $bindable(false),
    latestThreshold = 48,
    startThreshold = 48,
    item,
    empty,
    start,
    end,
  }: BottomAnchoredTimelineProps<Item> = $props();
  let latestSentinelRef = $state<HTMLDivElement | null>(null);
  let latestSentinelVisible = $state<boolean | null>(null);

  const joinClassNames = (...values: Array<string | false | null | undefined>): string =>
    values.filter((value): value is string => typeof value === "string" && value.length > 0).join(" ");

  const resolveDisplayIndex = (sourceIndex: number): number => items.length - sourceIndex - 1;
  const resolveSourceIndex = (displayIndex: number): number => items.length - displayIndex - 1;
  const resolveDisplayItem = (displayIndex: number): Item | undefined => items[resolveSourceIndex(displayIndex)];

  const displayedRows = $derived.by(() => {
    const rows: Array<StaticRow<Item>> = [];
    for (let sourceIndex = items.length - 1; sourceIndex >= 0; sourceIndex -= 1) {
      const value = items[sourceIndex];
      if (value === undefined) {
        continue;
      }
      rows.push({
        value,
        sourceIndex,
        displayIndex: resolveDisplayIndex(sourceIndex),
      });
    }
    return rows;
  });

  const resolveElementAxisSize = (
    element: Element,
    axis: "width" | "height",
    entry?: ResizeObserverEntry,
  ): number => {
    const borderBoxSize = entry?.borderBoxSize;
    const box =
      borderBoxSize === undefined
        ? undefined
        : Array.isArray(borderBoxSize)
          ? borderBoxSize[0]
          : borderBoxSize;
    if (box) {
      const borderBoxValue = axis === "width" ? box.inlineSize : box.blockSize;
      if (borderBoxValue > 0) {
        return Math.round(borderBoxValue);
      }
    }

    const contentRectValue = axis === "width" ? entry?.contentRect.width : entry?.contentRect.height;
    if (contentRectValue && contentRectValue > 0) {
      return Math.round(contentRectValue);
    }

    const htmlElement = element instanceof HTMLElement ? element : null;
    const clientValue = axis === "width" ? htmlElement?.clientWidth : htmlElement?.clientHeight;
    if (clientValue && clientValue > 0) {
      return Math.round(clientValue);
    }

    const offsetValue = axis === "width" ? htmlElement?.offsetWidth : htmlElement?.offsetHeight;
    if (offsetValue && offsetValue > 0) {
      return Math.round(offsetValue);
    }

    const rect = element.getBoundingClientRect();
    const rectValue = axis === "width" ? rect.width : rect.height;
    if (rectValue > 0) {
      return Math.round(rectValue);
    }

    return 0;
  };

  const resolveElementRect = (element: Element, entry?: ResizeObserverEntry): Rect => ({
    width: resolveElementAxisSize(element, "width", entry),
    height: resolveElementAxisSize(element, "height", entry),
  });

  const observeViewportRect = (
    instance: ScrollVirtualCoreInstance,
    callback: (rect: Rect) => void,
  ): (() => void) | undefined => {
    const element = instance.scrollElement;
    if (!element) {
      return undefined;
    }

    const emitRect = (entry?: ResizeObserverEntry): void => {
      callback(resolveElementRect(element, entry));
    };

    emitRect();

    const targetWindow = instance.targetWindow;
    if (!targetWindow?.ResizeObserver) {
      return undefined;
    }

    const observer = new targetWindow.ResizeObserver((entries) => {
      const nextEntry = entries[0];
      const run = (): void => emitRect(nextEntry);
      if (instance.options.useAnimationFrameWithResizeObserver) {
        targetWindow.requestAnimationFrame(run);
        return;
      }
      run();
    });

    observer.observe(element, { box: "border-box" });
    return () => {
      observer.unobserve(element);
      observer.disconnect();
    };
  };

  const observeBottomAnchoredOffset = (
    instance: ScrollVirtualCoreInstance,
    callback: (offset: number, isScrolling: boolean) => void,
  ): (() => void) | undefined =>
    observeElementOffset(instance, (offset, isScrolling) => {
      const viewport = instance.scrollElement;
      if (!(viewport instanceof HTMLDivElement)) {
        callback(Math.max(0, -offset), isScrolling);
        return;
      }
      callback(getBottomAnchoredVirtualOffset(viewport), isScrolling);
    });

  const resolveScrollIntentDuration = (
    behavior: ScrollBehavior,
    options: ScrollAnimationOptions = {},
  ): number =>
    behavior === "smooth"
      ? Math.max(BOTTOM_ANCHORED_INSERT_MOTION_DURATION_MS, options.durationMs ?? 0)
      : 0;

  const cancelScrollIntentFinalize = (): void => {
    if (scrollIntentFinalizeHandle === 0) {
      return;
    }
    const activeViewport = scrollIntent?.viewport;
    const targetWindow = activeViewport?.ownerDocument?.defaultView;
    targetWindow?.clearTimeout(scrollIntentFinalizeHandle);
    scrollIntentFinalizeHandle = 0;
  };

  const finalizeScrollIntent = (intentToken: number): void => {
    scrollIntentFinalizeHandle = 0;
    const activeIntent = scrollIntent;
    if (!activeIntent || activeIntent.token !== intentToken) {
      return;
    }
    const viewport = activeIntent.viewport;
    if (!viewport.isConnected) {
      scrollIntent = null;
      return;
    }
    if (Math.abs(viewport.scrollTop - activeIntent.targetTop) > 1) {
      setViewportScrollTop(viewport, activeIntent.targetTop);
      syncEdgeState();
    }
    scrollIntent = null;
  };

  const cancelDeferredSmoothScroll = (): void => {
    if (deferredSmoothScrollFrame === 0) {
      deferredSmoothScrollViewport = null;
      deferredSmoothScrollToken = 0;
      return;
    }
    const targetWindow = deferredSmoothScrollViewport?.ownerDocument?.defaultView;
    targetWindow?.cancelAnimationFrame(deferredSmoothScrollFrame);
    deferredSmoothScrollFrame = 0;
    deferredSmoothScrollViewport = null;
    deferredSmoothScrollToken = 0;
  };

  const setScrollIntent = (
    viewport: HTMLDivElement,
    kind: ScrollIntentKind,
    targetTop: number,
    behavior: ScrollBehavior,
    options: ScrollAnimationOptions = {},
  ): void => {
    cancelScrollIntentFinalize();
    const targetWindow = viewport.ownerDocument?.defaultView;
    const now = targetWindow?.performance.now() ?? Date.now();
    const durationMs = resolveScrollIntentDuration(behavior, options);
    const token = nextScrollIntentToken;
    nextScrollIntentToken += 1;
    scrollIntent = {
      token,
      viewport,
      kind,
      targetTop,
      deadline: now + durationMs + 240,
    };
    if (durationMs > 0 && targetWindow?.setTimeout) {
      scrollIntentFinalizeHandle = targetWindow.setTimeout(() => {
        finalizeScrollIntent(token);
      }, durationMs + 260);
    }
  };

  const resolveActiveScrollIntent = (viewport: HTMLDivElement): ScrollIntent | null => {
    const activeIntent = scrollIntent;
    if (!activeIntent || !Object.is(activeIntent.viewport, viewport)) {
      return null;
    }
    const targetWindow = viewport.ownerDocument?.defaultView;
    const now = targetWindow?.performance.now() ?? Date.now();
    if (now <= activeIntent.deadline) {
      return activeIntent;
    }
    scrollIntent = null;
    return null;
  };

  const scheduleDeferredSmoothScroll = (
    viewport: HTMLDivElement,
    kind: ScrollIntentKind,
    targetTop: number,
    options: ScrollAnimationOptions = {},
  ): void => {
    cancelDeferredSmoothScroll();
    const targetWindow = viewport.ownerDocument?.defaultView;
    if (!targetWindow?.requestAnimationFrame) {
      setScrollIntent(viewport, kind, targetTop, "smooth", options);
      applyScrollTop(viewport, targetTop, "smooth");
      syncEdgeState();
      return;
    }
    let lastSignature = "";
    let stableFrames = 0;
    let frameCount = 0;
    deferredSmoothScrollViewport = viewport;
    deferredSmoothScrollToken += 1;
    const token = deferredSmoothScrollToken;

    const step = (): void => {
      if (!Object.is(deferredSmoothScrollViewport, viewport) || deferredSmoothScrollToken !== token) {
        return;
      }
      if (!viewport.isConnected) {
        cancelDeferredSmoothScroll();
        return;
      }
      frameCount += 1;
      const nextSignature = `${viewport.scrollHeight}:${viewport.clientHeight}:${totalVirtualSize}`;
      if (nextSignature === lastSignature) {
        stableFrames += 1;
      } else {
        lastSignature = nextSignature;
        stableFrames = 0;
      }
      if (stableFrames >= 1 || frameCount >= 6) {
        deferredSmoothScrollFrame = 0;
        deferredSmoothScrollViewport = null;
        deferredSmoothScrollToken = 0;
        setScrollIntent(viewport, kind, targetTop, "smooth", options);
        applyScrollTop(viewport, targetTop, "smooth");
        syncEdgeState();
        return;
      }
      deferredSmoothScrollFrame = targetWindow.requestAnimationFrame(step);
    };

    deferredSmoothScrollFrame = targetWindow.requestAnimationFrame(step);
  };

  const shouldIgnoreVirtualizerCorrection = (
    viewport: HTMLDivElement,
    targetTop: number,
  ): { ignored: boolean; intentKind: ScrollIntentKind | null; distanceToLatest: number } => {
    const distanceToLatest = getBottomAnchoredDistanceToLatest(viewport);
    if (distanceToLatest <= latestThreshold && targetTop < 0) {
      return {
        ignored: true,
        intentKind: null,
        distanceToLatest,
      };
    }
    const activeIntent = resolveActiveScrollIntent(viewport);
    if (!activeIntent) {
      return {
        ignored: false,
        intentKind: null,
        distanceToLatest,
      };
    }
    if (activeIntent.kind === "latest" && targetTop < -1) {
      return {
        ignored: true,
        intentKind: activeIntent.kind,
        distanceToLatest,
      };
    }
    if (activeIntent.kind === "toward-start" && targetTop > activeIntent.targetTop + 1) {
      return {
        ignored: true,
        intentKind: activeIntent.kind,
        distanceToLatest,
      };
    }
    return {
      ignored: false,
      intentKind: activeIntent.kind,
      distanceToLatest,
    };
  };

  const scrollBottomAnchoredOffset = (
    offset: number,
    {
      adjustments = 0,
      behavior,
    }: {
      adjustments?: number;
      behavior?: ScrollBehavior;
    },
    instance: ScrollVirtualCoreInstance,
  ): void => {
    const viewport = instance.scrollElement;
    if (!(viewport instanceof HTMLDivElement)) {
      return;
    }
    const targetTop = getBottomAnchoredScrollTopFromVirtualOffset(offset + adjustments);
    const correction = shouldIgnoreVirtualizerCorrection(viewport, targetTop);
    if (correction.ignored) {
      if (diagnosticsEnabled) {
        console.debug("[BottomAnchoredTimeline]", "ignore-virtualizer-correction-away-from-latest", {
          offset,
          adjustments,
          behavior: behavior ?? "auto",
          targetTop,
          distanceToLatest: correction.distanceToLatest,
          scrollIntentKind: correction.intentKind,
          scrollTop: viewport.scrollTop,
          clientHeight: viewport.clientHeight,
          scrollHeight: viewport.scrollHeight,
          itemCount: items.length,
        });
      }
      syncEdgeState();
      return;
    }
    applyScrollTop(viewport, targetTop, behavior ?? "auto");
  };

  const resolveMeasuredSize = (
    element: HTMLDivElement,
    entry: ResizeObserverEntry | undefined,
    instance: ScrollVirtualCoreInstance,
    fallbackSize: number,
  ): number => {
    const measuredSize = defaultMeasureElement(element, entry, instance);
    if (measuredSize > 0) {
      return measuredSize;
    }

    const elementSize = resolveElementAxisSize(element, "height", entry);
    if (elementSize > 0) {
      return elementSize;
    }

    return Math.max(1, fallbackSize);
  };

  const virtualizerStore = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: 0,
    getScrollElement: () => viewportRef,
    estimateSize: () => 1,
    initialOffset: 0,
    observeElementRect: observeViewportRect,
    observeElementOffset: observeBottomAnchoredOffset,
    scrollToFn: scrollBottomAnchoredOffset,
    enabled: false,
  });
  let virtualizer = $state<ScrollViewVirtualizer | null>(null);
  let virtualizerVersion = $state(0);
  let virtualizerReady = $state(false);
  let insertMotionDisconnect: (() => void) | null = null;
  let deferredSmoothScrollFrame = 0;
  let deferredSmoothScrollViewport: HTMLDivElement | null = null;
  let deferredSmoothScrollToken = 0;
  let scrollIntent: ScrollIntent | null = null;
  let scrollIntentFinalizeHandle = 0;
  let nextScrollIntentToken = 1;
  let lastViewportSnapshot: ViewportSnapshot | null = null;
  const scheduleVirtualizerVersionBump = (): void => {
    queueMicrotask(() => {
      virtualizerVersion += 1;
    });
  };
  const unsubscribeVirtualizer = virtualizerStore.subscribe((nextVirtualizer) => {
    virtualizer = nextVirtualizer;
    scheduleVirtualizerVersionBump();
    if (!virtualizerReady) {
      virtualizerReady = true;
    }
  });

  const totalVirtualSize = $derived.by(() => {
    virtualizerVersion;
    return virtualizer?.getTotalSize() ?? 0;
  });
  const diagnosticsEnabled = $derived(Boolean(virtual?.debug));
  const measureVirtualInput = $derived.by(() => {
    if (!virtual?.measureElement) {
      return {
        enabled: false,
        virtualizer: null,
      } as { enabled: boolean; virtualizer: ScrollViewVirtualizer | null };
    }
    return {
      enabled: true,
      virtualizer,
    } as { enabled: boolean; virtualizer: ScrollViewVirtualizer | null };
  });
  const virtualUsesDynamicMeasurement = $derived(Boolean(virtual?.measureElement));
  const virtualRows = $derived.by(() => {
    virtualizerVersion;
    const config = virtual;
    const instance = virtualizer;
    if (!config || !instance) {
      return [] as Array<BottomAnchoredTimelineVirtualRow<Item>>;
    }

    const rows: Array<BottomAnchoredTimelineVirtualRow<Item>> = [];
    for (const virtualItem of instance.getVirtualItems()) {
      const value = resolveDisplayItem(virtualItem.index);
      if (value === undefined) {
        continue;
      }
      rows.push({
        value,
        sourceIndex: resolveSourceIndex(virtualItem.index),
        displayIndex: virtualItem.index,
        virtualItem,
      });
    }
    return rows;
  });

  const resolveEstimateSize = (
    config: NonNullable<typeof virtual>,
    displayIndex: number,
  ): number => {
    const nextItem = resolveDisplayItem(displayIndex);
    if (nextItem === undefined) {
      return 1;
    }
    return Math.max(1, config.estimateSize(resolveSourceIndex(displayIndex), nextItem));
  };

  const resolveMeasureElement = (
    config: NonNullable<typeof virtual> | undefined,
  ): ScrollVirtualMeasureCallback | undefined => {
    const measureHandler = config?.measureElement;
    if (!measureHandler) {
      return undefined;
    }
    if (measureHandler === true) {
      return (element, entry, instance) => {
        const displayIndex = instance.indexFromElement(element);
        const fallbackSize = resolveEstimateSize(config, displayIndex);
        return resolveMeasuredSize(element, entry, instance, fallbackSize);
      };
    }
    return (element, entry, instance) => {
      const displayIndex = instance.indexFromElement(element);
      const nextItem = resolveDisplayItem(displayIndex);
      if (nextItem === undefined) {
        return resolveMeasuredSize(element, entry, instance, 1);
      }
      const measuredSize = measureHandler({
        element,
        entry,
        index: resolveSourceIndex(displayIndex),
        item: nextItem,
        virtualizer: instance as Virtualizer<HTMLDivElement, HTMLDivElement>,
      });
      return measuredSize > 0 ? measuredSize : resolveEstimateSize(config, displayIndex);
    };
  };

  const measureVirtualItem = (
    node: HTMLDivElement,
    input: { enabled: boolean; virtualizer: ScrollViewVirtualizer | null },
  ) => {
    let currentInput = input;
    const measure = (nextInput: { enabled: boolean; virtualizer: ScrollViewVirtualizer | null }): void => {
      if (!nextInput.enabled || !nextInput.virtualizer) {
        return;
      }
      nextInput.virtualizer.measureElement(node);
    };
    measure(input);
    return {
      update(nextInput: { enabled: boolean; virtualizer: ScrollViewVirtualizer | null }) {
        const sameBinding =
          currentInput.enabled === nextInput.enabled &&
          Object.is(currentInput.virtualizer, nextInput.virtualizer);
        if (sameBinding) {
          return;
        }
        if (
          currentInput.enabled &&
          currentInput.virtualizer &&
          !Object.is(currentInput.virtualizer, nextInput.virtualizer)
        ) {
          currentInput.virtualizer.measureElement(null);
        }
        currentInput = nextInput;
        measure(nextInput);
      },
      destroy() {
        currentInput.virtualizer?.measureElement(null);
      },
    };
  };

  const syncEdgeState = (): void => {
    const viewport = viewportRef;
    if (!viewport) {
      atLatest = true;
      atStart = items.length === 0;
      lastViewportSnapshot = null;
      return;
    }
    const previousAtLatest = atLatest;
    const previousAtStart = atStart;
    const distanceToLatest = getBottomAnchoredDistanceToLatest(viewport);
    const distanceToStart = getBottomAnchoredDistanceToStart(viewport);
    atLatest = latestSentinelVisible ?? distanceToLatest <= latestThreshold;
    atStart = distanceToStart <= startThreshold;
    if (diagnosticsEnabled && (previousAtLatest !== atLatest || previousAtStart !== atStart)) {
      console.debug("[BottomAnchoredTimeline]", "edge-state", {
        previousAtLatest,
        previousAtStart,
        nextAtLatest: atLatest,
        nextAtStart: atStart,
        latestSentinelVisible,
        distanceToLatest,
        distanceToStart,
        scrollTop: viewport.scrollTop,
        clientHeight: viewport.clientHeight,
        scrollHeight: viewport.scrollHeight,
        itemCount: items.length,
        totalVirtualSize,
      });
    }
    lastViewportSnapshot = {
      scrollTop: viewport.scrollTop,
      clientHeight: viewport.clientHeight,
      scrollHeight: viewport.scrollHeight,
      virtualOffset: getBottomAnchoredVirtualOffset(viewport),
      atLatest,
      atStart,
    };
  };

  const resolveScrollBehavior = (viewport: HTMLDivElement, behavior: ScrollBehavior): ScrollBehavior => {
    if (behavior !== "smooth") {
      return behavior;
    }
    const targetWindow = viewport.ownerDocument?.defaultView;
    if (!targetWindow?.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return behavior;
    }
    return "auto";
  };

  const setViewportScrollTop = (viewport: HTMLDivElement, top: number): void => {
    viewport.scrollTop = top;
  };

  const applyScrollTop = (
    viewport: HTMLDivElement,
    top: number,
    behavior: ScrollBehavior,
  ): void => {
    const nextBehavior = resolveScrollBehavior(viewport, behavior);
    if (nextBehavior === "smooth") {
      if (typeof viewport.scrollTo === "function") {
        viewport.scrollTo({
          top,
          behavior: nextBehavior,
        });
        return;
      }
      setViewportScrollTop(viewport, top);
      return;
    }
    setViewportScrollTop(viewport, top);
  };

  const resolveMeasuredInsertBlockSize = (element: HTMLElement): number => {
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

  const resolveTargetTopFromVirtualOffset = (viewport: HTMLDivElement, offset: number): number => {
    const extent = getBottomAnchoredScrollExtent(viewport);
    return getBottomAnchoredScrollTopFromVirtualOffset(Math.min(extent, Math.max(0, offset)));
  };

  const resolveInsertRevealPx = (viewport: HTMLDivElement, insertedHeight: number): number =>
    Math.min(insertedHeight, Math.min(96, viewport.clientHeight * 0.2));

  const resolveBatchInsertHeight = (
    entries: readonly BottomAnchoredInsertMotionBatchEntry[],
    motion: BottomAnchoredInsertMotion,
  ): number =>
    entries.reduce((total, entry) => {
      if (entry.motion !== motion) {
        return total;
      }
      return total + resolveMeasuredInsertBlockSize(entry.element);
    }, 0);

  const handleInsertMotionBatch = (entries: readonly BottomAnchoredInsertMotionBatchEntry[]): void => {
    const viewport = viewportRef;
    const snapshot = lastViewportSnapshot;
    if (!viewport || !snapshot || entries.length === 0) {
      return;
    }

    const latestHeight = resolveBatchInsertHeight(entries, "latest");
    const olderHeight = resolveBatchInsertHeight(entries, "older");

    if (latestHeight > 0 && snapshot.atLatest) {
      const preserveOffset = snapshot.virtualOffset + latestHeight;
      const preserveTop = resolveTargetTopFromVirtualOffset(viewport, preserveOffset);
      if (diagnosticsEnabled) {
        console.debug("[BottomAnchoredTimeline]", "insert-motion-latest", {
          latestHeight,
          preserveOffset,
          preserveTop,
          snapshot,
          scrollTop: viewport.scrollTop,
          clientHeight: viewport.clientHeight,
          scrollHeight: viewport.scrollHeight,
        });
      }
      applyScrollTop(viewport, preserveTop, "auto");
      scheduleDeferredSmoothScroll(viewport, "latest", 0, {
        durationMs: BOTTOM_ANCHORED_INSERT_MOTION_DURATION_MS,
      });
      syncEdgeState();
      return;
    }

    if (olderHeight > 0 && snapshot.atStart) {
      const preserveOffset = snapshot.virtualOffset;
      const preserveTop = resolveTargetTopFromVirtualOffset(viewport, preserveOffset);
      const revealPx = resolveInsertRevealPx(viewport, olderHeight);
      const revealTop = resolveTargetTopFromVirtualOffset(viewport, preserveOffset + revealPx);
      if (diagnosticsEnabled) {
        console.debug("[BottomAnchoredTimeline]", "insert-motion-older", {
          olderHeight,
          preserveOffset,
          preserveTop,
          revealPx,
          revealTop,
          snapshot,
          scrollTop: viewport.scrollTop,
          clientHeight: viewport.clientHeight,
          scrollHeight: viewport.scrollHeight,
        });
      }
      applyScrollTop(viewport, preserveTop, "auto");
      if (revealPx > 0) {
        scheduleDeferredSmoothScroll(viewport, "toward-start", revealTop, {
          durationMs: BOTTOM_ANCHORED_INSERT_MOTION_DURATION_MS,
        });
      }
      syncEdgeState();
    }
  };

  const scrollToLatest = (behavior: ScrollBehavior = "auto"): void => {
    const viewport = viewportRef;
    if (!viewport) {
      return;
    }
    if (diagnosticsEnabled) {
      console.debug("[BottomAnchoredTimeline]", "scroll-to-latest", {
        behavior,
        scrollTop: viewport.scrollTop,
        clientHeight: viewport.clientHeight,
        scrollHeight: viewport.scrollHeight,
        itemCount: items.length,
      });
    }
    cancelDeferredSmoothScroll();
    setScrollIntent(viewport, "latest", 0, behavior);
    applyScrollTop(viewport, 0, behavior);
    syncEdgeState();
  };

  const scrollTowardStart = (deltaPx: number, behavior: ScrollBehavior = "auto"): void => {
    const viewport = viewportRef;
    if (!viewport) {
      return;
    }
    const offsetDelta = Number.isFinite(deltaPx) ? deltaPx : 0;
    const targetOffset = getBottomAnchoredVirtualOffset(viewport) + offsetDelta;
    const targetTop = getBottomAnchoredScrollTopFromVirtualOffset(targetOffset);
    if (diagnosticsEnabled) {
      console.debug("[BottomAnchoredTimeline]", "scroll-toward-start", {
        behavior,
        deltaPx: offsetDelta,
        targetOffset,
        targetTop,
        scrollTop: viewport.scrollTop,
        clientHeight: viewport.clientHeight,
        scrollHeight: viewport.scrollHeight,
        itemCount: items.length,
      });
    }
    cancelDeferredSmoothScroll();
    setScrollIntent(viewport, "toward-start", targetTop, behavior);
    applyScrollTop(viewport, targetTop, behavior);
    syncEdgeState();
  };

  const scrollToStart = (behavior: ScrollBehavior = "auto"): void => {
    const viewport = viewportRef;
    if (!viewport) {
      return;
    }
    const targetTop = getBottomAnchoredStartScrollTop(viewport);
    if (diagnosticsEnabled) {
      console.debug("[BottomAnchoredTimeline]", "scroll-to-start", {
        behavior,
        targetTop,
        scrollTop: viewport.scrollTop,
        clientHeight: viewport.clientHeight,
        scrollHeight: viewport.scrollHeight,
        itemCount: items.length,
      });
    }
    cancelDeferredSmoothScroll();
    setScrollIntent(viewport, "toward-start", targetTop, behavior);
    applyScrollTop(viewport, targetTop, behavior);
    syncEdgeState();
  };

  const handle: BottomAnchoredTimelineHandle = {
    scrollToLatest,
    scrollToStart,
    scrollTowardStart,
    get atLatest() {
      return atLatest;
    },
    get atStart() {
      return atStart;
    },
    get viewport() {
      return viewportRef;
    },
  };

  const handleScroll = (event: Event): void => {
    syncEdgeState();
    onViewportScroll?.(event);
  };

  const resolveVirtualItemStyle = (
    virtualItem: BottomAnchoredTimelineVirtualRow<Item>["virtualItem"],
    dynamicMeasure: boolean,
  ): string => {
    const offset = Math.max(0, totalVirtualSize - virtualItem.start - virtualItem.size);
    return `transform:translateY(${offset}px);inline-size:100%;${
      dynamicMeasure ? "" : `block-size:${virtualItem.size}px;`
    }`;
  };

  onDestroy(() => {
    insertMotionDisconnect?.();
    cancelDeferredSmoothScroll();
    cancelScrollIntentFinalize();
    scrollIntent = null;
    unsubscribeVirtualizer();
    virtualizer = null;
    virtualizerVersion = 0;
    virtualizerReady = false;
  });

  $effect(() => {
    timelineRef = handle;
    return () => {
      if (Object.is(timelineRef, handle)) {
        timelineRef = null;
      }
    };
  });

  $effect(() => {
    const ready = virtualizerReady;
    const instance = virtualizer;
    if (!ready || !instance) {
      return;
    }
    const config = virtual;
    virtualizerRef = config ? instance : null;
    if (!config) {
      instance.shouldAdjustScrollPositionOnItemSizeChange = undefined;
      instance.setOptions({
        count: 0,
        enabled: false,
        getScrollElement: () => viewportRef,
        estimateSize: () => 1,
        observeElementRect: observeViewportRect,
        observeElementOffset: observeBottomAnchoredOffset,
        scrollToFn: scrollBottomAnchoredOffset,
      });
      return;
    }
    instance.setOptions({
      count: items.length,
      enabled: config.enabled ?? true,
      debug: config.debug,
      getScrollElement: () => viewportRef,
      observeElementRect: observeViewportRect,
      observeElementOffset: observeBottomAnchoredOffset,
      scrollToFn: scrollBottomAnchoredOffset,
      initialRect: viewportRef ? resolveElementRect(viewportRef) : undefined,
      estimateSize: (displayIndex) => resolveEstimateSize(config, displayIndex),
      getItemKey: config.getItemKey
        ? (displayIndex) => {
            const nextItem = resolveDisplayItem(displayIndex);
            return nextItem === undefined
              ? displayIndex
              : config.getItemKey?.(resolveSourceIndex(displayIndex), nextItem) ?? displayIndex;
          }
        : undefined,
      measureElement: resolveMeasureElement(config),
      overscan: config.overscan,
      paddingStart: config.paddingStart,
      paddingEnd: config.paddingEnd,
      rangeExtractor: config.rangeExtractor,
      gap: config.gap,
      initialMeasurementsCache: config.initialMeasurementsCache,
      isScrollingResetDelay: config.isScrollingResetDelay,
      useScrollendEvent: config.useScrollendEvent,
      useAnimationFrameWithResizeObserver: config.useAnimationFrameWithResizeObserver ?? Boolean(config.measureElement),
      onChange: config.onChange,
      initialOffset: 0,
    });
    instance.shouldAdjustScrollPositionOnItemSizeChange =
      config.shouldAdjustScrollPositionOnItemSizeChange;
  });

  $effect(() => {
    items.length;
    totalVirtualSize;
    void tick().then(() => {
      syncEdgeState();
    });
  });

  $effect(() => {
    const content = contentRef;
    insertMotionDisconnect?.();
    insertMotionDisconnect = null;
    if (!content) {
      return;
    }
    const controller = createBottomAnchoredInsertMotionController(content, {
      onBeforePlay: handleInsertMotionBatch,
    });
    insertMotionDisconnect = controller.disconnect;
    return () => {
      if (Object.is(insertMotionDisconnect, controller.disconnect)) {
        insertMotionDisconnect = null;
      }
      controller.disconnect();
    };
  });

  $effect(() => {
    const viewport = viewportRef;
    const sentinel = latestSentinelRef;
    if (!viewport || !sentinel) {
      latestSentinelVisible = null;
      return;
    }
    const targetWindow = viewport.ownerDocument?.defaultView;
    const ObserverCtor = targetWindow?.IntersectionObserver;
    if (!ObserverCtor) {
      latestSentinelVisible = null;
      syncEdgeState();
      return;
    }

    let cancelled = false;
    const observer = new ObserverCtor(
      (entries) => {
        const nextVisible = entries[0]?.isIntersecting ?? false;
        queueMicrotask(() => {
          if (cancelled) {
            return;
          }
          latestSentinelVisible = nextVisible;
          syncEdgeState();
        });
      },
      {
        root: viewport,
        threshold: 0,
        rootMargin: `0px 0px ${latestThreshold}px 0px`,
      },
    );
    observer.observe(sentinel);
    return () => {
      cancelled = true;
      observer.disconnect();
      latestSentinelVisible = null;
      syncEdgeState();
    };
  });
</script>

<div
  class={joinClassNames("bottom-anchored-timeline-root", className)}
  data-at-latest={atLatest}
  data-at-start={atStart}
>
  <div
    bind:this={viewportRef}
    class={joinClassNames("bottom-anchored-timeline-viewport", viewportClass)}
    data-testid={viewportTestId}
    onscroll={handleScroll}
  >
    <div
      bind:this={contentRef}
      class={joinClassNames("bottom-anchored-timeline-content", contentClass)}
      data-bottom-anchored-timeline-content={virtual ? "virtual" : "static"}
    >
      <div
        bind:this={latestSentinelRef}
        aria-hidden="true"
        class="bottom-anchored-timeline-latest-sentinel"
        data-bottom-anchored-timeline-latest-sentinel="true"
      ></div>

      {#if end}
        <div
          class="bottom-anchored-timeline-slot bottom-anchored-timeline-slot-end"
          data-bottom-anchored-timeline-slot="end"
        >
          {@render end?.()}
        </div>
      {/if}

      {#if virtual && item}
        {#if items.length === 0}
          {@render empty?.()}
        {:else}
          <div
            class="bottom-anchored-timeline-virtual-host"
            style={`height:${totalVirtualSize}px;`}
          >
            {#each virtualRows as row (row.virtualItem.key)}
              <div
                class="bottom-anchored-timeline-virtual-item scroll-view-virtual-item"
                data-display-index={row.displayIndex}
                data-index={row.displayIndex}
                data-source-index={row.sourceIndex}
                style={resolveVirtualItemStyle(row.virtualItem, virtualUsesDynamicMeasurement)}
                use:measureVirtualItem={measureVirtualInput}
              >
                {@render item(row.value, row.sourceIndex)}
              </div>
            {/each}
          </div>
        {/if}
      {:else if item}
        {#if items.length === 0}
          {@render empty?.()}
        {:else}
          {#each displayedRows as row (row.sourceIndex)}
            <div
              class="bottom-anchored-timeline-static-item"
              data-display-index={row.displayIndex}
              data-source-index={row.sourceIndex}
            >
              {@render item(row.value, row.sourceIndex)}
            </div>
          {/each}
        {/if}
      {/if}

      {#if start}
        <div
          class="bottom-anchored-timeline-slot bottom-anchored-timeline-slot-start"
          data-bottom-anchored-timeline-slot="start"
        >
          {@render start?.()}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .bottom-anchored-timeline-root {
    block-size: 100%;
    inline-size: 100%;
    min-block-size: 0;
    min-inline-size: 0;
  }

  .bottom-anchored-timeline-viewport {
    block-size: 100%;
    inline-size: 100%;
    min-block-size: 0;
    min-inline-size: 0;
    display: flex;
    flex-direction: column-reverse;
    overflow-y: auto;
    overflow-x: hidden;
    overflow-anchor: auto;
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, currentColor, transparent) transparent;
  }

  .bottom-anchored-timeline-viewport::-webkit-scrollbar {
    width: 0.5rem;
    height: 0.5rem;
  }

  .bottom-anchored-timeline-viewport::-webkit-scrollbar-track {
    background: transparent;
  }

  .bottom-anchored-timeline-viewport::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, currentColor, transparent);
    border-radius: 999px;
  }

  .bottom-anchored-timeline-content {
    flex: none;
    display: flex;
    flex-direction: column-reverse;
    min-block-size: 100%;
    min-inline-size: 0;
    inline-size: 100%;
    overflow-anchor: auto;
  }

  .bottom-anchored-timeline-slot {
    flex: none;
    min-inline-size: 0;
  }

  .bottom-anchored-timeline-latest-sentinel {
    flex: none;
    inline-size: 100%;
    block-size: 1px;
    opacity: 0;
    pointer-events: none;
    overflow-anchor: none;
  }

  .bottom-anchored-timeline-slot-start {
    overflow-anchor: none;
  }

  .bottom-anchored-timeline-virtual-host {
    position: relative;
    flex: none;
    inline-size: 100%;
    min-inline-size: 0;
  }

  .bottom-anchored-timeline-virtual-item {
    position: absolute;
    inset-inline-start: 0;
    inset-block-start: 0;
  }

  .bottom-anchored-timeline-static-item {
    min-inline-size: 0;
  }

</style>
