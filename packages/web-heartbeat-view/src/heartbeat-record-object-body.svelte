<script lang="ts">
  import type { HeartbeatRecordObjectBodyModel } from "./heartbeat-record-card-model";
  import HeartbeatRecordChip from "./heartbeat-record-chip.svelte";

  let {
    model,
    kind,
    title,
    detail = false,
    running = false,
  }: {
    model: HeartbeatRecordObjectBodyModel;
    kind: "compact" | "config";
    title: string;
    detail?: boolean;
    running?: boolean;
  } = $props();
</script>

<span
  class="ag-heartbeat-record-object-body"
  class:ag-heartbeat-record-object-body--detail={detail}
  data-object-kind={kind}
  {title}
>
  <HeartbeatRecordChip kind={model.before.kind} label={model.before.label} title={model.before.title} />
  <span class="ag-heartbeat-record-object-body__line" aria-hidden="true"></span>
  <HeartbeatRecordChip kind={model.after.kind} label={model.after.label} title={model.after.title} animated={running} />
</span>

<style>
  .ag-heartbeat-record-object-body {
    display: grid;
    grid-template-columns: max-content minmax(1.2rem, 1fr) max-content;
    align-items: center;
    min-width: 0;
    gap: 0.34rem;
    overflow: hidden;
  }

  .ag-heartbeat-record-object-body--detail {
    margin-block-end: 0.08rem;
  }

  .ag-heartbeat-record-object-body__line {
    block-size: 1px;
    min-inline-size: 1.2rem;
    background: color-mix(in srgb, currentColor, transparent 82%);
  }
</style>
