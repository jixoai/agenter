<script lang="ts">
  import BottomAnchoredTimeline from "./bottom-anchored-timeline.svelte";
  import type { BottomAnchoredTimelineHandle } from "./bottom-anchored-timeline.types";

  let {
    items,
    latestThreshold = 48,
    motionByValue = {},
  }: {
    items: string[];
    latestThreshold?: number;
    motionByValue?: Record<string, "latest" | "older">;
  } = $props();

  let rows = $state<string[]>([]);
  let timelineRef = $state<BottomAnchoredTimelineHandle | null>(null);
  let atLatest = $state(true);
  let appendedLatestCount = $state(0);

  $effect(() => {
    rows = items;
  });

  const appendLatest = (): void => {
    appendedLatestCount += 1;
    rows = [...rows, `appended-latest-${appendedLatestCount}`];
  };
</script>

<div data-testid="timeline-state" data-at-latest={atLatest}>
  <button
    data-testid="scroll-toward-start"
    type="button"
    onclick={() => {
      timelineRef?.scrollTowardStart(96, "auto");
    }}
  >
    toward start
  </button>
  <button
    data-testid="scroll-to-latest"
    type="button"
    onclick={() => {
      timelineRef?.scrollToLatest("auto");
    }}
  >
    to latest
  </button>
  <button
    data-testid="scroll-to-latest-smooth"
    type="button"
    onclick={() => {
      timelineRef?.scrollToLatest("smooth");
    }}
  >
    to latest smooth
  </button>
  <button data-testid="append-latest" type="button" onclick={appendLatest}>
    append latest
  </button>
</div>

<BottomAnchoredTimeline
  bind:atLatest
  bind:timelineRef
  viewportClass="timeline-harness-viewport"
  contentClass="timeline-harness-content"
  items={rows}
  latestThreshold={latestThreshold}
  viewportTestId="timeline-viewport"
>
  {#snippet item(value, index)}
    <div
      data-insert-motion={value.startsWith("appended-latest-") ? "latest" : (motionByValue[value] ?? "none")}
      data-insert-motion-key={value}
    >
      <div class="timeline-harness-row" data-testid={`timeline-row-${index}`}>
        {value}
      </div>
    </div>
  {/snippet}
</BottomAnchoredTimeline>

<style>
  .timeline-harness-row {
    min-block-size: 120px;
  }
</style>
