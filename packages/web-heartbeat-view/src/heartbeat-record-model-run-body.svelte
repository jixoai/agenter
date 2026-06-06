<script lang="ts">
  import { onMount } from "svelte";

  import HeartbeatRecordChip from "./heartbeat-record-chip.svelte";
  import {
    buildHeartbeatRecordChipTone,
    buildHeartbeatRecordTimeline,
    type HeartbeatRecordTimelineSegment,
  } from "./heartbeat-record-chips";
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

  const lineStyle = (segment: HeartbeatRecordTimelineSegment): string => {
    if (!segment.lineBefore) {
      return "";
    }
    const tone = buildHeartbeatRecordChipTone([segment.lineBefore.fromKind, segment.lineBefore.toKind]);
    return [
      `--bridge-from:${tone.startBorder}`,
      `--bridge-to:${tone.endBorder}`,
    ].join(";");
  };

  const railStyle = (kind: HeartbeatRecordTimelineSegment["chip"]["kind"]): string => {
    const tone = buildHeartbeatRecordChipTone([kind]);
    return [
      `--rail-from:${tone.startBorder}`,
      `--rail-to:${tone.endBorder}`,
    ].join(";");
  };

  const railGradientId = (key: string): string => `ag-heartbeat-record-detail-${key.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`;
</script>

