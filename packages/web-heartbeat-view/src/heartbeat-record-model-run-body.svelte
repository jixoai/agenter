<script lang="ts">
  import { onMount } from "svelte";

  import HeartbeatRecordChip from "./heartbeat-record-chip.svelte";
  import {
    buildHeartbeatRecordChipTone,
    buildHeartbeatRecordTimeline,
    estimateHeartbeatRecordLineWidth,
    resolveHeartbeatRecordPartKind,
    type HeartbeatRecordChip as HeartbeatRecordChipModel,
    type HeartbeatRecordLine,
    type HeartbeatRecordTimelineSegment,
  } from "./heartbeat-record-chips";
  import { formatHeartbeatRecordPayload, type HeartbeatRecordDetailPartRow } from "./heartbeat-record-detail-model";
  import type { HeartbeatRecordPartSummary } from "./types";
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
  const detailRowTemplate = $derived(rows.flatMap(() => ["min-content", "minmax(54px, auto)"]).join(" "));
  const timelineColumns = $derived.by(() =>
    timeline.segments
      .flatMap((segment) => {
        if (!segment.lineBefore) {
          return ["min-content"];
        }
        return [`minmax(${estimateHeartbeatRecordLineWidth(segment.lineBefore, timeline.density)}px, 1fr)`, "min-content"];
      })
      .join(" "),
  );

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

  const lineStyleFromLine = (line: HeartbeatRecordLine): string => {
    const tone = buildHeartbeatRecordChipTone([line.fromKind, line.toKind]);
    return [`--bridge-from:${tone.startBorder}`, `--bridge-to:${tone.endBorder}`].join(";");
  };

  const chipColumn = (index: number): number => index * 2 + 1;
  const lineColumn = (index: number): number => index * 2;
  const bridgeColumn = (index: number): string => (index === 1 ? `${chipColumn(0)} / span 3` : `${lineColumn(index)} / span 2`);

  const railGradientId = (key: string): string => `ag-heartbeat-record-detail-${key.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`;
  const detailBridgeRow = (index: number): string => (index === 0 ? `${index * 2 + 1} / span 3` : `${index * 2 + 2} / span 2`);
  const detailLineRow = (index: number): number => index * 2 + 2;
  const detailChipRow = (index: number): number => index * 2 + 1;
  const detailSectionId = (row: HeartbeatRecordDetailPartRow): string =>
    `heartbeat-record-step-${row.key.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`;
  const detailRowToneStyle = (row: HeartbeatRecordDetailPartRow, next: HeartbeatRecordDetailPartRow): string => {
    // The detail rail is the card metro line rotated vertically: outer time range, inner chip-border continuity.
    const tone = buildHeartbeatRecordChipTone([row.kind, next.kind]);
    return [`--rail-from:${tone.startBorder}`, `--rail-to:${tone.endBorder}`].join(";");
  };
  const detailRowSummary = (row: HeartbeatRecordDetailPartRow): HeartbeatRecordPartSummary => {
    if (row.summary) {
      return row.summary;
    }
    const completedAt = row.part.isComplete ? row.part.updatedAt : null;
    return {
      messageId: row.part.messageId,
      partId: String(row.part.partId),
      role: row.part.role,
      type: row.part.partType,
      mimeType: row.part.mimeType,
      aiCallId: row.part.aiCallId,
      startedAt: row.part.createdAt,
      completedAt,
      label: formatHeartbeatRecordPayload(row.part.payload),
      isComplete: row.part.isComplete,
    };
  };
  const detailRowChip = (row: HeartbeatRecordDetailPartRow): HeartbeatRecordChipModel => {
    const summary = detailRowSummary(row);
    const kind = resolveHeartbeatRecordPartKind(summary);
    return {
      id: `detail:${row.key}`,
      kind,
      label: "",
      title: `${row.message.role} ${row.part.partType}`,
      startedAt: summary.startedAt,
      completedAt: summary.completedAt,
      count: 1,
      parts: [summary],
    };
  };
</script>

