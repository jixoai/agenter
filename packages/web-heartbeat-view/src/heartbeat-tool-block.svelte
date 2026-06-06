<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";

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
  const stateAriaLabel = $derived(`Tool ${stateLabel}`);
</script>

<details class="ag-heartbeat-tool" open={shouldOpen} data-tool-state={block.state}>
  <summary class="ag-heartbeat-tool__summary">
    <span class="ag-heartbeat-tool__state-icon" aria-label={stateAriaLabel} title={stateAriaLabel}>
      {#if block.state === "output-error"}
        <CircleAlert size={16} aria-hidden="true" />
      {:else if isRunning}
        <span class="ag-heartbeat-spin">
          <LoaderCircle size={16} aria-hidden="true" />
        </span>
      {:else}
        <CircleCheck size={16} aria-hidden="true" />
      {/if}
    </span>
    <span class="ag-heartbeat-tool__title">{block.tool}</span>
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
    box-sizing: border-box;
    inline-size: 100%;
    max-inline-size: 100%;
    min-width: 0;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, currentColor, transparent 84%);
    border-radius: 10px;
    background: color-mix(in srgb, Canvas, currentColor 3%);
  }

  .ag-heartbeat-tool__summary {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr) auto;
    box-sizing: border-box;
    inline-size: 100%;
    max-inline-size: 100%;
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
  .ag-heartbeat-tool__preview {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ag-heartbeat-tool__title {
    font: 600 0.78rem/1.2 system-ui, sans-serif;
  }

  .ag-heartbeat-tool__state-icon {
    display: inline-grid;
    place-items: center;
    color: color-mix(in srgb, currentColor, transparent 22%);
  }

  .ag-heartbeat-tool[data-tool-state="output-available"] .ag-heartbeat-tool__state-icon {
    color: #188038;
  }

  .ag-heartbeat-tool[data-tool-state="output-error"] .ag-heartbeat-tool__state-icon {
    color: #b00020;
  }

  .ag-heartbeat-tool[data-tool-state="input-streaming"] .ag-heartbeat-tool__state-icon,
  .ag-heartbeat-tool[data-tool-state="input-available"] .ag-heartbeat-tool__state-icon {
    color: #b45309;
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
    box-sizing: border-box;
    grid-template-columns: minmax(0, 1fr);
    inline-size: 100%;
    max-inline-size: 100%;
    min-inline-size: 0;
    overflow: hidden;
    gap: 0.6rem;
    padding: 0 0.65rem 0.65rem;
  }

  .ag-heartbeat-tool__body section {
    min-inline-size: 0;
    max-inline-size: 100%;
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
