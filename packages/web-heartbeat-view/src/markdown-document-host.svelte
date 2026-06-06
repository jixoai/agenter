<script lang="ts">
  import {
    MARKDOWN_DOCUMENT_TAG,
    defineMarkdownDocument,
    type MarkdownDocumentChrome,
    type MarkdownDocumentDensity,
    type MarkdownDocumentElementType,
    type MarkdownDocumentMode,
    type MarkdownDocumentOverflow,
    type MarkdownDocumentPadding,
    type MarkdownDocumentSurface,
    type MarkdownDocumentSyntaxTone,
    type MarkdownDocumentUsage,
  } from "@agenter/web-components";

  defineMarkdownDocument();

  let {
    value,
    mode = "preview",
    usage = "chat",
    surface = "",
    overflow = "",
    syntaxTone = "",
    chrome = "",
    density = "",
    padding = "default",
    minHeight = 0,
    maxHeight = 0,
    class: className = "",
  }: {
    value: string;
    mode?: MarkdownDocumentMode;
    usage?: MarkdownDocumentUsage;
    surface?: MarkdownDocumentSurface | "";
    overflow?: MarkdownDocumentOverflow | "";
    syntaxTone?: MarkdownDocumentSyntaxTone | "";
    chrome?: MarkdownDocumentChrome | "";
    density?: MarkdownDocumentDensity | "";
    padding?: MarkdownDocumentPadding | "default" | "none";
    minHeight?: number;
    maxHeight?: number;
    class?: string;
  } = $props();

  let element: MarkdownDocumentElementType | null = null;

  const syncProps = (): void => {
    if (!element) {
      return;
    }
    element.value = value;
    element.mode = mode;
    element.usage = usage;
    element.surface = surface;
    element.overflow = overflow;
    element.syntaxTone = syntaxTone;
    element.chrome = chrome;
    element.density = density;
    element.padding = padding;
    element.minHeight = minHeight;
    element.maxHeight = maxHeight;
  };

  $effect(() => {
    syncProps();
  });

  const hostClass = $derived(["ag-heartbeat-markdown-host", className].filter(Boolean).join(" "));
</script>

<svelte:element this={MARKDOWN_DOCUMENT_TAG} bind:this={element} class={hostClass}></svelte:element>

<style>
  :global(.ag-heartbeat-markdown-host) {
    display: block;
    box-sizing: border-box;
    inline-size: 100%;
    max-inline-size: 100%;
    min-inline-size: 0;
    contain: inline-size;
    overflow-wrap: anywhere;
  }
</style>
