<script lang="ts">
  import HeartbeatEntry from "./heartbeat-entry.svelte";
  import HeartbeatRecordChip from "./heartbeat-record-chip.svelte";
  import {
    formatHeartbeatRecordPayload,
    type HeartbeatRecordDetailPartRow,
  } from "./heartbeat-record-detail-model";
  import type {
    HeartbeatRecordChip as HeartbeatRecordChipModel,
    HeartbeatRecordTimeline,
  } from "./heartbeat-record-chips";
  import type { HeartbeatSubjectSection, HeartbeatSubjectSectionBlock } from "./heartbeat-parts";
  import type { HeartbeatRecordItem } from "./types";

  type HeartbeatPartSectionBlock = HeartbeatSubjectSectionBlock & {
    content: Extract<HeartbeatSubjectSectionBlock["content"], { kind: "part" }>;
  };

  let {
    record,
    timeline,
    rows = [],
    sections = [],
  }: {
    record: HeartbeatRecordItem;
    timeline: HeartbeatRecordTimeline;
    rows?: HeartbeatRecordDetailPartRow[];
    sections?: HeartbeatSubjectSection[];
  } = $props();

  const detailRowTemplate = $derived(timeline.segments.flatMap(() => ["min-content", "minmax(54px, 1fr)"]).join(" "));

  const chipKindTitle = (kind: HeartbeatRecordChipModel["kind"]): string => {
    if (kind === "input") {
      return "Input";
    }
    if (kind === "text") {
      return "Text";
    }
    if (kind === "thinking") {
      return "Thinking";
    }
    if (kind === "tool") {
      return "Tool";
    }
    if (kind === "pending") {
      return "Pending";
    }
    if (kind === "error") {
      return "Error";
    }
    return kind.replaceAll("_", " ");
  };

  const partMatchesChip = (row: HeartbeatRecordDetailPartRow, chip: HeartbeatRecordChipModel): boolean =>
    chip.parts.some((part) => part.messageId === row.part.messageId && part.partId === String(row.part.partId));

  const rowsForChip = (chip: HeartbeatRecordChipModel): HeartbeatRecordDetailPartRow[] =>
    rows.filter((row) => partMatchesChip(row, chip));

  const rowMatchesPart = (row: HeartbeatRecordDetailPartRow, part: HeartbeatRecordDetailPartRow["part"]): boolean =>
    row.part.messageId === part.messageId && row.part.partId === part.partId;

  const isToolPartRow = (row: HeartbeatRecordDetailPartRow): boolean =>
    row.part.partType === "tool_call" || row.part.partType === "tool_result" || row.part.partType === "tool_call_result";

  const isPartSectionBlock = (block: HeartbeatSubjectSectionBlock): block is HeartbeatPartSectionBlock =>
    block.content.kind === "part";

  const blockMatchesRows = (block: HeartbeatSubjectSectionBlock, detailRows: readonly HeartbeatRecordDetailPartRow[]): boolean => {
    if (isPartSectionBlock(block)) {
      return detailRows.some((row) => rowMatchesPart(row, block.content.part));
    }
    return detailRows.some((row) => isToolPartRow(row) && block.sourceEntryIds.includes(row.message.id));
  };

  const sectionsForRows = (detailRows: readonly HeartbeatRecordDetailPartRow[]): HeartbeatSubjectSection[] =>
    sections.flatMap((section) => {
      const blocks = section.blocks.filter((block) => blockMatchesRows(block, detailRows));
      if (blocks.length === 0) {
        return [];
      }
      const sourceEntryIds = new Set(blocks.flatMap((block) => block.sourceEntryIds));
      const entries = section.entries.filter((entry) => sourceEntryIds.has(entry.id));
      return [
        {
          ...section,
          key: `${section.key}:${blocks.map((block) => block.key).join("|")}`,
          entries: entries.length > 0 ? entries : section.entries,
          blocks,
        },
      ];
    });

  const sectionGroupLabel = (section: HeartbeatSubjectSection): string =>
    section.name && section.name.length > 0 ? `${section.role} · ${section.name}` : section.role;

  const kindRailTone = (kind: HeartbeatRecordChipModel["kind"]): string =>
    `color-mix(in oklch, var(--kind-${kind}, var(--tone-accent, #2563eb)), white 62%)`;

  const railStyle = (from: HeartbeatRecordChipModel, to: HeartbeatRecordChipModel): string =>
    `--rail-from:${kindRailTone(from.kind)};--rail-to:${kindRailTone(to.kind)}`;

  const stationBodyId = (chip: HeartbeatRecordChipModel, index: number): string =>
    `record-station-${record.id}-${chip.kind}-${index}`;
</script>

<div
  class="ag-heartbeat-record-detail-track detail-track"
  style={`grid-template-rows:${detailRowTemplate}`}
  data-testid="heartbeat-record-detail-track"
