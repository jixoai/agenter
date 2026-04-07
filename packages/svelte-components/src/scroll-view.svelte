<script lang="ts" generics="Item">
  import {
    createVirtualizer,
    measureElement as defaultMeasureElement,
    type VirtualItem,
  } from "@tanstack/svelte-virtual";
  import { onDestroy } from "svelte";

  import type {
    ScrollOrientation,
    ScrollViewProps,
    ScrollViewVirtualizer,
    ScrollVirtualConfig,
    ScrollVirtualMeasureInput,
  } from "./scroll-view.types";

  type VirtualRow<TItem> = { value: TItem; index: number; virtualItem: VirtualItem };
  type ScrollVirtualCoreInstance = ScrollVirtualMeasureInput<Item>["virtualizer"];
  type ScrollVirtualMeasureCallback = (
    element: HTMLDivElement,
    entry: ResizeObserverEntry | undefined,
    instance: ScrollVirtualCoreInstance,
  ) => number;

  let {
    class: className = "",
    viewportClass = "",
    contentClass = "",
    orientation = "vertical",
    viewportRef = $bindable<HTMLDivElement | null>(null),
    contentRef = $bindable<HTMLDivElement | null>(null),
    viewportTestId = undefined,
    onViewportScroll = undefined,
    virtual = undefined,
    virtualizerRef = $bindable<ScrollViewVirtualizer | null>(null),
    children,
    item,
    empty,
  }: ScrollViewProps<Item> = $props();

  const joinClassNames = (...values: Array<string | false | null | undefined>): string =>
    values.filter((value): value is string => typeof value === "string" && value.length > 0).join(" ");

  const virtualizerStore = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: 0,
    getScrollElement: () => viewportRef,
    estimateSize: () => 1,
    initialOffset: 0,
    enabled: false,
  });
  let virtualizerHandle: ScrollViewVirtualizer | null = null;
  let virtualizerReady = $state(false);
  const unsubscribeVirtualizer = virtualizerStore.subscribe((nextVirtualizer) => {
    virtualizerHandle = nextVirtualizer;
    if (!virtualizerReady) {
      virtualizerReady = true;
    }
  });

  const virtualAxis = $derived(orientation === "horizontal" ? "horizontal" : "vertical");
  const virtualizer = $derived(virtual ? $virtualizerStore : null);
  const totalVirtualSize = $derived(virtualizer?.getTotalSize() ?? 0);
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
  const virtualRows = $derived.by(() => {
    const config = virtual;
    const instance = virtualizer;
    if (!config || !instance) {
      return [] as Array<VirtualRow<Item>>;
    }
    const rows: Array<VirtualRow<Item>> = [];
    for (const virtualItem of instance.getVirtualItems()) {
      const value = config.items[virtualItem.index];
      if (value === undefined) {
        continue;
      }
      rows.push({ value, index: virtualItem.index, virtualItem });
    }
    return rows;
  });

  const resolveViewportOrientation = (value: ScrollOrientation): string => {
    if (value === "horizontal") {
      return "horizontal";
    }
    if (value === "both") {
      return "both";
    }
    return "vertical";
  };

  const resolveEstimateSize = (config: ScrollVirtualConfig<Item>, index: number): number => {
    const nextItem = config.items[index];
    if (nextItem === undefined) {
      return 1;
    }
    return Math.max(1, config.estimateSize(index, nextItem));
  };

  const resolveMeasureElement = (
    config: ScrollVirtualConfig<Item> | undefined,
  ): ScrollVirtualMeasureCallback | undefined => {
    const measureHandler = config?.measureElement;
    if (!measureHandler) {
      return undefined;
    }
    if (measureHandler === true) {
      return (element, entry, instance) => defaultMeasureElement(element, entry, instance);
    }
    return (element, entry, instance) => {
      const index = instance.indexFromElement(element);
      const nextItem = config.items[index];
      if (nextItem === undefined) {
        return defaultMeasureElement(element, entry, instance);
      }
      return measureHandler({
        element,
        entry,
        index,
        item: nextItem,
        virtualizer: instance,
      });
    };
  };

  const measureVirtualItem = (
    node: HTMLDivElement,
    input: { enabled: boolean; virtualizer: ScrollViewVirtualizer | null },
  ) => {
    const measure = (nextInput: { enabled: boolean; virtualizer: ScrollViewVirtualizer | null }): void => {
      if (!nextInput.enabled || !nextInput.virtualizer) {
        return;
      }
      nextInput.virtualizer.measureElement(node);
    };
    measure(input);
    return {
      update(nextInput: { enabled: boolean; virtualizer: ScrollViewVirtualizer | null }) {
        measure(nextInput);
      },
    };
  };

  onDestroy(() => {
    unsubscribeVirtualizer();
    virtualizerHandle = null;
    virtualizerReady = false;
  });

  $effect(() => {
    const ready = virtualizerReady;
    const instance = virtualizerHandle;
    if (!ready || !instance) {
      return;
    }
    const config = virtual;
    virtualizerRef = config ? instance : null;
    if (!config) {
      instance.setOptions({
        count: 0,
        enabled: false,
        getScrollElement: () => viewportRef,
        estimateSize: () => 1,
        horizontal: orientation === "horizontal",
      });
      return;
    }
    instance.setOptions({
      count: config.items.length,
      enabled: config.enabled ?? true,
      debug: config.debug,
      getScrollElement: () => viewportRef,
      horizontal: orientation === "horizontal",
      estimateSize: (index) => resolveEstimateSize(config, index),
      getItemKey: config.getItemKey
        ? (index) => {
            const nextItem = config.items[index];
            return nextItem === undefined ? index : config.getItemKey?.(index, nextItem) ?? index;
          }
        : undefined,
      measureElement: resolveMeasureElement(config),
      overscan: config.overscan,
      paddingStart: config.paddingStart,
      paddingEnd: config.paddingEnd,
      scrollPaddingStart: config.scrollPaddingStart,
      scrollPaddingEnd: config.scrollPaddingEnd,
      initialOffset: config.initialOffset ?? 0,
      rangeExtractor: config.rangeExtractor,
      gap: config.gap,
      initialMeasurementsCache: config.initialMeasurementsCache,
      isScrollingResetDelay: config.isScrollingResetDelay,
      useScrollendEvent: config.useScrollendEvent,
      useAnimationFrameWithResizeObserver: config.useAnimationFrameWithResizeObserver,
    });
  });
