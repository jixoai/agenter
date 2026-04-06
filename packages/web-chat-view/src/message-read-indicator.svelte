<script lang="ts">
  import Check from "@lucide/svelte/icons/check";

  import type { WebChatMessageReadProgress } from "./types";

  let {
    progress,
  }: {
    progress: WebChatMessageReadProgress;
  } = $props();

  const totalCount = $derived(Math.max(progress.totalCount, 1));
  const readCount = $derived(Math.max(0, Math.min(progress.readCount, totalCount)));
  const ratio = $derived(totalCount > 0 ? readCount / totalCount : 0);
  const complete = $derived(readCount >= totalCount);
  const title = $derived(progress.title ?? `${readCount}/${totalCount} read`);
  const circumference = 2 * Math.PI * 7;
  const dashOffset = $derived(circumference * (1 - ratio));
</script>

<div
  class="message-read-indicator"
  data-complete={complete ? "true" : "false"}
  data-testid="message-read-indicator"
  aria-label={title}
  title={title}
>
  <svg viewBox="0 0 20 20" class="message-read-ring">
    <circle cx="10" cy="10" r="7" class="message-read-track" />
    <circle
      cx="10"
      cy="10"
      r="7"
      class="message-read-progress"
      stroke-dasharray={circumference}
      stroke-dashoffset={dashOffset}
    />
  </svg>
  {#if complete}
    <Check class="message-read-check" />
  {/if}
</div>

<style>
  .message-read-indicator {
    position: relative;
    display: inline-flex;
    width: 1.65rem;
    height: 1.65rem;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    align-self: flex-end;
    margin-bottom: 0.2rem;
    color: #14b8a6;
  }

  .message-read-ring {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }

  .message-read-track,
  .message-read-progress {
    fill: none;
    stroke-width: 2.2;
  }

  .message-read-track {
    stroke: color-mix(in srgb, currentColor 20%, white);
  }

  .message-read-progress {
    stroke: currentColor;
    stroke-linecap: round;
    transition: stroke-dashoffset 180ms ease;
  }

  .message-read-indicator[data-complete="true"] .message-read-track,
  .message-read-indicator[data-complete="true"] .message-read-progress {
    stroke: currentColor;
  }

  :global(.message-read-check) {
    position: absolute;
    width: 0.8rem;
    height: 0.8rem;
    stroke-width: 2.5;
  }
</style>
