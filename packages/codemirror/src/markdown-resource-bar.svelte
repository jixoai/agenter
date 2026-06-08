<script lang="ts">
  import type { MarkdownPreviewTone, MarkdownResourceReference } from "./types";

  let {
    resources,
    tone = "participant",
    onOpenResource,
  }: {
    resources: readonly MarkdownResourceReference[];
    tone?: MarkdownPreviewTone;
    onOpenResource?: ((resource: MarkdownResourceReference) => void) | undefined;
  } = $props();
</script>

{#if resources.length > 0}
  <div class="jixo-cm-markdown-resource-bar" part="markdown-resources" data-tone={tone}>
    {#each resources as resource (resource.id)}
      <button
        type="button"
        part="markdown-resource"
        class="jixo-cm-markdown-resource"
        title={resource.fileName ?? resource.detailText ?? resource.tokenText ?? resource.label}
        onclick={() => {
          onOpenResource?.(resource);
        }}
      >
        {resource.label}
      </button>
    {/each}
  </div>
{/if}

<style>
  .jixo-cm-markdown-resource-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.28rem;
    align-items: center;
    box-sizing: border-box;
    max-inline-size: 100%;
    margin-top: 0.22rem;
    overflow: visible;
    padding: 0;
  }

  .jixo-cm-markdown-resource {
    border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
    border-radius: 999px;
    padding: 0.18rem 0.45rem;
    background: color-mix(in srgb, currentColor 7%, transparent);
    color: inherit;
    font: inherit;
    font-size: 0.82em;
    line-height: 1.2;
    cursor: pointer;
  }
</style>
