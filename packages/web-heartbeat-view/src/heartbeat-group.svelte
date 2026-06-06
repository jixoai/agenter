<script lang="ts">
  import HeartbeatEntry from "./heartbeat-entry.svelte";
  import { buildHeartbeatSubjectSections, getHeartbeatGroupLabel } from "./heartbeat-parts";
  import type { HeartbeatGroupItem } from "./types";

  let {
    group,
    avatarLabel = "Avatar",
    sessionIconUrl = null,
  }: {
    group: HeartbeatGroupItem;
    avatarLabel?: string;
    sessionIconUrl?: string | null;
  } = $props();

  type HeartbeatLayoutMode = "compact" | "detailed";

  const groupLabel = $derived(getHeartbeatGroupLabel(group));
  const sections = $derived(buildHeartbeatSubjectSections(group));
  let layoutMode = $state<HeartbeatLayoutMode>("compact");
</script>

<div
  class="ag-heartbeat-group"
  data-heartbeat-group-key={group.groupId}
  data-testid={`heartbeat-group-${group.id}`}
  aria-label={`${avatarLabel} ${groupLabel}`}
>
  {#each sections as section (section.key)}
    <div class="ag-heartbeat-section" data-role={section.role} data-testid={`heartbeat-section-${section.key}`}>
      <div class="ag-heartbeat-avatar" aria-hidden="true">
        {#if sessionIconUrl}
          <img alt="" src={sessionIconUrl} />
        {:else}
          <span>{avatarLabel.slice(0, 1).toUpperCase()}</span>
        {/if}
      </div>
      <HeartbeatEntry
        {section}
        {layoutMode}
        {groupLabel}
        groupTimestamp={group.createdAt}
        presentation={group.kind === "compact" ? "compact-special" : "default"}
        onLayoutModeChange={(value) => {
          layoutMode = value;
        }}
      />
    </div>
  {/each}
</div>

<style>
  .ag-heartbeat-group {
    display: grid;
    box-sizing: border-box;
    grid-template-columns: minmax(0, 1fr);
    inline-size: 100%;
    max-inline-size: 100%;
    min-width: 0;
    gap: 0.75rem;
  }

  .ag-heartbeat-section {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    box-sizing: border-box;
    inline-size: 100%;
    max-inline-size: 100%;
    align-items: start;
    gap: 0.65rem;
    min-width: 0;
  }

  .ag-heartbeat-avatar {
    display: grid;
    place-items: center;
    inline-size: 2rem;
    block-size: 2rem;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, currentColor, transparent 82%);
    border-radius: 10px;
    background: color-mix(in srgb, Canvas, currentColor 6%);
    font: 700 0.78rem/1 system-ui, sans-serif;
  }

  .ag-heartbeat-avatar img {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }

  .ag-heartbeat-section[data-role="user"] {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .ag-heartbeat-section[data-role="user"] .ag-heartbeat-avatar {
    grid-column: 2;
    grid-row: 1;
  }

  @media (min-width: 760px) {
    .ag-heartbeat-section[data-role="system"],
    .ag-heartbeat-section[data-role="config"],
    .ag-heartbeat-section[data-role="tool"] {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .ag-heartbeat-section[data-role="system"] .ag-heartbeat-avatar,
    .ag-heartbeat-section[data-role="config"] .ag-heartbeat-avatar,
    .ag-heartbeat-section[data-role="tool"] .ag-heartbeat-avatar {
      grid-column: 2;
      grid-row: 1;
    }
  }
</style>
