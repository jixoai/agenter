<script lang="ts">
  import { getHeartbeatCompactBodyModel } from "./heartbeat-record-card-model";
  import { formatHeartbeatRecordPayload, readHeartbeatRecordPayloadValue } from "./heartbeat-record-detail-model";
  import HeartbeatRecordObjectBody from "./heartbeat-record-object-body.svelte";
  import type { HeartbeatRecordItem } from "./types";

  let {
    record,
    payload = null,
    variant = "card",
    title,
  }: {
    record: HeartbeatRecordItem;
    payload?: unknown;
    variant?: "card" | "detail";
    title: string;
  } = $props();

  type CompactTab = "new" | "old";

  let compactTab = $state<CompactTab>("new");

  const bodyModel = $derived(getHeartbeatCompactBodyModel(record));
  const newContext = $derived(
    readHeartbeatRecordPayloadValue(payload, ["newContext", "new", "after", "context", "text", "content"]) ??
      (payload === null ? null : payload),
  );
  const oldContext = $derived(readHeartbeatRecordPayloadValue(payload, ["oldContext", "old", "before", "previousContext"]) ?? null);
  const compactError = $derived(readHeartbeatRecordPayloadValue(payload, ["error", "message"]) ?? null);
  const compactSource = $derived.by(() => {
    if (compactTab === "old") {
      return oldContext === null ? "" : formatHeartbeatRecordPayload(oldContext);
    }
    return newContext === null ? "" : formatHeartbeatRecordPayload(newContext);
  });
</script>

{#if variant === "card"}
  <HeartbeatRecordObjectBody model={bodyModel} kind="compact" {title} running={record.status === "running"} />
{:else}
  <div class="ag-heartbeat-record-kind-body" data-record-body="compact">
    <HeartbeatRecordObjectBody model={bodyModel} kind="compact" {title} detail running={record.status === "running"} />
    <div class="ag-heartbeat-record-detail__tabs" role="tablist" aria-label="Compact detail tabs">
      <button type="button" class:active={compactTab === "new"} onclick={() => (compactTab = "new")}>New Context</button>
      <button type="button" class:active={compactTab === "old"} onclick={() => (compactTab = "old")}>Old Context</button>
    </div>
    {#if compactTab === "new" && compactError !== null}
      <div class="ag-heartbeat-record-detail__error">{formatHeartbeatRecordPayload(compactError)}</div>
    {/if}
    {#if record.status === "running" && compactTab === "new"}
      <div class="ag-heartbeat-record-detail__streaming">streaming</div>
    {/if}
    {#if compactSource}
      <pre class="ag-heartbeat-record-detail__source">{compactSource}</pre>
    {:else}
      <div class="ag-heartbeat-record-detail__empty ag-heartbeat-record-detail__empty--pulse">
        {compactTab === "new" ? "Waiting for compacted context" : "No old context snapshot"}
      </div>
    {/if}
  </div>
{/if}

<style>
  .ag-heartbeat-record-kind-body {
    display: grid;
    min-width: 0;
    gap: 0.58rem;
  }

  .ag-heartbeat-record-detail__tabs {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 0.3rem;
  }

  .ag-heartbeat-record-detail__tabs button {
    overflow: hidden;
    border: 1px solid color-mix(in srgb, currentColor, transparent 86%);
    border-radius: 999px;
    background: transparent;
    color: inherit;
    padding: 0.35rem 0.5rem;
    font: 600 0.72rem/1.1 system-ui, sans-serif;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ag-heartbeat-record-detail__tabs button.active {
    background: color-mix(in srgb, Highlight, Canvas 88%);
  }

  .ag-heartbeat-record-detail__error {
    border: 1px solid color-mix(in srgb, red, currentColor 70%);
    border-radius: 8px;
    background: color-mix(in srgb, red, Canvas 92%);
    color: color-mix(in srgb, red, currentColor 20%);
    padding: 0.5rem 0.62rem;
    font: 0.78rem/1.35 system-ui, sans-serif;
  }

  .ag-heartbeat-record-detail__streaming {
    justify-self: start;
    border: 1px dashed color-mix(in srgb, currentColor, transparent 76%);
    border-radius: 999px;
    padding: 0.22rem 0.56rem;
    color: color-mix(in srgb, currentColor, transparent 34%);
    font: 700 0.72rem/1.15 system-ui, sans-serif;
    animation: ag-heartbeat-record-detail-breathe 1.6s ease-in-out infinite;
  }

  .ag-heartbeat-record-detail__source {
    box-sizing: border-box;
    min-width: 0;
    max-inline-size: 100%;
    overflow: auto;
    border: 1px solid color-mix(in srgb, currentColor, transparent 90%);
    border-radius: 8px;
    margin: 0;
    background: color-mix(in srgb, Canvas, currentColor 3%);
    padding: 0.55rem;
    font: 0.72rem/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .ag-heartbeat-record-detail__empty {
    border: 1px dashed color-mix(in srgb, currentColor, transparent 82%);
    border-radius: 8px;
    padding: 0.8rem;
    color: color-mix(in srgb, currentColor, transparent 42%);
    font: 0.76rem/1.35 system-ui, sans-serif;
    text-align: center;
  }

  .ag-heartbeat-record-detail__empty--pulse {
    animation: ag-heartbeat-record-detail-breathe 1.8s ease-in-out infinite;
  }

  @keyframes ag-heartbeat-record-detail-breathe {
    0%,
    100% {
      opacity: 0.68;
    }
    50% {
      opacity: 1;
    }
  }
</style>