{#if variant === "card"}
  <span
    class="ag-heartbeat-record-metro"
    bind:this={metroElement}
    title={timeline.hiddenCount > 0 ? `${timeline.hiddenCount} middle chips are merged` : title}
    data-hidden-count={timeline.hiddenCount}
    data-density={timeline.density}
  >
    <span class="ag-heartbeat-record-metro__grid" style={`grid-template-columns:${timelineColumns}`}>
      {#each timeline.segments as segment, index (segment.chip.id)}
        <span class="ag-heartbeat-record-metro__chip-cell" style={`grid-column:${chipColumn(index)};grid-row:3`}>
          <HeartbeatRecordChip
            chip={segment.chip}
            density={timeline.density}
            animated={record.status === "running" && segment.chip.kind === "pending"}
          />
        </span>
      {#if segment.lineBefore}
        <span
          class="ag-heartbeat-record-metro__bridge-label"
          style={`grid-column:${lineColumn(index)};grid-row:1;${lineStyleFromLine(segment.lineBefore)}`}
          title={segment.lineBefore.title}
        >
          {segment.lineBefore.label}
        </span>
        <span
          class="ag-heartbeat-record-metro__bridge"
          style={`grid-column:${bridgeColumn(index)};grid-row:2;${lineStyleFromLine(segment.lineBefore)}`}
          title={segment.lineBefore.title}
        >
          <svg class="ag-heartbeat-record-metro__bridge-svg" aria-hidden="true" focusable="false">
            <line class="ag-heartbeat-record-metro__bridge-track" x1="0" y1="0.5" x2="100%" y2="0.5"></line>
            <line class="ag-heartbeat-record-metro__bridge-tick" x1="0" y1="0.5" x2="0" y2="2.5"></line>
            <line class="ag-heartbeat-record-metro__bridge-tick ag-heartbeat-record-metro__bridge-tick--end" x1="100%" y1="0.5" x2="100%" y2="2.5"></line>
          </svg>
        </span>
        <span
          class="ag-heartbeat-record-metro__chip-link"
          style={`grid-column:${lineColumn(index)};grid-row:3;${lineStyle(segment)}`}
          title={segment.lineBefore.title}
        >
          <span class="ag-heartbeat-record-metro__chip-link-track" aria-hidden="true"></span>
        </span>
      {/if}
    {/each}
    </span>
  </span>
{:else}
  <div class="ag-heartbeat-record-detail__track" style={`grid-template-rows:${detailRowTemplate}`}>
    {#each rows as row, index (row.key)}
      {@const nextRow = rows[index + 1] ?? row}
      {@const chipRow = detailChipRow(index)}
      {@const linkRow = detailLineRow(index)}
      {@const toneStyle = detailRowToneStyle(row, nextRow)}
      {@const sectionId = detailSectionId(row)}
      <a
        class="ag-heartbeat-record-detail__station-link"
        href={`#${sectionId}`}
        style={`grid-row:${chipRow}`}
        title={`${row.message.role} ${row.part.partType}`}
      >
        <HeartbeatRecordChip
          chip={detailRowChip(row)}
          class="ag-heartbeat-record-detail__step-chip"
          density="full"
          sticky
          animated={!row.part.isComplete}
        />
      </a>

      <article
        id={sectionId}
        class="ag-heartbeat-record-detail__station-body"
        class:ag-heartbeat-record-detail__station-body--pending={!row.part.isComplete}
        style={`grid-row:${chipRow} / span 2`}
      >
        <header class="ag-heartbeat-record-detail__station-head">
          <strong class="ag-heartbeat-record-detail__station-title">{row.part.partType.replaceAll("_", " ")}</strong>
          <span class="ag-heartbeat-record-detail__station-meta">{row.message.role}</span>
        </header>
        <pre class="ag-heartbeat-record-detail__station-copy">{formatHeartbeatRecordPayload(row.part.payload)}</pre>
      </article>

      {#if index < rows.length - 1}
        <span
          class="ag-heartbeat-record-detail__time-label"
          style={`grid-row:${detailBridgeRow(index)};${toneStyle}`}
          title={`Interval ${row.durationLabel}`}
        >
          {row.durationLabel}
        </span>
        <span
          class="ag-heartbeat-record-detail__time-crossline"
          style={`grid-row:${detailBridgeRow(index)};${toneStyle}`}
          title={`Interval ${row.durationLabel}`}
          aria-hidden="true"
        ></span>
        <span class="ag-heartbeat-record-detail__time-bridge" style={`grid-row:${detailBridgeRow(index)};${toneStyle}`}>
          <svg class="ag-heartbeat-record-detail__time-svg" viewBox="0 0 3 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id={railGradientId(row.key)} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100">
                <stop offset="0%" style="stop-color:var(--rail-from);" />
                <stop offset="100%" style="stop-color:var(--rail-to);" />
              </linearGradient>
            </defs>
            <line class="ag-heartbeat-record-detail__time-svg-main" x1="0.5" y1="0" x2="0.5" y2="100" stroke={`url(#${railGradientId(row.key)})`}></line>
            <line class="ag-heartbeat-record-detail__time-svg-tick" x1="0.5" y1="0.5" x2="2.25" y2="0.5"></line>
            <line class="ag-heartbeat-record-detail__time-svg-tick ag-heartbeat-record-detail__time-svg-tick--end" x1="0.5" y1="99.5" x2="2.25" y2="99.5"></line>
          </svg>
        </span>
        <span class="ag-heartbeat-record-detail__chip-link-vertical" style={`grid-row:${linkRow};${toneStyle}`} aria-hidden="true"></span>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .ag-heartbeat-record-metro {
    display: block;
    inline-size: 100%;
    max-inline-size: 100%;
    min-inline-size: 0;
    overflow: hidden;
    padding-block-start: 6px;
  }

  .ag-heartbeat-record-metro__grid {
    display: grid;
    grid-template-rows: 9px 1px auto;
    align-items: center;
    justify-content: start;
    inline-size: 100%;
    max-inline-size: 100%;
    min-inline-size: 0;
    row-gap: 4px;
  }

  .ag-heartbeat-record-metro__chip-cell {
    display: flex;
    align-items: center;
    justify-content: start;
    min-inline-size: 0;
  }

  .ag-heartbeat-record-metro__bridge {
    position: relative;
    display: grid;
    align-self: end;
    min-inline-size: 0;
    padding-inline: 1px;
  }

  .ag-heartbeat-record-metro__bridge::before {
    content: "";
    display: block;
    grid-area: 1 / 1;
    align-self: start;
    inline-size: 100%;
    block-size: 1px;
    background: linear-gradient(
      90deg in oklch,
      var(--bridge-from, currentColor),
      var(--bridge-to, currentColor)
    );
  }

  .ag-heartbeat-record-metro__bridge-svg {
    grid-area: 1 / 1;
    display: block;
    inline-size: 100%;
    block-size: 1px;
    overflow: visible;
  }

  .ag-heartbeat-record-metro__bridge-track {
    stroke: transparent;
    stroke-width: 1px;
    vector-effect: non-scaling-stroke;
    shape-rendering: crispEdges;
  }

  .ag-heartbeat-record-metro__bridge-tick {
    stroke: var(--bridge-from, currentColor);
    stroke-width: 1px;
    vector-effect: non-scaling-stroke;
    shape-rendering: crispEdges;
  }

  .ag-heartbeat-record-metro__bridge-tick--end {
    stroke: var(--bridge-to, currentColor);
  }

  .ag-heartbeat-record-metro__bridge-label {
    display: block;
    align-self: end;
    justify-self: center;
    max-inline-size: 100%;
    overflow: hidden;
    background: linear-gradient(
      90deg in oklch,
      color-mix(in oklch, var(--bridge-from, currentColor), black 8%),
      color-mix(in oklch, var(--bridge-to, currentColor), black 8%)
    );
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    font: 780 8.5px/1 system-ui, sans-serif;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ag-heartbeat-record-metro__chip-link {
    display: grid;
    align-self: center;
    place-items: center;
    min-inline-size: 0;
    block-size: 20px;
    margin-inline: -1px;
  }

  .ag-heartbeat-record-metro__chip-link-track {
    display: block;
    inline-size: 100%;
    block-size: 1px;
    border-radius: 999px;
    background: linear-gradient(
      90deg in oklch,
      var(--bridge-from, currentColor),
      color-mix(in oklch, var(--bridge-from, currentColor), var(--bridge-to, currentColor) 45%),
      var(--bridge-to, currentColor)
    );
  }

  .ag-heartbeat-record-detail__track {
    --rail-gap-col: 6px;
    --chip-axis-x: 14px;
    display: grid;
    grid-template-columns:
      max-content 4px 1px var(--rail-gap-col) minmax(min-content, max-content)
      minmax(0, 1fr);
    column-gap: 0;
    align-items: stretch;
    min-inline-size: 0;
  }

  .ag-heartbeat-record-detail__time-label {
    grid-column: 1;
    align-self: center;
    justify-self: end;
    max-inline-size: 54px;
    overflow: hidden;
    color: color-mix(in oklch, var(--rail-from, currentColor), black 18%);
    font: 800 9px/1 system-ui, sans-serif;
    pointer-events: none;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ag-heartbeat-record-detail__time-crossline {
    grid-column: 2 / 6;
    align-self: center;
    justify-self: start;
    z-index: 0;
    inline-size: calc(5px + var(--rail-gap-col) + var(--chip-axis-x));
    border-block-start: 1px dashed
      color-mix(in oklch, var(--rail-from, currentColor), var(--rail-to, currentColor) 46%);
    opacity: 0.58;
    pointer-events: none;
  }

  .ag-heartbeat-record-detail__time-bridge {
    grid-column: 3;
    position: relative;
    z-index: 0;
    min-block-size: 1px;
    padding-block-end: 1px;
    overflow: visible;
    pointer-events: none;
  }

  .ag-heartbeat-record-detail__time-svg {
    display: block;
    inline-size: 3px;
    block-size: calc(100% - 1px);
    overflow: visible;
  }

  .ag-heartbeat-record-detail__time-svg-main {
    stroke-linecap: butt;
    stroke-width: 1.25px;
    vector-effect: non-scaling-stroke;
    opacity: 0.9;
  }

  .ag-heartbeat-record-detail__time-svg-tick {
    stroke: var(--rail-from, currentColor);
    stroke-linecap: round;
    stroke-width: 1px;
    vector-effect: non-scaling-stroke;
    opacity: 0.88;
  }

  .ag-heartbeat-record-detail__time-svg-tick--end {
    stroke: var(--rail-to, currentColor);
  }

  .ag-heartbeat-record-detail__chip-link-vertical {
    grid-column: 5;
    position: relative;
    z-index: 1;
    min-inline-size: 0;
    min-block-size: 54px;
    margin-block: -1px;
    pointer-events: none;
  }

  .ag-heartbeat-record-detail__chip-link-vertical::before {
    content: "";
    position: absolute;
    inset-block: 0;
    inset-inline-start: var(--chip-axis-x);
    inline-size: 1.25px;
    margin-block: -1px;
    border-radius: 999px;
    background: linear-gradient(
      180deg in oklch,
      var(--rail-from, currentColor),
      color-mix(in oklch, var(--rail-from, currentColor), var(--rail-to, currentColor) 45%),
      var(--rail-to, currentColor)
    );
    transform: translateX(-50%);
  }

  .ag-heartbeat-record-detail__station-link {
    grid-column: 5;
    align-self: start;
    justify-self: start;
    z-index: 2;
    display: inline-flex;
    max-inline-size: 118px;
    color: inherit;
    text-decoration: none;
  }

  .ag-heartbeat-record-detail__station-body {
    grid-column: 6;
    align-self: start;
    display: grid;
    gap: 6px;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow: hidden;
    padding-block: 1px 14px;
    padding-inline-start: 10px;
  }

  .ag-heartbeat-record-detail__station-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-inline-size: 0;
  }

  .ag-heartbeat-record-detail__station-title {
    overflow: hidden;
    color: #172033;
    font: 820 12px/1.15 system-ui, sans-serif;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ag-heartbeat-record-detail__station-meta {
    flex: none;
    color: color-mix(in srgb, currentColor, transparent 42%);
    font: 760 10px/1 system-ui, sans-serif;
    white-space: nowrap;
  }

  .ag-heartbeat-record-detail__station-copy {
    box-sizing: border-box;
    min-inline-size: 0;
    max-inline-size: 100%;
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

  .ag-heartbeat-record-detail__station-body--pending .ag-heartbeat-record-detail__station-title,
  .ag-heartbeat-record-detail__station-body--pending .ag-heartbeat-record-detail__station-meta {
    animation: ag-heartbeat-record-detail-breathe 2.2s ease-in-out infinite;
  }

  @media (max-width: 780px) {
    .ag-heartbeat-record-detail__time-label {
      max-inline-size: 46px;
      font-size: 8.5px;
    }

    .ag-heartbeat-record-detail__station-copy {
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