</script>

<div class={joinClassNames("scroll-view-root", className)} data-scroll-view-root="true">
  <div
    bind:this={viewportRef}
    class={joinClassNames("scroll-view-viewport", viewportClass)}
    data-scroll-view-viewport={resolveViewportOrientation(orientation)}
    data-testid={viewportTestId}
    onscroll={onViewportScroll}
  >
    <div
      bind:this={contentRef}
      class={joinClassNames("scroll-view-content", contentClass)}
      data-scroll-view-content={virtual ? "virtual" : "static"}
    >
      {#if virtual && item}
        {#if virtual.items.length === 0}
          {@render empty?.()}
        {:else}
          <div
            class="scroll-view-virtual-host"
            style={`${
              virtualAxis === "horizontal"
                ? `width:${totalVirtualSize}px;height:100%;`
                : `height:${totalVirtualSize}px;`
            }`}
          >
            {#each virtualRows as row (row.virtualItem.key)}
              <div
                class="scroll-view-virtual-item"
                data-index={row.index}
                style={`transform:translate${virtualAxis === "horizontal" ? "X" : "Y"}(${row.virtualItem.start}px);${
                  virtualAxis === "horizontal"
                    ? `width:${row.virtualItem.size}px;height:100%;`
                    : `height:${row.virtualItem.size}px;`
                }`}
                use:measureVirtualItem={measureVirtualInput}
              >
                {@render item(row.value, row.index, row.virtualItem)}
              </div>
            {/each}
          </div>
        {/if}
      {:else}
        {@render children?.()}
      {/if}
    </div>
  </div>
</div>

<style>
  .scroll-view-root {
    block-size: 100%;
    inline-size: 100%;
    min-block-size: 0;
    min-inline-size: 0;
  }

  .scroll-view-viewport {
    block-size: 100%;
    inline-size: 100%;
    min-block-size: 0;
    min-inline-size: 0;
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, currentColor, transparent) transparent;
  }

  .scroll-view-viewport[data-scroll-view-viewport="vertical"] {
    overflow-y: auto;
    overflow-x: hidden;
  }

  .scroll-view-viewport[data-scroll-view-viewport="horizontal"] {
    overflow-x: auto;
    overflow-y: hidden;
  }

  .scroll-view-viewport[data-scroll-view-viewport="both"] {
    overflow: auto;
  }

  .scroll-view-viewport::-webkit-scrollbar {
    width: 0.5rem;
    height: 0.5rem;
  }

  .scroll-view-viewport::-webkit-scrollbar-track {
    background: transparent;
  }

  .scroll-view-viewport::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, currentColor, transparent);
    border-radius: 999px;
  }

  .scroll-view-content {
    min-block-size: 100%;
    min-inline-size: 0;
    align-content: start;
  }

  .scroll-view-viewport[data-scroll-view-viewport="horizontal"] .scroll-view-content {
    inline-size: max-content;
  }

  .scroll-view-virtual-host {
    position: relative;
  }

  .scroll-view-virtual-item {
    position: absolute;
    inset-inline-start: 0;
    inset-block-start: 0;
    inline-size: 100%;
  }
</style>
