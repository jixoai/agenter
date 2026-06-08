<script lang="ts">
  import HeartbeatRecordIcon from "./heartbeat-record-icon.svelte";
  import { describeRecordStatus } from "./heartbeat-record-chips";
  import { getHeartbeatRecordCardMeta, getHeartbeatRecordKindLabel } from "./heartbeat-record-card-model";
  import HeartbeatRecordCompactBody from "./heartbeat-record-compact-body.svelte";
  import HeartbeatRecordConfigBody from "./heartbeat-record-config-body.svelte";
  import { buildHeartbeatRecordDetailRows, collectHeartbeatRecordParts } from "./heartbeat-record-detail-model";
  import HeartbeatRecordModelRunBody from "./heartbeat-record-model-run-body.svelte";
  import { buildHeartbeatSubjectSections } from "./heartbeat-parts";
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
  const summaryLabel = $derived(meta.modelLabel ?? meta.metaLabel);

  const partSummaryById = $derived.by(() => {
    const entries = record.summary.parts.flatMap((part) => [
      [`${part.messageId}:${part.partId}`, part] as const,
      [`${part.messageId}:${part.type}:${part.startedAt}`, part] as const,
    ]);
    return new Map<string, HeartbeatRecordPartSummary>(entries);
  });

  const partRows = $derived(buildHeartbeatRecordDetailRows(detail?.messages ?? [], partSummaryById));
  const detailSections = $derived.by(() => {
    if (!detail) {
      return [];
    }
    return buildHeartbeatSubjectSections({
      id: record.id,
      groupId: record.recordKey,
      kind: record.kind === "compact" ? "compact" : "call",
      aiCallId: record.primaryAiCallId,
      createdAt: record.startedAt,
      updatedAt: record.updatedAt,
      isComplete: record.isComplete,
      items: detail.messages,
    });
  });
  const compactPayload = $derived(
    collectHeartbeatRecordParts(detail?.messages ?? [], ["compact", "text"]).find((part) => part.partType === "compact")?.payload ??
      collectHeartbeatRecordParts(detail?.messages ?? [], ["compact", "text"])[0]?.payload ??
      null,
  );
  const configPayload = $derived(collectHeartbeatRecordParts(detail?.messages ?? [], ["config"])[0]?.payload ?? null);
</script>

<section class="ag-heartbeat-record-detail" data-testid="heartbeat-record-detail" data-kind={record.kind}>
  <header class="ag-heartbeat-record-detail__head">
    <div class="ag-heartbeat-record-detail__title">
      <strong>{getHeartbeatRecordKindLabel(record)} detail</strong>
      <span>#{record.id} · {statusLabel}</span>
      {#if summaryLabel}
        <p class="ag-heartbeat-record-detail__summary" title={summaryLabel}>{summaryLabel}</p>
      {/if}
    </div>

    <div class="ag-heartbeat-record-detail__status">
      {#if meta.durationLabel}
        <span class="ag-heartbeat-record-detail__pill" title={`Duration ${meta.durationLabel}`}>
          {meta.durationLabel}
        </span>
      {/if}
      {#if detailState?.refreshing}
        <span class="ag-heartbeat-record-detail__pill ag-heartbeat-record-detail__pill--refreshing">
          <HeartbeatRecordIcon kind="pending" size={13} />
          refreshing
        </span>
      {/if}
    </div>
  </header>

  <div class="ag-heartbeat-record-detail__body">
    {#if loading}
      <div class="ag-heartbeat-record-detail__empty ag-heartbeat-record-detail__empty--pulse">Loading detail</div>
    {:else if error}
      <div class="ag-heartbeat-record-detail__error">{error}</div>
    {:else if !detail}
      <div class="ag-heartbeat-record-detail__empty">Detail has not been loaded</div>
    {:else if record.kind === "model_call"}
      <HeartbeatRecordModelRunBody {record} rows={partRows} sections={detailSections} variant="detail" title={meta.title} />
    {:else if record.kind === "compact"}
      <HeartbeatRecordCompactBody {record} payload={compactPayload} variant="detail" title={meta.title} />
    {:else}
      <HeartbeatRecordConfigBody {record} payload={configPayload} variant="detail" title={meta.title} />
    {/if}
  </div>
</section>

<style>
  .ag-heartbeat-record-detail {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-width: 0;
    min-height: 100%;
    border: 1px solid color-mix(in srgb, currentColor, transparent 88%);
    border-radius: 16px;
    background: #fff;
    overflow: hidden;
    box-sizing: border-box;
  }

  .ag-heartbeat-record-detail__head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: start;
    border-bottom: 1px solid color-mix(in srgb, currentColor, transparent 90%);
    background: #f8fafc;
    padding: 14px;
  }

  .ag-heartbeat-record-detail__title {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .ag-heartbeat-record-detail__title strong {
    overflow: hidden;
    color: #111827;
    font: 700 14px/1.18 system-ui, sans-serif;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ag-heartbeat-record-detail__title span,
  .ag-heartbeat-record-detail__summary,
  .ag-heartbeat-record-detail__empty,
  .ag-heartbeat-record-detail__error {
    color: color-mix(in srgb, currentColor, transparent 42%);
    font: 0.76rem/1.45 system-ui, sans-serif;
  }

  .ag-heartbeat-record-detail__summary {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ag-heartbeat-record-detail__status {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }

  .ag-heartbeat-record-detail__pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 28px;
    border: 1px solid color-mix(in srgb, currentColor, transparent 86%);
    border-radius: 999px;
    background: #fbfcfe;
    padding: 0 10px;
    color: color-mix(in srgb, currentColor, transparent 28%);
    font: 600 11px/1.1 system-ui, sans-serif;
    white-space: nowrap;
  }

  .ag-heartbeat-record-detail__pill--refreshing {
    border-color: color-mix(in oklab, var(--tone-accent, #2563eb), white 52%);
    background: color-mix(in oklab, var(--tone-accent, #2563eb), white 94%);
    color: color-mix(in oklab, var(--tone-accent, #2563eb), black 10%);
  }

  .ag-heartbeat-record-detail__body {
    display: grid;
    min-width: 0;
    overflow: auto;
    padding: 14px;
  }

  .ag-heartbeat-record-detail__body > :global(*) {
    min-width: 0;
  }

  .ag-heartbeat-record-detail__body :global(.ag-heartbeat-record-detail-tabs) {
    --f7-subnavbar-height: 40px;
    position: relative;
    inset: auto;
    box-sizing: border-box;
    min-width: 0;
    border: 1px solid color-mix(in srgb, currentColor, transparent 90%);
    border-radius: 12px;
    background: color-mix(in srgb, Canvas, currentColor 2%);
    overflow: hidden;
  }

  .ag-heartbeat-record-detail__body :global(.ag-heartbeat-record-detail-tabs .subnavbar-inner) {
    box-sizing: border-box;
    min-width: 0;
    padding: 6px;
  }

  .ag-heartbeat-record-detail__body :global(.ag-heartbeat-record-detail-tabs .segmented) {
    width: 100%;
    min-width: 0;
  }

  .ag-heartbeat-record-detail__error {
    border: 1px solid color-mix(in srgb, red, currentColor 70%);
    border-radius: 8px;
    background: color-mix(in srgb, red, Canvas 92%);
    color: color-mix(in srgb, red, currentColor 20%);
    padding: 0.5rem 0.62rem;
  }

  .ag-heartbeat-record-detail__empty {
    display: grid;
    place-items: center;
    min-height: 86px;
    border: 1px dashed color-mix(in srgb, currentColor, transparent 82%);
    border-radius: 8px;
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
