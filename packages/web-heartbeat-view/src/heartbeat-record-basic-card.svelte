<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";

  import { isRecordRunning } from "./heartbeat-record-chips";
  import { formatHeartbeatRecordTime, getHeartbeatRecordCardMeta } from "./heartbeat-record-card-model";
  import type { HeartbeatRecordItem } from "./types";

  let {
    record,
    selected = false,
    children,
    support,
  }: {
    record: HeartbeatRecordItem;
    selected?: boolean;
    children?: Snippet;
    support?: Snippet;
  } = $props();

  let nowMs = $state(Date.now());

  const meta = $derived(getHeartbeatRecordCardMeta(record, nowMs));
  const recordTime = $derived(formatHeartbeatRecordTime(record.startedAt));
  const hasSupport = $derived(Boolean(support || meta.supportLabel || record.previewText));

  onMount(() => {
    const timer = setInterval(() => {
      if (isRecordRunning(record.status)) {
        nowMs = Date.now();
      }
    }, 1_000);
    return () => {
      clearInterval(timer);
    };
  });
</script>

<article
  class="ag-heartbeat-basic-record-card"
  class:ag-heartbeat-basic-record-card--selected={selected}
  class:ag-heartbeat-basic-record-card--running={isRecordRunning(record.status)}
  class:ag-heartbeat-basic-record-card--error={record.status === "error"}
  class:ag-heartbeat-basic-record-card--has-support={hasSupport}
  data-card-kind={record.kind}
  data-status={record.status}
  data-testid={`heartbeat-record-${record.id}`}
  title={meta.title}
>
  <header class="ag-heartbeat-basic-record-card__head">
    <div class="ag-heartbeat-basic-record-card__stack">
      <span class="ag-heartbeat-basic-record-card__time" title={`Started at ${new Date(record.startedAt).toISOString()}`}>{recordTime}</span>
      {#if meta.durationLabel}
        <span class="ag-heartbeat-basic-record-card__duration">{meta.durationLabel}</span>
      {/if}
    </div>
    <div class="ag-heartbeat-basic-record-card__stack">
      <strong class="ag-heartbeat-basic-record-card__title">{meta.kindLabel}</strong>
      <span class="ag-heartbeat-basic-record-card__meta" title={meta.modelLabel ?? meta.metaLabel}>{meta.metaLabel}</span>
    </div>
    <div class="ag-heartbeat-basic-record-card__status-wrap">
      <span class="ag-heartbeat-basic-record-card__status" title={`Record status: ${meta.statusLabel}`}>{meta.statusLabel}</span>
    </div>
  </header>

  <div class="ag-heartbeat-basic-record-card__body">
    {@render children?.()}
  </div>

  {#if support}
    <footer class="ag-heartbeat-basic-record-card__support">{@render support()}</footer>
  {:else if meta.supportLabel}
    <footer class="ag-heartbeat-basic-record-card__support">
      <span>{meta.supportLabel}</span>
    </footer>
  {:else if record.previewText}
    <footer class="ag-heartbeat-basic-record-card__support">
      <span>{record.previewText}</span>
    </footer>
  {/if}
</article>

<style>
  .ag-heartbeat-basic-record-card {
    box-sizing: border-box;
    display: grid;
    grid-template-rows: auto minmax(44px, 1fr);
    gap: 10px;
    inline-size: 100%;
    max-inline-size: 100%;
    min-inline-size: 0;
    min-block-size: 126px;
    border: 1px solid color-mix(in srgb, currentColor, transparent 86%);
    border-radius: 16px;
    background: color-mix(in oklab, Canvas, currentColor 2%);
    padding: 10px;
    text-align: start;
    contain: layout paint;
  }

  .ag-heartbeat-basic-record-card--has-support {
    grid-template-rows: auto minmax(44px, 1fr) auto;
    min-block-size: 150px;
  }

  .ag-heartbeat-basic-record-card--selected {
    border-color: color-mix(in oklab, Highlight, currentColor 20%);
    background: color-mix(in oklab, Highlight, Canvas 92%);
  }

  .ag-heartbeat-basic-record-card--running .ag-heartbeat-basic-record-card__time,
  .ag-heartbeat-basic-record-card--running .ag-heartbeat-basic-record-card__duration,
  .ag-heartbeat-basic-record-card--running .ag-heartbeat-basic-record-card__status {
    animation: ag-heartbeat-record-breathe 2.3s ease-in-out infinite;
    transform-origin: center;
  }

  .ag-heartbeat-basic-record-card--error {
    border-color: color-mix(in oklab, var(--kind-error, #dc2626), currentColor 35%);
  }

  .ag-heartbeat-basic-record-card__head {
    display: grid;
    grid-template-columns: minmax(70px, auto) minmax(0, 1fr) auto;
    gap: 10px;
    align-items: start;
  }

  .ag-heartbeat-basic-record-card__stack {
    display: grid;
    gap: 2px;
    min-inline-size: 0;
  }

  .ag-heartbeat-basic-record-card__status-wrap {
    display: flex;
    justify-content: flex-end;
  }

  .ag-heartbeat-basic-record-card__body {
    display: grid;
    min-inline-size: 0;
    align-items: center;
  }

  .ag-heartbeat-basic-record-card__support {
    display: block;
    min-inline-size: 0;
    color: color-mix(in srgb, currentColor, transparent 42%);
    font: 0.72rem/1.35 system-ui, sans-serif;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ag-heartbeat-basic-record-card__time {
    display: block;
    color: currentColor;
    font: 600 12.5px/1.15 system-ui, sans-serif;
  }

  .ag-heartbeat-basic-record-card__duration,
  .ag-heartbeat-basic-record-card__meta {
    display: block;
    overflow: hidden;
    color: color-mix(in srgb, currentColor, transparent 36%);
    font: 0.72rem/1.35 system-ui, sans-serif;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ag-heartbeat-basic-record-card__title {
    display: block;
    overflow: hidden;
    color: currentColor;
    font: 700 12.5px/1.15 system-ui, sans-serif;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ag-heartbeat-basic-record-card__status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 28px;
    border: 1px solid color-mix(in srgb, currentColor, transparent 86%);
    border-radius: 999px;
    background: #fff;
    padding: 0 10px;
    color: color-mix(in srgb, currentColor, transparent 32%);
    font: 600 11px/1 system-ui, sans-serif;
    white-space: nowrap;
  }

  @keyframes ag-heartbeat-record-breathe {
    0%,
    100% {
      opacity: 0.74;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.018);
    }
  }
</style>
