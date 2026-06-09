<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Copy from "@lucide/svelte/icons/copy";

  import HeartbeatPartContent from "./heartbeat-part-content.svelte";
  import type { HeartbeatSubjectSection } from "./heartbeat-parts";
  import {
    buildHeartbeatSectionClipboardText,
    getHeartbeatRowPreview,
    getHeartbeatSectionTimeMeta,
    readHeartbeatPartText,
  } from "./heartbeat-parts";
  import HeartbeatToolBlock from "./heartbeat-tool-block.svelte";
  import { formatRuntimeCompactDuration, formatRuntimeCompactTimestamp } from "./runtime-format";

  type HeartbeatLayoutMode = "compact" | "detailed";
  type HeartbeatEntryPresentation = "default" | "compact-special";

  let {
    section,
    layoutMode = "compact",
    groupLabel,
    groupTimestamp,
    presentation = "default",
    onLayoutModeChange = undefined,
    allowLayoutModeSwitch = true,
  }: {
    section: HeartbeatSubjectSection;
    layoutMode?: HeartbeatLayoutMode;
    groupLabel: string;
    groupTimestamp: number;
    presentation?: HeartbeatEntryPresentation;
    onLayoutModeChange?: ((mode: HeartbeatLayoutMode) => void) | undefined;
    allowLayoutModeSwitch?: boolean;
  } = $props();

  let localLayoutMode = $state<HeartbeatLayoutMode>("compact");
  let nowMs = $state(Date.now());

  const summary = $derived(section.entries[0] ? getHeartbeatRowPreview(section.entries[0]) : "");
  const compactSpecialPreludeBlocks = $derived.by(() =>
    presentation === "compact-special"
      ? section.blocks.filter((block) => !(block.content.kind === "part" && block.content.part.partType === "compact"))
      : [],
  );
  const compactSpecialResponseBlocks = $derived.by(() =>
    presentation === "compact-special"
      ? section.blocks.filter((block) => block.content.kind === "part" && block.content.part.partType === "compact")
      : [],
  );
  const compactSpecialResponseText = $derived.by(() => {
    if (presentation !== "compact-special") {
      return null;
    }
    const compactBlock = compactSpecialResponseBlocks[0]?.content;
    if (!compactBlock || compactBlock.kind !== "part") {
      return null;
    }
    return readHeartbeatPartText(compactBlock.part)?.trim() ?? null;
  });
  const showCompactSpecialPrelude = $derived(
    presentation === "compact-special" && compactSpecialPreludeBlocks.length > 0 && localLayoutMode === "detailed",
  );
  const compactCheckpointText = $derived.by(() => {
    const firstBlock = section.blocks[0]?.content;
    if (!firstBlock || section.blocks.length !== 1 || firstBlock.kind !== "part" || firstBlock.part.partType !== "compact") {
      return null;
    }
    return readHeartbeatPartText(firstBlock.part)?.trim() ?? summary;
  });
  const shouldShowLayoutModeSwitch = $derived.by(() => {
    if (!allowLayoutModeSwitch) {
      return false;
    }
    if (presentation === "compact-special" && compactSpecialPreludeBlocks.length > 0) {
      return true;
    }
    return section.blocks.some((block) => {
      if (block.content.kind === "tool") {
        return true;
      }
      return block.content.part.partType === "thinking";
    });
  });
  const hasRunningEntries = $derived(section.entries.some((entry) => !entry.isComplete));
  const timeMeta = $derived(getHeartbeatSectionTimeMeta(section, nowMs));
  const headerTimeLabel = $derived.by(() => {
    const startedAt = timeMeta.startedAt ?? groupTimestamp;
    const startedAtLabel = formatRuntimeCompactTimestamp(startedAt);
    if (!timeMeta.showRange) {
      return startedAtLabel;
    }
    return `${startedAtLabel}, ${formatRuntimeCompactDuration(timeMeta.durationMs)}`;
  });

  const setLayoutMode = (mode: HeartbeatLayoutMode): void => {
    localLayoutMode = mode;
    onLayoutModeChange?.(mode);
  };

  const copySection = async (): Promise<void> => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }
    await navigator.clipboard.writeText(buildHeartbeatSectionClipboardText(section));
  };

  $effect(() => {
    if (localLayoutMode !== layoutMode) {
      localLayoutMode = layoutMode;
    }
  });

  $effect(() => {
    nowMs = Date.now();
    if (!hasRunningEntries || typeof window === "undefined") {
      return;
    }
    const interval = window.setInterval(() => {
      nowMs = Date.now();
    }, 1_000);
    return () => {
      window.clearInterval(interval);
    };
  });
</script>

