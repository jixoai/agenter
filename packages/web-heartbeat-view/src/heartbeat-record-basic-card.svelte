<script lang="ts">
  import type { Snippet } from "svelte";

  import { isRecordRunning } from "./heartbeat-record-chips";
  import { formatHeartbeatRecordTime, getHeartbeatRecordCardMeta } from "./heartbeat-record-card-model";
  import type { HeartbeatRecordItem } from "./types";

  let {
    record,
    selected = false,
    onSelect,
    children,
    support,
  }: {
    record: HeartbeatRecordItem;
    selected?: boolean;
    onSelect?: (recordId: number) => void;
    children?: Snippet;
    support?: Snippet;
  } = $props();

  const meta = $derived(getHeartbeatRecordCardMeta(record));
</script>

<button
  type="button"
  class="ag-heartbeat-record-card"
  class:ag-heartbeat-record-card--selected={selected}
  class:ag-heartbeat-record-card--running={isRecordRunning(record.status)}
  class:ag-heartbeat-record-card--error={record.status === "error"}
  data-kind={record.kind}
  data-status={record.status}
  data-testid={`heartbeat-record-${record.id}`}
  title={meta.title}
  aria-pressed={selected}
  onclick={() => onSelect?.(record.id)}
>
  <span class="ag-heartbeat-record-card__top">
    <span class="ag-heartbeat-record-card__time" title={`Started at ${new Date(record.startedAt).toISOString()}`}>
      <span>{formatHeartbeatRecordTime(record.startedAt)}</span>
      {#if meta.durationLabel}
        <small>{meta.durationLabel}</small>
      {/if}
    </span>
    <span class="ag-heartbeat-record-card__identity">
      <strong>{meta.kindLabel}</strong>
      {#if meta.modelLabel}
        <span>{meta.modelLabel}</span>
      {/if}
    </span>
    <span class="ag-heartbeat-record-card__status" title={`Record status: ${meta.statusLabel}`}>{meta.statusLabel}</span>
  </span>

  {@render children?.()}

  {#if support}
    {@render support()}
  {:else if record.previewText}
    <span class="ag-heartbeat-record-card__preview">{record.previewText}</span>
  {/if}
</button>

<style>
  .ag-heartbeat-record-card {
    display: grid;
    box-sizing: border-box;
    inline-size: 100%;
    max-inline-size: 100%;
    min-width: 0;
    gap: 0.54rem;
    border: 1px solid color-mix(in srgb, currentColor, transparent 86%);
    border-radius: 12px;
    background: color-mix(in srgb, Canvas, currentColor 2%);
    color: inherit;
    padding: 0.72rem;
    text-align: start;
    contain: layout paint;
  }

  .ag-heartbeat-record-card--selected {
    border-color: color-mix(in srgb, Highlight, currentColor 20%);
    background: color-mix(in srgb, Highlight, Canvas 92%);
  }

  .ag-heartbeat-record-card--running .ag-heartbeat-record-card__time,
  .ag-heartbeat-record-card--running .ag-heartbeat-record-card__status {
    animation: ag-heartbeat-record-breathe 1.6s ease-in-out infinite;
  }

  .ag-heartbeat-record-card--error {
    border-color: color-mix(in srgb, red, currentColor 35%);
  }

  .ag-heartbeat-record-card__top {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    min-width: 0;
    gap: 0.56rem;
  }

  .ag-heartbeat-record-card__time,
  .ag-heartbeat-record-card__status {
    box-sizing: border-box;
    display: inline-grid;
    grid-auto-flow: column;
    grid-auto-columns: max-content;
    align-items: center;
    justify-content: center;
    min-width: 0;
    gap: 0.26rem;
    border: 1px solid color-mix(in srgb, currentColor, transparent 86%);
    border-radius: 999px;
    padding: 0.18rem 0.48rem;
    font: 600 0.72rem/1.16 system-ui, sans-serif;
    white-space: nowrap;
  }

  .ag-heartbeat-record-card__time {
    grid-auto-flow: row;
    justify-items: center;
    gap: 0.02rem;
  }

  .ag-heartbeat-record-card__time small {
    color: color-mix(in srgb, currentColor, transparent 42%);
    font: 0.64rem/1 system-ui, sans-serif;
  }

  .ag-heartbeat-record-card__identity {
    display: grid;
    min-width: 0;
    gap: 0.12rem;
  }

  .ag-heartbeat-record-card__identity strong,
  .ag-heartbeat-record-card__identity span,
  .ag-heartbeat-record-card__preview {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ag-heartbeat-record-card__identity strong {
    font: 700 0.88rem/1.15 system-ui, sans-serif;
  }

  .ag-heartbeat-record-card__identity span,
  .ag-heartbeat-record-card__preview {
    color: color-mix(in srgb, currentColor, transparent 36%);
    font: 0.76rem/1.25 system-ui, sans-serif;
  }

  @keyframes ag-heartbeat-record-breathe {
    0%,
    100% {
      opacity: 0.72;
    }
    50% {
      opacity: 1;
    }
  }
</style>
