<script lang="ts">
  import { onMount } from "svelte";

  import HeartbeatRecordChip from "./heartbeat-record-chip.svelte";
  import {
    buildHeartbeatRecordFullTimeline,
    buildHeartbeatRecordChipTone,
    buildHeartbeatRecordTimeline,
    estimateHeartbeatRecordLineWidth,
    type HeartbeatRecordLine,
    type HeartbeatRecordTimelineSegment,
  } from "./heartbeat-record-chips";
  import type { HeartbeatRecordDetailPartRow } from "./heartbeat-record-detail-model";
  import HeartbeatRecordDetailTrack from "./heartbeat-record-detail-track.svelte";
  import type { HeartbeatSubjectSection } from "./heartbeat-parts";
  import type { HeartbeatRecordItem } from "./types";

  let {
    record,
    rows = [],
    sections = [],
    variant = "card",
    title,
  }: {
    record: HeartbeatRecordItem;
    rows?: HeartbeatRecordDetailPartRow[];
    sections?: HeartbeatSubjectSection[];
    variant?: "card" | "detail";
    title: string;
  } = $props();

  let metroWidth = $state(390);
  let metroElement = $state<HTMLElement | null>(null);
  let nowMs = $state(Date.now());

  const timeline = $derived(buildHeartbeatRecordTimeline(record, metroWidth, nowMs));
  const fullTimeline = $derived(buildHeartbeatRecordFullTimeline(record, nowMs));
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
    const timer = setInterval(() => {
      if (record.status === "running") {
        nowMs = Date.now();
      }
    }, 1_000);
    const stopTimer = (): void => {
      clearInterval(timer);
    };
    if (!element || variant !== "card") {
      return stopTimer;
    };
    const commitWidth = (value: number): void => {
      if (Number.isFinite(value) && value > 0) {
        metroWidth = Math.round(value);
      }
    };
    commitWidth(element.clientWidth);
    if (typeof ResizeObserver !== "function") {
      return stopTimer;
    }
    const observer = new ResizeObserver((entries) => {
      commitWidth(entries[0]?.contentRect.width ?? element.clientWidth);
    });
    observer.observe(element);
    return () => {
      stopTimer();
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
  <HeartbeatRecordDetailTrack {record} timeline={fullTimeline} {rows} {sections} />
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
</style>
