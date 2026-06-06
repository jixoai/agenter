<script lang="ts">
  import { JSON_VIEWER_TAG, defineJsonViewer, type JsonViewerElementType } from "@agenter/web-components";

  defineJsonViewer();

  let {
    value,
    rawText = "",
    menuLabel = "Structured value options",
    class: className = "",
  }: {
    value: unknown;
    rawText?: string;
    menuLabel?: string;
    class?: string;
  } = $props();

  let element: JsonViewerElementType | null = null;

  const syncProps = (): void => {
    if (!element) {
      return;
    }
    element.value = value;
    element.rawText = rawText;
    element.menuLabel = menuLabel;
  };

  $effect(() => {
    syncProps();
  });

  const hostClass = $derived(["ag-heartbeat-json-viewer", className].filter(Boolean).join(" "));
</script>

<svelte:element this={JSON_VIEWER_TAG} bind:this={element} class={hostClass}></svelte:element>

<style>
  :global(.ag-heartbeat-json-viewer) {
    display: block;
    box-sizing: border-box;
    inline-size: 100%;
    max-inline-size: 100%;
    min-inline-size: 0;
    contain: inline-size;
    overflow: auto;
  }
</style>
