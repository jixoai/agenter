<script lang="ts">
  import { describeRecordStatus } from "./heartbeat-record-chips";
  import { getHeartbeatRecordCardMeta, getHeartbeatRecordKindLabel } from "./heartbeat-record-card-model";
  import HeartbeatRecordCompactBody from "./heartbeat-record-compact-body.svelte";
  import HeartbeatRecordConfigBody from "./heartbeat-record-config-body.svelte";
  import {
    buildHeartbeatRecordDetailRows,
    collectHeartbeatRecordParts,
  } from "./heartbeat-record-detail-model";
  import HeartbeatRecordModelRunBody from "./heartbeat-record-model-run-body.svelte";
  import type { CachedResourceState, HeartbeatRecordDetail, HeartbeatRecordItem, HeartbeatRecordPartSummary } from "./types";

  let {
    record,
    detailState,
  }: {
    record: HeartbeatRecordItem;
    detailState?: CachedResourceState<HeartbeatRecordDetail | null>;
  } = $props();

  const detail = $derived(detailState?.data ?? null);
  const loading = $derived(Boolean(detailState?.loading && !detailState.loaded));
  const error = $derived(detailState?.error ?? null);
  const statusLabel = $derived(describeRecordStatus(record.status));
  const meta = $derived(getHeartbeatRecordCardMeta(record));

  const partSummaryById = $derived.by(() => {
    const entries = record.summary.parts.flatMap((part) => [
      [`${part.messageId}:${part.partId}`, part] as const,
      [`${part.messageId}:${part.type}:${part.startedAt}`, part] as const,
    ]);
    return new Map<string, HeartbeatRecordPartSummary>(entries);
  });

  const partRows = $derived(buildHeartbeatRecordDetailRows(detail?.messages ?? [], partSummaryById));
  const compactPayload = $derived(
    collectHeartbeatRecordParts(detail?.messages ?? [], ["compact", "text"]).find((part) => part.partType === "compact")?.payload ??
      collectHeartbeatRecordParts(detail?.messages ?? [], ["compact", "text"])[0]?.payload ??
      null,
  );
  const configPayload = $derived(collectHeartbeatRecordParts(detail?.messages ?? [], ["config"])[0]?.payload ?? null);
</script>

<aside class="ag-heartbeat-record-detail" data-testid="heartbeat-record-detail" data-kind={record.kind}>
  <header class="ag-heartbeat-record-detail__header">
    <span class="ag-heartbeat-record-detail__title">
      <strong>{getHeartbeatRecordKindLabel(record)} detail</strong>
      <span>#{record.id} · {statusLabel}</span>
    </span>
    {#if detailState?.refreshing}
      <span class="ag-heartbeat-record-detail__refreshing">refreshing</span>
    {/if}
  </header>

  {#if loading}
    <div class="ag-heartbeat-record-detail__empty ag-heartbeat-record-detail__empty--pulse">Loading detail</div>
  {:else if error}
    <div class="ag-heartbeat-record-detail__error">{error}</div>
  {:else if !detail}
    <div class="ag-heartbeat-record-detail__empty">Detail has not been loaded</div>
  {:else if record.kind === "model_call"}
    <HeartbeatRecordModelRunBody {record} rows={partRows} variant="detail" title={meta.title} />
  {:else if record.kind === "compact"}
    <HeartbeatRecordCompactBody {record} payload={compactPayload} variant="detail" title={meta.title} />
  {:else}
    <HeartbeatRecordConfigBody {record} payload={configPayload} variant="detail" title={meta.title} />
  {/if}
</aside>

<style>
  .ag-heartbeat-record-detail {
    display: grid;
    box-sizing: border-box;
    min-width: 0;
    gap: 0.7rem;
    border: 1px solid color-mix(in srgb, currentColor, transparent 86%);
    border-radius: 12px;
    background: color-mix(in srgb, Canvas, currentColor 1.5%);
    padding: 0.75rem;
  }

  .ag-heartbeat-record-detail__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-width: 0;
    gap: 0.75rem;
  }

  .ag-heartbeat-record-detail__title {
    display: grid;
    min-width: 0;
    gap: 0.12rem;
  }

  .ag-heartbeat-record-detail__title strong {
    font: 700 0.86rem/1.2 system-ui, sans-serif;
  }

  .ag-heartbeat-record-detail__title span,
  .ag-heartbeat-record-detail__empty,
  .ag-heartbeat-record-detail__refreshing {
    color: color-mix(in srgb, currentColor, transparent 42%);
    font: 0.76rem/1.35 system-ui, sans-serif;
  }

  .ag-heartbeat-record-detail__error {
    border: 1px solid color-mix(in srgb, red, currentColor 70%);
    border-radius: 8px;
    background: color-mix(in srgb, red, Canvas 92%);
    color: color-mix(in srgb, red, currentColor 20%);
    padding: 0.5rem 0.62rem;
    font: 0.78rem/1.35 system-ui, sans-serif;
  }

  .ag-heartbeat-record-detail__empty {
    border: 1px dashed color-mix(in srgb, currentColor, transparent 82%);
    border-radius: 8px;
    padding: 0.8rem;
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
