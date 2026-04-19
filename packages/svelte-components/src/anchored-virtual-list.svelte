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
    const syncScrollHeightBaseline = (): void => {
      previousViewportScrollHeight = viewport.scrollHeight;
    };
    syncScrollHeightBaseline();
    syncVisibleAnchorSnapshot();
    if (!ResizeObserverCtor) {
      return;
    }
    const observer = new ResizeObserverCtor(() => {
      queueMicrotask(() => {
        syncScrollHeightBaseline();
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
  let previousViewportScrollHeight = 0;
  let pendingAppendPreserveFrame = 0;
  let pendingVisibleAnchorFrame = 0;
  let visibleAnchorSnapshot: VisibleAnchorSnapshot | null = null;

  const resolveCollectionKeys = (): readonly string[] =>
    items.map((value, index) =>
      String(virtual?.getItemKey ? virtual.getItemKey(index, value) : index),
    );

  const resolveTargetWindow = (): Window | null => viewportRef?.ownerDocument?.defaultView ?? null;

  const findAnchoredRowByKey = (root: HTMLElement, rowKey: string): HTMLElement | null =>
    root.querySelector<HTMLElement>(`[${INSERT_MOTION_KEY_ATTRIBUTE}="${rowKey}"]`) ??
    Array.from(root.querySelectorAll<HTMLElement>(`[${ANCHORED_ROW_KEY_ATTRIBUTE}]`)).find(
      (row) => row.getAttribute(ANCHORED_ROW_KEY_ATTRIBUTE) === rowKey,
    ) ??
    null;

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

  $effect(() => {
    const root = contentRef ?? viewportRef;
    const viewport = viewportRef;
    const nextKeys = resolveCollectionKeys();
    const currentViewportScrollHeight = viewport?.scrollHeight ?? previousViewportScrollHeight;
    const anchorSnapshotBeforeDelta = visibleAnchorSnapshot;
    if (previousCollectionKeys === null) {
      previousCollectionKeys = nextKeys;
      previousViewportScrollHeight = currentViewportScrollHeight;
      return;
    }
    if (!(root instanceof HTMLElement)) {
      previousCollectionKeys = nextKeys;
      previousViewportScrollHeight = currentViewportScrollHeight;
      return;
    }
    const delta = resolveCollectionDelta(previousCollectionKeys, nextKeys);
    previousCollectionKeys = nextKeys;
    const previousScrollHeight = previousViewportScrollHeight;
    previousViewportScrollHeight = currentViewportScrollHeight;
    if (viewport && delta.direction === "append" && !atLatest) {
      const targetWindow = viewport.ownerDocument?.defaultView;
      viewport.dataset.anchoredAppendAnchorStatus = anchorSnapshotBeforeDelta ? "captured" : "missing";
      viewport.dataset.anchoredAppendAnchorKey = anchorSnapshotBeforeDelta?.key ?? "";
      viewport.dataset.anchoredAppendAnchorTop = anchorSnapshotBeforeDelta
        ? String(Math.round(anchorSnapshotBeforeDelta.top))
        : "";
      if (pendingAppendPreserveFrame !== 0) {
        targetWindow?.cancelAnimationFrame?.(pendingAppendPreserveFrame);
        pendingAppendPreserveFrame = 0;
      }
      const writeViewportTop = (top: number): void => {
        if (timelineRef) {
          timelineRef.driver.scrollToPosition(
            top,
            viewport.scrollLeft,
            "auto",
            null,
          );
          return;
        }
        viewport.scrollTo({
          top,
          left: viewport.scrollLeft,
          behavior: "auto",
        });
      };
      const applyScrollHeightPreserveDelta = (deltaPx: number): void => {
        if (Math.abs(deltaPx) <= 0.5) {
          return;
        }
        writeViewportTop(viewport.scrollTop - deltaPx);
      };
      const applyAnchorDriftCorrection = (driftPx: number): void => {
        if (Math.abs(driftPx) <= 0.5) {
          return;
        }
        writeViewportTop(viewport.scrollTop + driftPx);
      };
      const readAnchorDrift = (): number | null => {
        if (!anchorSnapshotBeforeDelta) {
          return null;
        }
        const anchorElement = findAnchoredRowByKey(root, anchorSnapshotBeforeDelta.key);
        if (!anchorElement) {
          viewport.dataset.anchoredAppendAnchorStatus = "missing-element";
          return null;
        }
        const drift = anchorElement.getBoundingClientRect().top - anchorSnapshotBeforeDelta.top;
        viewport.dataset.anchoredAppendAnchorStatus = "drift-ready";
        viewport.dataset.anchoredAppendAnchorDrift = String(Math.round(drift));
        return drift;
      };
      let observedScrollHeight = viewport.scrollHeight;
      applyScrollHeightPreserveDelta(Math.max(0, observedScrollHeight - previousScrollHeight));
      const initialAnchorDrift = readAnchorDrift();
      if (initialAnchorDrift !== null) {
        applyAnchorDriftCorrection(initialAnchorDrift);
      }
      previousViewportScrollHeight = observedScrollHeight;

      if (targetWindow?.requestAnimationFrame) {
        let correctionFramesRemaining = 5;
        const reconcileLateGrowth = (): void => {
          if (correctionFramesRemaining <= 0) {
            scheduleVisibleAnchorSnapshotSync();
            return;
          }
          correctionFramesRemaining -= 1;
          pendingAppendPreserveFrame = targetWindow.requestAnimationFrame(() => {
            pendingAppendPreserveFrame = 0;
            const nextObservedScrollHeight = viewport.scrollHeight;
            const extraDelta = Math.max(0, nextObservedScrollHeight - observedScrollHeight);
            observedScrollHeight = nextObservedScrollHeight;
            previousViewportScrollHeight = nextObservedScrollHeight;
            applyScrollHeightPreserveDelta(extraDelta);
            const anchorDrift = readAnchorDrift();
            if (anchorDrift !== null) {
              applyAnchorDriftCorrection(anchorDrift);
            }
            if (extraDelta > 0 || (anchorDrift !== null && Math.abs(anchorDrift) > 0.5)) {
              reconcileLateGrowth();
              return;
            }
            scheduleVisibleAnchorSnapshotSync();
          });
        };
        reconcileLateGrowth();
      } else {
        scheduleVisibleAnchorSnapshotSync();
      }
    }
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
    if (pendingAppendPreserveFrame !== 0) {
      viewportRef?.ownerDocument?.defaultView?.cancelAnimationFrame?.(pendingAppendPreserveFrame);
      pendingAppendPreserveFrame = 0;
    }
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
