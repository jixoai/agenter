<script lang="ts">
  import { onMount } from "svelte";

  import { buildHeartbeatRecordTimeline, type HeartbeatRecordTimelineSegment } from "./heartbeat-record-chips";
  import HeartbeatRecordChip from "./heartbeat-record-chip.svelte";
  import { formatHeartbeatRecordPayload, type HeartbeatRecordDetailPartRow } from "./heartbeat-record-detail-model";
  import type { HeartbeatRecordItem } from "./types";

  let {
    record,
    rows = [],
    variant = "card",
    title,
  }: {
    record: HeartbeatRecordItem;
    rows?: HeartbeatRecordDetailPartRow[];
    variant?: "card" | "detail";
    title: string;
  } = $props();

  let metroWidth = $state(390);
  let metroElement = $state<HTMLElement | null>(null);

  const timeline = $derived(buildHeartbeatRecordTimeline(record, metroWidth));

  onMount(() => {
    const element = metroElement;
    if (!element || variant !== "card") {
      return;
    }
    const commitWidth = (value: number): void => {
      if (Number.isFinite(value) && value > 0) {
        metroWidth = Math.round(value);
      }
    };
    commitWidth(element.clientWidth);
    if (typeof ResizeObserver !== "function") {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      commitWidth(entries[0]?.contentRect.width ?? element.clientWidth);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  });

  const lineClass = (segment: HeartbeatRecordTimelineSegment): string =>
    segment.lineBefore ? "ag-heartbeat-record-metro__line" : "";
</script>

{#if variant === "card"}
  <span
    class="ag-heartbeat-record-metro"
    bind:this={metroElement}
    title={timeline.hiddenCount > 0 ? `${timeline.hiddenCount} middle chips are merged` : title}
    data-hidden-count={timeline.hiddenCount}
  >
    {#each timeline.segments as segment (segment.chip.id)}
      {#if segment.lineBefore}
        <span class={lineClass(segment)} title={segment.lineBefore.title}>
          <span>{segment.lineBefore.label}</span>
        </span>
      {/if}
      <HeartbeatRecordChip chip={segment.chip} animated={record.status === "running" && segment.chip.kind === "pending"} />
    {/each}
  </span>
{:else}
  <div class="ag-heartbeat-record-detail__steps">
    {#each rows as row (row.key)}
      <section class="ag-heartbeat-record-detail__step" class:ag-heartbeat-record-detail__step--pending={!row.part.isComplete}>
        <HeartbeatRecordChip
          class="ag-heartbeat-record-detail__step-chip"
          kind={row.kind}
          label={row.durationLabel}
          title={`${row.message.role} ${row.part.partType}`}
          sticky
          animated={!row.part.isComplete}
        />
        <article class="ag-heartbeat-record-detail__step-body">
          <header>
            <strong>{row.part.partType.replaceAll("_", " ")}</strong>
            <span>{row.message.role}</span>
          </header>
          <pre>{formatHeartbeatRecordPayload(row.part.payload)}</pre>
        </article>
      </section>
    {/each}
  </div>
{/if}

<style>
  .ag-heartbeat-record-metro {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: max-content;
    align-items: center;
    justify-content: stretch;
    inline-size: 100%;
    max-inline-size: 100%;
    min-width: 0;
    gap: 0.24rem;
    overflow: hidden;
  }

  .ag-heartbeat-record-metro__line {
    position: relative;
    display: grid;
    align-items: center;
    min-inline-size: 1.1rem;
    max-inline-size: 4.6rem;
    inline-size: clamp(1.1rem, 8vw, 4.6rem);
    overflow: hidden;
    color: color-mix(in srgb, currentColor, transparent 48%);
    font: 0.62rem/1 system-ui, sans-serif;
    text-align: center;
  }

  .ag-heartbeat-record-metro__line::before {
    content: "";
    position: absolute;
    inset-inline: 0;
    inset-block-start: 50%;
    block-size: 1px;
    background: color-mix(in srgb, currentColor, transparent 82%);
  }

  .ag-heartbeat-record-metro__line span {
    position: relative;
    justify-self: center;
    max-inline-size: 100%;
    overflow: hidden;
    background: Canvas;
    padding-inline: 0.16rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ag-heartbeat-record-detail__steps {
    display: grid;
    min-width: 0;
    gap: 0.6rem;
  }

  .ag-heartbeat-record-detail__step {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    align-items: start;
    min-width: 0;
    gap: 0.58rem;
  }

  .ag-heartbeat-record-detail__step-body {
    display: grid;
    min-width: 0;
    gap: 0.34rem;
  }

  .ag-heartbeat-record-detail__step-body header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    min-width: 0;
    gap: 0.6rem;
    color: color-mix(in srgb, currentColor, transparent 32%);
    font: 0.74rem/1.2 system-ui, sans-serif;
  }

  .ag-heartbeat-record-detail__step-body strong {
    overflow: hidden;
    color: currentColor;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ag-heartbeat-record-detail__step-body pre {
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

  @media (max-width: 420px) {
    .ag-heartbeat-record-metro__line span {
      max-inline-size: 3.8rem;
    }
  }
</style>
