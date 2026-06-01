<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import Wrench from "@lucide/svelte/icons/wrench";

  import type { HeartbeatDisplayBlock } from "./heartbeat-parts";
  import { getHeartbeatToolPreview } from "./heartbeat-parts";
  import JsonViewerHost from "./json-viewer-host.svelte";

  let {
    block,
    forceOpen = false,
    layoutMode = "detailed",
  }: {
    block: Extract<HeartbeatDisplayBlock, { kind: "tool" }>;
    forceOpen?: boolean;
    layoutMode?: "compact" | "detailed";
  } = $props();

  const shouldOpen = $derived(forceOpen || layoutMode === "detailed" || block.state !== "output-available");
  const preview = $derived(getHeartbeatToolPreview(block.input));
  const isRunning = $derived(block.state === "input-streaming" || block.state === "input-available");
  const stateLabel = $derived(
    block.state === "output-error"
      ? "error"
      : block.state === "output-available"
        ? "done"
        : block.state === "input-streaming"
          ? "streaming"
          : "running",
  );
</script>

<details class="ag-heartbeat-tool" open={shouldOpen} data-tool-state={block.state}>
  <summary class="ag-heartbeat-tool__summary">
    <span class="ag-heartbeat-tool__icon" aria-hidden="true">
      {#if block.state === "output-error"}
        <CircleAlert size={15} />
      {:else if isRunning}
        <span class="ag-heartbeat-spin">
          <LoaderCircle size={15} />
        </span>
      {:else}
        <Wrench size={15} />
      {/if}
    </span>
    <span class="ag-heartbeat-tool__title">{block.tool}</span>
    <span class="ag-heartbeat-tool__state">{stateLabel}</span>
    {#if preview}
      <span class="ag-heartbeat-tool__preview">{preview}</span>
    {/if}
    <span class="ag-heartbeat-tool__chevron" aria-hidden="true">
      <ChevronDown size={15} />
    </span>
  </summary>
  <div class="ag-heartbeat-tool__body">
    <section>
      <div class="ag-heartbeat-tool__label">Input</div>
      <JsonViewerHost value={block.input} rawText={JSON.stringify(block.input, null, 2)} />
    </section>
    {#if block.output !== undefined || block.errorText}
      <section>
        <div class="ag-heartbeat-tool__label">{block.errorText ? "Error" : "Output"}</div>
        <JsonViewerHost
          value={block.errorText ? { error: block.errorText } : block.output}
          rawText={JSON.stringify(block.errorText ? { error: block.errorText } : block.output, null, 2)}
        />
      </section>
    {/if}
  </div>
</details>

<style>
  .ag-heartbeat-tool {
    min-width: 0;
    border: 1px solid color-mix(in srgb, currentColor, transparent 84%);
    border-radius: 10px;
    background: color-mix(in srgb, Canvas, currentColor 3%);
  }

  .ag-heartbeat-tool__summary {
    display: grid;
    grid-template-columns: auto auto auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
    padding: 0.55rem 0.65rem;
    cursor: pointer;
    list-style: none;
  }

  .ag-heartbeat-tool__summary::-webkit-details-marker {
    display: none;
  }

  .ag-heartbeat-tool__title,
  .ag-heartbeat-tool__state,
  .ag-heartbeat-tool__preview {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ag-heartbeat-tool__title {
    font: 600 0.78rem/1.2 system-ui, sans-serif;
  }

  .ag-heartbeat-tool__state {
    border-radius: 999px;
    padding: 0.08rem 0.4rem;
    background: color-mix(in srgb, currentColor, transparent 90%);
    font: 500 0.67rem/1.35 system-ui, sans-serif;
    text-transform: uppercase;
  }

  .ag-heartbeat-tool__preview {
    color: color-mix(in srgb, currentColor, transparent 34%);
    font: 0.75rem/1.25 ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .ag-heartbeat-tool__chevron {
    display: inline-grid;
    place-items: center;
    justify-self: end;
    transition: transform 160ms ease;
  }

  .ag-heartbeat-tool[open] .ag-heartbeat-tool__chevron {
    transform: rotate(180deg);
  }

  .ag-heartbeat-tool__body {
    display: grid;
    gap: 0.6rem;
    padding: 0 0.65rem 0.65rem;
  }

  .ag-heartbeat-tool__label {
    margin-block-end: 0.25rem;
    color: color-mix(in srgb, currentColor, transparent 38%);
    font: 600 0.68rem/1.3 system-ui, sans-serif;
    text-transform: uppercase;
  }

  .ag-heartbeat-spin {
    display: inline-grid;
    place-items: center;
    animation: ag-heartbeat-spin 1s linear infinite;
  }

  @keyframes ag-heartbeat-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
