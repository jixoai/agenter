<script lang="ts">
  import HeartbeatRecordIcon from "./heartbeat-record-icon.svelte";
  import type { HeartbeatRecordChip, HeartbeatRecordChipKind } from "./heartbeat-record-chips";

  let {
    chip = null,
    kind = chip?.kind ?? "unknown",
    label = chip?.label ?? "",
    title = chip?.title ?? String(kind),
    class: className = "",
    animated = false,
    sticky = false,
    size = 15,
  }: {
    chip?: HeartbeatRecordChip | null;
    kind?: HeartbeatRecordChipKind | "compact" | "config";
    label?: string;
    title?: string;
    class?: string;
    animated?: boolean;
    sticky?: boolean;
    size?: number;
  } = $props();

  const visualKind = $derived(chip?.kind ?? kind);
  const visualLabel = $derived(chip?.label ?? label);
  const visualTitle = $derived(chip?.title ?? title);
</script>

<span
  class={`ag-heartbeat-record-chip ${className}`}
  class:ag-heartbeat-record-chip--combo={visualKind === "combo"}
  class:ag-heartbeat-record-chip--pending={visualKind === "pending"}
  class:ag-heartbeat-record-chip--error={visualKind === "error"}
  class:ag-heartbeat-record-chip--animated={animated}
  class:ag-heartbeat-record-chip--sticky={sticky}
  data-chip-kind={visualKind}
  title={visualTitle}
>
  <HeartbeatRecordIcon kind={visualKind} {size} />
  {#if visualLabel}
    <span class="ag-heartbeat-record-chip__label">{visualLabel}</span>
  {/if}
</span>

<style>
  .ag-heartbeat-record-chip {
    box-sizing: border-box;
    display: inline-grid;
    grid-auto-flow: column;
    grid-auto-columns: max-content;
    align-items: center;
    justify-content: center;
    min-width: 0;
    max-inline-size: 8.8rem;
    gap: 0.26rem;
    border: 1px solid color-mix(in srgb, currentColor, transparent 86%);
    border-radius: 999px;
    padding: 0.18rem 0.48rem;
    color: color-mix(in srgb, currentColor, transparent 12%);
    font: 600 0.72rem/1.16 system-ui, sans-serif;
    white-space: nowrap;
  }

  .ag-heartbeat-record-chip__label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ag-heartbeat-record-chip--sticky {
    position: sticky;
    inset-block-start: 0.5rem;
    min-inline-size: 2.2rem;
    padding: 0.22rem 0.48rem;
  }

  .ag-heartbeat-record-chip[data-chip-kind="input"] {
    background: color-mix(in oklab, Canvas, hsl(210 80% 52%) 7%);
  }

  .ag-heartbeat-record-chip[data-chip-kind="thinking"] {
    background: color-mix(in oklab, Canvas, hsl(262 60% 50%) 8%);
  }

  .ag-heartbeat-record-chip[data-chip-kind="tool"] {
    background: color-mix(in oklab, Canvas, hsl(35 82% 46%) 9%);
  }

  .ag-heartbeat-record-chip[data-chip-kind="text"],
  .ag-heartbeat-record-chip[data-chip-kind="compact"],
  .ag-heartbeat-record-chip[data-chip-kind="config"] {
    background: color-mix(in oklab, Canvas, hsl(152 55% 39%) 8%);
  }

  .ag-heartbeat-record-chip--combo {
    background: color-mix(in oklab, Canvas, currentColor 7%);
  }

  .ag-heartbeat-record-chip--pending {
    border-style: dashed;
  }

  .ag-heartbeat-record-chip--animated {
    animation: ag-heartbeat-record-chip-breathe 1.6s ease-in-out infinite;
  }

  .ag-heartbeat-record-chip--error {
    color: color-mix(in srgb, red, currentColor 24%);
  }

  @media (max-width: 420px) {
    .ag-heartbeat-record-chip__label {
      max-inline-size: 3.8rem;
    }
  }

  @keyframes ag-heartbeat-record-chip-breathe {
    0%,
    100% {
      opacity: 0.72;
    }
    50% {
      opacity: 1;
    }
  }
</style>
