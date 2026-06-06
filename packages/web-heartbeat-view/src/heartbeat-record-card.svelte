<script lang="ts">
  import HeartbeatRecordBasicCard from "./heartbeat-record-basic-card.svelte";
  import { getHeartbeatRecordCardMeta } from "./heartbeat-record-card-model";
  import HeartbeatRecordCompactBody from "./heartbeat-record-compact-body.svelte";
  import HeartbeatRecordConfigBody from "./heartbeat-record-config-body.svelte";
  import HeartbeatRecordModelRunBody from "./heartbeat-record-model-run-body.svelte";
  import type { HeartbeatRecordItem } from "./types";

  let {
    record,
    selected = false,
    selectRecord,
  }: {
    record: HeartbeatRecordItem;
    selected?: boolean;
    selectRecord?: (recordId: number) => void;
  } = $props();

  const meta = $derived(getHeartbeatRecordCardMeta(record));
</script>

<button
  type="button"
  class="ag-heartbeat-record-card"
  class:ag-heartbeat-record-card--selected={selected}
  data-kind={record.kind}
  data-status={record.status}
  aria-pressed={selected}
  onclick={() => selectRecord?.(record.id)}
  title={meta.title}
>
  <HeartbeatRecordBasicCard {record} {selected}>
    {#if record.kind === "model_call"}
      <HeartbeatRecordModelRunBody {record} title={meta.title} />
    {:else if record.kind === "compact"}
      <HeartbeatRecordCompactBody {record} title={meta.title} />
    {:else}
      <HeartbeatRecordConfigBody {record} title={meta.title} />
    {/if}
  </HeartbeatRecordBasicCard>
</button>

<style>
  .ag-heartbeat-record-card {
    display: block;
    box-sizing: border-box;
    inline-size: 100%;
    max-inline-size: 100%;
    min-inline-size: 0;
    padding: 0;
    border: 0;
    background: none;
    text-align: left;
    cursor: pointer;
    border-radius: 18px;
  }

  .ag-heartbeat-record-card:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--tone-accent, #2563eb), transparent 86%);
  }

  .ag-heartbeat-record-card--selected {
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--tone-accent, #2563eb), transparent 86%);
  }
</style>
