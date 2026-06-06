<script lang="ts">
  import HeartbeatRecordIcon from "./heartbeat-record-icon.svelte";
  import {
    buildHeartbeatRecordChipToneStyle,
    buildHeartbeatRecordChipTokens,
    type HeartbeatRecordChip,
    type HeartbeatRecordChipToken,
    type HeartbeatRecordToneKind,
  } from "./heartbeat-record-chips";

  type HeartbeatRecordDensity = "narrow" | "medium" | "full";

  let {
    chip = null,
    kind = chip?.kind ?? "unknown",
    label = chip?.label ?? "",
    title = chip?.title ?? String(kind),
    class: className = "",
    animated = false,
    sticky = false,
    size = 14,
    density = "full",
  }: {
    chip?: HeartbeatRecordChip | null;
    kind?: HeartbeatRecordToneKind;
    label?: string;
    title?: string;
    class?: string;
    animated?: boolean;
    sticky?: boolean;
    size?: number;
    density?: HeartbeatRecordDensity;
  } = $props();

  const visualKind = $derived(chip?.kind ?? kind);
  const visualLabel = $derived(chip?.label ?? label);
  const visualTitle = $derived(chip?.title ?? title);

  const fallbackTokens = (currentKind: HeartbeatRecordToneKind, currentLabel: string, currentTitle: string): HeartbeatRecordChipToken[] => [
    {
      kind: currentKind,
      label: currentLabel,
      title: currentTitle,
    },
  ];

  const visualTokens = $derived.by(() => {
    if (chip) {
      return buildHeartbeatRecordChipTokens(chip, density);
    }
    return fallbackTokens(visualKind, visualLabel, visualTitle);
  });

  const toneKinds = $derived.by(() => {
    const kinds = visualTokens.map((token) => token.kind);
    return kinds.length > 0 ? kinds : [visualKind];
  });

  const toneStyle = $derived(buildHeartbeatRecordChipToneStyle(toneKinds));
  const iconOnly = $derived(visualTokens.length === 1 && visualTokens[0]?.label.length === 0);
</script>

<span
  class={`ag-heartbeat-record-chip ${className}`}
  class:ag-heartbeat-record-chip--combo={visualKind === "combo"}
  class:ag-heartbeat-record-chip--pending={visualKind === "pending"}
  class:ag-heartbeat-record-chip--error={visualKind === "error"}
  class:ag-heartbeat-record-chip--animated={animated}
  class:ag-heartbeat-record-chip--sticky={sticky}
  class:ag-heartbeat-record-chip--icon-only={iconOnly}
  data-chip-kind={visualKind}
  data-chip-density={density}
  style={toneStyle}
  title={visualTitle}
>
  {#each visualTokens as token (token.kind + ":" + token.label + ":" + token.title)}
    <span class={`ag-heartbeat-record-chip__token ag-heartbeat-record-chip__token--${token.kind}`} title={token.title}>
      <HeartbeatRecordIcon kind={token.kind} {size} />
      {#if token.label}
        <span class="ag-heartbeat-record-chip__label">{token.label}</span>
      {/if}
    </span>
  {/each}
</span>

<style>
  .ag-heartbeat-record-chip {
    box-sizing: border-box;
    display: inline-flex;
    position: relative;
    align-items: center;
    gap: 5px;
    min-width: 0;
    max-inline-size: 8.8rem;
    border: 1px solid transparent;
    border-image: var(--chip-border-gradient) 1;
    border-image-width: 0;
    border-radius: 999px;
    background-color: var(--tone-surface, Canvas);
    background-image: var(--chip-bg-gradient);
    background-clip: padding-box;
    padding: 6px 9px;
    color: var(--chip-ink, var(--tone-ink-soft, #344054));
    font: 600 10.75px/1 system-ui, sans-serif;
    white-space: nowrap;
    isolation: isolate;
  }

  .ag-heartbeat-record-chip::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: var(--chip-border-gradient);
    padding: 1px;
    pointer-events: none;
    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    mask-composite: exclude;
  }

  .ag-heartbeat-record-chip > * {
    position: relative;
    z-index: 1;
  }

  .ag-heartbeat-record-chip--icon-only {
    padding: 6px;
  }

  .ag-heartbeat-record-chip--sticky {
    position: sticky;
    inset-block-start: 0.5rem;
  }

  .ag-heartbeat-record-chip--pending {
    border-style: dashed;
  }

  .ag-heartbeat-record-chip--error {
    color: color-mix(in oklch, var(--kind-error, #dc2626), black 10%);
  }

  .ag-heartbeat-record-chip--animated {
    animation: ag-heartbeat-record-chip-breathe 1.6s ease-in-out infinite;
  }

  .ag-heartbeat-record-chip__token {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    line-height: 1;
  }

  .ag-heartbeat-record-chip__label {
    display: inline-block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ag-heartbeat-record-chip__token--input,
  .ag-heartbeat-record-chip__token--combo,
  .ag-heartbeat-record-chip__token--compact,
  .ag-heartbeat-record-chip__token--config {
    font-weight: 720;
  }

  .ag-heartbeat-record-chip__token :global(svg) {
    flex: 0 0 auto;
  }

  .ag-heartbeat-record-chip[data-chip-density="narrow"] {
    gap: 3px;
  }

  .ag-heartbeat-record-chip[data-chip-density="narrow"] .ag-heartbeat-record-chip__label {
    max-inline-size: 3.8rem;
  }

  @keyframes ag-heartbeat-record-chip-breathe {
    0%,
    100% {
      opacity: 0.74;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.018);
    }
  }
</style>