>
  {#each timeline.segments as segment, index (`${segment.chip.id}:${index}`)}
    {@const nextSegment = timeline.segments[index + 1] ?? null}
    {@const nextChip = nextSegment?.chip ?? segment.chip}
    {@const detailRows = rowsForChip(segment.chip)}
    {@const chipRow = index * 2 + 1}
    {@const linkRow = chipRow + 1}
    {@const bridgeRow = index === 0 ? `${chipRow} / span 3` : `${linkRow} / span 2`}
    {@const style = railStyle(segment.chip, nextChip)}
    {@const bridgeLine = nextSegment?.lineBefore ?? null}
    {@const detailSections = sectionsForRows(detailRows)}
    <a
      class="ag-heartbeat-record-detail-track__station-link station-link"
      href={`#${stationBodyId(segment.chip, index)}`}
      title={segment.chip.title}
      style={`grid-row:${chipRow};${style}`}
    >
      <HeartbeatRecordChip
        class="ag-heartbeat-record-detail__step-chip ag-heartbeat-record-detail-track__chip detail-track__chip"
        chip={segment.chip}
        sticky
        animated={(record.status === "running" && segment.chip.kind === "pending") || detailRows.some((row) => !row.part.isComplete)}
      />
    </a>

    <article
      class="ag-heartbeat-record-detail-track__station-body station-body"
      id={stationBodyId(segment.chip, index)}
      style={`grid-row:${chipRow} / span 2`}
    >
      <div class="ag-heartbeat-record-detail-track__station-head station-body-head">
        <strong class="station-body-title">{chipKindTitle(segment.chip.kind)}</strong>
        {#if segment.chip.label}
          <span class="station-body-meta">{segment.chip.label}</span>
        {/if}
      </div>
      <div class="station-body-copy">
        {#if detailSections.length > 0}
          <div class="station-heartbeat-entries">
            {#each detailSections as section (section.key)}
              <HeartbeatEntry
                {section}
                layoutMode="detailed"
                groupLabel={sectionGroupLabel(section)}
                groupTimestamp={record.startedAt}
              />
            {/each}
          </div>
        {:else if detailRows.length > 0}
          <div class="station-payloads">
            {#each detailRows as row (row.key)}
              <section class="station-payload" data-part-kind={row.kind}>
                <header>
                  <span>{row.message.role} · {row.part.partType.replaceAll("_", " ")}</span>
                  {#if row.durationLabel}
                    <span>{row.durationLabel}</span>
                  {/if}
                </header>
                <pre>{formatHeartbeatRecordPayload(row.part.payload)}</pre>
              </section>
            {/each}
          </div>
        {:else}
          <span class="station-empty" aria-label={segment.chip.title}></span>
        {/if}
      </div>
    </article>

    {#if bridgeLine}
      <span
        class="ag-heartbeat-record-detail__time-label ag-heartbeat-record-detail-track__time-label time-bridge-label"
        style={`grid-row:${bridgeRow};${style}`}
        title={bridgeLine.title}
      >
        {bridgeLine.label}
      </span>
      <span
        class="ag-heartbeat-record-detail__time-bridge ag-heartbeat-record-detail__time-crossline ag-heartbeat-record-detail-track__time-bridge time-bridge"
        style={`grid-row:${bridgeRow};${style}`}
        aria-hidden="true"
      >
        <svg class="time-svg" viewBox="0 0 3 100" preserveAspectRatio="none" focusable="false">
          <defs>
            <linearGradient id={`ag-heartbeat-time-gradient-${record.id}-${index}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100">
              <stop offset="0%" style="stop-color:var(--rail-from)"></stop>
              <stop offset="100%" style="stop-color:var(--rail-to)"></stop>
            </linearGradient>
          </defs>
          <line
            class="ag-heartbeat-record-detail__time-svg-main time-svg-main"
            x1="0.5"
            y1="0"
            x2="0.5"
            y2="100"
            style={`stroke:url(#ag-heartbeat-time-gradient-${record.id}-${index})`}
          ></line>
          <line class="time-svg-tick" x1="0.5" y1="0.5" x2="2.25" y2="0.5" style="stroke:var(--rail-from)"></line>
          <line class="time-svg-tick" x1="0.5" y1="99.5" x2="2.25" y2="99.5" style="stroke:var(--rail-to)"></line>
        </svg>
      </span>
      <span
        class="ag-heartbeat-record-detail__chip-link-vertical ag-heartbeat-record-detail-track__chip-link chip-link-vertical"
        style={`grid-row:${linkRow};${style}`}
        aria-hidden="true"
      ></span>
    {/if}
  {/each}
</div>

<style>
  .detail-track {
    --tone-accent: #2563eb;
    --kind-input: oklch(58% 0.16 230deg);
    --kind-combo: oklch(58% 0.05 250deg);
    --kind-compact: oklch(58% 0.04 250deg);
    --kind-thinking: oklch(58% 0.14 185deg);
    --kind-text: oklch(58% 0.17 260deg);
    --kind-tool: oklch(58% 0.16 55deg);
    --kind-pending: oklch(58% 0.15 85deg);
    --kind-refusal: oklch(58% 0.18 345deg);
    --kind-error: oklch(58% 0.18 25deg);
    --kind-image: oklch(58% 0.15 150deg);
    --kind-file: oklch(58% 0.04 250deg);
    --kind-video: oklch(58% 0.18 285deg);
    --kind-unknown: oklch(58% 0.04 250deg);
    --rail-gap-col: 6px;
    --chip-axis-x: 14px;
    display: grid;
    grid-template-columns:
      max-content 4px 1px var(--rail-gap-col) minmax(min-content, max-content)
      minmax(0, 1fr);
    align-items: stretch;
    min-width: 0;
    column-gap: 0;
  }

  .time-bridge {
    --rail-from: var(--tone-accent);
    --rail-to: var(--tone-accent);
    --bridge-gap: 1px;
    grid-column: 3;
    position: relative;
    z-index: 0;
    min-block-size: 1px;
    padding-block-end: var(--bridge-gap);
    overflow: visible;
    pointer-events: none;
  }

  .time-bridge-label {
    --rail-from: var(--tone-accent);
    z-index: 1;
    grid-column: 1;
    align-self: center;
    justify-self: end;
    max-inline-size: 54px;
    overflow: hidden;
    color: color-mix(in oklch, var(--rail-from), black 18%);
    font-size: 9px;
    font-weight: 800;
    line-height: 1;
    pointer-events: none;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .time-svg {
    display: block;
    inline-size: 3px;
    block-size: calc(100% - var(--bridge-gap));
    overflow: visible;
  }

  .time-svg-main {
    opacity: 0.9;
    stroke-linecap: butt;
    stroke-width: 1.25px;
    vector-effect: non-scaling-stroke;
  }

  .time-svg-tick {
    opacity: 0.88;
    stroke-linecap: round;
    stroke-width: 1px;
    vector-effect: non-scaling-stroke;
  }

  .chip-link-vertical {
    --rail-from: var(--tone-accent);
    --rail-to: var(--tone-accent);
    grid-column: 5;
    position: relative;
    z-index: 1;
    min-width: 0;
    min-block-size: 54px;
    margin-block: -1px;
    pointer-events: none;
  }

  .chip-link-vertical::before {
    content: "";
    position: absolute;
    inset-block: 0;
    inset-inline-start: var(--chip-axis-x);
    inline-size: 1.25px;
    margin-block: -1px;
    border-radius: 999px;
    background: linear-gradient(
      180deg in oklch,
      var(--rail-from),
      color-mix(in oklch, var(--rail-from), var(--rail-to) 45%),
      var(--rail-to)
    );
    transform: translateX(-50%);
  }

  .station-link {
    z-index: 2;
    grid-column: 5;
    align-self: start;
    justify-self: start;
    display: inline-flex;
    max-inline-size: 118px;
    color: inherit;
    text-decoration: none;
  }

  .station-link :global(.ag-heartbeat-record-chip) {
    max-inline-size: 118px;
  }

  .station-body {
    grid-column: 6;
    align-self: start;
    min-width: 0;
    padding-block: 1px 14px;
    padding-inline-start: 10px;
  }

  .station-body-head {
    display: flex;
    align-items: baseline;
    min-width: 0;
    gap: 8px;
    margin-block-end: 4px;
  }

  .station-body-title {
    overflow: hidden;
    color: #172033;
    font-size: 12px;
    font-weight: 820;
    line-height: 1.15;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .station-body-meta {
    flex: none;
    color: color-mix(in srgb, currentColor, transparent 48%);
    font-size: 10px;
    font-weight: 760;
    line-height: 1;
    white-space: nowrap;
  }

  .station-body-copy {
    color: #334155;
    font-size: 11.5px;
    line-height: 1.48;
  }

  .station-body-copy > :first-child {
    margin-block-start: 0;
  }

  .station-body-copy > :last-child {
    margin-block-end: 0;
  }

  .station-heartbeat-entries {
    display: grid;
    min-width: 0;
    gap: 8px;
  }

  .station-payloads {
    display: grid;
    min-width: 0;
    gap: 8px;
  }

  .station-payload {
    display: grid;
    min-width: 0;
    gap: 4px;
  }

  .station-payload header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-width: 0;
    gap: 8px;
    color: color-mix(in srgb, currentColor, transparent 42%);
    font-size: 10px;
    font-weight: 760;
    line-height: 1;
  }

  .station-payload header span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .station-payload header span:last-child {
    flex: none;
  }

  .station-payload pre {
    box-sizing: border-box;
    min-width: 0;
    max-inline-size: 100%;
    overflow: auto;
    border: 1px solid rgba(15, 23, 42, 0.08);
    border-radius: 12px;
    margin: 0;
    background: #f7f9fc;
    padding: 10px;
    color: #273449;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11.5px;
    line-height: 1.55;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .station-empty {
    display: block;
    min-block-size: 0.3rem;
  }

  @media (max-width: 780px) {
    .detail-track {
      grid-template-columns:
        max-content 4px 1px var(--rail-gap-col) minmax(min-content, max-content)
        minmax(0, 1fr);
    }

    .time-bridge-label {
      max-inline-size: 46px;
      font-size: 8.5px;
    }

    .station-payload pre {
      font-size: 10.8px;
    }
  }
</style>
