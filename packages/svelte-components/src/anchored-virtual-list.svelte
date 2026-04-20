<script lang="ts" generics="Item">
  import { onDestroy, untrack } from "svelte";

  import BottomAnchoredTimeline from "./bottom-anchored-timeline.svelte";
  import { createBottomAnchoredTimelineHostAdapter } from "./anchored-virtual-list-scroll-browser";
  import { createAnchoredVirtualListScrollController } from "./anchored-virtual-list-scroll-controller";
  import { createNamedScrollController } from "./named-scroll-controller";
  import type { AnchoredVirtualListScrollHandle } from "./anchored-virtual-list-scroll.types";
  import type { AnchoredVirtualListProps } from "./anchored-virtual-list.types";
  import {
    ANCHORED_VIRTUAL_LIST_COLLECTION_DELTA_EVENT,
    ANCHORED_VIRTUAL_LIST_INSERT_BATCH_EVENT,
    resolveCollectionDelta,
  } from "./named-scroll-triggers";
  import type { AnchoredVirtualListCollectionDeltaEventDetail } from "./named-scroll-triggers";
  import type { ScrollController } from "./named-scroll-controller.types";
  import type {
    BottomAnchoredTimelineHandle,
    BottomAnchoredTimelineInsertMotionBatch,
    BottomAnchoredTimelineScrollCommand,
  } from "./bottom-anchored-timeline.types";
  import type { ScrollViewVirtualizer, ScrollVirtualOnChangeHandler } from "./scroll-view.types";

  const ANCHORED_ROW_KEY_ATTRIBUTE = "data-anchored-row-key";
  const INSERT_MOTION_KEY_ATTRIBUTE = "data-insert-motion-key";

  type VisibleAnchorSnapshot = {
    key: string;
    top: number;
  };

  const compareKeyArrays = (left: readonly string[], right: readonly string[]): boolean =>
    left.length === right.length && left.every((value, index) => value === right[index]);

  const kernel = createAnchoredVirtualListScrollController();
  const controller = createNamedScrollController({ kernel });
  let timelineRef = $state<BottomAnchoredTimelineHandle | null>(null);

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
    scrollHandleRef = $bindable<AnchoredVirtualListScrollHandle | null>(null),
    scrollControllerRef = $bindable<ScrollController | null>(null),
    scrollState = $bindable<AnchoredVirtualListProps<Item>["scrollState"]>(undefined),
    controllerOptions = undefined,
    resolveScrollTarget = undefined,
    atLatest = $bindable(true),
    atStart = $bindable(false),
    latestThreshold = 48,
    startThreshold = 48,
    item,
    empty,
    start,
    end,
  }: AnchoredVirtualListProps<Item> = $props();

  const handleTimelineScrollCommand = (command: BottomAnchoredTimelineScrollCommand): void => {
    switch (command.kind) {
      case "edge":
        void kernel.handle.request({
          intent: "seek",
          target: { kind: "edge", edge: command.edge },
          source: command.source === "imperative" ? "api" : "reconcile",
          priority: command.source === "imperative" ? "default" : "background",
          behavior: command.behavior,
          settle: "scroll-end",
          debugLabel: `bottom-anchored-timeline:${command.edge}`,
        });
        return;
      case "position":
        void kernel.handle.request({
          intent: "stabilize",
          target: {
            kind: "position",
            top: command.top,
            left: command.left,
          },
          source: command.source === "imperative" ? "api" : "reconcile",
          priority: command.source === "imperative" ? "default" : "background",
          behavior: command.behavior,
          settle: "scroll-end",
          debugLabel: `bottom-anchored-timeline:${command.source}:position`,
        });
        return;
    }
  };

  const handleInsertMotionPrepare = (batch: BottomAnchoredTimelineInsertMotionBatch): void => {
    kernel.publishInsertMotionBatch(batch);
  };

  const handleInsertMotionBatch = (batch: BottomAnchoredTimelineInsertMotionBatch): void => {
    if (viewportRef && Math.abs(viewportRef.scrollTop - batch.snapshot.scrollTop) <= 1) {
      kernel.publishInsertMotionBatch(batch);
    }
    const latestElements = batch.entries
      .filter((entry) => entry.motion === "latest")
      .map((entry) => entry.element);
    const olderElements = batch.entries
      .filter((entry) => entry.motion === "older")
      .map((entry) => entry.element);
    if (contentRef && latestElements.length > 0) {
      contentRef.dispatchEvent(
        new CustomEvent(ANCHORED_VIRTUAL_LIST_INSERT_BATCH_EVENT, {
          detail: {
            motion: "latest",
            elements: latestElements,
            extentPx: latestElements.reduce((total, element) => total + Math.round(element.getBoundingClientRect().height), 0),
            nearestElement: latestElements.at(-1) ?? null,
          },
          bubbles: true,
        }),
      );
    }
    if (contentRef && olderElements.length > 0) {
      contentRef.dispatchEvent(
        new CustomEvent(ANCHORED_VIRTUAL_LIST_INSERT_BATCH_EVENT, {
          detail: {
            motion: "older",
            elements: olderElements,
            extentPx: olderElements.reduce((total, element) => total + Math.round(element.getBoundingClientRect().height), 0),
            nearestElement: olderElements.at(-1) ?? null,
          },
          bubbles: true,
        }),
      );
    }
  };

  const hostAdapter = createBottomAnchoredTimelineHostAdapter({
    getViewport: () => viewportRef,
    getContentRoot: () => contentRef ?? viewportRef,
    getTimelineHandle: () => timelineRef,
    getEdgeState: () => ({ atLatest, atStart }),
    resolveTarget: (request, snapshot) => resolveScrollTarget?.(request, snapshot) ?? null,
  });

  const unsubscribe = kernel.handle.subscribe((snapshot) => {
    scrollState = snapshot;
  });

  onDestroy(() => {
    unsubscribe();
    controller.disconnect();
  });

  $effect(() => {
    scrollHandleRef = kernel.handle;
    scrollControllerRef = controller;
  });

  $effect(() => {
    viewportRef;
    contentRef;
    timelineRef;
    resolveScrollTarget;
    controllerOptions;
    untrack(() => {
      controller.connect(hostAdapter);
    });
  });

  $effect(() => {
    const viewport = viewportRef;
    const observedContent = contentRef ?? viewportRef;
    if (!viewport || !observedContent) {
      return;
    }
    const targetWindow = viewport.ownerDocument?.defaultView;
    const ResizeObserverCtor = targetWindow?.ResizeObserver;
    syncVisibleAnchorSnapshot();
    if (!ResizeObserverCtor) {
      return;
    }
    const observer = new ResizeObserverCtor(() => {
      queueMicrotask(() => {
        scheduleVisibleAnchorSnapshotSync();
      });
    });
    observer.observe(observedContent, { box: "border-box" });
    return () => {
      observer.disconnect();
    };
  });

  const handleViewportScroll = (event: Event): void => {
    onViewportScroll?.(event);
    if (visibleAnchorSnapshot === null) {
      syncVisibleAnchorSnapshot();
    }
    scheduleVisibleAnchorSnapshotSync();
  };

  let previousCollectionKeys: readonly string[] | null = null;
  let pendingVisibleAnchorFrame = 0;
  let visibleAnchorSnapshot: VisibleAnchorSnapshot | null = null;

  const resolveCollectionKeys = (): readonly string[] =>
    items.map((value, index) =>
      String(virtual?.getItemKey ? virtual.getItemKey(index, value) : index),
    );

  const resolveTargetWindow = (): Window | null => viewportRef?.ownerDocument?.defaultView ?? null;

  const readVisibleAnchorSnapshot = (): VisibleAnchorSnapshot | null => {
    const viewport = viewportRef;
    const root = contentRef ?? viewportRef;
    if (!(viewport instanceof HTMLElement) || !(root instanceof HTMLElement)) {
      return null;
    }
    const viewportRect = viewport.getBoundingClientRect();
    const viewportCenter = viewportRect.top + viewportRect.height / 2;
    const motionRows = Array.from(root.querySelectorAll<HTMLElement>(`[${INSERT_MOTION_KEY_ATTRIBUTE}]`));
    const fallbackRows = Array.from(root.querySelectorAll<HTMLElement>(`[${ANCHORED_ROW_KEY_ATTRIBUTE}]`));
    const rows = (motionRows.length > 0 ? motionRows : fallbackRows).filter((row) => {
      const rect = row.getBoundingClientRect();
      return rect.bottom > viewportRect.top + 1 && rect.top < viewportRect.bottom - 1;
    });
    if (rows.length === 0) {
      return null;
    }
    let bestRow: HTMLElement | null = null;
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
      if (distance < bestDistance) {
        bestDistance = distance;
        bestRow = row;
      }
    }
    if (!bestRow) {
      return null;
    }
    const rowKey =
      bestRow.getAttribute(INSERT_MOTION_KEY_ATTRIBUTE)?.trim() ??
      bestRow.getAttribute(ANCHORED_ROW_KEY_ATTRIBUTE)?.trim() ??
      "";
    if (rowKey.length === 0) {
      return null;
    }
    return {
      key: rowKey,
      top: bestRow.getBoundingClientRect().top,
    };
  };

  const syncVisibleAnchorSnapshot = (): void => {
    visibleAnchorSnapshot = readVisibleAnchorSnapshot();
    if (viewportRef) {
      viewportRef.dataset.anchoredVisibleKey = visibleAnchorSnapshot?.key ?? "";
      viewportRef.dataset.anchoredVisibleTop = visibleAnchorSnapshot
        ? String(Math.round(visibleAnchorSnapshot.top))
        : "";
    }
  };

  const scheduleVisibleAnchorSnapshotSync = (): void => {
    const targetWindow = resolveTargetWindow();
    if (pendingVisibleAnchorFrame !== 0) {
      targetWindow?.cancelAnimationFrame?.(pendingVisibleAnchorFrame);
      pendingVisibleAnchorFrame = 0;
    }
    if (!targetWindow?.requestAnimationFrame) {
      syncVisibleAnchorSnapshot();
      return;
    }
    pendingVisibleAnchorFrame = targetWindow.requestAnimationFrame(() => {
      pendingVisibleAnchorFrame = targetWindow.requestAnimationFrame(() => {
        pendingVisibleAnchorFrame = 0;
        syncVisibleAnchorSnapshot();
      });
    });
  };

  const resolvedVirtualConfig = $derived.by(() => {
    if (!virtual) {
      return undefined;
    }
    const onChange = virtual.onChange;
    return {
      ...virtual,
      onChange: ((instance, sync) => {
        onChange?.(instance, sync);
        scheduleVisibleAnchorSnapshotSync();
      }) satisfies ScrollVirtualOnChangeHandler,
    };
  });

  $effect.pre(() => {
    const nextKeys = resolveCollectionKeys();
    if (previousCollectionKeys === null || compareKeyArrays(previousCollectionKeys, nextKeys)) {
      return;
    }
    syncVisibleAnchorSnapshot();
  });

  $effect(() => {
    const root = contentRef ?? viewportRef;
    const nextKeys = resolveCollectionKeys();
    if (previousCollectionKeys === null) {
      previousCollectionKeys = nextKeys;
      return;
    }
    if (!(root instanceof HTMLElement)) {
      previousCollectionKeys = nextKeys;
      return;
    }
    const delta = resolveCollectionDelta(previousCollectionKeys, nextKeys);
    previousCollectionKeys = nextKeys;
    if (!delta.changed) {
      return;
    }
    root.dispatchEvent(
      new CustomEvent<AnchoredVirtualListCollectionDeltaEventDetail>(
        ANCHORED_VIRTUAL_LIST_COLLECTION_DELTA_EVENT,
        {
          detail: {
            direction: delta.direction,
            insertedKeys: delta.insertedKeys,
            removedKeys: delta.removedKeys,
            anchorKey: delta.anchorKey,
          },
          bubbles: true,
        },
      ),
    );
    scheduleVisibleAnchorSnapshotSync();
  });

  onDestroy(() => {
    if (pendingVisibleAnchorFrame !== 0) {
      viewportRef?.ownerDocument?.defaultView?.cancelAnimationFrame?.(pendingVisibleAnchorFrame);
      pendingVisibleAnchorFrame = 0;
    }
  });
</script>

  <BottomAnchoredTimeline
  class={className}
  {viewportClass}
  {contentClass}
  bind:viewportRef
  bind:contentRef
  {viewportTestId}
  onViewportScroll={handleViewportScroll}
  onInsertMotionPrepare={handleInsertMotionPrepare}
  onScrollCommand={handleTimelineScrollCommand}
  onInsertMotionBatch={handleInsertMotionBatch}
  {items}
  virtual={resolvedVirtualConfig}
  bind:virtualizerRef
  bind:timelineRef
  bind:atLatest
  bind:atStart
  {latestThreshold}
  {startThreshold}
  {item}
  {empty}
  {start}
  {end}
/>