{#if variant === "card"}
  <span
    class="ag-heartbeat-record-metro"
    bind:this={metroElement}
    title={timeline.hiddenCount > 0 ? `${timeline.hiddenCount} middle chips are merged` : title}
    data-hidden-count={timeline.hiddenCount}
    data-density={timeline.density}
  >
    {#each timeline.segments as segment (segment.chip.id)}
      {#if segment.lineBefore}
        <span class="ag-heartbeat-record-metro__line" title={segment.lineBefore.title} style={lineStyle(segment)}>
          <span>{segment.lineBefore.label}</span>
        </span>
      {/if}
      <HeartbeatRecordChip
        chip={segment.chip}
        density={timeline.density}
        animated={record.status === "running" && segment.chip.kind === "pending"}
      />
    {/each}
  </span>
{:else}
  <div class="ag-heartbeat-record-detail__steps">
    {#each rows as row, index (row.key)}
      <section
        class="ag-heartbeat-record-detail__step"
        class:ag-heartbeat-record-detail__step--pending={!row.part.isComplete}
      >
        <div class="ag-heartbeat-record-detail__step-rail" style={railStyle(row.kind)}>
          <span class="ag-heartbeat-record-detail__step-time" title={`Interval ${row.durationLabel}`}>{row.durationLabel}</span>
          <svg class="ag-heartbeat-record-detail__step-svg" viewBox="0 0 3 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id={railGradientId(row.key)} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100">
                <stop offset="0%" style="stop-color:var(--rail-from);" />
                <stop offset="100%" style="stop-color:var(--rail-to);" />
              </linearGradient>
            </defs>
            <line class="ag-heartbeat-record-detail__step-svg-main" x1="1.5" y1="0" x2="1.5" y2="100" stroke={`url(#${railGradientId(row.key)})`}></line>
            <line class="ag-heartbeat-record-detail__step-svg-tick" x1="1.5" y1="0.5" x2="2.6" y2="0.5"></line>
            <line class="ag-heartbeat-record-detail__step-svg-tick" x1="1.5" y1="99.5" x2="2.6" y2="99.5"></line>
          </svg>
          <HeartbeatRecordChip
            class="ag-heartbeat-record-detail__step-chip"
            kind={row.kind}
            label={row.durationLabel}
            title={`${row.message.role} ${row.part.partType}`}
            sticky
            animated={!row.part.isComplete}
          />
        </div>

        <article class="ag-heartbeat-record-detail__step-body">
          <header class="ag-heartbeat-record-detail__step-body-head">
            <strong class="ag-heartbeat-record-detail__step-body-title">{row.part.partType.replaceAll("_", " ")}</strong>
            <span class="ag-heartbeat-record-detail__step-body-meta">{row.message.role}</span>
          </header>
          <pre class="ag-heartbeat-record-detail__step-body-copy">{formatHeartbeatRecordPayload(row.part.payload)}</pre>
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
    justify-content: start;
    inline-size: 100%;
    max-inline-size: 100%;
    min-inline-size: 0;
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
    background: linear-gradient(
      90deg in oklch,
      var(--bridge-from, currentColor),
      color-mix(in oklch, var(--bridge-from, currentColor), var(--bridge-to, currentColor) 45%),
      var(--bridge-to, currentColor)
    );
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
    gap: 12px;
    min-inline-size: 0;
  }

  .ag-heartbeat-record-detail__step {
    display: grid;
    grid-template-columns: 238px minmax(0, 1fr);
    gap: 16px;
    align-items: start;
    min-inline-size: 0;
  }

  .ag-heartbeat-record-detail__step-rail {
    display: grid;
    grid-template-columns: max-content 4px 1px 6px minmax(0, max-content);
    align-items: start;
    min-inline-size: 0;
    row-gap: 0;
  }

  .ag-heartbeat-record-detail__step-time {
    grid-column: 1;
    align-self: center;
    justify-self: end;
    max-inline-size: 54px;
    color: color-mix(in srgb, currentColor, transparent 28%);
    font: 800 9px/1 system-ui, sans-serif;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ag-heartbeat-record-detail__step-svg {
    grid-column: 3;
    display: block;
    inline-size: 3px;
    block-size: 100%;
    min-block-size: 56px;
    overflow: visible;
  }

  .ag-heartbeat-record-detail__step-svg-main {
    stroke-linecap: butt;
    stroke-width: 1.25px;
    vector-effect: non-scaling-stroke;
    opacity: 0.9;
  }

  .ag-heartbeat-record-detail__step-svg-tick {
    stroke-linecap: round;
    stroke-width: 1px;
    vector-effect: non-scaling-stroke;
    stroke: var(--rail-from, currentColor);
    opacity: 0.88;
  }

  .ag-heartbeat-record-detail__step-body {
    display: grid;
    gap: 6px;
    min-inline-size: 0;
    padding-block: 1px 14px;
    padding-inline-start: 4px;
  }

  .ag-heartbeat-record-detail__step-body-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-inline-size: 0;
  }

  .ag-heartbeat-record-detail__step-body-title {
    overflow: hidden;
    color: #172033;
    font: 820 12px/1.15 system-ui, sans-serif;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ag-heartbeat-record-detail__step-body-meta {
    flex: none;
    color: color-mix(in srgb, currentColor, transparent 42%);
    font: 760 10px/1 system-ui, sans-serif;
    white-space: nowrap;
  }

  .ag-heartbeat-record-detail__step-body-copy {
    overflow: auto;
    border: 1px solid color-mix(in srgb, currentColor, transparent 90%);
    border-radius: 12px;
    margin: 0;
    background: color-mix(in srgb, Canvas, currentColor 3%);
    padding: 10px;
    color: #273449;
    font: 11.5px/1.58 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .ag-heartbeat-record-detail__step--pending .ag-heartbeat-record-detail__step-time {
    animation: ag-heartbeat-record-detail-breathe 2.2s ease-in-out infinite;
  }

  @media (max-width: 780px) {
    .ag-heartbeat-record-detail__step {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .ag-heartbeat-record-detail__step-rail {
      grid-template-columns: max-content 4px 1px 6px minmax(0, max-content);
    }

    .ag-heartbeat-record-detail__step-time {
      max-inline-size: 46px;
      font-size: 8.5px;
    }

    .ag-heartbeat-record-detail__step-body-copy {
      font-size: 11.5px;
    }
  }

  @keyframes ag-heartbeat-record-detail-breathe {
    0%,
    100% {
      opacity: 0.72;
      transform: translateY(0);
    }
    50% {
      opacity: 1;
      transform: translateY(-1px);
    }
  }
</style>
