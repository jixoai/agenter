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
    onSelect,
  }: {
    record: HeartbeatRecordItem;
    selected?: boolean;
    onSelect?: (recordId: number) => void;
  } = $props();

  const meta = $derived(getHeartbeatRecordCardMeta(record));
</script>

<HeartbeatRecordBasicCard {record} {selected} {onSelect}>
  {#if record.kind === "model_call"}
    <HeartbeatRecordModelRunBody {record} title={meta.title} />
  {:else if record.kind === "compact"}
    <HeartbeatRecordCompactBody {record} title={meta.title} />
  {:else}
    <HeartbeatRecordConfigBody {record} title={meta.title} />
  {/if}
</HeartbeatRecordBasicCard>
