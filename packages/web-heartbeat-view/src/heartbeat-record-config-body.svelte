<script lang="ts">
  import { getHeartbeatConfigBodyModel } from "./heartbeat-record-card-model";
  import { formatHeartbeatRecordPayload, indentHeartbeatYaml, readHeartbeatRecordPayloadValue } from "./heartbeat-record-detail-model";
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

  type ConfigTab = "diff" | "new" | "old";

  let configTab = $state<ConfigTab>("diff");

  const bodyModel = $derived(getHeartbeatConfigBodyModel(record));
  const newConfig = $derived(readHeartbeatRecordPayloadValue(payload, ["newConfig", "new", "after", "config", "value"]) ?? payload);
  const oldConfig = $derived(readHeartbeatRecordPayloadValue(payload, ["oldConfig", "old", "before", "previousConfig"]) ?? null);
  const diff = $derived(readHeartbeatRecordPayloadValue(payload, ["diff", "changes"]) ?? null);
  const configSource = $derived.by(() => {
    if (configTab === "new") {
      return formatHeartbeatRecordPayload(newConfig);
    }
    if (configTab === "old") {
      return oldConfig === null ? "" : formatHeartbeatRecordPayload(oldConfig);
    }
    if (diff !== null) {
      return formatHeartbeatRecordPayload(diff);
    }
    return [
      "old:",
      oldConfig === null ? "  null" : indentHeartbeatYaml(formatHeartbeatRecordPayload(oldConfig)),
      "new:",
      indentHeartbeatYaml(formatHeartbeatRecordPayload(newConfig)),
    ].join("\n");
  });
</script>

{#if variant === "card"}
  <HeartbeatRecordObjectBody model={bodyModel} kind="config" {title} running={record.status === "running"} />
{:else}
  <div class="ag-heartbeat-record-kind-body" data-record-body="config">
    <HeartbeatRecordObjectBody model={bodyModel} kind="config" {title} detail running={record.status === "running"} />
    <div class="ag-heartbeat-record-detail__tabs" role="tablist" aria-label="Config detail tabs">
      <button type="button" class:active={configTab === "diff"} onclick={() => (configTab = "diff")}>Diff Config</button>
      <button type="button" class:active={configTab === "new"} onclick={() => (configTab = "new")}>New Config</button>
      <button type="button" class:active={configTab === "old"} onclick={() => (configTab = "old")}>Old Config</button>
    </div>
    {#if configSource}
      <pre class="ag-heartbeat-record-detail__source">{configSource}</pre>
    {:else}
      <div class="ag-heartbeat-record-detail__empty">No config snapshot</div>
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
</style>
