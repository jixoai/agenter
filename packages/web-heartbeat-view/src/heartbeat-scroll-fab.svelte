<script lang="ts">
  import ArrowDownToLine from "@lucide/svelte/icons/arrow-down-to-line";
  import { onDestroy, onMount, tick } from "svelte";

  import { Fab } from "./framework7-components";

  let {
    contentSelector,
    refreshKey = "",
    class: className = "",
  }: {
    contentSelector: string;
    refreshKey?: string | number;
    class?: string;
  } = $props();

  let pageContent: HTMLElement | null = null;
  let visible = $state(false);
  let frame = 0;

  const readPageContent = (): HTMLElement | null => document.querySelector<HTMLElement>(contentSelector);
  const isNearBottom = (element: HTMLElement): boolean =>
    element.scrollHeight - element.clientHeight - element.scrollTop <= 48;

  const updateVisibility = (): void => {
    pageContent = readPageContent();
    visible = Boolean(pageContent && pageContent.scrollHeight > pageContent.clientHeight + 1 && !isNearBottom(pageContent));
  };

  const queueVisibilityUpdate = (): void => {
    if (typeof window === "undefined") {
      return;
    }
    if (frame !== 0) {
      window.cancelAnimationFrame(frame);
    }
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      updateVisibility();
    });
  };

  const scrollToBottom = (): void => {
    pageContent = pageContent ?? readPageContent();
    if (!pageContent) {
      return;
    }
    pageContent.scrollTo({
      top: pageContent.scrollHeight,
      behavior: "smooth",
    });
    queueVisibilityUpdate();
  };

  onMount(() => {
    void tick().then(() => {
      pageContent = readPageContent();
      pageContent?.addEventListener("scroll", updateVisibility, { passive: true });
      updateVisibility();
    });
  });

  onDestroy(() => {
    if (frame !== 0 && typeof window !== "undefined") {
      window.cancelAnimationFrame(frame);
    }
    pageContent?.removeEventListener("scroll", updateVisibility);
  });

  $effect(() => {
    refreshKey;
    contentSelector;
    queueVisibilityUpdate();
  });

  const fabClass = $derived(["ag-heartbeat-scroll-fab", className].filter(Boolean).join(" "));
</script>

{#if visible}
  <Fab
    position="right-bottom"
    class={fabClass}
    title="Scroll to bottom"
    aria-label="Scroll to bottom"
    onclick={() => scrollToBottom()}
  >
    <ArrowDownToLine size={22} aria-hidden="true" />
    <span class="ag-heartbeat-scroll-fab__label">Scroll to bottom</span>
  </Fab>
{/if}

<style>
  .ag-heartbeat-scroll-fab__label {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