<section class="ag-heartbeat-entry" data-testid={`heartbeat-entry-${section.entryId}`} data-layout-mode={localLayoutMode}>
  <header class="ag-heartbeat-entry__header">
    <span class="ag-heartbeat-badge">{groupLabel}</span>
    <time title={timeMeta.isRunning ? `Running for ${formatRuntimeCompactDuration(timeMeta.durationMs)}` : undefined}>
      {headerTimeLabel}
    </time>
    <button type="button" class="ag-heartbeat-icon-button" title="Copy section" aria-label="Copy section" onclick={() => void copySection()}>
      <Copy size={14} />
    </button>
  </header>

  <div class="ag-heartbeat-entry__body">
    {#if presentation === "compact-special" && compactSpecialPreludeBlocks.length > 0}
      <section class="ag-heartbeat-compact-prelude">
        <div class="ag-heartbeat-compact-prelude__title">Compact prompt facts</div>
        {#if showCompactSpecialPrelude}
          {#each compactSpecialPreludeBlocks as block (block.key)}
            {#if block.content.kind === "tool"}
              <HeartbeatToolBlock block={block.content} forceOpen layoutMode={localLayoutMode} />
            {:else}
              <HeartbeatPartContent part={block.content.part} layoutMode={localLayoutMode} />
            {/if}
          {/each}
        {:else}
          <div class="ag-heartbeat-muted">Switch to Detailed to inspect the exact compact prompt facts.</div>
        {/if}
      </section>
    {/if}

    {#if presentation === "compact-special" && compactSpecialResponseText}
      <div class="ag-heartbeat-checkpoint">{compactSpecialResponseText}</div>
    {:else if compactCheckpointText}
      <div class="ag-heartbeat-checkpoint">{compactCheckpointText}</div>
    {:else}
      {#each presentation === "compact-special" ? compactSpecialResponseBlocks : section.blocks as block (block.key)}
        {#if block.content.kind === "tool"}
          <HeartbeatToolBlock block={block.content} layoutMode={localLayoutMode} />
        {:else}
          <HeartbeatPartContent part={block.content.part} layoutMode={localLayoutMode} />
        {/if}
      {/each}
      {#if section.blocks.length === 0 && summary}
        <div class="ag-heartbeat-muted">{summary}</div>
      {/if}
    {/if}
  </div>

  {#if shouldShowLayoutModeSwitch}
    <footer class="ag-heartbeat-entry__footer">
      <div class="ag-heartbeat-segmented" role="group" aria-label="Heartbeat row layout">
        <button type="button" class:active={localLayoutMode === "compact"} onclick={() => setLayoutMode("compact")}>Compact</button>
        <button type="button" class:active={localLayoutMode === "detailed"} onclick={() => setLayoutMode("detailed")}>Detailed</button>
      </div>
      <ChevronDown size={15} aria-hidden="true" />
    </footer>
  {/if}
</section>

<style>
  .ag-heartbeat-entry {
    display: grid;
    box-sizing: border-box;
    grid-template-columns: minmax(0, 1fr);
    inline-size: 100%;
    max-inline-size: 100%;
    min-width: 0;
    overflow: hidden;
    gap: 0.65rem;
    border: 1px solid color-mix(in srgb, currentColor, transparent 86%);
    border-radius: 14px;
    background: color-mix(in srgb, Canvas, currentColor 2%);
    padding: 0.78rem;
    box-shadow: 0 12px 28px -26px color-mix(in srgb, currentColor, transparent 20%);
  }

  .ag-heartbeat-entry__header,
  .ag-heartbeat-entry__footer {
    display: flex;
    box-sizing: border-box;
    inline-size: 100%;
    max-inline-size: 100%;
    min-width: 0;
    align-items: center;
    gap: 0.45rem;
  }

  .ag-heartbeat-entry__header time {
    min-inline-size: 0;
    overflow: hidden;
    color: color-mix(in srgb, currentColor, transparent 40%);
    text-overflow: ellipsis;
    white-space: nowrap;
    font: 0.72rem/1.2 system-ui, sans-serif;
  }

  .ag-heartbeat-entry__body {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    inline-size: 100%;
    max-inline-size: 100%;
    min-width: 0;
    overflow: hidden;
    gap: 0.55rem;
  }

  .ag-heartbeat-badge {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, currentColor, transparent 82%);
    border-radius: 999px;
    padding: 0.12rem 0.48rem;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: 600 0.68rem/1.25 system-ui, sans-serif;
  }

  .ag-heartbeat-icon-button {
    display: inline-grid;
    place-items: center;
    margin-inline-start: auto;
    border: 1px solid color-mix(in srgb, currentColor, transparent 84%);
    border-radius: 999px;
    background: transparent;
    color: inherit;
    inline-size: 1.8rem;
    block-size: 1.8rem;
  }

  .ag-heartbeat-segmented {
    display: inline-grid;
    grid-auto-flow: column;
    max-inline-size: 100%;
    gap: 0.15rem;
    border: 1px solid color-mix(in srgb, currentColor, transparent 84%);
    border-radius: 999px;
    padding: 0.15rem;
  }

  .ag-heartbeat-segmented button {
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: inherit;
    padding: 0.18rem 0.55rem;
    font: 600 0.7rem/1.2 system-ui, sans-serif;
  }

  .ag-heartbeat-segmented button.active {
    background: color-mix(in srgb, currentColor, transparent 88%);
  }

  .ag-heartbeat-compact-prelude,
  .ag-heartbeat-checkpoint {
    display: grid;
    box-sizing: border-box;
    grid-template-columns: minmax(0, 1fr);
    inline-size: 100%;
    max-inline-size: 100%;
    min-inline-size: 0;
    overflow-wrap: anywhere;
    gap: 0.5rem;
    border: 1px dashed color-mix(in srgb, currentColor, transparent 78%);
    border-radius: 10px;
    background: color-mix(in srgb, Canvas, currentColor 4%);
    padding: 0.65rem;
  }

  .ag-heartbeat-compact-prelude__title {
    color: color-mix(in srgb, currentColor, transparent 38%);
    font: 700 0.68rem/1.3 system-ui, sans-serif;
    text-transform: uppercase;
  }

  .ag-heartbeat-muted {
    color: color-mix(in srgb, currentColor, transparent 38%);
    font: 0.78rem/1.45 system-ui, sans-serif;
  }
</style>
