<script lang="ts">
  import {
    formatHeartbeatPartTypeLabel,
    readHeartbeatPartText,
    toHeartbeatPartRawText,
  } from "./heartbeat-parts";
  import JsonViewerHost from "./json-viewer-host.svelte";
  import MarkdownDocumentHost from "./markdown-document-host.svelte";
  import type { HeartbeatPartItem } from "./types";

  let {
    part,
    layoutMode = "compact",
  }: {
    part: HeartbeatPartItem["parts"][number];
    layoutMode?: "compact" | "detailed";
  } = $props();

  const text = $derived(readHeartbeatPartText(part));
  const showMetaRow = $derived((part.mimeType ?? "").length > 0 || !part.isComplete);
  const showTypeLabel = $derived(!["text", "thinking", "compact"].includes(part.partType));
  const shouldOpenReasoning = $derived(layoutMode === "detailed" || !part.isComplete);
</script>

<section class="ag-heartbeat-part" data-part-type={part.partType}>
  {#if showTypeLabel || showMetaRow}
    <div class="ag-heartbeat-part__meta">
      {#if showTypeLabel}
        <span>{formatHeartbeatPartTypeLabel(part.partType)}</span>
      {/if}
      {#if part.mimeType}
        <span>{part.mimeType}</span>
      {/if}
      {#if !part.isComplete}
        <span>streaming</span>
      {/if}
    </div>
  {/if}

  {#if part.partType === "thinking"}
    <details class="ag-heartbeat-reasoning" open={shouldOpenReasoning}>
      <summary>Reasoning</summary>
      <MarkdownDocumentHost
        value={text ?? ""}
        mode="preview"
        usage="chat"
        surface="muted"
        syntaxTone="accented"
        padding="compact"
      />
    </details>
  {:else if text !== null}
    <MarkdownDocumentHost value={text} mode="preview" usage="chat" surface="muted" syntaxTone="accented" padding="compact" />
  {:else}
    <JsonViewerHost value={part.payload} rawText={toHeartbeatPartRawText(part)} />
  {/if}
</section>

<style>
  .ag-heartbeat-part {
    display: grid;
    min-width: 0;
    gap: 0.4rem;
  }

  .ag-heartbeat-part__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .ag-heartbeat-part__meta span {
    border: 1px solid color-mix(in srgb, currentColor, transparent 82%);
    border-radius: 999px;
    padding: 0.05rem 0.42rem;
    color: color-mix(in srgb, currentColor, transparent 32%);
    font: 500 0.68rem/1.35 system-ui, sans-serif;
  }

  .ag-heartbeat-reasoning {
    border-radius: 10px;
    background: color-mix(in srgb, Canvas, currentColor 4%);
    padding: 0.55rem;
  }

  .ag-heartbeat-reasoning summary {
    cursor: pointer;
    color: color-mix(in srgb, currentColor, transparent 28%);
    font: 600 0.78rem/1.3 system-ui, sans-serif;
  }
</style>
