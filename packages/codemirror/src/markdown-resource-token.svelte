<script lang="ts">
  import type { MarkdownPreviewTone, MarkdownResourceReference } from "./types";

  let {
    resource,
    tone = "participant",
    onOpen,
  }: {
    resource: MarkdownResourceReference;
    tone?: MarkdownPreviewTone;
    onOpen?: (() => void) | undefined;
  } = $props();

  const tokenTitle = $derived(resource.fileName ?? resource.detailText ?? resource.tokenText ?? resource.label);
</script>

<span
  role="button"
  tabindex="0"
  class="jixo-cm-markdown-resource-token"
  data-tone={tone}
  data-kind={resource.kind}
  part="markdown-resource-token"
  aria-label={`Open ${resource.kind} resource ${resource.label}`}
  title={tokenTitle}
  onclick={() => {
    onOpen?.();
  }}
  onkeydown={(event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen?.();
    }
  }}
>
  {resource.label}
</span>

<style>
  .jixo-cm-markdown-resource-token {
    display: inline-flex;
    align-items: baseline;
    max-inline-size: 100%;
    border-radius: 0.38em;
    padding: 0 0.2em;
    color: var(--md-link, currentColor);
    font: inherit;
    font-size: 1em;
    font-weight: 600;
    line-height: 1.1;
    text-decoration: none;
    white-space: nowrap;
    vertical-align: -0.12em;
    cursor: pointer;
  }

  .jixo-cm-markdown-resource-token:hover {
    background: color-mix(in srgb, currentColor 10%, transparent);
  }

  .jixo-cm-markdown-resource-token:focus-visible {
    background: color-mix(in srgb, currentColor 12%, transparent);
    outline: 2px solid color-mix(in srgb, currentColor 24%, transparent);
    outline-offset: 2px;
  }
</style>
