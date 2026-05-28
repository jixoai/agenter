<script lang="ts">
  import ResourceCard from "../resource-card.svelte";
  import type { WebChatResourceReference } from "../types";

  let {
    resources,
    tone = "participant",
    onOpenResource,
  }: {
    resources: readonly WebChatResourceReference[];
    tone?: "assistant" | "participant" | "viewer";
    onOpenResource?: ((resource: WebChatResourceReference) => void) | undefined;
  } = $props();
</script>

{#if resources.length > 0}
  <div class="message-markdown-resource-bar" part="message-attachments" data-tone={tone}>
    {#each resources as resource (resource.id)}
      <div part="message-attachment">
        <ResourceCard
          {resource}
          mode="sent"
          {tone}
          onOpen={() => {
            onOpenResource?.(resource);
          }}
        />
      </div>
    {/each}
  </div>
{/if}

<style>
  .message-markdown-resource-bar {
    display: inline-flex;
    gap: 0.24rem;
    align-items: center;
    max-width: 100%;
    margin-top: 0.18rem;
    overflow-x: auto;
    padding-bottom: 0.04rem;
    scrollbar-width: thin;
  }

  .message-markdown-resource-bar > [part="message-attachment"] {
    flex: 0 0 auto;
    min-width: 0;
  }
</style>
