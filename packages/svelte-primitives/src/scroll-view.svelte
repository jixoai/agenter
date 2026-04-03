<script lang="ts" generics="Item">
  import type { ScrollOrientation, ScrollViewProps } from "./scroll-view.types";

  let {
    class: className = "",
    viewportClass = "",
    contentClass = "",
    orientation = "vertical",
    viewportRef = $bindable<HTMLElement | null>(null),
    contentRef = $bindable<HTMLElement | null>(null),
    viewportTestId = undefined,
    onViewportScroll = undefined,
    virtual = undefined,
    children,
    item,
    empty,
  }: ScrollViewProps<Item> = $props();
  let viewportWidth = $state(0);
  let viewportHeight = $state(0);
  let scrollLeft = $state(0);
  let scrollTop = $state(0);

  const joinClassNames = (...values: Array<string | false | null | undefined>): string =>
    values.filter((value): value is string => typeof value === "string" && value.length > 0).join(" ");

  const virtualAxis = $derived(orientation === "horizontal" ? "horizontal" : "vertical");
  const viewportSize = $derived(virtualAxis === "horizontal" ? viewportWidth : viewportHeight);
  const scrollOffset = $derived(virtualAxis === "horizontal" ? scrollLeft : scrollTop);

  const virtualItems = $derived.by(() => {
    if (!virtual) {
      return [] as Array<{ value: Item; index: number; offset: number }>;
    }
    const overscan = Math.max(0, virtual.overscan ?? 4);
    const itemSize = Math.max(virtual.itemSize, 1);
    const visibleCount = Math.ceil(Math.max(viewportSize, itemSize) / itemSize);
    const start = Math.max(0, Math.floor(scrollOffset / itemSize) - overscan);
    const end = Math.min(virtual.items.length, start + visibleCount + overscan * 2);
    return virtual.items.slice(start, end).map((value, index) => ({
      value,
      index: start + index,
      offset: (start + index) * itemSize,
    }));
  });

  const totalVirtualSize = $derived(virtual ? virtual.items.length * virtual.itemSize : 0);

  const syncViewportMetrics = (): void => {
    if (!viewportRef) {
      return;
    }
    viewportWidth = viewportRef.clientWidth;
    viewportHeight = viewportRef.clientHeight;
    scrollLeft = viewportRef.scrollLeft;
    scrollTop = viewportRef.scrollTop;
  };

  const resolveViewportOrientation = (value: ScrollOrientation): string => {
    if (value === "horizontal") {
      return "horizontal";
    }
    if (value === "both") {
      return "both";
    }
    return "vertical";
  };

  $effect(() => {
    if (!viewportRef) {
      return;
    }
    syncViewportMetrics();
    const handleScroll = (): void => {
      syncViewportMetrics();
    };
    const resizeObserver = new ResizeObserver(() => {
      syncViewportMetrics();
    });
    viewportRef.addEventListener("scroll", handleScroll, { passive: true });
    resizeObserver.observe(viewportRef);
    return () => {
      viewportRef?.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
    };
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
            {#each virtualItems as row (row.index)}
              <div
                class="scroll-view-virtual-item"
                style={`transform:translate${virtualAxis === "horizontal" ? "X" : "Y"}(${row.offset}px);${
                  virtualAxis === "horizontal"
                    ? `width:${virtual.itemSize}px;height:100%;`
                    : `height:${virtual.itemSize}px;`
                }`}
              >
                {@render item(row.value, row.index)}
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
